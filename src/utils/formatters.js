export function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAmountInput(value) {
  if (value == null) return "";

  let next = String(value).replace(/[^\d.]/g, "");

  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next =
      next.slice(0, firstDot + 1) +
      next.slice(firstDot + 1).replace(/\./g, "");
  }

  const [whole, decimal] = next.split(".");
  if (decimal != null) {
    return `${whole}.${decimal.slice(0, 2)}`;
  }

  return whole;
}

export function parseAmountInput(value) {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}