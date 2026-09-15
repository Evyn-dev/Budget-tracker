// Versioned cloud document. QBUD2 remains the external backup format.
export const DEFAULT_LABELS = { digital: 'Digital Balance', wallet: 'Wallet', savings: 'Savings' };
export const ARRAY_FIELDS = ['transactions', 'bucketTransfers', 'subscriptions', 'debts', 'creditCards',
  'customExpenseCategories', 'customIncomeCategories', 'hiddenExpenseCategories', 'hiddenIncomeCategories'];

export function emptyBudget() {
  return { schemaVersion: 1, ...Object.fromEntries(ARRAY_FIELDS.map(key => [key, []])), bucketLabels: { ...DEFAULT_LABELS } };
}

export function validateBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid budget document.');
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) throw new Error('This budget needs a newer version of the app.');
  const result = emptyBudget();
  for (const key of ARRAY_FIELDS) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid budget field: ${key}.`);
    result[key] = value[key];
    if (key.includes('Categories')) {
      if (value[key].some(item => typeof item !== 'string')) throw new Error('Invalid category.');
    } else if (value[key].some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new Error(`Invalid entry in ${key}.`);
    }
  }
  if (!value.bucketLabels || ['digital', 'wallet', 'savings'].some(key => typeof value.bucketLabels[key] !== 'string')) {
    throw new Error('Invalid bucket labels.');
  }
  result.bucketLabels = { ...value.bucketLabels };
  for (const key of ['transactions', 'bucketTransfers', 'subscriptions', 'debts']) {
    if (result[key].some(item => !Number.isFinite(Number(item.amount)))) throw new Error('Invalid amount.');
  }
  for (const card of result.creditCards) {
    if (!Number.isFinite(Number(card.balance)) || !Array.isArray(card.history)
      || ['limit', 'minimumPayment'].some(key => card[key] !== undefined && !Number.isFinite(Number(card[key])))
      || card.history.some(item => !item || !Number.isFinite(Number(item.amount)))) throw new Error('Invalid credit card.');
  }
  for (const subscription of result.subscriptions) {
    if (subscription.customIntervalDays !== undefined && (!Number.isInteger(Number(subscription.customIntervalDays))
      || Number(subscription.customIntervalDays) < 1 || Number(subscription.customIntervalDays) > 36500)) throw new Error('Invalid subscription interval.');
  }
  return JSON.parse(JSON.stringify(result));
}

// Older JSON backups can omit fields introduced in later app releases.
export function validateImport(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.transactions)) throw new Error('Invalid backup.');
  if (value.version !== undefined && ![1, 2].includes(value.version)) throw new Error('Unsupported backup version.');
  const filled = { ...emptyBudget(), ...value, bucketLabels: { ...DEFAULT_LABELS, ...value.bucketLabels } };
  filled.creditCards = (filled.creditCards || []).map(card => ({ ...card, history: card.history || [] }));
  return validateBudget(filled);
}
