import { emptyBudget, validateBudget } from './budgetDocument';

export const DEMO_KEY = 'budget-demo-data';
export const accountKey = userId => `budget-account:${userId}`;
const LEGACY_FIELDS = {
  transactions: 'transactions', bucketTransfers: 'bucketTransfers', subscriptions: 'subscriptions',
  debts: 'debtsOwedToMe', creditCards: 'creditCards', customExpenseCategories: 'expenseCustomCategories',
  customIncomeCategories: 'incomeCustomCategories', hiddenExpenseCategories: 'hiddenExpenseCategories',
  hiddenIncomeCategories: 'hiddenIncomeCategories', bucketLabels: 'bucketLabels',
};

export function readLegacy(storage = localStorage) {
  const data = emptyBudget();
  let found = false;
  for (const [field, key] of Object.entries(LEGACY_FIELDS)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('Some existing browser data could not be read. It has been left untouched.'); }
    data[field] = value;
    if (field === 'bucketLabels' || (Array.isArray(value) && value.length)) found = true;
  }
  return found ? validateBudget(data) : null;
}

export function readDraft(userId, storage = localStorage) {
  const raw = storage.getItem(accountKey(userId));
  if (!raw) return null;
  const draft = JSON.parse(raw);
  if (draft.userId !== userId || !Number.isInteger(draft.revision) || draft.revision < 0) throw new Error('Invalid local recovery copy.');
  draft.data = validateBudget(draft.data);
  return draft;
}

export function writeDraft(userId, draft, storage = localStorage) {
  const previous = storage.getItem(accountKey(userId));
  if (previous) {
    const parsed = JSON.parse(previous);
    if (parsed.pending && parsed.writerId !== draft.writerId) {
      // Another tab's unacknowledged work must survive even if this tab saves.
      storage.setItem(`budget-recovery:${userId}:${parsed.writerId || 'migration'}`, previous);
    }
  }
  storage.setItem(accountKey(userId), JSON.stringify({ ...draft, userId }));
}

export function readDemo(seed, storage = localStorage) {
  const raw = storage.getItem(DEMO_KEY);
  if (raw) return validateBudget(JSON.parse(raw));
  const data = seed();
  storage.setItem(DEMO_KEY, JSON.stringify(data));
  return data;
}

export function saveDemo(data, storage = localStorage) {
  storage.setItem(DEMO_KEY, JSON.stringify(validateBudget(data)));
}
