import { validateBudget } from './budgetDocument';
import { writeDraft } from './storage';

export class ConflictError extends Error {
  constructor() { super('Another device or tab saved a newer budget. Your local changes are retained.'); this.name = 'ConflictError'; }
}

export function cloudRepository(client, userId) {
  async function authorization() {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('Session changed. Sign in to resume saving.');
    return `Bearer ${data.session.access_token}`;
  }
  return {
    async load() {
      const token = await authorization();
      const { data, error } = await client.from('user_budget_data')
        .select('data,revision,last_write_id').eq('user_id', userId).maybeSingle()
        .setHeader('Authorization', token).abortSignal(AbortSignal.timeout(20000));
      if (error) throw error;
      return data ? { ...data, data: validateBudget(data.data) } : null;
    },
    async save(data, revision, writeId) {
      const token = await authorization();
      // No caller-supplied user ID: the database function derives it from auth.uid().
      const { data: rows, error } = await client.rpc('save_budget', {
        p_data: validateBudget(data), p_expected_revision: revision, p_write_id: writeId,
      }).setHeader('Authorization', token).abortSignal(AbortSignal.timeout(20000));
      if (error) throw error;
      if (!rows?.length) throw new ConflictError();
      return rows[0];
    },
  };
}

// Postgres JSONB can return object keys in a different order. Compare JSON
// values consistently so loading the same budget does not schedule a write.
const canonicalJSON = value => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item);
const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b);

// A response may be lost after a successful write. Reconcile its idempotency ID
// before treating a changed revision as another device's edit.
export function reconcileDraft(row, draft) {
  if (!draft?.pending) return { data: row?.data, revision: row?.revision || 0, pending: false, operation: null };
  if (draft.operation && row?.last_write_id === draft.operation.id) {
    return { ...draft, revision: row.revision, pending: !equal(draft.data, draft.operation.data), operation: null };
  }
  if ((row?.revision || 0) !== draft.revision) throw new ConflictError();
  return draft;
}

export class SaveQueue {
  constructor({ userId, repository, draft, onStatus, storage = localStorage, delay = 650 }) {
    Object.assign(this, { userId, repository, onStatus, storage, delay });
    this.draft = { ...draft, writerId: crypto.randomUUID() };
    this.stopped = false;
    this.conflict = false;
    this.running = null;
  }
  persist() {
    try { writeDraft(this.userId, this.draft, this.storage); this.localError = false; }
    catch { this.localError = true; }
  }
  update(data) {
    if (this.stopped || equal(data, this.draft.data)) return;
    this.draft = { ...this.draft, data: validateBudget(data), pending: true };
    this.persist();
    if (this.conflict) return;
    this.onStatus(this.localError ? 'Browser storage unavailable — keep this page open until saved.' : 'Unsaved changes');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.stopped || this.conflict || !this.draft.pending) return !this.draft.pending;
    this.running = this.drain();
    try { return await this.running; } finally { this.running = null; }
  }
  async drain() {
    while (this.draft.pending && !this.stopped) {
      const operation = this.draft.operation || { id: crypto.randomUUID(), data: this.draft.data, revision: this.draft.revision };
      this.draft.operation = operation;
      this.persist();
      this.onStatus('Saving…');
      try {
        const row = await this.repository.save(operation.data, operation.revision, operation.id);
        if (this.stopped) return false;
        this.draft = { ...this.draft, revision: row.revision, operation: null, pending: !equal(this.draft.data, operation.data) };
        this.persist();
        this.onStatus(this.draft.pending ? 'Unsaved changes' : 'Saved');
      } catch (error) {
        if (this.stopped) return false;
        this.conflict = error instanceof ConflictError;
        this.onStatus(this.conflict ? 'Conflict' : this.localError
          ? 'Save failed and browser recovery unavailable — export a backup before closing.'
          : 'Offline / Save failed — local recovery copy retained');
        if (!this.conflict) this.timer = setTimeout(() => this.flush(), 15000);
        return false;
      }
    }
    return !this.draft.pending;
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
}
