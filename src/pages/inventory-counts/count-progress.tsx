import { useTranslate } from "@refinedev/core";
import { Check, CircleDashed, Clock } from "lucide-react";

import { formatNumber } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export type CountProgress = {
  total: number;
  counted: number;
  pending: number;
  resolved: number;
};

/**
 * Counted plus already resolved lines over the sheet's total. `fallbackTotal`
 * covers sheets whose header total was written before the lines existed.
 */
export function CountProgressBar({
  progress,
  fallbackTotal,
  className,
}: {
  progress?: CountProgress;
  fallbackTotal?: number;
  className?: string;
}) {
  const translate = useTranslate();
  const total = progress?.total ?? fallbackTotal ?? 0;
  const done = (progress?.counted ?? 0) + (progress?.resolved ?? 0);
  const share = total > 0 ? Math.min(done / total, 1) : 0;

  if (total === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {translate("inv.counts.progress.noLines", { ns: "inv" }, "No lines")}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-1.5 text-xs tabular-nums">
        <span className="font-medium">
          {formatNumber(done)}/{formatNumber(total)}
        </span>
        <span className="text-muted-foreground">
          {Math.round(share * 100)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            share >= 1 ? "bg-emerald-500" : "bg-blue-500"
          )}
          style={{ width: `${Math.max(share * 100, done > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export type CountStage = "draft" | "in_progress" | "review" | "completed";

const STAGE_ORDER: CountStage[] = [
  "draft",
  "in_progress",
  "review",
  "completed",
];

/**
 * The sheet's lifecycle as a stepper. "Review" is not a stored status — it is
 * the in-progress sheet whose lines are all counted and whose variances are
 * waiting to be accepted, which is exactly when a supervisor gets involved.
 */
export function resolveStage(
  status: string | null | undefined,
  progress?: CountProgress
): CountStage | "cancelled" {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "draft") return "draft";
  const total = progress?.total ?? 0;
  const pending = progress?.pending ?? 0;
  if (total > 0 && pending === 0) return "review";
  return "in_progress";
}

export function CountStageStepper({
  stage,
  className,
}: {
  stage: CountStage | "cancelled";
  className?: string;
}) {
  const translate = useTranslate();

  const labels: Record<CountStage, string> = {
    draft: translate("inv.counts.stage.draft", { ns: "inv" }, "Draft"),
    in_progress: translate(
      "inv.counts.stage.in_progress",
      { ns: "inv" },
      "Counting"
    ),
    review: translate(
      "inv.counts.stage.review",
      { ns: "inv" },
      "Variance review"
    ),
    completed: translate("inv.counts.stage.completed", { ns: "inv" }, "Posted"),
  };

  if (stage === "cancelled") {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground",
          className
        )}
      >
        {translate(
          "inv.counts.stage.cancelledNote",
          { ns: "inv" },
          "This count sheet was cancelled; no stock was adjusted."
        )}
      </div>
    );
  }

  const activeIndex = STAGE_ORDER.indexOf(stage);

  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)}>
      {STAGE_ORDER.map((item, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <li key={item} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
                isActive && "border-primary bg-primary text-primary-foreground",
                isDone &&
                  "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                !isActive && !isDone && "bg-card text-muted-foreground"
              )}
            >
              {isDone ? (
                <Check className="size-3.5" />
              ) : isActive ? (
                <Clock className="size-3.5" />
              ) : (
                <CircleDashed className="size-3.5" />
              )}
              {labels[item]}
            </div>
            {index < STAGE_ORDER.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px w-4",
                  index < activeIndex ? "bg-emerald-400" : "bg-border"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
