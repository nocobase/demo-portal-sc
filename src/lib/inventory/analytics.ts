import type { OptionItem } from "@/lib/inventory/constants";
import type { ProductRecord } from "@/lib/inventory/types";

/** Rolling window every derived inventory metric on this portal is based on. */
export const ANALYSIS_WINDOW_DAYS = 90;
/** Stock at or above safety stock times this factor counts as overstock. */
export const OVERSTOCK_FACTOR = 4;
/** A stocked SKU with no issue for this many days is treated as dead stock. */
export const DEAD_STOCK_DAYS = 60;
/** Days of cover a replenishment proposal aims for. */
export const REORDER_COVER_DAYS = 30;
/** Stock below safety times this factor is still "watch", not yet "low". */
export const WATCH_FACTOR = 1.5;

export type StockHealth = "out" | "low" | "watch" | "healthy" | "over";

export const STOCK_HEALTH: OptionItem[] = [
  {
    value: "out",
    i18nKey: "inv.option.stockHealth.out",
    labelZh: "缺货",
    labelEn: "Out of stock",
    color: "red",
  },
  {
    value: "low",
    i18nKey: "inv.option.stockHealth.low",
    labelZh: "低于安全库存",
    labelEn: "Below safety",
    color: "gold",
  },
  {
    value: "watch",
    i18nKey: "inv.option.stockHealth.watch",
    labelZh: "临近安全库存",
    labelEn: "Watch",
    color: "cyan",
  },
  {
    value: "healthy",
    i18nKey: "inv.option.stockHealth.healthy",
    labelZh: "健康",
    labelEn: "Healthy",
    color: "green",
  },
  {
    value: "over",
    i18nKey: "inv.option.stockHealth.over",
    labelZh: "超储",
    labelEn: "Overstock",
    color: "purple",
  },
];

export const ABC_CLASSES: OptionItem[] = [
  {
    value: "A",
    i18nKey: "inv.option.abc.A",
    labelZh: "A 类",
    labelEn: "Class A",
    color: "green",
  },
  {
    value: "B",
    i18nKey: "inv.option.abc.B",
    labelZh: "B 类",
    labelEn: "Class B",
    color: "blue",
  },
  {
    value: "C",
    i18nKey: "inv.option.abc.C",
    labelZh: "C 类",
    labelEn: "Class C",
    color: "default",
  },
];

/** Aggregated movement figures for one product over the analysis window. */
export type ProductMovementStats = {
  /** Everything that increased stock (purchase, return, opening balance). */
  inQty: number;
  /** Everything that decreased stock (sales, losses). */
  outQty: number;
  purchaseQty: number;
  saleQty: number;
  returnQty: number;
  lossQty: number;
  adjustmentQty: number;
  /** Number of inbound documents — a receipt count for supplier scoring. */
  receipts: number;
  issues: number;
  lastInAt?: string;
  lastOutAt?: string;
  lastMovementAt?: string;
};

export const EMPTY_MOVEMENT_STATS: ProductMovementStats = {
  inQty: 0,
  outQty: 0,
  purchaseQty: 0,
  saleQty: 0,
  returnQty: 0,
  lossQty: 0,
  adjustmentQty: 0,
  receipts: 0,
  issues: 0,
};

export function stockHealth(product: ProductRecord): StockHealth {
  const stock = Number(product.currentStock ?? 0);
  const safety = Number(product.safetyStock ?? 0);
  if (stock <= 0) return "out";
  if (stock <= safety) return "low";
  if (safety > 0 && stock >= safety * OVERSTOCK_FACTOR) return "over";
  if (safety > 0 && stock <= safety * WATCH_FACTOR) return "watch";
  return "healthy";
}

/** Health only matters for products that are still traded. */
export function isTracked(product: ProductRecord): boolean {
  return product.status !== "stopped";
}

export function averageDailyIssue(
  stats: ProductMovementStats | undefined,
  windowDays = ANALYSIS_WINDOW_DAYS
): number {
  if (!stats || windowDays <= 0) return 0;
  return stats.outQty / windowDays;
}

/** How many days the current stock lasts at the recent issue rate. */
export function daysOfCover(
  stock: number,
  avgDailyIssue: number
): number | null {
  if (avgDailyIssue <= 0) return null;
  return stock / avgDailyIssue;
}

/** Annualised turns: issues extrapolated to a year over the stock on hand. */
export function turnoverRatio(
  outQty: number,
  averageStock: number,
  windowDays = ANALYSIS_WINDOW_DAYS
): number | null {
  if (averageStock <= 0 || windowDays <= 0) return null;
  return (outQty * (365 / windowDays)) / averageStock;
}

export function inventoryValue(product: ProductRecord): number {
  return Number(product.currentStock ?? 0) * Number(product.purchasePrice ?? 0);
}

export function marginRate(product: ProductRecord): number | null {
  const sale = Number(product.salePrice ?? 0);
  const purchase = Number(product.purchasePrice ?? 0);
  if (sale <= 0) return null;
  return (sale - purchase) / sale;
}

/**
 * Classic Pareto split on consumption value: the SKUs making up the first 80%
 * are A, the next 15% B, the tail C. Products with no consumption fall to C.
 */
export function classifyAbc(
  entries: Array<{ id: number; value: number }>
): Map<number, "A" | "B" | "C"> {
  const result = new Map<number, "A" | "B" | "C">();
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, entry) => sum + Math.max(entry.value, 0), 0);
  if (total <= 0) {
    sorted.forEach((entry) => result.set(entry.id, "C"));
    return result;
  }
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += Math.max(entry.value, 0);
    const share = cumulative / total;
    result.set(entry.id, share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C");
  }
  return result;
}

/**
 * Replenishment proposal: cover the safety level plus the configured days of
 * demand, rounded up. Products that are already covered return 0.
 */
export function suggestedReorderQty(
  product: ProductRecord,
  stats: ProductMovementStats | undefined,
  windowDays = ANALYSIS_WINDOW_DAYS
): number {
  const stock = Number(product.currentStock ?? 0);
  const safety = Number(product.safetyStock ?? 0);
  const demand = averageDailyIssue(stats, windowDays) * REORDER_COVER_DAYS;
  const target = Math.max(safety + demand, safety * 2, demand);
  const gap = target - stock;
  return gap > 0 ? Math.ceil(gap) : 0;
}

export function isDeadStock(
  product: ProductRecord,
  stats: ProductMovementStats | undefined,
  now = new Date()
): boolean {
  if (Number(product.currentStock ?? 0) <= 0) return false;
  if (!isTracked(product)) return false;
  if (!stats?.lastOutAt) return true;
  const last = new Date(stats.lastOutAt).getTime();
  if (Number.isNaN(last)) return true;
  return (now.getTime() - last) / 86_400_000 >= DEAD_STOCK_DAYS;
}

export function daysSince(value?: string | null, now = new Date()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now.getTime() - time) / 86_400_000);
}

export function formatRatio(
  value: number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

/** ISO date for "n days ago", used as the lower bound of aggregate filters. */
export function isoDaysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
