import { useTranslate } from "@refinedev/core";
import {
  Columns3,
  Download,
  Rows2,
  Rows3,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { SavedView, TableDensity } from "@/lib/inventory/view-state";
import { cn } from "@/lib/utils";

/** One row above the table: views on the left, table tools on the right. */
export function ListToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SavedViewTabs({
  views,
  activeView,
  onChange,
  counts,
}: {
  views: SavedView[];
  activeView: string;
  onChange: (view: string) => void;
  /** Optional per-view row counts; only shown for views that supply one. */
  counts?: Record<string, number | undefined>;
}) {
  const translate = useTranslate();

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
      {views.map((view) => {
        const isActive = view.id === activeView;
        const count = counts?.[view.id];
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {translate(view.labelKey, { ns: "inv" }, view.labelFallback)}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TableSearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const translate = useTranslate();

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          placeholder ?? translate("inv.common.search", { ns: "inv" }, "Search")
        }
        className="h-8 pr-7 pl-8 text-sm"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={translate("inv.common.clear", { ns: "inv" }, "Clear")}
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export type ColumnOption = { id: string; label: string };

export function ColumnSettingsMenu({
  columns,
  hiddenColumns,
  onToggleColumn,
  onReset,
  density,
  onDensityChange,
}: {
  columns: ColumnOption[];
  hiddenColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onReset: () => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
}) {
  const translate = useTranslate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Columns3 className="size-3.5" />
            <span className="hidden sm:inline">
              {translate("inv.common.columns", { ns: "inv" }, "Columns")}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          {translate("inv.common.density", { ns: "inv" }, "Density")}
        </DropdownMenuLabel>
        <div className="flex gap-1 px-1.5 pb-1.5">
          <Button
            type="button"
            variant={density === "compact" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 flex-1 gap-1.5 text-xs"
            onClick={() => onDensityChange("compact")}
          >
            <Rows3 className="size-3.5" />
            {translate("inv.common.density.compact", { ns: "inv" }, "Compact")}
          </Button>
          <Button
            type="button"
            variant={density === "comfortable" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 flex-1 gap-1.5 text-xs"
            onClick={() => onDensityChange("comfortable")}
          >
            <Rows2 className="size-3.5" />
            {translate(
              "inv.common.density.comfortable",
              { ns: "inv" },
              "Comfortable"
            )}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {translate("inv.common.visibleColumns", { ns: "inv" }, "Visible columns")}
        </DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={!hiddenColumns.includes(column.id)}
            closeOnClick={false}
            onCheckedChange={() => onToggleColumn(column.id)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onReset}>
          <RotateCcw />
          {translate("inv.common.resetColumns", { ns: "inv" }, "Reset columns")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportCsvButton({
  onExport,
  disabled,
  label,
}: {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const translate = useTranslate();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      disabled={disabled}
      onClick={onExport}
    >
      <Download className="size-3.5" />
      <span className="hidden sm:inline">
        {label ?? translate("inv.common.exportCsv", { ns: "inv" }, "Export CSV")}
      </span>
    </Button>
  );
}

/** Appears only while rows are selected; hosts the bulk actions for the page. */
export function BulkActionBar({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const translate = useTranslate();

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-accent/40 px-3 py-2">
      <Badge variant="secondary" className="tabular-nums">
        {translate(
          "inv.common.selectedCount",
          { ns: "inv", count: selectedCount },
          `${selectedCount} selected`
        )}
      </Badge>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-7 text-xs"
        onClick={onClear}
      >
        {translate("inv.common.clearSelection", { ns: "inv" }, "Clear selection")}
      </Button>
    </div>
  );
}
