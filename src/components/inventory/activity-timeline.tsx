import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export type TimelineTone = "neutral" | "in" | "out" | "warning" | "success";

export type TimelineEvent = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  at?: string | null;
  actor?: string | null;
  icon?: ReactNode;
  tone?: TimelineTone;
  /** Right-aligned figure, e.g. the signed quantity of a movement. */
  amount?: ReactNode;
};

const toneRing: Record<TimelineTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  in: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  out: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  success: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

/**
 * Audit trail rendering. Events arrive already sorted by the caller so a page
 * can weave record changes and stock movements into one stream.
 */
export function ActivityTimeline({
  events,
  locale,
  emptyText,
  className,
}: {
  events: TimelineEvent[];
  locale?: string;
  emptyText: string;
  className?: string;
}) {
  if (events.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyText}
      </p>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((event, index) => {
        const tone = event.tone ?? "neutral";
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-0 left-[13px] w-px bg-border"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-background [&_svg]:size-3.5",
                toneRing[tone]
              )}
            >
              {event.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{event.title}</span>
                {event.amount ? (
                  <span className="text-sm">{event.amount}</span>
                ) : null}
              </div>
              {event.description ? (
                <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {event.description}
                </div>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{formatDateTime(event.at, locale)}</span>
                {event.actor ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{event.actor}</span>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
