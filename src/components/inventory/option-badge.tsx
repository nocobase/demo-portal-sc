import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OptionItem } from "@/lib/inventory/constants";
import { resolveOption } from "@/lib/inventory/constants";

const colorClasses: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300",
  gold: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  geekblue: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300",
  purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
  default:
    "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
};

export function OptionBadge({
  options,
  value,
  locale,
  empty = "-",
  className,
}: {
  options: OptionItem[];
  value?: string | null;
  locale?: string;
  empty?: string;
  className?: string;
}) {
  const option = resolveOption(options, value);
  if (!option) return <span className="text-muted-foreground">{empty}</span>;

  const isChinese = locale !== "en-US";
  const label = isChinese ? option.labelZh : option.labelEn;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-md border bg-card px-2 text-[11px] font-medium shadow-none",
        colorClasses[option.color ?? "default"] ?? colorClasses.default,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          option.color === "default"
            ? "bg-neutral-400"
            : "bg-current opacity-60"
        )}
      />
      {label}
    </Badge>
  );
}
