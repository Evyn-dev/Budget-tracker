const BACKUP_PREFIX = "QBUD2:";
const GZIP_MARKER = "GZ.";
const RAW_MARKER = "RAW.";

const TYPE_TO_CODE = {
  income: 0,
  expense: 1,
};

const CODE_TO_TYPE = ["income", "expense"];

const PAYMENT_TO_CODE = {
  card: 0,
  cash: 1,
};

const CODE_TO_PAYMENT = ["card", "cash"];

const BUCKET_TO_CODE = {
  digital: 0,
  wallet: 1,
  savings: 2,
};

const CODE_TO_BUCKET = ["digital", "wallet", "savings"];

const FREQUENCY_TO_CODE = {
  monthly: 0,
  yearly: 1,
  custom: 2,
};

const CODE_TO_FREQUENCY = ["monthly", "yearly", "custom"];

const CARD_ACTIVITY_TO_CODE = {
  charge: 0,
  payment: 1,
};

const CODE_TO_CARD_ACTIVITY = ["charge", "payment"];

function stripEmptyTail(items) {
  const next = [...items];
  while (
    next.length > 0 &&
    (next[next.length - 1] === undefined ||
      next[next.length - 1] === null ||
      next[next.length - 1] === "" ||
      next[next.length - 1] === false)
  ) {
    next.pop();
  }
  return next;
}

function cleanNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function compactDate(value) {
  return typeof value === "string" ? value.replace(/-/g, "") : "";
}

function expandDate(value) {
  if (typeof value !== "string") return "";
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function base64UrlFromBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function gzipTextToBase64Url(text) {
  if (typeof CompressionStream === "undefined") return null;

  try {
    const stream = new Blob([text], { type: "application/json" })
      .stream()
      .pipeThrough(new CompressionStream("gzip"));

    const buffer = await new Response(stream).arrayBuffer();
    return base64UrlFromBytes(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

async function gunzipBase64UrlToText(value) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Compressed backups are not supported in this browser.");
  }

  const bytes = bytesFromBase64Url(value);
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

function textToBase64Url(text) {
  return base64UrlFromBytes(new TextEncoder().encode(text));
}

function base64UrlToText(value) {
  return new TextDecoder().decode(bytesFromBase64Url(value));
}

function makeLookup() {
  const values = [];
  const map = new Map();

  const add = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (map.has(text)) return map.get(text);

    const index = values.length;
    values.push(text);
    map.set(text, index);
    return index;
  };

  return { values, add };
}

function compactBudgetData(payload = {}) {
  const categories = makeLookup();

  const addCategoryList = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => categories.add(item))
      .filter((item) => item !== null);
  };

  const transactions = Array.isArray(payload.transactions)
    ? payload.transactions.map((item) =>
        stripEmptyTail([
          item?.id ?? "",
          cleanNumber(item?.amount),
          categories.add(item?.category || "Other"),
          TYPE_TO_CODE[item?.type] ?? 1,
          compactDate(item?.date),
          item?.note || "",
          item?.paymentMethod == null ? null : PAYMENT_TO_CODE[item.paymentMethod] ?? 0,
          item?.refunded ? 1 : 0,
          item?.refundedById ?? null,
          item?.refundSourceId ?? null,
          item?.splitGroupId ?? null,
        ])
      )
    : [];

  const bucketTransfers = Array.isArray(payload.bucketTransfers)
    ? payload.bucketTransfers.map((item) =>
        stripEmptyTail([
          item?.id ?? "",
          cleanNumber(item?.amount),
          BUCKET_TO_CODE[item?.from] ?? 0,
          BUCKET_TO_CODE[item?.to] ?? 2,
          compactDate(item?.date),
          item?.note || "",
        ])
      )
    : [];

  const subscriptions = Array.isArray(payload.subscriptions)
    ? payload.subscriptions.map((item) =>
        stripEmptyTail([
          item?.id ?? "",
          item?.name || "",
          cleanNumber(item?.amount),
          compactDate(item?.dueDate),
          item?.note || "",
          FREQUENCY_TO_CODE[item?.frequency] ?? 0,
          Number(item?.customIntervalDays || 30),
          compactDate(item?.lastChargedDate),
        ])
      )
    : [];

  const debts = Array.isArray(payload.debts)
    ? payload.debts.map((item) =>
        stripEmptyTail([item?.id ?? "", item?.name || "", cleanNumber(item?.amount), item?.note || ""])
      )
    : [];

  const creditCards = Array.isArray(payload.creditCards)
    ? payload.creditCards.map((card) =>
        stripEmptyTail([
          card?.id ?? "",
          card?.name || "Credit Card",
          cleanNumber(card?.balance),
          cleanNumber(card?.limit),
          cleanNumber(card?.minimumPayment),
          compactDate(card?.dueDate),
          card?.note || "",
          compactDate(card?.createdAt),
          Array.isArray(card?.history)
            ? card.history.map((item) =>
                stripEmptyTail([
                  item?.id ?? "",
                  CARD_ACTIVITY_TO_CODE[item?.type] ?? 0,
                  cleanNumber(item?.amount),
                  compactDate(item?.date),
                  item?.note || "",
                ])
              )
            : [],
        ])
      )
    : [];

  return {
    v: 2,
    e: payload.exportedAt || new Date().toISOString(),
    k: categories.values,
    t: transactions,
    bt: bucketTransfers,
    s: subscriptions,
    d: debts,
    cc: creditCards,
    ce: addCategoryList(payload.customExpenseCategories),
    ci: addCategoryList(payload.customIncomeCategories),
    he: addCategoryList(payload.hiddenExpenseCategories),
    hi: addCategoryList(payload.hiddenIncomeCategories),
    b: [
      payload.bucketLabels?.digital || "Digital Balance",
      payload.bucketLabels?.wallet || "Wallet",
      payload.bucketLabels?.savings || "Savings",
    ],
  };
}

function expandBudgetData(compact = {}) {
  const categories = Array.isArray(compact.k) ? compact.k : [];
  const getCategory = (index, fallback = "Other") => categories[index] || fallback;
  const categoryList = (items) =>
    Array.isArray(items)
      ? items.map((index) => getCategory(index, "")).filter(Boolean)
      : [];

  return {
    version: 2,
    exportedAt: compact.e || null,
    transactions: Array.isArray(compact.t)
      ? compact.t.map((item) => ({
          id: item[0],
          amount: cleanNumber(item[1]),
          category: getCategory(item[2]),
          type: CODE_TO_TYPE[item[3]] || "expense",
          date: expandDate(item[4]),
          note: item[5] || "",
          paymentMethod: item[6] == null ? null : CODE_TO_PAYMENT[item[6]] || "card",
          refunded: Boolean(item[7]),
          refundedById: item[8] ?? null,
          refundSourceId: item[9] ?? null,
          splitGroupId: item[10] ?? null,
        }))
      : [],
    bucketTransfers: Array.isArray(compact.bt)
      ? compact.bt.map((item) => ({
          id: item[0],
          amount: cleanNumber(item[1]),
          from: CODE_TO_BUCKET[item[2]] || "digital",
          to: CODE_TO_BUCKET[item[3]] || "savings",
          date: expandDate(item[4]),
          note: item[5] || "",
        }))
      : [],
    subscriptions: Array.isArray(compact.s)
      ? compact.s.map((item) => ({
          id: item[0],
          name: item[1] || "",
          amount: cleanNumber(item[2]),
          dueDate: expandDate(item[3]),
          note: item[4] || "",
          frequency: CODE_TO_FREQUENCY[item[5]] || "monthly",
          customIntervalDays: Number(item[6] || 30),
          lastChargedDate: expandDate(item[7]) || null,
        }))
      : [],
    debts: Array.isArray(compact.d)
      ? compact.d.map((item) => ({
          id: item[0],
          name: item[1] || "",
          amount: cleanNumber(item[2]),
          note: item[3] || "",
        }))
      : [],
    creditCards: Array.isArray(compact.cc)
      ? compact.cc.map((card) => ({
          id: card[0],
          name: card[1] || "Credit Card",
          balance: cleanNumber(card[2]),
          limit: cleanNumber(card[3]),
          minimumPayment: cleanNumber(card[4]),
          dueDate: expandDate(card[5]),
          note: card[6] || "",
          createdAt: expandDate(card[7]),
          history: Array.isArray(card[8])
            ? card[8].map((item) => ({
                id: item[0],
                type: CODE_TO_CARD_ACTIVITY[item[1]] || "charge",
                amount: cleanNumber(item[2]),
                date: expandDate(item[3]),
                note: item[4] || "",
              }))
            : [],
        }))
      : [],
    customExpenseCategories: categoryList(compact.ce),
    customIncomeCategories: categoryList(compact.ci),
    hiddenExpenseCategories: categoryList(compact.he),
    hiddenIncomeCategories: categoryList(compact.hi),
    bucketLabels: {
      digital: compact.b?.[0] || "Digital Balance",
      wallet: compact.b?.[1] || "Wallet",
      savings: compact.b?.[2] || "Savings",
    },
  };
}

export async function createBudgetBackupText(payload) {
  const compactJson = JSON.stringify(compactBudgetData(payload));
  const gzipped = await gzipTextToBase64Url(compactJson);

  if (gzipped) {
    return `${BACKUP_PREFIX}${GZIP_MARKER}${gzipped}`;
  }

  return `${BACKUP_PREFIX}${RAW_MARKER}${textToBase64Url(compactJson)}`;
}

export async function readBudgetBackupText(text) {
  const value = String(text || "").trim();

  if (!value.startsWith(BACKUP_PREFIX)) {
    return JSON.parse(value);
  }

  const body = value.slice(BACKUP_PREFIX.length);
  let json;

  if (body.startsWith(GZIP_MARKER)) {
    json = await gunzipBase64UrlToText(body.slice(GZIP_MARKER.length));
  } else if (body.startsWith(RAW_MARKER)) {
    json = base64UrlToText(body.slice(RAW_MARKER.length));
  } else {
    throw new Error("Unsupported backup format.");
  }

  return expandBudgetData(JSON.parse(json));
}
