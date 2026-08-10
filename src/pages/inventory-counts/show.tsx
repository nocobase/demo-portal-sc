import {
  useDataProvider,
  useGetLocale,
  useList,
  useShow,
  useTranslate,
} from "@refinedev/core";
import { Ban, Loader2, PlayCircle, RotateCw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import {
  CopyLinkButton,
  DetailGrid,
  DetailItem,
  DetailSection,
  PrintButton,
  StatTile,
} from "@/components/inventory/detail-scaffold";
import { OptionBadge } from "@/components/inventory/option-badge";
import {
  PrintDocumentHeader,
  PrintSignatureRow,
} from "@/components/inventory/print-document";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { formatPercent } from "@/lib/inventory/analytics";
import {
  COUNT_SCOPES,
  COUNT_STATUS,
  optionLabel,
} from "@/lib/inventory/constants";
import { formatCurrency, formatDate, formatNumber } from "@/lib/inventory/format";
import { pushRecentRecord } from "@/lib/inventory/recent-records";
import type { CountItemRecord, InventoryCountRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import {
  CountProgressBar,
  CountStageStepper,
  resolveStage,
  type CountProgress,
} from "./count-progress";
import { CountItemsPanel } from "./items-panel";
import { completeCount, startCount } from "./actions";

type CountDetail = InventoryCountRecord & {
  updatedAt?: string | null;
};

type CountItemWithProduct = CountItemRecord & {
  product?: {
    id: number;
    name?: string | null;
    sku?: string | null;
    unit?: string | null;
    purchasePrice?: number | null;
  } | null;
};

export const InventoryCountShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { id } = useParams<{ id: string }>();
  const dataProvider = useDataProvider()();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const { result: record, query } = useShow<CountDetail>({
    resource: "scm_inventory_counts",
    id,
  });

  useEffect(() => {
    if (!record?.id) return;
    pushRecentRecord({
      resource: "scm_inventory_counts",
      id: String(record.id),
      label: record.countNo ?? String(record.id),
      sublabel: record.countBy ?? undefined,
      path: `/counting/counts/show/${record.id}`,
    });
  }, [record?.countBy, record?.countNo, record?.id]);

  const { result: itemsResult, query: itemsQuery } =
    useList<CountItemWithProduct>({
      resource: "scm_inventory_count_items",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      filters: record?.id
        ? [{ field: "count_id", operator: "eq", value: record.id }]
        : undefined,
      sorters: [{ field: "id", order: "asc" }],
      errorNotification: false,
      queryOptions: { enabled: Boolean(record?.id), retry: false },
      meta: { appends: ["product"] },
    });
  const items = useMemo(() => itemsResult?.data ?? [], [itemsResult?.data]);

  const refreshAll = useCallback(async () => {
    await Promise.all([query.refetch(), itemsQuery.refetch()]);
  }, [itemsQuery, query]);

  const progress = useMemo<CountProgress>(() => {
    const summary: CountProgress = {
      total: items.length,
      counted: 0,
      pending: 0,
      resolved: 0,
    };
    for (const item of items) {
      if (item.status === "counted") summary.counted += 1;
      else if (item.status === "resolved") summary.resolved += 1;
      else summary.pending += 1;
    }
    return summary;
  }, [items]);

  const variance = useMemo(() => {
    let lines = 0;
    let netQty = 0;
    let netValue = 0;
    let shrinkValue = 0;
    for (const item of items) {
      const system = Number(item.systemStock ?? 0);
      const counted =
        item.countedStock === null || item.countedStock === undefined
          ? system
          : Number(item.countedStock);
      const diff = counted - system;
      if (diff === 0) continue;
      lines += 1;
      netQty += diff;
      const value = diff * Number(item.product?.purchasePrice ?? 0);
      netValue += value;
      if (diff < 0) shrinkValue += value;
    }
    return {
      lines,
      netQty,
      netValue,
      shrinkValue,
      rate: items.length > 0 ? lines / items.length : null,
    };
  }, [items]);

  const stage = resolveStage(record?.status, progress);
  const stageLabel =
    stage === "draft"
      ? translate("inv.counts.stage.draft", { ns: "inv" }, "Draft")
      : stage === "in_progress"
      ? translate("inv.counts.stage.in_progress", { ns: "inv" }, "Counting")
      : stage === "review"
      ? translate(
          "inv.counts.stage.review",
          { ns: "inv" },
          "Variance review"
        )
      : stage === "completed"
      ? translate("inv.counts.stage.completed", { ns: "inv" }, "Posted")
      : optionLabel(COUNT_STATUS, stage);
  const isOpen = stage === "draft" || stage === "in_progress" || stage === "review";
  const canStart = stage === "draft";
  const canPost = stage === "review" || stage === "in_progress";
  const allCounted = progress.total > 0 && progress.pending === 0;

  const integrityIssues = useMemo(() => {
    if (!record) return [];
    const issues: string[] = [];
    if (Number(record.totalItems ?? 0) !== items.length) {
      issues.push(
        `Header says ${Number(record.totalItems ?? 0)} line(s), but ${items.length} detail line(s) were loaded.`
      );
    }
    if (Number(record.diffCount ?? 0) !== variance.lines) {
      issues.push(
        `Header says ${Number(record.diffCount ?? 0)} variance line(s), but the details contain ${variance.lines}.`
      );
    }
    if (record.status === "completed" && progress.resolved !== progress.total) {
      issues.push(
        `This count is completed, but ${progress.total - progress.resolved} line(s) are not resolved.`
      );
    }
    const productIds = items
      .map((item) => item.productId ?? item.product?.id)
      .filter((productId): productId is number => productId !== undefined);
    if (new Set(productIds).size !== productIds.length) {
      issues.push("The same product appears more than once on this count.");
    }
    return issues;
  }, [items, progress.resolved, progress.total, record, variance.lines]);

  const runAction = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      setError(undefined);
      setBusy(true);
      try {
        await action();
        await refreshAll();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : fallbackMessage);
      } finally {
        setBusy(false);
      }
    },
    [refreshAll]
  );

  const handleStart = useCallback(() => {
    if (!record) return;
    void runAction(
      () => startCount(dataProvider, record.id),
      translate(
        "inv.counts.actions.startError",
        { ns: "inv" },
        "Could not start the count"
      )
    );
  }, [dataProvider, record, runAction, translate]);

  const handlePost = useCallback(() => {
    if (!record) return;
    if (!allCounted) {
      setError(
        translate(
          "inv.counts.actions.postPendingBlocked",
          { ns: "inv", count: progress.pending },
          `${progress.pending} line(s) are still uncounted. Count them or explicitly accept the system quantities first.`
        )
      );
      return;
    }
    void runAction(
      () => completeCount(dataProvider, record.id),
      translate(
        "inv.counts.items.completeError",
        { ns: "inv" },
        "Failed to complete the count"
      )
    );
  }, [allCounted, dataProvider, progress.pending, record, runAction, translate]);

  const handleCancel = useCallback(() => {
    if (!record) return;
    const proceed = window.confirm(
      translate(
        "inv.counts.actions.cancelConfirm",
        { ns: "inv" },
        "Cancel this count sheet? No stock will be adjusted."
      )
    );
    if (!proceed) return;
    void runAction(
      async () => {
        await dataProvider.update({
          resource: "scm_inventory_counts",
          id: record.id,
          variables: { status: "cancelled" },
        });
      },
      translate(
        "inv.counts.items.cancelError",
        { ns: "inv" },
        "Failed to cancel the count"
      )
    );
  }, [dataProvider, record, runAction, translate]);

  const detailContext = useAIPageElementHandle({
    id: `inventory-counts-detail-${id ?? "current"}`,
    title: `${translate(
      "inv.counts.ai.detail",
      { ns: "inv" },
      "Count order details"
    )}: ${record?.countNo ?? record?.id ?? ""}`,
    kind: "detail",
    getContext: () => ({
      resource: "scm_inventory_counts",
      record: {
        id: record?.id,
        countNo: record?.countNo,
        scope: record?.scope,
        status: record?.status,
        stage,
        countDate: record?.countDate,
        countBy: record?.countBy,
        remark: record?.remark,
      },
      progress,
      variance,
      lines: items.slice(0, 50).map((item) => ({
        product: item.product?.name,
        sku: item.product?.sku,
        systemStock: item.systemStock,
        countedStock: item.countedStock,
        diffStock: item.diffStock,
        status: item.status,
      })),
    }),
  });

  return (
    <RouteDrawer
      className="lg:w-[62vw] lg:min-w-[52rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.countNo ?? `#${record?.id ?? ""}`
        )
      }
      description={translate(
        "inv.counts.drawer.show.description",
        { ns: "inv" },
        "Enter counted quantities and post the sheet; stock is adjusted by each variance."
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/counting/counts"
      actions={
        record ? (
          <>
            <CopyLinkButton />
            <PrintButton />
            <RefreshButton
              resource="scm_inventory_counts"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
              onClick={() => void refreshAll()}
            >
              <RotateCw />
            </RefreshButton>
          </>
        ) : null
      }
    >
      <div
        ref={detailContext.ref}
        className="print-document min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.counts.detail.loadError.title",
                { ns: "inv" },
                "Unable to load count order"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <PrintDocumentHeader
              title={translate(
                "inv.print.countSheet",
                { ns: "inv" },
                "Inventory Count Sheet"
              )}
              documentNo={record.countNo}
              meta={[
                {
                  label: translate(
                    "inv.counts.fields.countDate",
                    { ns: "inv" },
                    "Count date"
                  ),
                  value: formatDate(record.countDate, locale),
                },
                {
                  label: translate(
                    "inv.counts.fields.countBy",
                    { ns: "inv" },
                    "Counted by"
                  ),
                  value: record.countBy || "-",
                },
                {
                  label: translate(
                    "inv.counts.fields.scope",
                    { ns: "inv" },
                    "Scope"
                  ),
                  value: optionLabel(COUNT_SCOPES, record.scope),
                },
                {
                  label: translate(
                    "inv.counts.fields.status",
                    { ns: "inv" },
                    "Stage"
                  ),
                  value: stageLabel,
                },
                {
                  label: translate(
                    "inv.counts.fields.totalItems",
                    { ns: "inv" },
                    "Total lines"
                  ),
                  value: formatNumber(progress.total, locale),
                },
                {
                  label: translate(
                    "inv.counts.fields.diffCount",
                    { ns: "inv" },
                    "Variance lines"
                  ),
                  value: formatNumber(variance.lines, locale),
                },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <OptionBadge
                options={COUNT_STATUS}
                value={record.status}
                locale={locale}
              />
              <OptionBadge
                options={COUNT_SCOPES}
                value={record.scope}
                locale={locale}
              />
            </div>

            <CountStageStepper stage={stage} />

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {translate(
                    "inv.common.error",
                    { ns: "inv" },
                    "Something went wrong"
                  )}
                </AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {integrityIssues.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {translate(
                    "inv.counts.integrity.title",
                    { ns: "inv" },
                    "Count data is inconsistent"
                  )}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {integrityIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {isOpen ? (
              <div className="print-hidden flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {stage === "draft"
                    ? translate(
                        "inv.counts.actions.hint.draft",
                        { ns: "inv" },
                        "Start the count to open the sheet for entry."
                      )
                    : stage === "review"
                    ? translate(
                        "inv.counts.actions.hint.review",
                        { ns: "inv" },
                        "All lines are counted. Review the variances, then post to adjust stock."
                      )
                    : translate(
                        "inv.counts.actions.hint.counting",
                        { ns: "inv" },
                        "Enter counted quantities below; lines save as you leave each field."
                      )}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={busy}
                    onClick={handleCancel}
                  >
                    <Ban className="size-3.5" />
                    {translate(
                      "inv.counts.items.cancelCount",
                      { ns: "inv" },
                      "Cancel count"
                    )}
                  </Button>
                  {canStart ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={handleStart}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PlayCircle className="size-3.5" />
                      )}
                      {translate(
                        "inv.counts.actions.start",
                        { ns: "inv" },
                        "Start counting"
                      )}
                    </Button>
                  ) : null}
                  {canPost ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={busy || progress.total === 0 || !allCounted}
                      title={
                        progress.total === 0
                          ? translate(
                              "inv.counts.actions.noLines",
                              { ns: "inv" },
                              "This sheet has no lines to post"
                            )
                          : !allCounted
                          ? translate(
                              "inv.counts.actions.pendingLines",
                              { ns: "inv", count: progress.pending },
                              `${progress.pending} line(s) still need a counted quantity`
                            )
                          : undefined
                      }
                      onClick={handlePost}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      {translate(
                        "inv.counts.items.completeCount",
                        { ns: "inv" },
                        "Post and adjust stock"
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile
                label={translate(
                  "inv.counts.fields.totalItems",
                  { ns: "inv" },
                  "Lines"
                )}
                value={formatNumber(progress.total)}
              />
              <StatTile
                label={translate(
                  "inv.counts.stats.pending",
                  { ns: "inv" },
                  "Still open"
                )}
                value={formatNumber(progress.pending)}
                tone={progress.pending > 0 ? "warning" : "success"}
              />
              <StatTile
                label={translate(
                  "inv.counts.fields.diffCount",
                  { ns: "inv" },
                  "Variance lines"
                )}
                value={formatNumber(variance.lines)}
                hint={formatPercent(variance.rate, 1)}
                tone={variance.lines > 0 ? "warning" : "default"}
              />
              <StatTile
                label={translate(
                  "inv.counts.stats.netQty",
                  { ns: "inv" },
                  "Net variance"
                )}
                value={`${variance.netQty >= 0 ? "+" : ""}${formatNumber(
                  variance.netQty
                )}`}
                tone={variance.netQty < 0 ? "danger" : "default"}
              />
              <StatTile
                label={translate(
                  "inv.counts.stats.netValue",
                  { ns: "inv" },
                  "Value impact"
                )}
                value={formatCurrency(variance.netValue, locale)}
                hint={
                  variance.shrinkValue < 0
                    ? `${translate(
                        "inv.counts.stats.shrink",
                        { ns: "inv" },
                        "Shrinkage"
                      )} ${formatCurrency(variance.shrinkValue, locale)}`
                    : undefined
                }
                tone={variance.netValue < 0 ? "danger" : "default"}
              />
            </div>

            <CountProgressBar progress={progress} />

            <DetailSection>
              <DetailGrid columns={3}>
                <DetailItem
                  label={translate(
                    "inv.counts.fields.countDate",
                    { ns: "inv" },
                    "Count date"
                  )}
                  value={formatDate(record.countDate, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.counts.fields.countBy",
                    { ns: "inv" },
                    "Counted by"
                  )}
                  value={record.countBy || "-"}
                />
                <DetailItem
                  label={translate(
                    "inv.counts.fields.createdAt",
                    { ns: "inv" },
                    "Created"
                  )}
                  value={formatDate(record.createdAt, locale)}
                />
              </DetailGrid>
            </DetailSection>

            {record.remark ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {record.remark}
              </p>
            ) : null}

            <Separator />

            <div className="print-only space-y-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1.5 text-left">
                      {translate(
                        "inv.counts.items.col.no",
                        { ns: "inv" },
                        "No."
                      )}
                    </th>
                    <th className="border px-2 py-1.5 text-left">
                      {translate(
                        "inv.products.fields.sku",
                        { ns: "inv" },
                        "SKU"
                      )}
                    </th>
                    <th className="border px-2 py-1.5 text-left">
                      {translate(
                        "inv.counts.items.col.product",
                        { ns: "inv" },
                        "Product"
                      )}
                    </th>
                    <th className="border px-2 py-1.5 text-right">
                      {translate(
                        "inv.counts.items.col.systemStock",
                        { ns: "inv" },
                        "System quantity"
                      )}
                    </th>
                    <th className="border px-2 py-1.5 text-right">
                      {translate(
                        "inv.counts.items.col.countedStock",
                        { ns: "inv" },
                        "Counted quantity"
                      )}
                    </th>
                    <th className="border px-2 py-1.5 text-right">
                      {translate(
                        "inv.counts.items.col.diffStock",
                        { ns: "inv" },
                        "Variance"
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const hasCount =
                      item.countedStock !== null &&
                      item.countedStock !== undefined;
                    return (
                      <tr key={item.id}>
                        <td className="border px-2 py-1.5 tabular-nums">
                          {formatNumber(index + 1, locale)}
                        </td>
                        <td className="border px-2 py-1.5">
                          {item.product?.sku || "-"}
                        </td>
                        <td className="border px-2 py-1.5">
                          {item.product?.name || "-"}
                        </td>
                        <td className="border px-2 py-1.5 text-right tabular-nums">
                          {formatNumber(item.systemStock, locale)}
                        </td>
                        <td className="border px-2 py-1.5 text-right tabular-nums">
                          {hasCount
                            ? formatNumber(item.countedStock, locale)
                            : ""}
                        </td>
                        <td className="border px-2 py-1.5 text-right tabular-nums">
                          {hasCount
                            ? formatNumber(item.diffStock, locale)
                            : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm tabular-nums">
                <span>
                  {translate(
                    "inv.counts.fields.totalItems",
                    { ns: "inv" },
                    "Total lines"
                  )}: {formatNumber(progress.total, locale)}
                </span>
                <span>
                  {translate(
                    "inv.counts.items.counted",
                    { ns: "inv" },
                    "Counted lines"
                  )}: {formatNumber(progress.counted + progress.resolved, locale)}
                </span>
                <span>
                  {translate(
                    "inv.counts.fields.diffCount",
                    { ns: "inv" },
                    "Variance lines"
                  )}: {formatNumber(variance.lines, locale)}
                </span>
                <span>
                  {translate(
                    "inv.counts.stats.netQty",
                    { ns: "inv" },
                    "Net variance quantity"
                  )}: {variance.netQty >= 0 ? "+" : ""}
                  {formatNumber(variance.netQty, locale)}
                </span>
              </div>
            </div>

            <div className="print-hidden">
              <CountItemsPanel
                count={record}
                items={items}
                isLoading={itemsQuery.isLoading}
                isError={itemsQuery.isError}
                onRefetch={refreshAll}
                editable={isOpen}
              />
            </div>

            <PrintSignatureRow
              labels={[
                translate(
                  "inv.print.countedBy",
                  { ns: "inv" },
                  "Counted by"
                ),
                translate(
                  "inv.print.verifiedBy",
                  { ns: "inv" },
                  "Verified by"
                ),
              ]}
            />
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
