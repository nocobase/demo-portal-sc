export function formatNumber(
  value: number | string | null | undefined,
  locale = "en-US"
): string {
  if (value === null || value === undefined || value === "") return "-";
  const number = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(number)) return "-";
  return new Intl.NumberFormat(locale).format(number);
}

export function formatCurrency(
  value: number | string | null | undefined,
  locale = "en-US",
  currency = "USD"
): string {
  if (value === null || value === undefined || value === "") return "-";
  const number = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(number)) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatDateTime(
  value?: string | null,
  locale = "en-US"
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value?: string | null, locale = "en-US"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatRelativeDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  return `${Math.abs(diffDays)} days ago`;
}
