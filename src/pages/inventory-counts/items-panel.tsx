import { useDataProvider, useGetLocale, useTranslate } from "@refinedev/core";
import { CheckCheck, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ExportCsvButton, TableSearchInput } from "@/components/inventory/list-toolbar";
import { OptionBadge } from "@/components/inventory/option-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ITEM_STATUS, optionLabel, PRODUCT_UNITS } from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatNumber } from "@/lib/inventory/format";
import type { CountItemRecord, InventoryCountRecord } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { acceptSystemQuantities, saveCountItem } from "./actions";

type CountItemWithProduct = CountItemRecord & {
  product?: {
    id: number;
    name?: string | null;
    sku?: string | null;
    unit?: string | null;
    purchasePrice?: number | null;
  } | null;
};

type LineFilter = "all" | "pending" | "counted" | "variance";

export function CountItemsPanel({
  count,
  items,
  isLoading,
  isError,
  onRefetch,
  editable,
}: {
  count: InventoryCountRecord;
  items: CountItemWithProduct[];
  isLoading?: boolean;
  isError?: boolean;
  onRefetch: () => Promise<void> | void;
  editable: boolean;
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const dataProvider = useDataProvider()();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<LineFilter>("all");
  const [search, setSearch] = useState("");

  const diffOf = useCallback((item: CountItemWithProduct) => {
    const system = Number(item.systemStock ?? 0);
    if (item.countedStock === null || item.countedStock === undefined) return 0;
    return Number(item.countedStock) - system;
  }, []);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "pending" && item.status !== "pending") return false;
      if (filter === "counted" && item.status === "pending") return false;
      if (filter === "variance" && diffOf(item) === 0) return false;
      if (!term) return true;
      return [item.product?.name, item.product?.sku]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [diffOf, filter, items, search]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending").length,
    [items]
  );

  const handleSaveItem = useCallback(
    async (item: CountItemWithProduct, value: string) => {
      const parsed = value.trim() === "" ? null : Number(value);
      if (parsed === null || Number.isNaN(parsed)) {
        setEditing((previous) => ({ ...previous, [String(item.id)]: "" }));
        return;
      }
      try {
        setBusy(true);
        setError(undefined);
        await saveCountItem(dataProvider, item.id, parsed);
        await onRefetch();
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : translate("inv.counts.items.saveError", { ns: "inv" }, "Failed to save")
        );
      } finally {
        setBusy(false);
        setEditing((previous) => {
          const next = { ...previous };
          delete next[String(item.id)];
          return next;
        });
      }
    },
    [dataProvider, onRefetch, translate]
  );

  const handleAcceptSystem = useCallback(async () => {
    const confirmed = window.confirm(
      translate(
        "inv.counts.items.acceptSystemConfirm",
        { ns: "inv", count: pendingCount },
        `Record the system quantity for the ${pendingCount} open line(s)?`
      )
    );
    if (!confirmed) return;
    try {
      setBusy(true);
      setError(undefined);
      await acceptSystemQuantities(dataProvider, items);
      await onRefetch();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate("inv.counts.items.saveError", { ns: "inv" }, "Failed to save")
      );
    } finally {
      setBusy(false);
    }
  }, [dataProvider, items, onRefetch, pendingCount, translate]);

  const filters: Array<{ id: LineFilter; label: string; count: number }> = [
    {
      id: "all",
      label: translate("inv.counts.items.filter.all", { ns: "inv" }, "All lines"),
      count: items.length,
    },
    {
      id: "pending",
      label: translate("inv.counts.items.filter.pending", { ns: "inv" }, "Open"),
      count: pendingCount,
    },
    {
      id: "counted",
      label: translate(
        "inv.counts.items.filter.counted",
        { ns: "inv" },
        "Counted"
      ),
      count: items.length - pendingCount,
    },
    {
      id: "variance",
      label: translate(
        "inv.counts.items.filter.variance",
        { ns: "inv" },
        "Variances"
      ),
      count: items.filter((item) => diffOf(item) !== 0).length,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {translate("inv.counts.items.title", { ns: "inv" }, "Count lines")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {editable && pendingCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() => void handleAcceptSystem()}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              {translate(
                "inv.counts.items.acceptSystem",
                { ns: "inv", count: pendingCount },
                `Accept system qty (${pendingCount})`
              )}
            </Button>
          ) : null}
          <ExportCsvButton
            disabled={items.length === 0}
            onExport={() =>
              exportCsv(`count-${count.countNo ?? count.id}`, visibleItems, [
                { header: "SKU", value: (row) => row.product?.sku ?? "" },
                { header: "Product", value: (row) => row.product?.name ?? "" },
                { header: "System stock", value: (row) => row.systemStock ?? 0 },
                { header: "Counted", value: (row) => row.countedStock ?? "" },
                { header: "Variance", value: (row) => diffOf(row) },
                { header: "Status", value: (row) => row.status ?? "" },
                { header: "Notes", value: (row) => row.remark ?? "" },
              ])
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                "flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                filter === option.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {option.label}
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  filter === option.id ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder={translate(
            "inv.counts.items.searchPlaceholder",
            { ns: "inv" },
            "Search product or SKU"
          )}
          className="ml-auto w-full sm:w-60"
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {translate("inv.common.error", { ns: "inv" }, "Something went wrong")}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {translate(
              "inv.counts.items.loadError",
              { ns: "inv" },
              "Unable to load count items"
            )}
          </AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => void onRefetch()}
            >
              {translate("inv.common.retry", { ns: "inv" }, "Retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? translate(
                "inv.counts.items.empty",
                { ns: "inv" },
                "No lines yet. Create a count with a scope to generate them."
              )
            : translate(
                "inv.counts.items.emptyFilter",
                { ns: "inv" },
                "No lines match this filter."
              )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table style={{ tableLayout: "fixed", width: "100%" }}>
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead className="w-12">
                  {translate("inv.counts.items.col.no", { ns: "inv" }, "No.")}
                </TableHead>
                <TableHead className="w-[30%] min-w-44">
                  {translate(
                    "inv.counts.items.col.product",
                    { ns: "inv" },
                    "Product"
                  )}
                </TableHead>
                <TableHead className="w-24">
                  {translate(
                    "inv.counts.items.col.systemStock",
                    { ns: "inv" },
                    "System"
                  )}
                </TableHead>
                <TableHead className="w-32">
                  {translate(
                    "inv.counts.items.col.countedStock",
                    { ns: "inv" },
                    "Counted"
                  )}
                </TableHead>
                <TableHead className="w-20">
                  {translate("inv.counts.items.col.diffStock", { ns: "inv" }, "Var.")}
                </TableHead>
                <TableHead className="w-28">
                  {translate(
                    "inv.counts.items.col.diffValue",
                    { ns: "inv" },
                    "Value impact"
                  )}
                </TableHead>
                <TableHead className="w-24">
                  {translate("inv.counts.items.col.status", { ns: "inv" }, "Status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item, index) => {
                const systemStock = Number(item.systemStock ?? 0);
                const diff = diffOf(item);
                const editValue =
                  editing[String(item.id)] ??
                  (item.countedStock === null || item.countedStock === undefined
                    ? ""
                    : String(item.countedStock));
                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      diff !== 0 &&
                        "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20"
                    )}
                  >
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="min-w-0">
                        <span className="block truncate font-medium">
                          {item.product?.name ?? "-"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.product?.sku}
                          {item.product?.unit
                            ? ` · ${optionLabel(PRODUCT_UNITS, item.product.unit)}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatNumber(systemStock)}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          className="h-8 w-24"
                          value={editValue}
                          disabled={busy}
                          onChange={(event) =>
                            setEditing((previous) => ({
                              ...previous,
                              [String(item.id)]: event.target.value,
                            }))
                          }
                          onBlur={() => {
                            const pending = editing[String(item.id)];
                            if (pending === undefined) return;
                            void handleSaveItem(item, pending);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {item.countedStock === null ||
                          item.countedStock === undefined
                            ? "-"
                            : formatNumber(item.countedStock)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium tabular-nums",
                        diff > 0 && "text-emerald-600 dark:text-emerald-400",
                        diff < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatNumber(diff)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        diff < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {diff === 0
                        ? "-"
                        : formatCurrency(
                            diff * Number(item.product?.purchasePrice ?? 0),
                            locale
                          )}
                    </TableCell>
                    <TableCell>
                      <OptionBadge
                        options={ITEM_STATUS}
                        value={item.status}
                        locale={locale}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
