import { useEffect, useMemo, useRef, useState } from "react";
import {
  colors,
  accentColors,
  expenseCategories,
  incomeCategories,
  moneyBuckets,
} from "./utils/constants";
import {
  formatCurrency,
  formatAmountInput,
  parseAmountInput,
} from "./utils/formatters";
import {
  advanceSubscriptionDate,
  getDaysUntilDate,
  getMonthKey,
  getTodayString,
  isValidDateString,
} from "./utils/dates";
import {
  normalizeBucketTransfer,
  normalizeDebt,
  normalizeSubscription,
  normalizeTransaction,
} from "./utils/normalizers";
import {
  loadBucketTransfers,
  loadDebts,
  loadSubscriptions,
  loadTransactions,
} from "./utils/storage";
import { createBudgetBackupText, readBudgetBackupText } from "./utils/backup";

import HomeTab from "./components/HomeTab";
import RecapsTab from "./components/RecapsTab";
import MoneyTab from "./components/MoneyTab";
import CreditCardsTab from "./components/CreditCardsTab";
import SubscriptionsTab from "./components/SubscriptionsTab";
import DebtsTab from "./components/DebtsTab";
import CategoriesTab from "./components/CategoriesTab";

const DEFAULT_BUCKET_LABELS = {
  digital: moneyBuckets[0] || "Digital Balance",
  wallet: moneyBuckets[1] || "Wallet",
  savings: moneyBuckets[2] || "Savings",
};

const STORAGE_KEYS = {
  expenseCustomCategories: "expenseCustomCategories",
  incomeCustomCategories: "incomeCustomCategories",
  hiddenExpenseCategories: "hiddenExpenseCategories",
  hiddenIncomeCategories: "hiddenIncomeCategories",
  bucketLabels: "bucketLabels",
  creditCards: "creditCards",
};

const TAB_OPTIONS = [
  { key: "home", label: "Home" },
  { key: "recaps", label: "Recaps" },
  { key: "money", label: "Money" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "creditCards", label: "Credit Cards" },
  { key: "debts", label: "Debts" },
  { key: "categories", label: "Categories" },
];

const DEFAULT_SUBSCRIPTION_FREQUENCY = "monthly";
const DEFAULT_SUBSCRIPTION_CUSTOM_INTERVAL_DAYS = "30";

const normalizeSubscriptionFrequency = (value) => {
  if (value === "monthly" || value === "yearly" || value === "custom") {
    return value;
  }
  return DEFAULT_SUBSCRIPTION_FREQUENCY;
};

const normalizeCustomIntervalInput = (value) =>
  String(value ?? "").replace(/\D/g, "").slice(0, 3);

const getSubscriptionFrequencyLabel = (subscription) => {
  if (subscription.frequency === "yearly") return "Yearly";
  if (subscription.frequency === "custom") {
    const days = Number(subscription.customIntervalDays || 0);
    return days > 0 ? `Every ${days} day${days === 1 ? "" : "s"}` : "Custom";
  }
  return "Monthly";
};

const getSubscriptionStatusMeta = (daysUntilDue) => {
  if (daysUntilDue < 0) {
    return {
      label: "Overdue",
      accent: "#ff9b9b",
      backgroundColor: "rgba(255, 107, 107, 0.14)",
      borderColor: "rgba(255, 107, 107, 0.45)",
    };
  }

  if (daysUntilDue <= 3) {
    return {
      label: "Due Soon",
      accent: "#ffd38a",
      backgroundColor: "rgba(255, 200, 90, 0.14)",
      borderColor: "rgba(255, 200, 90, 0.45)",
    };
  }

  return {
    label: "Upcoming",
    accent: "#9be7b4",
    backgroundColor: colors.subscriptionBg,
    borderColor: colors.subscriptionBorder,
  };
};

function readStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredObject(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed && typeof parsed === "object"
      ? { ...fallback, ...parsed }
      : fallback;
  } catch {
    return fallback;
  }
}

function normalizeCreditCard(card) {
  const rawHistory = Array.isArray(card?.history) ? card.history : [];

  return {
    id: card?.id ?? Date.now() + Math.random(),
    name: String(card?.name || "Credit Card"),
    balance: Number.isFinite(Number(card?.balance))
      ? Math.max(0, Number(card.balance))
      : 0,
    limit: Number.isFinite(Number(card?.limit))
      ? Math.max(0, Number(card.limit))
      : 0,
    minimumPayment: Number.isFinite(Number(card?.minimumPayment))
      ? Math.max(0, Number(card.minimumPayment))
      : 0,
    dueDate: typeof card?.dueDate === "string" ? card.dueDate : "",
    note: typeof card?.note === "string" ? card.note : "",
    createdAt: typeof card?.createdAt === "string" ? card.createdAt : getTodayString(),
    history: rawHistory.map((item) => ({
      id: item?.id ?? Date.now() + Math.random(),
      type: item?.type === "payment" ? "payment" : "charge",
      amount: Number.isFinite(Number(item?.amount))
        ? Math.max(0, Number(item.amount))
        : 0,
      date: typeof item?.date === "string" ? item.date : getTodayString(),
      note: typeof item?.note === "string" ? item.note : "",
    })),
  };
}

function App() {
  const today = getTodayString();

  // -------------------- base app state --------------------
  const [activeTab, setActiveTab] = useState("home");
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);

  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [category, setCategory] = useState(expenseCategories[0]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [monthFilter, setMonthFilter] = useState("All Months");
  const [sortOption, setSortOption] = useState("newest");

  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [editingTransactionId, setEditingTransactionId] = useState(null);

  const [transactions, setTransactions] = useState(loadTransactions);
  const [openIncomeMonths, setOpenIncomeMonths] = useState({});
  const [openExpenseMonths, setOpenExpenseMonths] = useState({});

  // -------------------- split transaction state --------------------
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { id: 1, amount: "", category: expenseCategories[0] },
    { id: 2, amount: "", category: expenseCategories[1] || expenseCategories[0] },
  ]);

  // -------------------- bucket transfer state --------------------
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFrom, setTransferFrom] = useState("digital");
  const [transferTo, setTransferTo] = useState("savings");
  const [transferNote, setTransferNote] = useState("");
  const [bucketTransfers, setBucketTransfers] = useState(loadBucketTransfers);
  const [moneyTotalsStartDate, setMoneyTotalsStartDate] = useState("");

  // -------------------- subscriptions state --------------------
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [subscriptionDueDate, setSubscriptionDueDate] = useState(today);
  const [subscriptionFrequency, setSubscriptionFrequency] = useState(
    DEFAULT_SUBSCRIPTION_FREQUENCY
  );
  const [subscriptionCustomIntervalDays, setSubscriptionCustomIntervalDays] =
    useState(DEFAULT_SUBSCRIPTION_CUSTOM_INTERVAL_DAYS);
  const [subscriptionNote, setSubscriptionNote] = useState("");
  const [subscriptions, setSubscriptions] = useState(loadSubscriptions);

  // -------------------- debt state --------------------
  const [debtName, setDebtName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [debts, setDebts] = useState(loadDebts);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [editingDebtName, setEditingDebtName] = useState("");
  const [editingDebtNote, setEditingDebtNote] = useState("");
  const [debtAdjustAmounts, setDebtAdjustAmounts] = useState({});

  // -------------------- credit card debt state --------------------
  const [creditCardName, setCreditCardName] = useState("");
  const [creditCardBalance, setCreditCardBalance] = useState("");
  const [creditCardLimit, setCreditCardLimit] = useState("");
  const [creditCardMinimumPayment, setCreditCardMinimumPayment] = useState("");
  const [creditCardDueDate, setCreditCardDueDate] = useState(today);
  const [creditCardNote, setCreditCardNote] = useState("");
  const [creditCards, setCreditCards] = useState(() =>
    readStoredArray(STORAGE_KEYS.creditCards).map((item) => normalizeCreditCard(item))
  );
  const [creditCardActionAmounts, setCreditCardActionAmounts] = useState({});
  const [creditCardActionNotes, setCreditCardActionNotes] = useState({});
  const [editingCreditCardActivity, setEditingCreditCardActivity] = useState(null);

  // -------------------- custom categories + bucket labels --------------------
  const [customExpenseCategories, setCustomExpenseCategories] = useState(() =>
    readStoredArray(STORAGE_KEYS.expenseCustomCategories)
  );
  const [customIncomeCategories, setCustomIncomeCategories] = useState(() =>
    readStoredArray(STORAGE_KEYS.incomeCustomCategories)
  );
  const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState(() =>
    readStoredArray(STORAGE_KEYS.hiddenExpenseCategories)
  );
  const [hiddenIncomeCategories, setHiddenIncomeCategories] = useState(() =>
    readStoredArray(STORAGE_KEYS.hiddenIncomeCategories)
  );
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newIncomeCategory, setNewIncomeCategory] = useState("");
  const [categoryReassignState, setCategoryReassignState] = useState(null);

  const [bucketLabels, setBucketLabels] = useState(() =>
    readStoredObject(STORAGE_KEYS.bucketLabels, DEFAULT_BUCKET_LABELS)
  );

  // -------------------- import / export state --------------------
  const [importExportText, setImportExportText] = useState("");

  // -------------------- polish state --------------------
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  // -------------------- swipe refs --------------------
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // -------------------- derived category lists --------------------
  const allExpenseCategories = useMemo(() => {
    return Array.from(
      new Set([...expenseCategories, ...customExpenseCategories])
    ).filter((item) => !hiddenExpenseCategories.includes(item));
  }, [customExpenseCategories, hiddenExpenseCategories]);

  const allIncomeCategories = useMemo(() => {
    return Array.from(
      new Set([...incomeCategories, "Refund", ...customIncomeCategories])
    ).filter((item) => !hiddenIncomeCategories.includes(item));
  }, [customIncomeCategories, hiddenIncomeCategories]);

  const currentCategories =
    type === "expense" ? allExpenseCategories : allIncomeCategories;

  const currentTabLabel =
    TAB_OPTIONS.find((tab) => tab.key === activeTab)?.label || "Home";

  // -------------------- helpers --------------------
  const getBucketLabel = (bucketKey) =>
    bucketLabels[bucketKey] || DEFAULT_BUCKET_LABELS[bucketKey];

  const normalizeBucketKey = (value) => {
    if (value === "digital" || value === "wallet" || value === "savings") {
      return value;
    }

    if (value === "Digital Balance") return "digital";
    if (value === "Wallet") return "wallet";
    if (value === "Savings") return "savings";

    if (value === bucketLabels.digital) return "digital";
    if (value === bucketLabels.wallet) return "wallet";
    if (value === bucketLabels.savings) return "savings";

    return "digital";
  };

  const getDefaultCategoryForType = (nextType) =>
    nextType === "expense" ? allExpenseCategories[0] : allIncomeCategories[0];

  const makeDefaultSplitRows = (nextType) => {
    const categories =
      nextType === "expense" ? allExpenseCategories : allIncomeCategories;

    return [
      { id: Date.now(), amount: "", category: categories[0] || "Other" },
      {
        id: Date.now() + 1,
        amount: "",
        category: categories[1] || categories[0] || "Other",
      },
    ];
  };

  const resetSplitRows = (nextType = type) => {
    setSplitRows(makeDefaultSplitRows(nextType));
  };

  const goToTabByOffset = (offset) => {
    const currentIndex = TAB_OPTIONS.findIndex((tab) => tab.key === activeTab);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= TAB_OPTIONS.length) return;

    setActiveTab(TAB_OPTIONS[nextIndex].key);
    setIsTabMenuOpen(false);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touch = event.changedTouches[0];
    const diffX = touch.clientX - touchStartXRef.current;
    const diffY = touch.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    const horizontalThreshold = 70;
    const verticalAllowance = 45;

    if (Math.abs(diffX) < horizontalThreshold) return;
    if (Math.abs(diffY) > verticalAllowance) return;

    if (diffX < 0) {
      goToTabByOffset(1);
    } else {
      goToTabByOffset(-1);
    }
  };

  const showToast = (message, variant = "info") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      id: Date.now(),
      message,
      variant,
    });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const closeConfirm = () => {
    setConfirmState(null);
  };

  const openConfirm = ({
    title = "Confirm action",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
  }) => {
    setConfirmState({
      title,
      message,
      confirmLabel,
      cancelLabel,
      destructive,
      onConfirm,
    });
  };

  const runConfirmedAction = () => {
    if (!confirmState) return;
    const action = confirmState.onConfirm;
    setConfirmState(null);
    if (typeof action === "function") {
      action();
    }
  };

  // -------------------- money calculations --------------------
  const normalizedBucketTransfers = useMemo(() => {
    return bucketTransfers.map((transfer) => {
      const safeTransfer = normalizeBucketTransfer(transfer);
      return {
        ...safeTransfer,
        from: normalizeBucketKey(safeTransfer.from),
        to: normalizeBucketKey(safeTransfer.to),
      };
    });
  }, [bucketTransfers, bucketLabels]);

  const normalizedTransactions = useMemo(() => {
    return transactions.map((transaction) => ({
      ...normalizeTransaction(transaction),
      refunded: Boolean(transaction.refunded),
      refundedById: transaction.refundedById ?? null,
      refundSourceId: transaction.refundSourceId ?? null,
      splitGroupId: transaction.splitGroupId ?? null,
    }));
  }, [transactions]);

  const transactionBalance = useMemo(() => {
    return normalizedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );
  }, [normalizedTransactions]);

  const savingsTotal = useMemo(() => {
    return normalizedBucketTransfers.reduce((sum, transfer) => {
      let next = sum;
      if (transfer.to === "savings") next += transfer.amount;
      if (transfer.from === "savings") next -= transfer.amount;
      return next;
    }, 0);
  }, [normalizedBucketTransfers]);

  const walletTransferNet = useMemo(() => {
    return normalizedBucketTransfers.reduce((sum, transfer) => {
      let next = sum;
      if (transfer.to === "wallet") next += transfer.amount;
      if (transfer.from === "wallet") next -= transfer.amount;
      return next;
    }, 0);
  }, [normalizedBucketTransfers]);

  const walletCashExpenses = useMemo(() => {
    return normalizedTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.paymentMethod === "cash"
      )
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [normalizedTransactions]);

  const walletTotal = useMemo(() => {
    return walletTransferNet - walletCashExpenses;
  }, [walletTransferNet, walletCashExpenses]);

  const digitalBalanceTotal = useMemo(() => {
    return transactionBalance - savingsTotal - walletTotal;
  }, [transactionBalance, savingsTotal, walletTotal]);

  const spendableBalance = useMemo(() => {
    return transactionBalance - savingsTotal;
  }, [transactionBalance, savingsTotal]);

  const totalBalanceIncludingSavings = useMemo(() => {
    return transactionBalance;
  }, [transactionBalance]);

  const totalIncome = useMemo(() => {
    return normalizedTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [normalizedTransactions]);

  const totalExpenses = useMemo(() => {
    return normalizedTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [normalizedTransactions]);

  const filteredMoneyTotalsTransactions = useMemo(() => {
    if (!moneyTotalsStartDate) return normalizedTransactions;

    return normalizedTransactions.filter(
      (transaction) => transaction.date >= moneyTotalsStartDate
    );
  }, [normalizedTransactions, moneyTotalsStartDate]);

  const moneyTabIncomeTotal = useMemo(() => {
    return filteredMoneyTotalsTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          String(transaction.category || "").trim().toLowerCase() !== "other"
      )
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [filteredMoneyTotalsTransactions]);

  const moneyTabExpenseTotal = useMemo(() => {
    return filteredMoneyTotalsTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [filteredMoneyTotalsTransactions]);

  const totalSubscriptionAmount = useMemo(() => {
    return subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
  }, [subscriptions]);

  const totalDebtAmount = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debt.amount, 0);
  }, [debts]);

  const normalizedCreditCards = useMemo(() => {
    return creditCards.map((card) => normalizeCreditCard(card));
  }, [creditCards]);

  const totalCreditCardDebt = useMemo(() => {
    return normalizedCreditCards.reduce(
      (sum, card) => sum + Number(card.balance || 0),
      0
    );
  }, [normalizedCreditCards]);

  const totalCreditLimit = useMemo(() => {
    return normalizedCreditCards.reduce(
      (sum, card) => sum + Number(card.limit || 0),
      0
    );
  }, [normalizedCreditCards]);

  const totalCreditAvailable = useMemo(() => {
    return normalizedCreditCards.reduce((sum, card) => {
      const limit = Number(card.limit || 0);
      const balance = Number(card.balance || 0);
      return sum + Math.max(0, limit - balance);
    }, 0);
  }, [normalizedCreditCards]);

  const overallCreditUtilization = useMemo(() => {
    if (totalCreditLimit <= 0) return 0;
    return (totalCreditCardDebt / totalCreditLimit) * 100;
  }, [totalCreditCardDebt, totalCreditLimit]);

  const upcomingSubscriptions = useMemo(() => {
    return [...subscriptions]
      .map((subscription) => {
        const normalizedSubscription = normalizeSubscription(subscription);
        const daysUntilDue = getDaysUntilDate(normalizedSubscription.dueDate, today);
        const statusMeta = getSubscriptionStatusMeta(daysUntilDue);

        return {
          ...normalizedSubscription,
          daysUntilDue,
          frequencyLabel: getSubscriptionFrequencyLabel(normalizedSubscription),
          statusLabel: statusMeta.label,
          statusAccent: statusMeta.accent,
          statusBackgroundColor: statusMeta.backgroundColor,
          statusBorderColor: statusMeta.borderColor,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [subscriptions, today]);

  const overdueSubscriptionCount = useMemo(() => {
    return upcomingSubscriptions.filter((subscription) => subscription.daysUntilDue < 0)
      .length;
  }, [upcomingSubscriptions]);

  const dueSoonSubscriptionCount = useMemo(() => {
    return upcomingSubscriptions.filter(
      (subscription) =>
        subscription.daysUntilDue >= 0 && subscription.daysUntilDue <= 3
    ).length;
  }, [upcomingSubscriptions]);

  const lastPaycheckTransaction = useMemo(() => {
    const paycheckTransactions = normalizedTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" && transaction.category === "Paycheck"
      )
      .sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }

        const aId =
          typeof a.id === "number" ? a.id : Number.isFinite(Number(a.id)) ? Number(a.id) : 0;
        const bId =
          typeof b.id === "number" ? b.id : Number.isFinite(Number(b.id)) ? Number(b.id) : 0;

        return bId - aId;
      });

    return paycheckTransactions[0] || null;
  }, [normalizedTransactions]);

  const spentSinceLastPaycheck = useMemo(() => {
    if (!lastPaycheckTransaction) return 0;

    return normalizedTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.date >= lastPaycheckTransaction.date
      )
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  }, [normalizedTransactions, lastPaycheckTransaction]);

  const remainingFromLastPaycheck = useMemo(() => {
    if (!lastPaycheckTransaction) return null;
    return Math.abs(lastPaycheckTransaction.amount) - spentSinceLastPaycheck;
  }, [lastPaycheckTransaction, spentSinceLastPaycheck]);

  const orderedDebts = useMemo(() => {
    return [...debts].sort((a, b) => b.amount - a.amount);
  }, [debts]);

  const splitTotal = useMemo(() => {
    return splitRows.reduce((sum, row) => {
      return sum + Math.abs(parseAmountInput(row.amount));
    }, 0);
  }, [splitRows]);

  const splitMatchesMainAmount = useMemo(() => {
    const mainValue = Math.abs(parseAmountInput(amount));
    return mainValue > 0 && splitTotal === mainValue;
  }, [amount, splitTotal]);

  // -------------------- form reset helpers --------------------
  const resetForm = () => {
    setAmount("");
    setType("expense");
    setPaymentMethod("card");
    setCategory(allExpenseCategories[0] || expenseCategories[0]);
    setDate(today);
    setNote("");
    setEditingTransactionId(null);
    setSelectedTransactionId(null);
    setIsSplitMode(false);
    resetSplitRows("expense");
  };

  const resetTransferForm = () => {
    setTransferAmount("");
    setTransferFrom("digital");
    setTransferTo("savings");
    setTransferNote("");
  };

  const resetSubscriptionForm = () => {
    setSubscriptionName("");
    setSubscriptionAmount("");
    setSubscriptionDueDate(today);
    setSubscriptionFrequency(DEFAULT_SUBSCRIPTION_FREQUENCY);
    setSubscriptionCustomIntervalDays(DEFAULT_SUBSCRIPTION_CUSTOM_INTERVAL_DAYS);
    setSubscriptionNote("");
  };

  const resetDebtForm = () => {
    setDebtName("");
    setDebtAmount("");
    setDebtNote("");
  };

  const resetCreditCardForm = () => {
    setCreditCardName("");
    setCreditCardBalance("");
    setCreditCardLimit("");
    setCreditCardMinimumPayment("");
    setCreditCardDueDate(today);
    setCreditCardNote("");
  };

  const getAvailableAmountForBucket = (bucketKey) => {
    if (bucketKey === "digital") return digitalBalanceTotal;
    if (bucketKey === "savings") return savingsTotal;
    if (bucketKey === "wallet") return walletTotal;
    return 0;
  };

  // -------------------- import / export actions --------------------
  const exportDataToText = async () => {
    const exportPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions: normalizedTransactions,
      bucketTransfers: normalizedBucketTransfers,
      subscriptions,
      debts,
      creditCards: normalizedCreditCards,
      customExpenseCategories,
      customIncomeCategories,
      hiddenExpenseCategories,
      hiddenIncomeCategories,
      bucketLabels,
    };

    try {
      const text = await createBudgetBackupText(exportPayload);
      setImportExportText(text);
      showToast("Compressed backup created.", "success");

      try {
        await navigator.clipboard.writeText(text);
        showToast("Compressed backup copied to clipboard.", "success");
      } catch {
        // ignore clipboard failures
      }
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Could not create backup text.", "error");
    }
  };

  const importDataFromText = async () => {
    const raw = importExportText.trim();
    if (!raw) {
      showToast("Paste exported backup text first.", "error");
      return;
    }

    let parsed;

    try {
      parsed = await readBudgetBackupText(raw);
    } catch {
      showToast("That text is not valid import data.", "error");
      return;
    }

    const nextTransactions = Array.isArray(parsed.transactions)
      ? parsed.transactions.map((item) => ({
          ...normalizeTransaction(item),
          refunded: Boolean(item?.refunded),
          refundedById: item?.refundedById ?? null,
          refundSourceId: item?.refundSourceId ?? null,
          splitGroupId: item?.splitGroupId ?? null,
        }))
      : [];

    const nextBucketTransfers = Array.isArray(parsed.bucketTransfers)
      ? parsed.bucketTransfers.map((item) => ({
          ...normalizeBucketTransfer(item),
          from: normalizeBucketKey(item?.from),
          to: normalizeBucketKey(item?.to),
        }))
      : [];

    const nextSubscriptions = Array.isArray(parsed.subscriptions)
      ? parsed.subscriptions.map((item) => normalizeSubscription(item))
      : [];

    const nextDebts = Array.isArray(parsed.debts)
      ? parsed.debts.map((item) => normalizeDebt(item))
      : [];

    const nextCreditCards = Array.isArray(parsed.creditCards)
      ? parsed.creditCards.map((item) => normalizeCreditCard(item))
      : [];

    const nextCustomExpenseCategories = Array.isArray(parsed.customExpenseCategories)
      ? parsed.customExpenseCategories.filter((item) => typeof item === "string")
      : [];

    const nextCustomIncomeCategories = Array.isArray(parsed.customIncomeCategories)
      ? parsed.customIncomeCategories.filter((item) => typeof item === "string")
      : [];

    const nextHiddenExpenseCategories = Array.isArray(parsed.hiddenExpenseCategories)
      ? parsed.hiddenExpenseCategories.filter((item) => typeof item === "string")
      : [];

    const nextHiddenIncomeCategories = Array.isArray(parsed.hiddenIncomeCategories)
      ? parsed.hiddenIncomeCategories.filter((item) => typeof item === "string")
      : [];

    const nextBucketLabels =
      parsed.bucketLabels && typeof parsed.bucketLabels === "object"
        ? {
            ...DEFAULT_BUCKET_LABELS,
            ...parsed.bucketLabels,
          }
        : DEFAULT_BUCKET_LABELS;

    openConfirm({
      title: "Replace saved data?",
      message:
        "Importing will replace your current saved app data on this device.",
      confirmLabel: "Import Data",
      destructive: true,
      onConfirm: () => {
        setTransactions(nextTransactions);
        setBucketTransfers(nextBucketTransfers);
        setSubscriptions(nextSubscriptions);
        setDebts(nextDebts);
        setCreditCards(nextCreditCards);
        setCustomExpenseCategories(nextCustomExpenseCategories);
        setCustomIncomeCategories(nextCustomIncomeCategories);
        setHiddenExpenseCategories(nextHiddenExpenseCategories);
        setHiddenIncomeCategories(nextHiddenIncomeCategories);
        setBucketLabels(nextBucketLabels);
        setOpenIncomeMonths({});
        setOpenExpenseMonths({});
        setCategoryReassignState(null);

        if (nextTransactions.length === 0) {
          setCategory(
            nextCustomExpenseCategories[0] || expenseCategories[0] || "Other"
          );
        }

        showToast("Import complete.", "success");
      },
    });
  };

  // -------------------- transaction actions --------------------
  const addSplitRow = () => {
    setSplitRows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        amount: "",
        category: currentCategories[0] || "Other",
      },
    ]);
  };

  const removeSplitRow = (id) => {
    setSplitRows((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((row) => row.id !== id);
    });
  };

  const updateSplitRow = (id, field, value) => {
    setSplitRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === "amount" ? formatAmountInput(value) : value,
            }
          : row
      )
    );
  };

  const addTransaction = () => {
    const value = parseAmountInput(amount);
    if (!value) return;

    if (isSplitMode) {
      const cleanRows = splitRows
        .map((row) => ({
          ...row,
          parsedAmount: Math.abs(parseAmountInput(row.amount)),
        }))
        .filter((row) => row.parsedAmount > 0);

      if (cleanRows.length < 2) {
        showToast("Add at least two split rows with amounts.", "error");
        return;
      }

      if (!splitMatchesMainAmount) {
        showToast("Split amounts must exactly match the main amount.", "error");
        return;
      }

      const splitGroupId = `split-${Date.now()}`;

      const newTransactions = cleanRows.map((row, index) => {
        const rowAmount =
          type === "expense" ? -Math.abs(row.parsedAmount) : Math.abs(row.parsedAmount);

        return normalizeTransaction({
          id: Date.now() + index,
          amount: rowAmount,
          category: row.category,
          type,
          date,
          note: note ? `${note} (split)` : "Split transaction",
          paymentMethod: type === "expense" ? paymentMethod : null,
          splitGroupId,
        });
      });

      if (type === "expense") {
        const totalExpense = cleanRows.reduce((sum, row) => sum + row.parsedAmount, 0);

        if (paymentMethod === "cash" && totalExpense > walletTotal) {
          showToast("You do not have enough in Wallet for this cash expense.", "error");
          return;
        }

        if (paymentMethod === "card" && totalExpense > digitalBalanceTotal) {
          showToast("You do not have enough in Digital Balance for this card expense.", "error");
          return;
        }
      }

      setTransactions((prev) => [...newTransactions, ...prev]);

      const monthKey = getMonthKey(date);
      if (type === "income") {
        setOpenIncomeMonths((prev) => ({ ...prev, [monthKey]: true }));
      } else {
        setOpenExpenseMonths((prev) => ({ ...prev, [monthKey]: true }));
      }

      resetForm();
      showToast("Split transaction added.", "success");
      return;
    }

    const finalAmount = type === "expense" ? -Math.abs(value) : Math.abs(value);

    if (type === "expense") {
      if (paymentMethod === "cash" && Math.abs(finalAmount) > walletTotal) {
        showToast("You do not have enough in Wallet for this cash expense.", "error");
        return;
      }

      if (paymentMethod === "card" && Math.abs(finalAmount) > digitalBalanceTotal) {
        showToast("You do not have enough in Digital Balance for this card expense.", "error");
        return;
      }
    }

    const newTransaction = normalizeTransaction({
      id: Date.now(),
      amount: finalAmount,
      category,
      type,
      date,
      note,
      paymentMethod: type === "expense" ? paymentMethod : null,
      refunded: false,
      refundedById: null,
      refundSourceId: null,
      splitGroupId: null,
    });

    setTransactions((prev) => [newTransaction, ...prev]);

    if (newTransaction.type === "income") {
      setOpenIncomeMonths((prev) => ({
        ...prev,
        [getMonthKey(newTransaction.date)]: true,
      }));
    } else {
      setOpenExpenseMonths((prev) => ({
        ...prev,
        [getMonthKey(newTransaction.date)]: true,
      }));
    }

    resetForm();
    showToast("Transaction added.", "success");
  };

  const refundTransaction = (transaction) => {
    const safeTransaction = normalizeTransaction(transaction);

    if (safeTransaction.type !== "expense") return;
    if (transaction.refunded) return;

    const refundId = Date.now();

    const refundTransactionItem = normalizeTransaction({
      id: refundId,
      amount: Math.abs(safeTransaction.amount),
      type: "income",
      category: "Refund",
      date: today,
      note: `Refund for: ${safeTransaction.category}${
        safeTransaction.note ? ` — ${safeTransaction.note}` : ""
      }`,
      paymentMethod: null,
      refundSourceId: safeTransaction.id,
    });

    setTransactions((prev) => [
      refundTransactionItem,
      ...prev.map((item) =>
        item.id === safeTransaction.id
          ? {
              ...item,
              refunded: true,
              refundedById: refundId,
            }
          : item
      ),
    ]);

    setOpenIncomeMonths((prev) => ({
      ...prev,
      [getMonthKey(refundTransactionItem.date)]: true,
    }));
    showToast("Refund recorded.", "success");
  };

  const addBucketTransfer = () => {
    const value = parseAmountInput(transferAmount);
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;

    if (!safeValue) return;

    if (transferFrom === transferTo) {
      showToast("Choose two different places to move money between.", "error");
      return;
    }

    const available = getAvailableAmountForBucket(transferFrom);

    if (safeValue > available) {
      showToast(
        `You do not have enough money in ${getBucketLabel(transferFrom)} for that transfer.`,
        "error"
      );
      return;
    }

    const newTransfer = normalizeBucketTransfer({
      id: Date.now(),
      amount: safeValue,
      from: transferFrom,
      to: transferTo,
      date: today,
      note: transferNote,
    });

    setBucketTransfers((prev) => [newTransfer, ...prev]);
    resetTransferForm();
    showToast("Transfer saved.", "success");
  };

  const addSubscription = () => {
    const value = parseAmountInput(subscriptionAmount);
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;
    const normalizedFrequency = normalizeSubscriptionFrequency(subscriptionFrequency);
    const normalizedCustomIntervalDays = normalizeCustomIntervalInput(
      subscriptionCustomIntervalDays
    );
    const customIntervalValue = Number(normalizedCustomIntervalDays || 0);

    if (!subscriptionName.trim()) {
      showToast("Add a subscription name first.", "error");
      return;
    }

    if (!safeValue) {
      showToast("Enter a valid subscription amount.", "error");
      return;
    }

    if (!isValidDateString(subscriptionDueDate)) {
      showToast("Choose a valid due date.", "error");
      return;
    }

    if (normalizedFrequency === "custom" && customIntervalValue < 1) {
      showToast("Custom frequency needs at least 1 day.", "error");
      return;
    }

    const newSubscription = normalizeSubscription({
      id: Date.now(),
      name: subscriptionName,
      amount: safeValue,
      dueDate: subscriptionDueDate,
      frequency: normalizedFrequency,
      customIntervalDays: normalizedFrequency === "custom" ? customIntervalValue : null,
      note: subscriptionNote,
    });

    setSubscriptions((prev) => [newSubscription, ...prev]);
    resetSubscriptionForm();
    showToast("Subscription added.", "success");
  };

  const deleteSubscription = (id) => {
    openConfirm({
      title: "Delete subscription?",
      message: "This will remove the selected subscription.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setSubscriptions((prev) =>
          prev.filter((subscription) => subscription.id !== id)
        );
        showToast("Subscription deleted.", "success");
      },
    });
  };

  const addDebt = () => {
    const value = parseAmountInput(debtAmount);
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;

    if (!debtName.trim() || !safeValue) return;

    const newDebt = normalizeDebt({
      id: Date.now(),
      name: debtName,
      amount: safeValue,
      note: debtNote,
      createdAt: today,
    });

    setDebts((prev) => [newDebt, ...prev]);
    resetDebtForm();
    showToast("Debt added.", "success");
  };

  const deleteDebt = (id) => {
    openConfirm({
      title: "Delete debt?",
      message: "This will remove the selected debt entry.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setDebts((prev) => prev.filter((debt) => debt.id !== id));
        setDebtAdjustAmounts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        showToast("Debt deleted.", "success");
      },
    });
  };

  const startEditingDebt = (debt) => {
    setEditingDebtId(debt.id);
    setEditingDebtName(debt.name);
    setEditingDebtNote(debt.note);
  };

  const saveDebtEdit = () => {
    if (!editingDebtId) return;

    setDebts((prev) =>
      prev.map((debt) =>
        debt.id === editingDebtId
          ? {
              ...debt,
              name: editingDebtName.trim() || debt.name,
              note: editingDebtNote,
            }
          : debt
      )
    );

    setEditingDebtId(null);
    setEditingDebtName("");
    setEditingDebtNote("");
  };

  const cancelDebtEdit = () => {
    setEditingDebtId(null);
    setEditingDebtName("");
    setEditingDebtNote("");
  };

  const increaseDebt = (id) => {
    const value = parseAmountInput(debtAdjustAmounts[id] || "");
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;
    if (!safeValue) return;

    setDebts((prev) =>
      prev.map((debt) =>
        debt.id === id ? { ...debt, amount: debt.amount + safeValue } : debt
      )
    );

    setDebtAdjustAmounts((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const decreaseDebt = (id) => {
    const value = parseAmountInput(debtAdjustAmounts[id] || "");
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;
    if (!safeValue) return;

    setDebts((prev) =>
      prev.map((debt) =>
        debt.id === id
          ? { ...debt, amount: Math.max(0, debt.amount - safeValue) }
          : debt
      )
    );

    setDebtAdjustAmounts((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const addCreditCard = () => {
    const balanceValue = parseAmountInput(creditCardBalance);
    const limitValue = parseAmountInput(creditCardLimit);
    const minimumPaymentValue = parseAmountInput(creditCardMinimumPayment);

    const safeBalance = Number.isFinite(balanceValue) ? Math.abs(balanceValue) : 0;
    const safeLimit = Number.isFinite(limitValue) ? Math.abs(limitValue) : 0;
    const safeMinimumPayment = Number.isFinite(minimumPaymentValue)
      ? Math.abs(minimumPaymentValue)
      : 0;

    if (!creditCardName.trim()) {
      showToast("Add a credit card name first.", "error");
      return;
    }

    const newCard = normalizeCreditCard({
      id: Date.now(),
      name: creditCardName.trim(),
      balance: safeBalance,
      limit: safeLimit,
      minimumPayment: safeMinimumPayment,
      dueDate: creditCardDueDate,
      note: creditCardNote,
      createdAt: today,
      history: [],
    });

    setCreditCards((prev) => [newCard, ...prev]);
    resetCreditCardForm();
    showToast("Credit card added.", "success");
  };

  const deleteCreditCard = (id) => {
    openConfirm({
      title: "Delete credit card?",
      message: "This will remove the selected credit card and its payment history.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setCreditCards((prev) => prev.filter((card) => card.id !== id));
        setCreditCardActionAmounts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setCreditCardActionNotes((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        showToast("Credit card deleted.", "success");
      },
    });
  };

  const addCreditCardActivity = (id, activityType) => {
    const value = parseAmountInput(creditCardActionAmounts[id] || "");
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;

    if (!safeValue) return;

    const note = creditCardActionNotes[id] || "";

    setCreditCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;

        const safeCard = normalizeCreditCard(card);
        const nextBalance =
          activityType === "payment"
            ? Math.max(0, safeCard.balance - safeValue)
            : safeCard.balance + safeValue;

        return normalizeCreditCard({
          ...safeCard,
          balance: nextBalance,
          history: [
            {
              id: Date.now(),
              type: activityType,
              amount: safeValue,
              date: today,
              note,
            },
            ...safeCard.history,
          ],
        });
      })
    );

    setCreditCardActionAmounts((prev) => ({
      ...prev,
      [id]: "",
    }));

    setCreditCardActionNotes((prev) => ({
      ...prev,
      [id]: "",
    }));

    showToast(
      activityType === "payment" ? "Credit card payment added." : "Credit card charge added.",
      "success"
    );
  };

  const addCreditCardPayment = (id) => {
    addCreditCardActivity(id, "payment");
  };

  const addCreditCardCharge = (id) => {
    addCreditCardActivity(id, "charge");
  };

  const updateCreditCardDetails = (cardId, updates) => {
    setCreditCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? normalizeCreditCard({
              ...card,
              ...updates,
            })
          : card
      )
    );

    showToast("Credit card updated.", "success");
  };

  const updateCreditCardMinimumPayment = (cardId, nextMinimumPayment) => {
    const value = parseAmountInput(nextMinimumPayment);
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;

    updateCreditCardDetails(cardId, {
      minimumPayment: safeValue,
    });
  };

  const updateCreditCardLimit = (cardId, nextLimit) => {
    const value = parseAmountInput(nextLimit);
    const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;

    updateCreditCardDetails(cardId, {
      limit: safeValue,
    });
  };

  const updateCreditCardDueDate = (cardId, nextDueDate) => {
    updateCreditCardDetails(cardId, {
      dueDate: nextDueDate,
    });
  };

  const startEditingCreditCardActivity = (cardId, activity) => {
    setEditingCreditCardActivity({
      cardId,
      activityId: activity.id,
      amount: String(Math.abs(Number(activity.amount || 0))),
      note: activity.note || "",
    });
  };

  const cancelEditingCreditCardActivity = () => {
    setEditingCreditCardActivity(null);
  };

  const saveEditedCreditCardActivity = () => {
    if (!editingCreditCardActivity) return;

    const nextAmount = parseAmountInput(editingCreditCardActivity.amount);
    const safeNextAmount = Number.isFinite(nextAmount) ? Math.abs(nextAmount) : 0;

    if (!safeNextAmount) {
      showToast("Enter a valid amount.", "error");
      return;
    }

    setCreditCards((prev) =>
      prev.map((card) => {
        if (card.id !== editingCreditCardActivity.cardId) return card;

        const safeCard = normalizeCreditCard(card);
        const existingActivity = safeCard.history.find(
          (item) => item.id === editingCreditCardActivity.activityId
        );

        if (!existingActivity) return safeCard;

        const oldAmount = Math.abs(Number(existingActivity.amount || 0));
        let nextBalance = safeCard.balance;

        if (existingActivity.type === "payment") {
          nextBalance = safeCard.balance + oldAmount - safeNextAmount;
        } else {
          nextBalance = safeCard.balance - oldAmount + safeNextAmount;
        }

        return normalizeCreditCard({
          ...safeCard,
          balance: Math.max(0, nextBalance),
          history: safeCard.history.map((item) =>
            item.id === editingCreditCardActivity.activityId
              ? {
                  ...item,
                  amount: safeNextAmount,
                  note: editingCreditCardActivity.note,
                }
              : item
          ),
        });
      })
    );

    setEditingCreditCardActivity(null);
    showToast("Credit card activity updated.", "success");
  };

  const deleteCreditCardActivity = (cardId, activityId) => {
    openConfirm({
      title: "Delete credit card activity?",
      message: "This will remove this charge or payment and adjust the card balance.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setCreditCards((prev) =>
          prev.map((card) => {
            if (card.id !== cardId) return card;

            const safeCard = normalizeCreditCard(card);
            const activity = safeCard.history.find((item) => item.id === activityId);

            if (!activity) return safeCard;

            const amount = Math.abs(Number(activity.amount || 0));
            const nextBalance =
              activity.type === "payment"
                ? safeCard.balance + amount
                : safeCard.balance - amount;

            return normalizeCreditCard({
              ...safeCard,
              balance: Math.max(0, nextBalance),
              history: safeCard.history.filter((item) => item.id !== activityId),
            });
          })
        );

        if (
          editingCreditCardActivity?.cardId === cardId &&
          editingCreditCardActivity?.activityId === activityId
        ) {
          setEditingCreditCardActivity(null);
        }

        showToast("Credit card activity deleted.", "success");
      },
    });
  };

  const clearHistory = () => {
    openConfirm({
      title: "Clear everything?",
      message:
        "This will permanently remove transaction history, transfer history, subscriptions, debts, and credit cards on this device.",
      confirmLabel: "Clear Data",
      destructive: true,
      onConfirm: () => {
        setTransactions([]);
        setBucketTransfers([]);
        setSubscriptions([]);
        setDebts([]);
        setCreditCards([]);
        setOpenIncomeMonths({});
        setOpenExpenseMonths({});
        localStorage.removeItem("transactions");
        localStorage.removeItem("bucketTransfers");
        localStorage.removeItem("subscriptions");
        localStorage.removeItem("debtsOwedToMe");
        localStorage.removeItem(STORAGE_KEYS.creditCards);
        localStorage.removeItem("balance");
        resetForm();
        resetTransferForm();
        resetSubscriptionForm();
        resetDebtForm();
        resetCreditCardForm();
        showToast("Saved data cleared.", "success");
      },
    });
  };

  const deleteTransaction = (id) => {
    openConfirm({
      title: "Delete transaction?",
      message: "This will permanently remove the selected transaction.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setTransactions((prev) =>
          prev.filter((transaction) => transaction.id !== id)
        );

        if (editingTransactionId === id) {
          resetForm();
        } else {
          setSelectedTransactionId(null);
        }

        showToast("Transaction deleted.", "success");
      },
    });
  };

  const deleteBucketTransfer = (id) => {
    openConfirm({
      title: "Delete transfer?",
      message: "This will remove the selected transfer from history.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        setBucketTransfers((prev) =>
          prev.filter((transfer) => transfer.id !== id)
        );
        showToast("Transfer deleted.", "success");
      },
    });
  };

  const startEditingTransaction = (transaction) => {
    const safeTransaction = normalizeTransaction(transaction);

    setEditingTransactionId(safeTransaction.id);
    setSelectedTransactionId(safeTransaction.id);
    setAmount(String(Math.abs(safeTransaction.amount)));
    setType(safeTransaction.type);
    setPaymentMethod(
      safeTransaction.type === "expense"
        ? safeTransaction.paymentMethod || "card"
        : "card"
    );
    setCategory(safeTransaction.category);
    setDate(safeTransaction.date);
    setNote(safeTransaction.note);
    setIsSplitMode(false);

    if (safeTransaction.type === "income") {
      setOpenIncomeMonths((prev) => ({
        ...prev,
        [getMonthKey(safeTransaction.date)]: true,
      }));
    } else {
      setOpenExpenseMonths((prev) => ({
        ...prev,
        [getMonthKey(safeTransaction.date)]: true,
      }));
    }
  };

  const saveEditedTransaction = () => {
    const value = parseAmountInput(amount);
    if (!value || editingTransactionId === null) return;

    const existingTransaction = normalizedTransactions.find(
      (transaction) => transaction.id === editingTransactionId
    );

    if (!existingTransaction) return;

    const finalAmount = type === "expense" ? -Math.abs(value) : Math.abs(value);

    const simulatedTransactions = normalizedTransactions.map((transaction) =>
      transaction.id === editingTransactionId
        ? {
            ...normalizeTransaction({
              ...transaction,
              amount: finalAmount,
              category,
              type,
              date,
              note,
              paymentMethod: type === "expense" ? paymentMethod : null,
            }),
            refunded: Boolean(transaction.refunded),
            refundedById: transaction.refundedById ?? null,
            refundSourceId: transaction.refundSourceId ?? null,
            splitGroupId: transaction.splitGroupId ?? null,
          }
        : transaction
    );

    const simulatedTransactionBalance = simulatedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

    const simulatedWalletCashExpenses = simulatedTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.paymentMethod === "cash"
      )
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

    const simulatedWalletTotal = walletTransferNet - simulatedWalletCashExpenses;
    const simulatedDigitalBalance =
      simulatedTransactionBalance - savingsTotal - simulatedWalletTotal;

    if (type === "expense") {
      if (paymentMethod === "cash" && simulatedWalletTotal < 0) {
        showToast("That edit would make Wallet go below zero.", "error");
        return;
      }

      if (paymentMethod === "card" && simulatedDigitalBalance < 0) {
        showToast("That edit would make Digital Balance go below zero.", "error");
        return;
      }
    }

    setTransactions(simulatedTransactions);

    if (type === "income") {
      setOpenIncomeMonths((prev) => ({
        ...prev,
        [getMonthKey(date)]: true,
      }));
    } else {
      setOpenExpenseMonths((prev) => ({
        ...prev,
        [getMonthKey(date)]: true,
      }));
    }

    resetForm();
    showToast("Transaction updated.", "success");
  };

  const cancelEditing = () => {
    resetForm();
  };

  // -------------------- category actions --------------------
  const addCustomCategory = (kind) => {
    if (kind === "expense") {
      const cleaned = newExpenseCategory.trim();
      if (!cleaned) return;

      const exists = [...expenseCategories, ...customExpenseCategories].some(
        (item) => item.toLowerCase() === cleaned.toLowerCase()
      );
      if (exists) {
        if (hiddenExpenseCategories.includes(cleaned)) {
          setHiddenExpenseCategories((prev) =>
            prev.filter((item) => item !== cleaned)
          );
        }
        setNewExpenseCategory("");
        return;
      }

      setCustomExpenseCategories((prev) => [...prev, cleaned]);
      setNewExpenseCategory("");
      return;
    }

    const cleaned = newIncomeCategory.trim();
    if (!cleaned) return;

    const exists = [...incomeCategories, "Refund", ...customIncomeCategories].some(
      (item) => item.toLowerCase() === cleaned.toLowerCase()
    );
    if (exists) {
      if (hiddenIncomeCategories.includes(cleaned)) {
        setHiddenIncomeCategories((prev) =>
          prev.filter((item) => item !== cleaned)
        );
      }
      setNewIncomeCategory("");
      return;
    }

    setCustomIncomeCategories((prev) => [...prev, cleaned]);
    setNewIncomeCategory("");
  };

  const hideCategory = (kind, categoryName) => {
    if (kind === "expense") {
      if (categoryName === "Other") return;
      setHiddenExpenseCategories((prev) =>
        prev.includes(categoryName) ? prev : [...prev, categoryName]
      );
      if (editingTransactionId === null && category === categoryName) {
        const nextCategory =
          allExpenseCategories.find((item) => item !== categoryName) || "Other";
        setCategory(nextCategory);
      }
      return;
    }

    if (categoryName === "Refund" || categoryName === "Other") return;

    setHiddenIncomeCategories((prev) =>
      prev.includes(categoryName) ? prev : [...prev, categoryName]
    );
    if (editingTransactionId === null && category === categoryName) {
      const nextCategory =
        allIncomeCategories.find((item) => item !== categoryName) || "Other";
      setCategory(nextCategory);
    }
  };

  const startCategoryReassign = (kind, sourceCategory) => {
    const options =
      kind === "expense"
        ? allExpenseCategories.filter((item) => item !== sourceCategory)
        : allIncomeCategories.filter(
            (item) => item !== sourceCategory && item !== "Refund"
          );

    setCategoryReassignState({
      kind,
      sourceCategory,
      targetCategory: options[0] || "",
    });
  };

  const cancelCategoryReassign = () => {
    setCategoryReassignState(null);
  };

  const confirmCategoryReassign = () => {
    if (!categoryReassignState) return;

    const { kind, sourceCategory, targetCategory } = categoryReassignState;

    if (!targetCategory || sourceCategory === targetCategory) return;

    setTransactions((prev) =>
      prev.map((transaction) =>
        transaction.category === sourceCategory
          ? { ...transaction, category: targetCategory }
          : transaction
      )
    );

    hideCategory(kind, sourceCategory);
    setCategoryReassignState(null);
  };

  const restoreHiddenCategory = (kind, categoryName) => {
    if (kind === "expense") {
      setHiddenExpenseCategories((prev) =>
        prev.filter((item) => item !== categoryName)
      );
      return;
    }

    setHiddenIncomeCategories((prev) =>
      prev.filter((item) => item !== categoryName)
    );
  };

  // -------------------- month toggles --------------------
  const toggleIncomeMonth = (monthKey) => {
    setOpenIncomeMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const toggleExpenseMonth = (monthKey) => {
    setOpenExpenseMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  // -------------------- transaction filtering --------------------
  const allMonthOptions = useMemo(() => {
    const monthSet = new Set(
      normalizedTransactions.map((transaction) => getMonthKey(transaction.date))
    );

    return [
      "All Months",
      ...Array.from(monthSet).sort((a, b) => {
        const aDate = new Date(
          `${
            normalizedTransactions.find((t) => getMonthKey(t.date) === a)?.date || today
          }T00:00:00`
        );
        const bDate = new Date(
          `${
            normalizedTransactions.find((t) => getMonthKey(t.date) === b)?.date || today
          }T00:00:00`
        );
        return bDate - aDate;
      }),
    ];
  }, [normalizedTransactions, today]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return normalizedTransactions.filter((transaction) => {
      const monthKey = getMonthKey(transaction.date);

      const matchesMonth =
        monthFilter === "All Months" || monthKey === monthFilter;

      const searchableText = [
        transaction.category,
        transaction.note,
        transaction.date,
        transaction.type,
        monthKey,
        transaction.paymentMethod || "",
        transaction.refunded ? "refunded" : "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch === "" || searchableText.includes(normalizedSearch);

      return matchesMonth && matchesSearch;
    });
  }, [normalizedTransactions, searchTerm, monthFilter]);

  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter((transaction) => transaction.type === "income");
  }, [filteredTransactions]);

  const expenseTransactions = useMemo(() => {
    return filteredTransactions.filter((transaction) => transaction.type === "expense");
  }, [filteredTransactions]);

  const sortItems = (items) => {
    const sorted = [...items];

    sorted.sort((a, b) => {
      if (sortOption === "oldest") {
        return new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`);
      }

      if (sortOption === "highest") {
        return Math.abs(b.amount) - Math.abs(a.amount);
      }

      if (sortOption === "lowest") {
        return Math.abs(a.amount) - Math.abs(b.amount);
      }

      return new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`);
    });

    return sorted;
  };

  const groupedByMonth = (items) => {
    const sorted = sortItems(items).map((item) => ({
      ...normalizeTransaction(item),
      refunded: Boolean(item.refunded),
      refundedById: item.refundedById ?? null,
      refundSourceId: item.refundSourceId ?? null,
      splitGroupId: item.splitGroupId ?? null,
    }));

    const groups = {};

    for (const transaction of sorted) {
      const monthKey = getMonthKey(transaction.date);

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }

      groups[monthKey].push(transaction);
    }

    return groups;
  };

  const incomeGroups = useMemo(
    () => groupedByMonth(incomeTransactions),
    [incomeTransactions, sortOption]
  );
  const expenseGroups = useMemo(
    () => groupedByMonth(expenseTransactions),
    [expenseTransactions, sortOption]
  );

  const orderedIncomeMonths = useMemo(() => {
    return Object.keys(incomeGroups).sort((a, b) => {
      const aDate = new Date(`${incomeGroups[a][0].date}T00:00:00`);
      const bDate = new Date(`${incomeGroups[b][0].date}T00:00:00`);
      return bDate - aDate;
    });
  }, [incomeGroups]);

  const orderedExpenseMonths = useMemo(() => {
    return Object.keys(expenseGroups).sort((a, b) => {
      const aDate = new Date(`${expenseGroups[a][0].date}T00:00:00`);
      const bDate = new Date(`${expenseGroups[b][0].date}T00:00:00`);
      return bDate - aDate;
    });
  }, [expenseGroups]);

  const filteredIncomeTotal = useMemo(() => {
    return incomeTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0
    );
  }, [incomeTransactions]);

  const filteredExpenseTotal = useMemo(() => {
    return expenseTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0
    );
  }, [expenseTransactions]);

  const getMonthTotal = (monthTransactions) => {
    return monthTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0
    );
  };

  const expenseBreakdown = useMemo(() => {
    const categoryTotals = {};

    expenseTransactions
      .filter((transaction) => !transaction.refunded)
      .forEach((transaction) => {
        const key = transaction.category || "Other";
        categoryTotals[key] = (categoryTotals[key] || 0) + Math.abs(transaction.amount);
      });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value: Number(value) || 0,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

  // -------------------- recap data --------------------
  const weeklySummaryData = useMemo(() => {
    const days = [];
    const todayDate = new Date(`${today}T00:00:00`);

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);

      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short" });

      days.push({
        date: iso,
        day: label,
        income: 0,
        expense: 0,
      });
    }

    filteredTransactions.forEach((transaction) => {
      const foundDay = days.find((day) => day.date === transaction.date);
      if (!foundDay) return;

      if (transaction.type === "income") {
        foundDay.income += Math.abs(transaction.amount);
      } else {
        foundDay.expense += Math.abs(transaction.amount);
      }
    });

    return days;
  }, [filteredTransactions, today]);

  const recapWeeklyData = useMemo(() => {
    const days = [];
    const todayDate = new Date(`${today}T00:00:00`);

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);

      const iso = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      days.push({
        date: iso,
        label,
        income: 0,
        expense: 0,
        count: 0,
      });
    }

    normalizedTransactions.forEach((transaction) => {
      const foundDay = days.find((day) => day.date === transaction.date);
      if (!foundDay) return;

      foundDay.count += 1;

      if (transaction.type === "income") {
        foundDay.income += Math.abs(transaction.amount);
      } else {
        foundDay.expense += Math.abs(transaction.amount);
      }
    });

    return days;
  }, [normalizedTransactions, today]);

  const monthlyRecapData = useMemo(() => {
    const grouped = {};

    normalizedTransactions.forEach((transaction) => {
      const monthKey = getMonthKey(transaction.date);

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          income: 0,
          expense: 0,
          count: 0,
          latestDate: transaction.date,
        };
      }

      grouped[monthKey].count += 1;

      if (transaction.type === "income") {
        grouped[monthKey].income += Math.abs(transaction.amount);
      } else {
        grouped[monthKey].expense += Math.abs(transaction.amount);
      }

      if (transaction.date > grouped[monthKey].latestDate) {
        grouped[monthKey].latestDate = transaction.date;
      }
    });

    return Object.values(grouped).sort((a, b) =>
      b.latestDate.localeCompare(a.latestDate)
    );
  }, [normalizedTransactions]);

  const orderedBucketTransfers = useMemo(() => {
    return [...normalizedBucketTransfers].sort((a, b) =>
      `${b.date}-${String(b.id)}`.localeCompare(`${a.date}-${String(a.id)}`)
    );
  }, [normalizedBucketTransfers]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // -------------------- persistence --------------------
  useEffect(() => {
    localStorage.setItem("transactions", JSON.stringify(normalizedTransactions));
  }, [normalizedTransactions]);

  useEffect(() => {
    localStorage.setItem("bucketTransfers", JSON.stringify(normalizedBucketTransfers));
  }, [normalizedBucketTransfers]);

  useEffect(() => {
    localStorage.setItem("subscriptions", JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem("debtsOwedToMe", JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.creditCards, JSON.stringify(normalizedCreditCards));
  }, [normalizedCreditCards]);

  useEffect(() => {
    localStorage.setItem("balance", String(transactionBalance));
  }, [transactionBalance]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.expenseCustomCategories,
      JSON.stringify(customExpenseCategories)
    );
  }, [customExpenseCategories]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.incomeCustomCategories,
      JSON.stringify(customIncomeCategories)
    );
  }, [customIncomeCategories]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.hiddenExpenseCategories,
      JSON.stringify(hiddenExpenseCategories)
    );
  }, [hiddenExpenseCategories]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.hiddenIncomeCategories,
      JSON.stringify(hiddenIncomeCategories)
    );
  }, [hiddenIncomeCategories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bucketLabels, JSON.stringify(bucketLabels));
  }, [bucketLabels]);

  useEffect(() => {
    setOpenIncomeMonths((prev) => {
      const updated = { ...prev };
      for (const monthKey of orderedIncomeMonths) {
        if (!(monthKey in updated)) updated[monthKey] = true;
      }
      return updated;
    });
  }, [orderedIncomeMonths]);

  useEffect(() => {
    setOpenExpenseMonths((prev) => {
      const updated = { ...prev };
      for (const monthKey of orderedExpenseMonths) {
        if (!(monthKey in updated)) updated[monthKey] = true;
      }
      return updated;
    });
  }, [orderedExpenseMonths]);

  useEffect(() => {
    if (!currentCategories.includes(category) && editingTransactionId === null) {
      setCategory(getDefaultCategoryForType(type));
    }
  }, [currentCategories, category, type, editingTransactionId]);

  useEffect(() => {
    setSplitRows((prev) =>
      prev.map((row) => ({
        ...row,
        category: currentCategories.includes(row.category)
          ? row.category
          : currentCategories[0] || "Other",
      }))
    );
  }, [currentCategories]);

  useEffect(() => {
    if (subscriptions.length === 0) return;

    const newTransactions = [];
    let subscriptionsChanged = false;

    const updatedSubscriptions = subscriptions.map((subscription) => {
      let updatedSubscription = normalizeSubscription(subscription);

      while (updatedSubscription.dueDate <= today) {
        subscriptionsChanged = true;

        newTransactions.push(
          normalizeTransaction({
            id: `${updatedSubscription.id}-${updatedSubscription.dueDate}`,
            amount: -Math.abs(updatedSubscription.amount),
            type: "expense",
            category: "Bills",
            date: updatedSubscription.dueDate,
            paymentMethod: "card",
            note: `Subscription charge: ${updatedSubscription.name}${
              updatedSubscription.note ? ` — ${updatedSubscription.note}` : ""
            }`,
          })
        );

        updatedSubscription = {
          ...updatedSubscription,
          dueDate: advanceSubscriptionDate(
            updatedSubscription.dueDate,
            updatedSubscription.frequency,
            updatedSubscription.customIntervalDays
          ),
        };
      }

      return updatedSubscription;
    });

    if (!subscriptionsChanged) return;

    setSubscriptions(updatedSubscriptions);
    if (newTransactions.length > 0) {
      setTransactions((prev) => {
        const existingKeys = new Set(
          prev.map(
            (transaction) =>
              `${transaction.type}|${transaction.amount}|${transaction.date}|${transaction.note}|${transaction.paymentMethod || ""}`
          )
        );

        const dedupedNew = newTransactions.filter((transaction) => {
          const key = `${transaction.type}|${transaction.amount}|${transaction.date}|${transaction.note}|${transaction.paymentMethod || ""}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        return [...dedupedNew, ...prev];
      });
    }
  }, [subscriptions, today]);

  // -------------------- styles --------------------
 const inputStyle = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  width: "100%",
  minWidth: 0,
  minHeight: "48px",
  boxSizing: "border-box",
  backgroundColor: colors.card,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  fontSize: "clamp(15px, 1rem, 16px)",
};

  const buttonStyle = {
    width: "100%",
    padding: "12px 14px",
    minHeight: "48px",
    backgroundColor: colors.button,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    cursor: "pointer",
    boxSizing: "border-box",
    fontSize: "clamp(14px, 0.98rem, 15px)",
    fontWeight: "600",
  };

  const tabSelectorButtonStyle = {
    width: "100%",
    minHeight: "52px",
    height: "52px",
    padding: "12px 14px",
    backgroundColor: colors.button,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "clamp(15px, 1rem, 16px)",
    textAlign: "left",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  };

  const summaryCardStyle = {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: "14px",
    padding: "clamp(14px, 2vw, 18px)",
    minHeight: "110px",
    boxSizing: "border-box",
  };

  const cardStyle = {
    backgroundColor: colors.section,
    border: `1px solid ${colors.border}`,
    borderRadius: "16px",
    padding: "clamp(14px, 2vw, 18px)",
    marginTop: "16px",
    boxSizing: "border-box",
  };

  const shellStyle = {
    width: "100%",
    maxWidth: "980px",
    margin: "0 auto",
    padding: "clamp(12px, 2.6vw, 22px)",
    backgroundColor: colors.bg,
    color: colors.text,
    minHeight: "100dvh",
    boxSizing: "border-box",
  };

  const stickyBarStyle = {
    position: "sticky",
    top: 0,
    zIndex: 999,
    backgroundColor: colors.bg,
    paddingBottom: "12px",
  };

  const tabContentStyle = {
    width: "100%",
    boxSizing: "border-box",
    paddingTop: "2px",
  };

  const pageTitleStyle = {
    margin: "0 0 16px 0",
    fontSize: "clamp(28px, 3.6vw, 34px)",
    lineHeight: 1.1,
  };

  const summaryGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
    alignItems: "stretch",
  };

  const actionRowStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    width: "100%",
  };

  const filterGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
    alignItems: "stretch",
  };

  const denseCardGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "10px",
  };

  const toastStyle = {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 2000,
    minWidth: "min(320px, calc(100vw - 32px))",
    maxWidth: "420px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    color: colors.text,
    backgroundColor:
      toast?.variant === "success"
        ? "rgba(80, 200, 120, 0.16)"
        : toast?.variant === "error"
          ? "rgba(255, 107, 107, 0.16)"
          : colors.card,
    backdropFilter: "blur(10px)",
  };

  const modalBackdropStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 1900,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  };

  const modalCardStyle = {
    width: "min(460px, 100%)",
    backgroundColor: colors.section,
    border: `1px solid ${colors.border}`,
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  };

  // -------------------- shared render helpers --------------------
  const renderTransactionCard = (transaction) => {
    const isSelected = selectedTransactionId === transaction.id;
    const isIncome = transaction.type === "income";
    const isRefunded = Boolean(transaction.refunded);

    return (
      <li
        key={transaction.id}
        onClick={() => setSelectedTransactionId(transaction.id)}
        style={{
          border: isRefunded
            ? "2px solid rgba(80, 200, 120, 0.5)"
            : isSelected
              ? `2px solid ${colors.text}`
              : `1px solid ${
                  isIncome ? colors.incomeBorder : colors.expenseBorder
                }`,
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "12px",
          cursor: "pointer",
          backgroundColor: isIncome ? colors.incomeBg : colors.expenseBg,
          opacity: isRefunded ? 0.82 : 1,
          position: "relative",
        }}
      >
        <div style={{ fontWeight: "bold", color: colors.text }}>
          {isIncome ? "Income" : "Expense"}: $
          {formatCurrency(Math.abs(transaction.amount))} — {transaction.category}
        </div>

        <div style={{ fontSize: "14px", marginTop: "4px", color: colors.subtext }}>
          Date: {transaction.date}
        </div>

        {transaction.type === "expense" && (
          <div style={{ fontSize: "14px", marginTop: "4px", color: colors.subtext }}>
            Paid with: {transaction.paymentMethod === "cash" ? "Cash" : "Card"}
          </div>
        )}

        {transaction.splitGroupId && (
          <div style={{ fontSize: "14px", marginTop: "4px", color: colors.subtext }}>
            Split transaction
          </div>
        )}

        {transaction.note && (
          <div style={{ fontSize: "14px", marginTop: "4px", color: colors.subtext }}>
            Note: {transaction.note}
          </div>
        )}

        {isRefunded && (
          <div
            style={{
              marginTop: "8px",
              color: "#9be7b4",
              fontWeight: "bold",
            }}
          >
            ✅ Refunded
          </div>
        )}

        {isSelected && (
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                startEditingTransaction(transaction);
              }}
              style={buttonStyle}
            >
              Edit
            </button>

            {!isIncome && !isRefunded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refundTransaction(transaction);
                }}
                style={{
                  ...buttonStyle,
                  border: "1px solid rgba(80, 200, 120, 0.5)",
                }}
              >
                Refund
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteTransaction(transaction.id);
              }}
              style={buttonStyle}
            >
              Delete
            </button>
          </div>
        )}
      </li>
    );
  };

  const renderSection = ({
    title,
    total,
    groups,
    orderedMonths,
    openMonths,
    toggleMonth,
    emptyMessage,
  }) => {
    return (
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "10px", fontSize: "18px" }}>
          {title}
        </h3>
        <div style={{ marginBottom: "12px", color: colors.subtext }}>
          Section Total: ${formatCurrency(total)}
        </div>

        {orderedMonths.length === 0 ? (
          <p style={{ color: colors.subtext }}>{emptyMessage}</p>
        ) : (
          orderedMonths.map((monthKey) => {
            const monthTransactions = groups[monthKey];
            const monthTotal = getMonthTotal(monthTransactions);
            const isOpen = openMonths[monthKey];

            return (
              <div key={monthKey} style={{ marginBottom: "14px" }}>
                <button
                  onClick={() => toggleMonth(monthKey)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px",
                    minHeight: "48px",
                    fontWeight: "bold",
                    borderRadius: "10px",
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.card,
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: "15px",
                  }}
                >
                  {isOpen ? "▼" : "▶"} {monthKey} — ${formatCurrency(monthTotal)}
                </button>

                {isOpen && (
                  <ul
                    style={{
                      paddingLeft: "0",
                      listStyle: "none",
                      marginTop: "10px",
                    }}
                  >
                    {monthTransactions.map(renderTransactionCard)}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderCategoryRow = (kind, cat) => {
    const isExpense = kind === "expense";
    const isProtected = isExpense
      ? cat === "Other"
      : cat === "Other" || cat === "Refund";

    return (
      <div
        key={`${kind}-${cat}`}
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: "10px",
          padding: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span>{cat}</span>

        {!isProtected && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
            <button onClick={() => hideCategory(kind, cat)} style={buttonStyle}>
              Hide
            </button>
            <button
              onClick={() => startCategoryReassign(kind, cat)}
              style={buttonStyle}
            >
              Reassign
            </button>
          </div>
        )}
      </div>
    );
  };

  // -------------------- app shell --------------------
  return (
    <div style={shellStyle}>
      <div style={stickyBarStyle}>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setIsTabMenuOpen((prev) => !prev)}
            style={tabSelectorButtonStyle}
          >
            <span>{currentTabLabel}</span>
            <span>{isTabMenuOpen ? "▲" : "▼"}</span>
          </button>

          {isTabMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "110%",
                left: 0,
                right: 0,
                zIndex: 999,

                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: "12px",
                overflow: "hidden",

                boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              }}
            >
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setIsTabMenuOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    minHeight: "46px",
                    textAlign: "left",
                    backgroundColor:
                      activeTab === tab.key ? colors.accent : colors.card,
                    color: colors.text,
                    border: "none",
                    borderBottom:
                      tab.key !== TAB_OPTIONS[TAB_OPTIONS.length - 1].key
                        ? `1px solid ${colors.border}`
                        : "none",
                    cursor: "pointer",
                    fontSize: "15px",
                    fontWeight: activeTab === tab.key ? "700" : "500",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={tabContentStyle}
      >
        {activeTab === "home" && (
          <HomeTab
            colors={colors}
            buttonStyle={buttonStyle}
            inputStyle={inputStyle}
            cardStyle={cardStyle}
            summaryCardStyle={summaryCardStyle}
            formatCurrency={formatCurrency}
            clearHistory={clearHistory}
            getBucketLabel={getBucketLabel}
            digitalBalanceTotal={digitalBalanceTotal}
            walletTotal={walletTotal}
            type={type}
            setType={setType}
            setCategory={setCategory}
            getDefaultCategoryForType={getDefaultCategoryForType}
            setPaymentMethod={setPaymentMethod}
            resetSplitRows={resetSplitRows}
            paymentMethod={paymentMethod}
            amount={amount}
            setAmount={setAmount}
            formatAmountInput={formatAmountInput}
            isSplitMode={isSplitMode}
            setIsSplitMode={setIsSplitMode}
            currentCategories={currentCategories}
            category={category}
            date={date}
            setDate={setDate}
            note={note}
            setNote={setNote}
            splitTotal={splitTotal}
            parseAmountInput={parseAmountInput}
            splitMatchesMainAmount={splitMatchesMainAmount}
            splitRows={splitRows}
            updateSplitRow={updateSplitRow}
            removeSplitRow={removeSplitRow}
            addSplitRow={addSplitRow}
            editingTransactionId={editingTransactionId}
            addTransaction={addTransaction}
            saveEditedTransaction={saveEditedTransaction}
            cancelEditing={cancelEditing}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            monthFilter={monthFilter}
            setMonthFilter={setMonthFilter}
            allMonthOptions={allMonthOptions}
            sortOption={sortOption}
            setSortOption={setSortOption}
            renderSection={renderSection}
            filteredIncomeTotal={filteredIncomeTotal}
            incomeGroups={incomeGroups}
            orderedIncomeMonths={orderedIncomeMonths}
            openIncomeMonths={openIncomeMonths}
            toggleIncomeMonth={toggleIncomeMonth}
            filteredExpenseTotal={filteredExpenseTotal}
            expenseGroups={expenseGroups}
            orderedExpenseMonths={orderedExpenseMonths}
            openExpenseMonths={openExpenseMonths}
            toggleExpenseMonth={toggleExpenseMonth}
            expenseBreakdown={expenseBreakdown}
            accentColors={accentColors}
            weeklySummaryData={weeklySummaryData}
            lastPaycheckTransaction={lastPaycheckTransaction}
            spentSinceLastPaycheck={spentSinceLastPaycheck}
            remainingFromLastPaycheck={remainingFromLastPaycheck}
            pageTitleStyle={pageTitleStyle}
            summaryGridStyle={summaryGridStyle}
            actionRowStyle={actionRowStyle}
            filterGridStyle={filterGridStyle}
            denseCardGridStyle={denseCardGridStyle}
          />
        )}

        {activeTab === "recaps" && (
          <RecapsTab
            colors={colors}
            cardStyle={cardStyle}
            formatCurrency={formatCurrency}
            recapWeeklyData={recapWeeklyData}
            monthlyRecapData={monthlyRecapData}
            pageTitleStyle={pageTitleStyle}
            denseCardGridStyle={denseCardGridStyle}
          />
        )}

        {activeTab === "money" && (
          <MoneyTab
            colors={colors}
            inputStyle={inputStyle}
            buttonStyle={buttonStyle}
            cardStyle={cardStyle}
            summaryCardStyle={summaryCardStyle}
            formatCurrency={formatCurrency}
            totalIncome={moneyTabIncomeTotal}
            totalExpenses={moneyTabExpenseTotal}
            moneyTotalsStartDate={moneyTotalsStartDate}
            setMoneyTotalsStartDate={setMoneyTotalsStartDate}
            getBucketLabel={getBucketLabel}
            digitalBalanceTotal={digitalBalanceTotal}
            walletTotal={walletTotal}
            savingsTotal={savingsTotal}
            spendableBalance={spendableBalance}
            totalBalanceIncludingSavings={totalBalanceIncludingSavings}
            bucketLabels={bucketLabels}
            setBucketLabels={setBucketLabels}
            DEFAULT_BUCKET_LABELS={DEFAULT_BUCKET_LABELS}
            transferFrom={transferFrom}
            setTransferFrom={setTransferFrom}
            transferTo={transferTo}
            setTransferTo={setTransferTo}
            transferAmount={transferAmount}
            setTransferAmount={setTransferAmount}
            transferNote={transferNote}
            setTransferNote={setTransferNote}
            formatAmountInput={formatAmountInput}
            addBucketTransfer={addBucketTransfer}
            orderedBucketTransfers={orderedBucketTransfers}
            deleteBucketTransfer={deleteBucketTransfer}
            pageTitleStyle={pageTitleStyle}
            summaryGridStyle={summaryGridStyle}
            actionRowStyle={actionRowStyle}
          />
        )}


        {activeTab === "subscriptions" && (
          <SubscriptionsTab
            colors={colors}
            inputStyle={inputStyle}
            buttonStyle={buttonStyle}
            cardStyle={cardStyle}
            summaryCardStyle={summaryCardStyle}
            formatCurrency={formatCurrency}
            totalSubscriptionAmount={totalSubscriptionAmount}
            subscriptions={subscriptions}
            subscriptionName={subscriptionName}
            setSubscriptionName={setSubscriptionName}
            subscriptionAmount={subscriptionAmount}
            setSubscriptionAmount={setSubscriptionAmount}
            formatAmountInput={formatAmountInput}
            subscriptionDueDate={subscriptionDueDate}
            setSubscriptionDueDate={setSubscriptionDueDate}
            subscriptionFrequency={subscriptionFrequency}
            setSubscriptionFrequency={setSubscriptionFrequency}
            subscriptionCustomIntervalDays={subscriptionCustomIntervalDays}
            setSubscriptionCustomIntervalDays={setSubscriptionCustomIntervalDays}
            normalizeCustomIntervalInput={normalizeCustomIntervalInput}
            subscriptionNote={subscriptionNote}
            setSubscriptionNote={setSubscriptionNote}
            addSubscription={addSubscription}
            upcomingSubscriptions={upcomingSubscriptions}
            overdueSubscriptionCount={overdueSubscriptionCount}
            dueSoonSubscriptionCount={dueSoonSubscriptionCount}
            deleteSubscription={deleteSubscription}
            pageTitleStyle={pageTitleStyle}
            summaryGridStyle={summaryGridStyle}
            actionRowStyle={actionRowStyle}
          />
        )}
        {activeTab === "creditCards" && (
          <CreditCardsTab
            colors={colors}
            inputStyle={inputStyle}
            buttonStyle={buttonStyle}
            cardStyle={cardStyle}
            summaryCardStyle={summaryCardStyle}
            formatCurrency={formatCurrency}
            formatAmountInput={formatAmountInput}
            creditCards={normalizedCreditCards}
            creditCardName={creditCardName}
            setCreditCardName={setCreditCardName}
            creditCardBalance={creditCardBalance}
            setCreditCardBalance={setCreditCardBalance}
            creditCardLimit={creditCardLimit}
            setCreditCardLimit={setCreditCardLimit}
            creditCardMinimumPayment={creditCardMinimumPayment}
            setCreditCardMinimumPayment={setCreditCardMinimumPayment}
            creditCardDueDate={creditCardDueDate}
            setCreditCardDueDate={setCreditCardDueDate}
            creditCardNote={creditCardNote}
            setCreditCardNote={setCreditCardNote}
            addCreditCard={addCreditCard}
            deleteCreditCard={deleteCreditCard}
            creditCardActionAmounts={creditCardActionAmounts}
            setCreditCardActionAmounts={setCreditCardActionAmounts}
            creditCardActionNotes={creditCardActionNotes}
            setCreditCardActionNotes={setCreditCardActionNotes}
            addCreditCardCharge={addCreditCardCharge}
            addCreditCardPayment={addCreditCardPayment}
            updateCreditCardMinimumPayment={updateCreditCardMinimumPayment}
            updateCreditCardLimit={updateCreditCardLimit}
            updateCreditCardDueDate={updateCreditCardDueDate}
            editingCreditCardActivity={editingCreditCardActivity}
            setEditingCreditCardActivity={setEditingCreditCardActivity}
            startEditingCreditCardActivity={startEditingCreditCardActivity}
            cancelEditingCreditCardActivity={cancelEditingCreditCardActivity}
            saveEditedCreditCardActivity={saveEditedCreditCardActivity}
            deleteCreditCardActivity={deleteCreditCardActivity}
            totalCreditCardDebt={totalCreditCardDebt}
            totalCreditLimit={totalCreditLimit}
            totalCreditAvailable={totalCreditAvailable}
            overallCreditUtilization={overallCreditUtilization}
            pageTitleStyle={pageTitleStyle}
            summaryGridStyle={summaryGridStyle}
            actionRowStyle={actionRowStyle}
          />
        )}

        {activeTab === "debts" && (
          <DebtsTab
            colors={colors}
            inputStyle={inputStyle}
            buttonStyle={buttonStyle}
            cardStyle={cardStyle}
            summaryCardStyle={summaryCardStyle}
            formatCurrency={formatCurrency}
            totalDebtAmount={totalDebtAmount}
            debts={debts}
            debtName={debtName}
            setDebtName={setDebtName}
            debtAmount={debtAmount}
            setDebtAmount={setDebtAmount}
            formatAmountInput={formatAmountInput}
            debtNote={debtNote}
            setDebtNote={setDebtNote}
            addDebt={addDebt}
            orderedDebts={orderedDebts}
            editingDebtId={editingDebtId}
            editingDebtName={editingDebtName}
            setEditingDebtName={setEditingDebtName}
            editingDebtNote={editingDebtNote}
            setEditingDebtNote={setEditingDebtNote}
            saveDebtEdit={saveDebtEdit}
            cancelDebtEdit={cancelDebtEdit}
            debtAdjustAmounts={debtAdjustAmounts}
            setDebtAdjustAmounts={setDebtAdjustAmounts}
            increaseDebt={increaseDebt}
            decreaseDebt={decreaseDebt}
            startEditingDebt={startEditingDebt}
            deleteDebt={deleteDebt}
            pageTitleStyle={pageTitleStyle}
            summaryGridStyle={summaryGridStyle}
            actionRowStyle={actionRowStyle}
          />
        )}

        {activeTab === "categories" && (
          <CategoriesTab
            colors={colors}
            inputStyle={inputStyle}
            buttonStyle={buttonStyle}
            cardStyle={cardStyle}
            newExpenseCategory={newExpenseCategory}
            setNewExpenseCategory={setNewExpenseCategory}
            addCustomCategory={addCustomCategory}
            allExpenseCategories={allExpenseCategories}
            renderCategoryRow={renderCategoryRow}
            categoryReassignState={categoryReassignState}
            allIncomeCategories={allIncomeCategories}
            setCategoryReassignState={setCategoryReassignState}
            confirmCategoryReassign={confirmCategoryReassign}
            cancelCategoryReassign={cancelCategoryReassign}
            newIncomeCategory={newIncomeCategory}
            setNewIncomeCategory={setNewIncomeCategory}
            hiddenExpenseCategories={hiddenExpenseCategories}
            hiddenIncomeCategories={hiddenIncomeCategories}
            restoreHiddenCategory={restoreHiddenCategory}
            importExportText={importExportText}
            setImportExportText={setImportExportText}
            exportDataToText={exportDataToText}
            importDataFromText={importDataFromText}
            pageTitleStyle={pageTitleStyle}
            actionRowStyle={actionRowStyle}
          />
        )}
      </div>

      {confirmState && (
        <div style={modalBackdropStyle} onClick={closeConfirm}>
          <div
            style={modalCardStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
              {confirmState.title}
            </h3>
            <div
              style={{
                color: colors.subtext,
                lineHeight: 1.5,
                marginBottom: "16px",
              }}
            >
              {confirmState.message}
            </div>

            <div style={actionRowStyle}>
              <button onClick={closeConfirm} style={buttonStyle}>
                {confirmState.cancelLabel}
              </button>
              <button
                onClick={runConfirmedAction}
                style={{
                  ...buttonStyle,
                  backgroundColor: confirmState.destructive
                    ? "rgba(255, 107, 107, 0.18)"
                    : colors.accent,
                  border: confirmState.destructive
                    ? "1px solid rgba(255, 107, 107, 0.45)"
                    : `1px solid ${colors.accent}`,
                }}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={toastStyle}>
          <div style={{ fontWeight: "700", marginBottom: "4px" }}>
            {toast.variant === "success"
              ? "Done"
              : toast.variant === "error"
                ? "Check this"
                : "Notice"}
          </div>
          <div style={{ color: colors.subtext }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default App;
