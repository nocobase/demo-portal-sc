import { useGetLocale, useShow, useTranslate } from "@refinedev/core";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  RotateCw,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useOutlet, useParams } from "react-router";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import type { OptionItem } from "@/lib/inventory/constants";
import { formatCurrency, formatDate, formatNumber } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

type PurchaseOrderItemRecord = {
  id: number;
  po_id?: number | null;
  product_id?: number | null;
  product?: { id: number; name?: string | null; sku?: string | null } | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  amount?: number | string | null;
  receivedQuantity?: number | string | null;
};

type PurchaseOrderDetail = {
  id: number;
  orderNo?: string | null;
  supplier_id?: number | null;
  supplier?: { id: number; name?: string | null } | null;
  orderDate?: string | null;
  promisedDate?: string | null;
  actualArrivalDate?: string | null;
  status?: string | null;
  totalAmount?: number | string | null;
  remark?: string | null;
  items?: PurchaseOrderItemRecord[] | null;
};

type PurchaseOrderStage =
  | "draft"
  | "placed"
  | "partially_received"
  | "received";

const PURCHASE_ORDER_STATUS: OptionItem[] = [
  {
    value: "draft",
    i18nKey: "inv.option.purchaseOrderStatus.draft",
    labelZh: "草稿",
    labelEn: "Draft",
    color: "default",
  },
  {
    value: "placed",
    i18nKey: "inv.option.purchaseOrderStatus.placed",
    labelZh: "已下单",
    labelEn: "Placed",
    color: "blue",
  },
  {
    value: "partially_received",
    i18nKey: "inv.option.purchaseOrderStatus.partially_received",
    labelZh: "部分收货",
    labelEn: "Partially received",
    color: "gold",
  },
  {
    value: "received",
    i18nKey: "inv.option.purchaseOrderStatus.received",
    labelZh: "已收货",
    labelEn: "Received",
    color: "green",
  },
  {
    value: "cancelled",
    i18nKey: "inv.option.purchaseOrderStatus.cancelled",
    labelZh: "已取消",
    labelEn: "Cancelled",
    color: "red",
  },
];

const STAGE_ORDER: PurchaseOrderStage[] = [
  "draft",
  "placed",
  "partially_received",
  "received",
];
const DAY_MS = 86_400_000;

function dateBoundary(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isOpenOrder(order?: PurchaseOrderDetail): boolean {
  return Boolean(
    order &&
      (order.status === "placed" || order.status === "partially_received") &&
      !order.actualArrivalDate
  );
}

function PurchaseOrderStageStepper({
  status,
}: {
  status?: string | null;
}) {
  const translate = useTranslate();
  const labels: Record<PurchaseOrderStage, string> = {
    draft: translate(
      "inv.purchaseOrders.stage.draft",
      { ns: "inv" },
      "Draft"
    ),
    placed: translate(
      "inv.purchaseOrders.stage.placed",
      { ns: "inv" },
      "Placed"
    ),
    partially_received: translate(
      "inv.purchaseOrders.stage.partiallyReceived",
      { ns: "inv" },
      "Partially received"
    ),
    received: translate(
      "inv.purchaseOrders.stage.received",
      { ns: "inv" },
      "Received"
    ),
  };

  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {translate(
          "inv.purchaseOrders.stage.cancelledNote",
          { ns: "inv" },
          "This purchase order was cancelled and will not advance further."
        )}
      </div>
    );
  }

  const activeIndex = STAGE_ORDER.indexOf(status as PurchaseOrderStage);

  return (
    <ol className="flex flex-wrap items-center gap-1">
      {STAGE_ORDER.map((stage, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <li key={stage} className="flex items-center gap-1">
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
              {labels[stage]}
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

export const PurchaseOrderShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { id } = useParams<{ id: string }>();
  const nestedDrawer = useOutlet();
  const { result: record, query } = useShow<PurchaseOrderDetail>({
    resource: "scm_purchase_orders",
    id,
    meta: { appends: ["supplier", "items", "items.product"] },
  });

  const items = useMemo(() => record?.items ?? [], [record?.items]);
  const today = dateBoundary(new Date().toISOString()) ?? Date.now();
  const orderedAt = dateBoundary(record?.orderDate);
  const promisedAt = dateBoundary(record?.promisedDate);
  const actualAt = dateBoundary(record?.actualArrivalDate);
  const hasInvalidDateSequence = Boolean(
    orderedAt !== null &&
      ((promisedAt !== null && promisedAt < orderedAt) ||
        (actualAt !== null && actualAt < orderedAt))
  );
  const overdue =
    isOpenOrder(record) && promisedAt !== null && promisedAt < today
      ? Math.floor((today - promisedAt) / DAY_MS)
      : 0;

  const totals = useMemo(() => {
    let orderedQuantity = 0;
    let receivedQuantity = 0;
    let hasReceivedQuantity = false;
    let lineAmount = 0;
    for (const item of items) {
      orderedQuantity += Number(item.quantity ?? 0);
      lineAmount += Number(item.amount ?? 0);
      if (
        item.receivedQuantity !== null &&
        item.receivedQuantity !== undefined
      ) {
        hasReceivedQuantity = true;
        receivedQuantity += Number(item.receivedQuantity);
      }
    }
    const receiptProgress =
      hasReceivedQuantity && orderedQuantity > 0
        ? receivedQuantity / orderedQuantity
        : null;
    return {
      orderedQuantity,
      receivedQuantity: hasReceivedQuantity ? receivedQuantity : null,
      receiptProgress,
      lineAmount,
      reconciled: Math.abs(lineAmount - Number(record?.totalAmount ?? 0)) < 0.01,
    };
  }, [items, record?.totalAmount]);

  const delivery = useMemo(() => {
    const emDash = translate("inv.common.emDash", { ns: "inv" }, "—");
    if (hasInvalidDateSequence) {
      return {
        label: translate(
          "inv.purchaseOrders.delivery.invalidDates",
          { ns: "inv" },
          "Invalid date sequence"
        ),
        tone: "danger" as const,
      };
    }
    if (record?.status === "draft" || record?.status === "cancelled") {
      return { label: emDash, tone: "default" as const };
    }
    if (promisedAt === null) {
      return { label: emDash, tone: "default" as const };
    }
    if (actualAt !== null) {
      const days = Math.floor((actualAt - promisedAt) / DAY_MS);
      return days <= 0
        ? {
            label: translate(
              "inv.purchaseOrders.delivery.onTime",
              { ns: "inv" },
              "On time"
            ),
            tone: "success" as const,
          }
        : {
            label: translate(
              "inv.purchaseOrders.delivery.lateDays",
              { ns: "inv", days },
              "Late by {{days}} days"
            ),
            tone: "danger" as const,
          };
    }
    if (isOpenOrder(record) && promisedAt < today) {
      const days = Math.floor((today - promisedAt) / DAY_MS);
      return {
        label: translate(
          "inv.purchaseOrders.delivery.overdueDays",
          { ns: "inv", days },
          "Overdue by {{days}} days"
        ),
        tone: "warning" as const,
      };
    }
    return { label: emDash, tone: "default" as const };
  }, [actualAt, hasInvalidDateSequence, promisedAt, record, today, translate]);

  const emDash = translate("inv.common.emDash", { ns: "inv" }, "—");

  return (
    <RouteDrawer
      className="lg:w-[68vw] lg:min-w-[58rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.orderNo ?? `#${record?.id ?? ""}`
        )
      }
      description={translate(
        "inv.purchaseOrders.drawer.show.description",
        { ns: "inv" },
        "Purchase order details, receipt progress and line reconciliation."
      )}
      closeLabel={translate("inv.common.close", { ns: "inv" }, "Close")}
      closeTo="/goods/purchase-orders"
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <CopyLinkButton className="print-hidden" />
            <PrintButton className="print-hidden" />
            <RefreshButton
              resource="scm_purchase_orders"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              className="print-hidden"
              aria-label={translate(
                "inv.common.refresh",
                { ns: "inv" },
                "Refresh"
              )}
              title={translate(
                "inv.common.refresh",
                { ns: "inv" },
                "Refresh"
              )}
            >
              <RotateCw />
            </RefreshButton>
          </>
        ) : null
      }
    >
      <div className="print-document min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.purchaseOrders.detail.loadError.title",
                { ns: "inv" },
                "Unable to load purchase order"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <Alert>
              <AlertTriangle />
              <AlertTitle>
                {translate(
                  "inv.purchaseOrders.readOnly.title",
                  { ns: "inv" },
                  "Read-only purchasing report"
                )}
              </AlertTitle>
              <AlertDescription>
                {translate(
                  "inv.purchaseOrders.readOnly.description",
                  { ns: "inv" },
                  "Approval, ordering, receiving, returns and cancellation are not implemented in this portal. The status steps below are informational only."
                )}
              </AlertDescription>
            </Alert>

            {hasInvalidDateSequence ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>
                  {translate(
                    "inv.purchaseOrders.invalidDates.title",
                    { ns: "inv" },
                    "Purchase order dates are inconsistent"
                  )}
                </AlertTitle>
                <AlertDescription>
                  {translate(
                    "inv.purchaseOrders.invalidDates.description",
                    { ns: "inv" },
                    "Promised and actual arrival dates cannot be earlier than the order date. This record needs correction by an authorised data owner."
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <PrintDocumentHeader
              title={translate(
                "inv.print.purchaseOrder",
                { ns: "inv" },
                "Purchase Order"
              )}
              documentNo={record.orderNo}
              meta={[
                {
                  label: translate(
                    "inv.purchaseOrders.fields.supplier",
                    { ns: "inv" },
                    "Supplier"
                  ),
                  value: record.supplier?.name ?? emDash,
                },
                {
                  label: translate(
                    "inv.purchaseOrders.fields.orderDate",
                    { ns: "inv" },
                    "Order date"
                  ),
                  value: formatDate(record.orderDate, locale),
                },
                {
                  label: translate(
                    "inv.purchaseOrders.fields.promisedDate",
                    { ns: "inv" },
                    "Promised date"
                  ),
                  value: formatDate(record.promisedDate, locale),
                },
                {
                  label: translate(
                    "inv.purchaseOrders.fields.totalAmount",
                    { ns: "inv" },
                    "Total amount"
                  ),
                  value: formatCurrency(record.totalAmount, locale),
                },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <OptionBadge
                options={PURCHASE_ORDER_STATUS}
                value={record.status}
                locale={locale}
                empty={emDash}
              />
            </div>

            {overdue > 0 ? (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle />
                <AlertTitle>
                  {translate(
                    "inv.purchaseOrders.overdue.title",
                    { ns: "inv" },
                    "Delivery overdue"
                  )}
                </AlertTitle>
                <AlertDescription className="text-current/80">
                  {translate(
                    "inv.purchaseOrders.overdue.description",
                    { ns: "inv", days: overdue },
                    "This order is {{days}} days past its promised date and has not arrived."
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <PurchaseOrderStageStepper status={record.status} />

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile
                label={translate(
                  "inv.purchaseOrders.stats.lines",
                  { ns: "inv" },
                  "Lines"
                )}
                value={formatNumber(items.length, locale)}
              />
              <StatTile
                label={translate(
                  "inv.purchaseOrders.stats.orderedQuantity",
                  { ns: "inv" },
                  "Ordered quantity"
                )}
                value={formatNumber(totals.orderedQuantity, locale)}
              />
              <StatTile
                label={translate(
                  "inv.purchaseOrders.stats.receivedQuantity",
                  { ns: "inv" },
                  "Received quantity"
                )}
                value={
                  totals.receivedQuantity === null
                    ? emDash
                    : formatNumber(totals.receivedQuantity, locale)
                }
                tone={
                  totals.receiptProgress !== null && totals.receiptProgress >= 1
                    ? "success"
                    : totals.receiptProgress !== null &&
                        totals.receiptProgress > 0
                      ? "warning"
                      : "default"
                }
              />
              <StatTile
                label={translate(
                  "inv.purchaseOrders.stats.receiptProgress",
                  { ns: "inv" },
                  "Receipt progress"
                )}
                value={
                  totals.receiptProgress === null
                    ? emDash
                    : `${Math.round(totals.receiptProgress * 100)}%`
                }
                tone={
                  totals.receiptProgress !== null && totals.receiptProgress >= 1
                    ? "success"
                    : totals.receiptProgress !== null &&
                        totals.receiptProgress > 0
                      ? "warning"
                      : "default"
                }
              />
              <StatTile
                label={translate(
                  "inv.purchaseOrders.fields.totalAmount",
                  { ns: "inv" },
                  "Total amount"
                )}
                value={formatCurrency(record.totalAmount, locale)}
              />
            </div>

            <DetailSection>
              <DetailGrid columns={3}>
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.orderNo",
                    { ns: "inv" },
                    "Order no."
                  )}
                  value={record.orderNo ?? emDash}
                />
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.supplier",
                    { ns: "inv" },
                    "Supplier"
                  )}
                  value={
                    record.supplier?.id ? (
                      <Link
                        className="hover:underline"
                        to={`/goods/suppliers/show/${record.supplier.id}`}
                      >
                        {record.supplier.name ?? emDash}
                      </Link>
                    ) : (
                      emDash
                    )
                  }
                />
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.orderDate",
                    { ns: "inv" },
                    "Order date"
                  )}
                  value={formatDate(record.orderDate, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.promisedDate",
                    { ns: "inv" },
                    "Promised date"
                  )}
                  value={formatDate(record.promisedDate, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.actualArrivalDate",
                    { ns: "inv" },
                    "Arrival date"
                  )}
                  value={formatDate(record.actualArrivalDate, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.purchaseOrders.fields.delivery",
                    { ns: "inv" },
                    "Delivery"
                  )}
                  value={delivery.label}
                  tone={delivery.tone}
                />
              </DetailGrid>
            </DetailSection>

            <DetailSection
              title={translate(
                "inv.purchaseOrders.detail.lines",
                { ns: "inv" },
                "Order lines"
              )}
            >
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table style={{ tableLayout: "fixed", width: "100%" }}>
                  <TableHeader className="bg-muted/45">
                    <TableRow>
                      <TableHead className="w-[30%] min-w-48">
                        {translate(
                          "inv.purchaseOrders.items.product",
                          { ns: "inv" },
                          "Product"
                        )}
                      </TableHead>
                      <TableHead className="w-24 text-right">
                        {translate(
                          "inv.purchaseOrders.items.quantity",
                          { ns: "inv" },
                          "Quantity"
                        )}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {translate(
                          "inv.purchaseOrders.items.unitPrice",
                          { ns: "inv" },
                          "Unit price"
                        )}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {translate(
                          "inv.purchaseOrders.items.amount",
                          { ns: "inv" },
                          "Amount"
                        )}
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        {translate(
                          "inv.purchaseOrders.items.receivedQuantity",
                          { ns: "inv" },
                          "Received"
                        )}
                      </TableHead>
                      <TableHead className="w-40">
                        {translate(
                          "inv.purchaseOrders.items.progress",
                          { ns: "inv" },
                          "Receipt progress"
                        )}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const quantity = Number(item.quantity ?? 0);
                      const hasReceived =
                        item.receivedQuantity !== null &&
                        item.receivedQuantity !== undefined;
                      const received = hasReceived
                        ? Number(item.receivedQuantity)
                        : null;
                      const progress =
                        received !== null && quantity > 0
                          ? Math.min(received / quantity, 1)
                          : null;
                      const complete = progress !== null && progress >= 1;
                      const partial =
                        progress !== null && progress > 0 && progress < 1;
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            complete &&
                              "bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-950/20",
                            partial &&
                              "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20"
                          )}
                        >
                          <TableCell className="whitespace-normal">
                            <div className="min-w-0">
                              <span className="block truncate font-medium">
                                {item.product?.name ?? emDash}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.product?.sku ?? emDash}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.quantity, locale)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.unitPrice, locale)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.amount, locale)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              complete &&
                                "font-medium text-emerald-600 dark:text-emerald-400",
                              partial &&
                                "font-medium text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {received === null
                              ? emDash
                              : formatNumber(received, locale)}
                          </TableCell>
                          <TableCell>
                            {progress === null ? (
                              <span className="text-muted-foreground">
                                {emDash}
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={cn(
                                    "text-xs tabular-nums",
                                    complete &&
                                      "text-emerald-600 dark:text-emerald-400",
                                    partial &&
                                      "text-amber-600 dark:text-amber-400"
                                  )}
                                >
                                  {formatNumber(received, locale)}/
                                  {formatNumber(quantity, locale)} · {Math.round(progress * 100)}%
                                </span>
                                <div
                                  role="progressbar"
                                  aria-label={translate(
                                    "inv.purchaseOrders.items.progress",
                                    { ns: "inv" },
                                    "Receipt progress"
                                  )}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(progress * 100)}
                                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      complete
                                        ? "bg-emerald-500"
                                        : partial
                                          ? "bg-amber-500"
                                          : "bg-muted-foreground/30"
                                    )}
                                    style={{ width: `${progress * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-sm">
                {totals.reconciled ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : null}
                <span className="text-muted-foreground">
                  {translate(
                    "inv.purchaseOrders.reconciliation.lines",
                    { ns: "inv" },
                    "Line total"
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(totals.lineAmount, locale)}
                </span>
                <span className="text-muted-foreground">
                  {translate(
                    "inv.purchaseOrders.reconciliation.header",
                    { ns: "inv" },
                    "Header total"
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(record.totalAmount, locale)}
                </span>
                {totals.reconciled ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {translate(
                      "inv.purchaseOrders.reconciliation.verified",
                      { ns: "inv" },
                      "Verified"
                    )}
                  </span>
                ) : null}
              </div>
            </DetailSection>

            {record.remark ? (
              <DetailSection
                title={translate(
                  "inv.purchaseOrders.fields.remark",
                  { ns: "inv" },
                  "Remark"
                )}
              >
                <p className="text-sm leading-6 text-muted-foreground">
                  {record.remark}
                </p>
              </DetailSection>
            ) : null}

            <PrintSignatureRow
              labels={[
                translate(
                  "inv.print.orderedBy",
                  { ns: "inv" },
                  "Ordered by"
                ),
                translate(
                  "inv.print.receivedBy",
                  { ns: "inv" },
                  "Received by"
                ),
                translate(
                  "inv.print.approvedBy",
                  { ns: "inv" },
                  "Approved by"
                ),
              ]}
            />
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
