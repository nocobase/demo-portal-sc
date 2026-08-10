import { useTranslate } from "@refinedev/core";
import { Info, RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Derived columns (turns, days of cover, ABC, dead stock) come from a separate
 * aggregate query. Saying so — and letting the user retry when it fails —
 * keeps the numbers auditable instead of mysterious.
 */
export function ActivityBadgeGroup({
  windowDays,
  isLoading,
  isError,
  onRetry,
  className,
}: {
  windowDays: number;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  const translate = useTranslate();

  if (isError) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
          className
        )}
      >
        <TriangleAlert className="size-3.5" />
        {translate(
          "inv.metrics.error",
          { ns: "inv" },
          "Movement analytics failed to load — turns, cover and ABC are unavailable."
        )}
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onRetry}
          >
            <RotateCw className="size-3" />
            {translate("inv.common.retry", { ns: "inv" }, "Retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="size-3.5" />
      <span>
        {translate(
          "inv.metrics.window",
          { ns: "inv", days: windowDays },
          `Turns, days of cover and ABC are computed from the last ${windowDays} days of movements.`
        )}
      </span>
      {isLoading ? (
        <span className="animate-pulse">
          {translate("inv.metrics.loading", { ns: "inv" }, "calculating…")}
        </span>
      ) : null}
    </div>
  );
}
