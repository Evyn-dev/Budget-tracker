import {
  normalizeBucketTransfer,
  normalizeDebt,
  normalizeSubscription,
  normalizeTransaction,
} from "./normalizers";

function loadArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTransactions() {
  return loadArray("transactions").map(normalizeTransaction);
}

export function loadBucketTransfers() {
  return loadArray("bucketTransfers").map(normalizeBucketTransfer);
}

export function loadSubscriptions() {
  return loadArray("subscriptions").map(normalizeSubscription);
}

export function loadDebts() {
  return loadArray("debtsOwedToMe").map(normalizeDebt);
}