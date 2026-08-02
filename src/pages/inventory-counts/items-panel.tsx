import {
  useDataProvider,
  useGetLocale,
  useList,
  useTranslate,
} from "@refinedev/core";
import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatNumber } from "@/lib/inventory/format";
import { ITEM_STATUS, optionLabel, PRODUCT_UNITS } from "@/lib/inventory/constants";
import type { CountItemRecord, InventoryCountRecord } from "@/lib/inventory/types";
import { completeCount, saveCountItem } from "./actions";
import { cn } from "@/lib/utils";

export function CountItemsPanel({
  count,
  onChanged,
}: {
  count: InventoryCountRecord;
  onChanged: () => void;
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const dataProvider = useDataProvider()();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { result: itemsResult, query: itemsQuery } = useList<CountItemRecord>({
    resource: "scm_inventory_count_items",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    filters: count.id
      ? [{ field: "count_id", operator: "eq", value: count.id }]
      : undefined,
    sorters: [{ field: "id", order: "asc" }],
    errorNotification: false,
    queryOptions: { enabled: Boolean(count.id), retry: false },
    meta: { appends: ["product"] },
  });
  const items = itemsResult?.data ?? [];
  const { refetch } = itemsQuery;

  const isEditable = ["draft", "in_progress"].includes(count.status ?? "");
  const countedItems = useMemo(
    () => items.filter((item) => item.status === "counted").length,
    [items]
  );
  const diffItems = useMemo(
    () => items.filter((item) => Number(item.diffStock ?? 0) !== 0).length,
    [items]
  );

  const handleSaveItem = useCallback(
    async (item: CountItemRecord, value: string) => {
      const parsed = value.trim() === "" ? null : Number(value);
      if (parsed === null || Number.isNaN(parsed)) {
        setEditing((prev) => ({ ...prev, [String(item.id)]: "" }));
        return;
      }
      try {
        setBusy(true);
        setError(undefined);
        await saveCountItem(dataProvider, item.id, parsed);
        await refetch();
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : translate(
                "inv.counts.items.saveError",
                { ns: "inv" },
                "Failed to save"
              )
        );
      } finally {
        setBusy(false);
        setEditing((prev) => {
          const next = { ...prev };
          delete next[String(item.id)];
          return next;
        });
      }
    },
    [dataProvider, refetch, translate]
  );

  const handleComplete = useCallback(async () => {
    setError(undefined);
    setBusy(true);
    try {
      await completeCount(dataProvider, count.id);
      await refetch();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate(
              "inv.counts.items.completeError",
              { ns: "inv" },
              "Failed to complete the count"
            )
      );
    } finally {
      setBusy(false);
    }
  }, [count.id, dataProvider, locale, onChanged, refetch, translate]);

  const handleCancel = useCallback(async () => {
    setError(undefined);
    setBusy(true);
    try {
      await dataProvider.update({
        resource: "scm_inventory_counts",
        id: count.id,
        variables: { status: "cancelled" },
      });
      await refetch();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : translate(
              "inv.counts.items.cancelError",
              { ns: "inv" },
              "Failed to cancel the count"
            )
      );
    } finally {
      setBusy(false);
    }
  }, [count.id, dataProvider, onChanged, refetch, translate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            {translate("inv.counts.items.total", { ns: "inv" }, "Total")}{" "}
            {formatNumber(items.length)} items
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-blue-700 dark:text-blue-300">
            {translate("inv.counts.items.counted", { ns: "inv" }, "Counted")}{" "}
            {formatNumber(countedItems)}
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-amber-700 dark:text-amber-300">
            {translate("inv.counts.items.diff", { ns: "inv" }, "Diff")}{" "}
            {formatNumber(diffItems)}
          </Badge>
        </div>

        {isEditable ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleCancel()}
            >
              {translate("inv.counts.items.cancelCount", { ns: "inv" }, "Cancel count")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleComplete()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {translate(
                "inv.counts.items.completeCount",
                { ns: "inv" },
                "Complete count and adjust stock"
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {translate("inv.common.error", { ns: "inv" }, "Something went wrong")}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {itemsQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : itemsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {translate(
              "inv.counts.items.loadError",
              { ns: "inv" },
              "Unable to load count items"
            )}
          </AlertTitle>
        </Alert>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {translate(
            "inv.counts.items.empty",
            { ns: "inv" },
            "No items yet. Create with a scope to generate them."
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table style={{ tableLayout: "fixed", width: "100%" }}>
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead className="w-14">
                  {translate("inv.counts.items.col.no", { ns: "inv" }, "No.")}
                </TableHead>
                <TableHead className="w-[38%] min-w-48">
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
                    "System stock"
                  )}
                </TableHead>
                <TableHead className="w-36">
                  {translate(
                    "inv.counts.items.col.countedStock",
                    { ns: "inv" },
                    "Counted qty"
                  )}
                </TableHead>
                <TableHead className="w-20">
                  {translate(
                    "inv.counts.items.col.diffStock",
                    { ns: "inv" },
                    "Diff"
                  )}
                </TableHead>
                <TableHead className="w-24">
                  {translate("inv.counts.items.col.status", { ns: "inv" }, "Status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const systemStock = Number(item.systemStock ?? 0);
                const countedStock = Number(item.countedStock ?? item.systemStock ?? 0);
                const diff = countedStock - systemStock;
                const editValue =
                  editing[String(item.id)] ??
                  (item.countedStock === null || item.countedStock === undefined
                    ? ""
                    : String(item.countedStock));
                return (
                  <TableRow key={item.id}>
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
                    <TableCell>{formatNumber(systemStock)}</TableCell>
                    <TableCell>
                      {isEditable ? (
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          className="h-8 w-24"
                          value={editValue}
                          disabled={busy}
                          onChange={(event) =>
                            setEditing((prev) => ({
                              ...prev,
                              [String(item.id)]: event.target.value,
                            }))
                          }
                          onBlur={() =>
                            void handleSaveItem(item, editing[String(item.id)] ?? "")
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <span
                          className={cn(
                            diff === 0
                              ? "font-medium"
                              : "font-semibold text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {formatNumber(countedStock)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium",
                        diff > 0 && "text-emerald-600 dark:text-emerald-400",
                        diff < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatNumber(diff)}
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
    </div>
  );
}
