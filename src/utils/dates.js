export function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDateString(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function getMonthKey(dateString) {
  if (!isValidDateString(dateString)) return "Unknown Month";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function addDaysToDateString(dateString, daysToAdd) {
  if (!isValidDateString(dateString)) return getTodayString();

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(daysToAdd || 0));

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export function addOneMonthToDateString(dateString) {
  if (!isValidDateString(dateString)) return getTodayString();

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const originalDay = day;
  date.setMonth(date.getMonth() + 1);

  if (date.getDate() !== originalDay) {
    date.setDate(0);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export function addOneYearToDateString(dateString) {
  if (!isValidDateString(dateString)) return getTodayString();

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const originalMonth = date.getMonth();
  date.setFullYear(date.getFullYear() + 1);

  if (date.getMonth() !== originalMonth) {
    date.setDate(0);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export function getDaysBetweenDateStrings(fromDateString, toDateString) {
  if (!isValidDateString(fromDateString) || !isValidDateString(toDateString)) {
    return 0;
  }

  const [fy, fm, fd] = fromDateString.split("-").map(Number);
  const [ty, tm, td] = toDateString.split("-").map(Number);

  const fromDate = new Date(fy, fm - 1, fd);
  const toDate = new Date(ty, tm - 1, td);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toDate - fromDate) / msPerDay);
}

export function getDaysUntilDate(dateString, today = getTodayString()) {
  return getDaysBetweenDateStrings(today, dateString);
}

export function advanceSubscriptionDate(subscriptionOrDate, frequency, customIntervalDays) {
  if (
    subscriptionOrDate &&
    typeof subscriptionOrDate === "object" &&
    !Array.isArray(subscriptionOrDate)
  ) {
    const dueDate = subscriptionOrDate.dueDate;
    const nextFrequency = subscriptionOrDate.frequency || "monthly";
    const nextCustomIntervalDays = Number(subscriptionOrDate.customIntervalDays || 30);

    if (nextFrequency === "yearly") {
      return addOneYearToDateString(dueDate);
    }

    if (nextFrequency === "custom") {
      return addDaysToDateString(dueDate, nextCustomIntervalDays);
    }

    return addOneMonthToDateString(dueDate);
  }

  const dueDate = subscriptionOrDate;
  const nextFrequency = frequency || "monthly";
  const nextCustomIntervalDays = Number(customIntervalDays || 30);

  if (nextFrequency === "yearly") {
    return addOneYearToDateString(dueDate);
  }

  if (nextFrequency === "custom") {
    return addDaysToDateString(dueDate, nextCustomIntervalDays);
  }

  return addOneMonthToDateString(dueDate);
}