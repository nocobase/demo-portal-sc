import { useTranslate } from "@refinedev/core";

import { OptionBadge } from "@/components/inventory/option-badge";
import {
  ABC_CLASSES,
  OVERSTOCK_FACTOR,
  STOCK_HEALTH,
  type StockHealth,
} from "@/lib/inventory/analytics";
import { formatNumber } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export function StockHealthBadge({
  health,
  locale,
}: {
  health: StockHealth;
  locale?: string;
}) {
  return <OptionBadge options={STOCK_HEALTH} value={health} locale={locale} />;
}

export function AbcBadge({
  abc,
  locale,
}: {
  abc?: "A" | "B" | "C" | null;
  locale?: string;
}) {
  return <OptionBadge options={ABC_CLASSES} value={abc} locale={locale} />;
}

const barTone: Record<StockHealth, string> = {
  out: "bg-red-500",
  low: "bg-amber-500",
  watch: "bg-cyan-500",
  healthy: "bg-emerald-500",
  over: "bg-purple-500",
};

/**
 * On-hand against the safety level. The bar is scaled to the overstock
 * threshold so "far above safety" and "just above safety" look different.
 */
export function StockLevelMeter({
  stock,
  safety,
  health,
  className,
}: {
  stock: number;
  safety: number;
  health: StockHealth;
  className?: string;
}) {
  const ceiling = Math.max(safety * OVERSTOCK_FACTOR, stock, 1);
  const stockShare = Math.min(stock / ceiling, 1);
  const safetyShare = safety > 0 ? Math.min(safety / ceiling, 1) : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tabular-nums">
          {formatNumber(stock)}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          / {formatNumber(safety)}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barTone[health])}
          style={{ width: `${Math.max(stockShare * 100, stock > 0 ? 3 : 0)}%` }}
        />
        {safetyShare !== null ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-foreground/50"
            style={{ left: `${safetyShare * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Days of cover with a tone that mirrors the reorder urgency. */
export function CoverageLabel({
  days,
  className,
}: {
  days: number | null;
  className?: string;
}) {
  const translate = useTranslate();
  if (days === null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {translate("inv.metrics.noDemand", { ns: "inv" }, "No recent demand")}
      </span>
    );
  }
  const rounded = Math.floor(days);
  return (
    <span
      className={cn(
        "text-sm font-medium tabular-nums",
        rounded <= 7 && "text-red-600 dark:text-red-400",
        rounded > 7 && rounded <= 21 && "text-amber-600 dark:text-amber-400",
        className
      )}
    >
      {translate("inv.metrics.daysOfCover", { ns: "inv", count: rounded }, `${rounded} d`)}
    </span>
  );
}

/** Signed quantity with the in/out colour convention used across the portal. */
export function SignedQuantity({
  quantity,
  direction,
  className,
}: {
  quantity: number;
  direction: "in" | "out" | "flat";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        direction === "in" && "text-emerald-600 dark:text-emerald-400",
        direction === "out" && "text-red-600 dark:text-red-400",
        className
      )}
    >
      {direction === "in" ? "+" : direction === "out" ? "-" : ""}
      {formatNumber(Math.abs(quantity))}
    </span>
  );
}
