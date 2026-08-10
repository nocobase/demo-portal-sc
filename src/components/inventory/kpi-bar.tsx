import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "success" | "warning" | "danger" | "info";

export type KpiItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: KpiTone;
  /** Set to turn the tile into a drill-down into the matching filtered view. */
  onClick?: () => void;
  active?: boolean;
};

const toneAccent: Record<KpiTone, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
};

const toneIcon: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  danger: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

/**
 * The summary strip that sits above a list. Tiles are compact on purpose —
 * they are a legend for the table below, not a dashboard.
 */
export function KpiBar({
  items,
  loading,
  className,
}: {
  items: KpiItem[];
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
          className
        )}
      >
        {items.map((item) => (
          <Skeleton key={item.id} className="h-[74px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? "default";
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
              {item.icon ? (
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-3.5",
                    toneIcon[tone]
                  )}
                >
                  {item.icon}
                </span>
              ) : null}
            </div>
            <div
              className={cn(
                "mt-1 truncate text-xl font-semibold tabular-nums",
                toneAccent[tone]
              )}
            >
              {item.value}
            </div>
            {item.hint ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {item.hint}
              </div>
            ) : null}
          </>
        );

        const base =
          "rounded-xl border bg-card px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

        return item.onClick ? (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-pressed={item.active}
            className={cn(
              base,
              "cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40",
              item.active && "border-primary/60 bg-accent/50"
            )}
          >
            {body}
          </button>
        ) : (
          <div key={item.id} className={cn(base, item.active && "border-primary/60")}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
