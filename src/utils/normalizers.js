import {
  addDaysToDateString,
  addOneMonthToDateString,
  addOneYearToDateString,
  getDaysBetweenDateStrings,
  getTodayString,
  isValidDateString,
} from "./dates";

export function normalizeTransaction(transaction = {}) {
  const rawAmount = Number(transaction.amount || 0);

  const type =
    transaction.type === "income"
      ? "income"
      : transaction.type === "expense"
      ? "expense"
      : rawAmount < 0
      ? "expense"
      : "income";

  const amount =
    type === "expense" ? -Math.abs(rawAmount) : Math.abs(rawAmount);

  return {
    id: transaction.id ?? Date.now(),
    amount,
    category: transaction.category || "Other",
    type,
    date: isValidDateString(transaction.date)
      ? transaction.date
      : getTodayString(),
    note: transaction.note || "",
    paymentMethod:
      type === "expense"
        ? transaction.paymentMethod === "cash"
          ? "cash"
          : "card"
        : null,
  };
}

export function normalizeSubscription(subscription = {}) {
  const frequency = ["monthly", "yearly", "custom"].includes(subscription.frequency)
    ? subscription.frequency
    : "monthly";

  return {
    id: subscription.id ?? Date.now(),
    name: String(subscription.name || "").trim(),
    amount: Math.abs(Number(subscription.amount || 0)),
    dueDate: isValidDateString(subscription.dueDate)
      ? subscription.dueDate
      : getTodayString(),
    note: subscription.note || "",
    frequency,
    customIntervalDays: Math.max(1, Number(subscription.customIntervalDays || 30)),
    lastChargedDate: isValidDateString(subscription.lastChargedDate)
      ? subscription.lastChargedDate
      : null,
  };
}

export function getNextSubscriptionDueDate(subscription) {
  const s = normalizeSubscription(subscription);

  if (s.frequency === "yearly") return addOneYearToDateString(s.dueDate);
  if (s.frequency === "custom") {
    return addDaysToDateString(s.dueDate, s.customIntervalDays);
  }

  return addOneMonthToDateString(s.dueDate);
}

export function getSubscriptionStatus(subscription, today = getTodayString()) {
  const s = normalizeSubscription(subscription);

  const days = getDaysBetweenDateStrings(today, s.dueDate);

  if (days < 0) {
    return {
      status: "overdue",
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
    };
  }

  if (days <= 3) {
    return {
      status: "dueSoon",
      label: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
    };
  }

  return {
    status: "upcoming",
    label: `Due in ${days} days`,
  };
}

export function normalizeDebt(debt = {}) {
  return {
    id: debt.id ?? Date.now(),
    name: String(debt.name || "").trim(),
    amount: Math.abs(Number(debt.amount || 0)),
    note: debt.note || "",
    createdAt: isValidDateString(debt.createdAt)
      ? debt.createdAt
      : getTodayString(),
  };
}

export function normalizeBucketTransfer(transfer = {}) {
  return {
    id: transfer.id ?? Date.now(),
    amount: Math.abs(Number(transfer.amount || 0)),
    from: transfer.from || "Digital Balance",
    to: transfer.to || "Savings",
    date: isValidDateString(transfer.date)
      ? transfer.date
      : getTodayString(),
    note: transfer.note || "",
  };
}