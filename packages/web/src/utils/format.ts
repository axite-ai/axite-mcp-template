/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format a date string or Date object
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
  locale: string = "en-US"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString(
    locale,
    options || { year: "numeric", month: "short", day: "numeric" }
  );
}

/**
 * Format a number as a percentage
 */
export function formatPercent(
  value: number,
  decimals: number = 2,
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(
  value: number,
  decimals: number = 0,
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format category name (convert snake_case or kebab-case to Title Case)
 */
export function formatCategoryName(category: string): string {
  return category
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format a relative time (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeTime(
  date: string | Date,
  locale: string = "en-US"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffDay) >= 1) {
    return rtf.format(diffDay, "day");
  }
  if (Math.abs(diffHour) >= 1) {
    return rtf.format(diffHour, "hour");
  }
  if (Math.abs(diffMin) >= 1) {
    return rtf.format(diffMin, "minute");
  }
  return rtf.format(diffSec, "second");
}
