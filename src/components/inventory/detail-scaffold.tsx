import { useTranslate } from "@refinedev/core";
import { Check, Link2, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-2">
          {title ? (
            <h3 className="text-sm font-medium">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DetailGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {children}
    </dl>
  );
}

export function DetailItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium break-words",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "success" && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Compact metric tile used inside detail headers. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate text-lg font-semibold tabular-nums",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "success" && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** Segmented control used for detail tabs inside drawers. */
export function DetailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; badge?: number }>;
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Copies the current deep link so a record can be handed to a colleague. */
export function CopyLinkButton({ className }: { className?: string }) {
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={className}
      aria-label={translate("inv.common.copyLink", { ns: "inv" }, "Copy link")}
      title={translate("inv.common.copyLink", { ns: "inv" }, "Copy link")}
      onClick={() => {
        void navigator.clipboard?.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check /> : <Link2 />}
    </Button>
  );
}

export function PrintButton({ className }: { className?: string }) {
  const translate = useTranslate();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={className}
      aria-label={translate("inv.common.print", { ns: "inv" }, "Print")}
      title={translate("inv.common.print", { ns: "inv" }, "Print")}
      onClick={() => window.print()}
    >
      <Printer />
    </Button>
  );
}
