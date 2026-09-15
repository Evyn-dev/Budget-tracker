import { describe, it, expect, vi } from 'vitest';
import { emptyBudget, validateBudget, validateImport } from '../src/utils/budgetDocument';
import { createDemoData } from '../src/utils/demoData';
import { readLegacy, readDraft, writeDraft, readDemo, saveDemo, DEMO_KEY } from '../src/utils/storage';
import { SaveQueue, ConflictError, reconcileDraft, cloudRepository } from '../src/utils/cloudStorage';
import { createBudgetBackupText, readBudgetBackupText } from '../src/utils/backup';

function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, val) => map.set(key, val), removeItem: key => map.delete(key) };
}
const document = n => ({ ...emptyBudget(), transactions: [{ id: n, amount: n, type: 'income', category: 'Paycheck', date: '2026-09-14', note: '', paymentMethod: null }] });
function queue(repository, draft = { data: document(1), revision: 0, pending: true, operation: null }) {
  return new SaveQueue({ repository, draft, userId: 'user-a', storage: memoryStorage(), onStatus: vi.fn(), delay: 60000 });
}

describe('isolated persistence and recovery', () => {
  it('does not save unchanged JSONB data when nested object keys are reordered', async () => {
    const original = document(1);
    const reordered = JSON.parse(JSON.stringify(original, (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).reverse()) : item));
    const repository = { save: vi.fn().mockResolvedValue({ revision: 2 }) };
    const q = queue(repository, { data: reordered, revision: 1, pending: false, operation: null });
    q.update(original);
    await q.flush();
    expect(repository.save).not.toHaveBeenCalled();
    q.update(document(2));
    await q.flush();
    expect(repository.save).toHaveBeenCalledTimes(1);
    q.stop();
  });
  it('seeds editable demo data without touching legacy or account drafts', () => {
    const storage = memoryStorage();
    storage.setItem('transactions', JSON.stringify(document(1).transactions));
    writeDraft('user-a', { data: document(2), revision: 2, pending: true }, storage);
    const seed = () => createDemoData(new Date('2026-09-14T12:00:00'));
    const data = readDemo(seed, storage); data.transactions = [];
    saveDemo(data, storage);
    expect(readDemo(seed, storage).transactions).toEqual([]);
    expect(readDraft('user-a', storage).data.transactions[0].amount).toBe(2);
    expect(readLegacy(storage).transactions[0].amount).toBe(1);
    saveDemo(seed(), storage);
    expect(readDemo(seed, storage).transactions.length).toBeGreaterThan(10);
    expect(readDraft('user-b', storage)).toBeNull();
    expect(storage.getItem(DEMO_KEY)).toBeTruthy();
  });
  it('retains legacy bytes after preparing migration and reports corrupt data', () => {
    const storage = memoryStorage(); const original = JSON.stringify(document(10).transactions);
    storage.setItem('transactions', original);
    writeDraft('user-a', { data: readLegacy(storage), pending: true, revision: 0 }, storage);
    expect(storage.getItem('transactions')).toBe(original);
    storage.setItem('transactions', '{invalid');
    expect(() => readLegacy(storage)).toThrow('untouched');
  });
  it('serializes saves and preserves edits made while a request is in flight', async () => {
    let resolve;
    const repository = { save: vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ revision: 2 }) };
    const q = queue(repository); const first = q.flush();
    q.update(document(3)); resolve({ revision: 1 });
    expect(await first).toBe(true);
    expect(repository.save.mock.calls.map(c => [c[0].transactions[0].amount, c[1]])).toEqual([[1, 0], [3, 1]]);
    expect(q.draft.pending).toBe(false); q.stop();
  });
  it('retries an uncertain request with the same ID and snapshot', async () => {
    const repository = { save: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ revision: 1 }) };
    const q = queue(repository);
    expect(await q.flush()).toBe(false);
    expect(readDraft('user-a', q.storage).pending).toBe(true);
    expect(await q.flush()).toBe(true);
    expect(repository.save.mock.calls[0]).toEqual(repository.save.mock.calls[1]); q.stop();
  });
  it('recovers a saved response lost before reload, including newer local edits', () => {
    const row = { data: document(1), revision: 5, last_write_id: 'write-a' };
    const draft = { data: document(2), revision: 4, pending: true, operation: { id: 'write-a', data: document(1) } };
    expect(reconcileDraft(row, draft)).toMatchObject({ revision: 5, pending: true, operation: null });
    expect(reconcileDraft(row, { ...draft, data: document(1) }).pending).toBe(false);
    expect(() => reconcileDraft({ ...row, last_write_id: 'other' }, draft)).toThrow(ConflictError);
  });
  it('stops stale writers and retains their local data', async () => {
    const repository = { save: vi.fn().mockRejectedValue(new ConflictError()) };
    const q = queue(repository); await q.flush();
    q.update(document(4)); await q.flush();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(q.draft.data.transactions[0].amount).toBe(4); expect(q.draft.pending).toBe(true); q.stop();
  });
  it('does not report Saved when both cloud and local storage fail', async () => {
    const q = queue({ save: vi.fn().mockRejectedValue(new Error('offline')) });
    q.storage.setItem = () => { throw new Error('quota'); };
    expect(await q.flush()).toBe(false);
    expect(q.onStatus).toHaveBeenLastCalledWith(expect.stringContaining('export a backup'));
    expect(q.draft.data.transactions.length).toBe(1); q.stop();
  });
  it('refuses to send account A data after the client changes to account B', async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'b' }, access_token: 'fake-b' } } }) }, rpc: vi.fn(), from: vi.fn() };
    const repo = cloudRepository(client, 'a');
    await expect(repo.save(document(1), 0, 'id')).rejects.toThrow('Session changed');
    await expect(repo.load()).rejects.toThrow('Session changed');
    expect(client.rpc).not.toHaveBeenCalled(); expect(client.from).not.toHaveBeenCalled();
  });
});

describe('document and backup compatibility', () => {
  it('round trips QBUD2 refunds, splits, categories, cards, and transfers', async () => {
    const source = createDemoData();
    const text = await createBudgetBackupText(source);
    expect(text.startsWith('QBUD2:')).toBe(true);
    const restored = validateImport(await readBudgetBackupText(text));
    for (const key of ['bucketTransfers','creditCards','customExpenseCategories','customIncomeCategories','hiddenExpenseCategories','bucketLabels']) expect(restored[key]).toEqual(source[key]);
    expect(restored.transactions.find(t => t.id === 900)).toMatchObject({ refunded: true, refundedById: 901 });
    expect(restored.transactions.filter(t => t.splitGroupId === 'demo-split')).toHaveLength(2);
    expect(restored.transactions).toHaveLength(source.transactions.length);
  });
  it('accepts original JSON backups with missing optional fields but rejects malformed data', () => {
    expect(validateImport({ version: 1, transactions: [] }).creditCards).toEqual([]);
    expect(() => validateImport({ anything: 123 })).toThrow();
    expect(() => validateBudget({ ...emptyBudget(), schemaVersion: 9 })).toThrow('newer');
    expect(() => validateBudget({ ...emptyBudget(), transactions: [null] })).toThrow();
  });
});
