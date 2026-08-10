import { useGetLocale, useShow, useTranslate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { Pencil, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import {
  CopyLinkButton,
  DetailGrid,
  DetailItem,
  DetailSection,
  DetailTabs,
  StatTile,
} from "@/components/inventory/detail-scaffold";
import { ExportCsvButton } from "@/components/inventory/list-toolbar";
import {
  CoverageLabel,
  StockHealthBadge,
} from "@/components/inventory/stock-indicators";
import { EditButton } from "@/components/resources/buttons/edit";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import {
  ANALYSIS_WINDOW_DAYS,
  averageDailyIssue,
  daysOfCover,
  formatPercent,
  inventoryValue,
  isoDaysAgo,
  stockHealth,
  suggestedReorderQty,
} from "@/lib/inventory/analytics";
import { exportCsv } from "@/lib/inventory/csv";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/inventory/format";
import { pushRecentRecord } from "@/lib/inventory/recent-records";
import type { SupplierRecord } from "@/lib/inventory/types";
import { queryAggregate, useMovementStats } from "@/lib/inventory/use-movement-stats";
import { usePurchasePerformance } from "@/lib/inventory/use-purchase-performance";
import { useSupplierPerformance } from "@/pages/suppliers/use-supplier-performance";

type SupplierTab = "overview" | "products" | "performance";

type MonthlyRow = {
  month: string;
  qty: number | string | null;
  documents: number | string | null;
};

export const SupplierShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const nestedDrawer = useOutlet();
  const [activeTab, setActiveTab] = useState<SupplierTab>("overview");

  const { result: record, query } = useShow<SupplierRecord>({
    resource: "scm_suppliers",
    id,
  });

  useEffect(() => {
    if (!record?.id) return;
    pushRecentRecord({
      resource: "scm_suppliers",
      id: String(record.id),
      label: record.name,
      sublabel: record.code,
      path: `/goods/suppliers/show/${record.id}`,
    });
  }, [record?.code, record?.id, record?.name]);

  const performance = useSupplierPerformance();
  const stats = record?.id ? performance.bySupplier.get(record.id) : undefined;
  const delivery = usePurchasePerformance();
  const deliveryStats = record?.id
    ? delivery.bySupplier.get(record.id)
    : undefined;
  const deliveryPercentile = record?.id
    ? delivery.percentileOf(record.id)
    : null;
  const movements = useMovementStats();

  const supplierProducts = useMemo(() => {
    if (!record?.id) return [];
    return performance.products
      .filter(
        (product) =>
          Number(
            product.supplier?.id ?? product.supplierId ?? product.supplier_id ?? 0
          ) === record.id
      )
      .sort((a, b) => inventoryValue(b) - inventoryValue(a));
  }, [performance.products, record?.id]);

  const productIds = useMemo(
    () => supplierProducts.map((product) => product.id),
    [supplierProducts]
  );

  /** Receipt cadence over the past year, so buyers can see supply rhythm. */
  const monthly = useQuery<MonthlyRow[]>({
    queryKey: ["supplier-receipts", record?.id, productIds.length],
    enabled: productIds.length > 0,
    retry: false,
    queryFn: () =>
      queryAggregate<MonthlyRow[]>("scm_stock_movements", {
        measures: [
          { field: ["quantity"], aggregation: "sum", alias: "qty" },
          { field: ["id"], aggregation: "count", alias: "documents" },
        ],
        dimensions: [
          { field: ["occurredAt"], alias: "month", format: "YYYY-MM" },
        ],
        orders: [{ field: ["occurredAt"], alias: "month", order: "asc" }],
        filter: {
          $and: [
            { product_id: { $in: productIds } },
            { type: { $eq: "purchase_in" } },
            { occurredAt: { $gte: isoDaysAgo(365) } },
          ],
        },
      }),
  });

  const monthlyChart = useMemo(
    () =>
      (monthly.data ?? []).map((row) => ({
        month: row.month,
        qty: Number(row.qty ?? 0),
        documents: Number(row.documents ?? 0),
      })),
    [monthly.data]
  );

  const reorderLines = useMemo(
    () =>
      supplierProducts
        .map((product) => ({
          product,
          qty: suggestedReorderQty(
            product,
            movements.statsById.get(product.id)
          ),
        }))
        .filter((line) => line.qty > 0),
    [movements.statsById, supplierProducts]
  );

  const tabs = useMemo(
    () => [
      {
        id: "overview" as const,
        label: translate("inv.tabs.overview", { ns: "inv" }, "Overview"),
      },
      {
        id: "products" as const,
        label: translate("inv.tabs.products", { ns: "inv" }, "Products"),
        badge: supplierProducts.length,
      },
      {
        id: "performance" as const,
        label: translate("inv.tabs.performance", { ns: "inv" }, "Performance"),
      },
    ],
    [supplierProducts.length, translate]
  );

  return (
    <RouteDrawer
      className="lg:w-[56vw] lg:min-w-[48rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-44" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.suppliers.drawer.show.description",
        { ns: "inv" },
        "Supplier details"
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/goods/suppliers"
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <CopyLinkButton />
            <RefreshButton
              resource="scm_suppliers"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <EditButton
              resource="scm_suppliers"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.edit", "Edit")}
              title={translate("buttons.edit", "Edit")}
              onClick={() => navigate("edit")}
            >
              <Pencil />
            </EditButton>
          </>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.suppliers.detail.loadError.title",
                { ns: "inv" },
                "Unable to load supplier"
              )}
            </AlertTitle>
            <AlertDescription>
              {translate(
                "inv.suppliers.detail.loadError.description",
                { ns: "inv" },
                "The supplier may no longer exist, or you lack view permission."
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {record.code}
              </code>
              {stats?.lastReceiptAt ? (
                <span className="text-xs text-muted-foreground">
                  {translate(
                    "inv.suppliers.fields.lastReceipt",
                    { ns: "inv" },
                    "Last receipt"
                  )}{" "}
                  {formatDate(stats.lastReceiptAt, locale)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={translate(
                  "inv.suppliers.fields.skus",
                  { ns: "inv" },
                  "SKUs supplied"
                )}
                value={formatNumber(stats?.skuCount ?? 0)}
              />
              <StatTile
                label={translate(
                  "inv.suppliers.fields.stockValue",
                  { ns: "inv" },
                  "Stock value"
                )}
                value={formatCurrency(stats?.stockValue ?? 0, locale)}
              />
              <StatTile
                label={translate(
                  "inv.suppliers.fields.estimatedReceiptValue",
                  { ns: "inv" },
                  "Estimated receipt value (90d)"
                )}
                value={formatCurrency(
                  stats?.estimatedReceiptValue ?? 0,
                  locale
                )}
                hint={translate(
                  "inv.suppliers.fields.estimatedReceiptValueHint",
                  { ns: "inv" },
                  "Receipt quantity × current product cost; not actual PO spend"
                )}
              />
              <StatTile
                label={translate(
                  "inv.suppliers.fields.shortages",
                  { ns: "inv" },
                  "SKUs to reorder"
                )}
                value={formatNumber(stats?.shortageSkus ?? 0)}
                tone={(stats?.shortageSkus ?? 0) > 0 ? "warning" : "default"}
              />
            </div>

            <DetailTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            {activeTab === "overview" ? (
              <div className="space-y-5">
                <DetailSection
                  title={translate(
                    "inv.suppliers.detail.contact",
                    { ns: "inv" },
                    "Contact"
                  )}
                >
                  <DetailGrid>
                    <DetailItem
                      label={translate(
                        "inv.suppliers.fields.contact",
                        { ns: "inv" },
                        "Contact"
                      )}
                      value={record.contact || "-"}
                    />
                    <DetailItem
                      label={translate(
                        "inv.suppliers.fields.phone",
                        { ns: "inv" },
                        "Phone"
                      )}
                      value={record.phone || "-"}
                    />
                    <DetailItem
                      label={translate(
                        "inv.suppliers.fields.address",
                        { ns: "inv" },
                        "Address"
                      )}
                      value={record.address || "-"}
                    />
                    <DetailItem
                      label={translate(
                        "inv.suppliers.fields.createdAt",
                        { ns: "inv" },
                        "Created at"
                      )}
                      value={formatDateTime(record.createdAt, locale)}
                    />
                  </DetailGrid>
                </DetailSection>

                {record.remark ? (
                  <>
                    <Separator />
                    <DetailSection
                      title={translate(
                        "inv.suppliers.fields.remark",
                        { ns: "inv" },
                        "Remarks"
                      )}
                    >
                      <p className="text-sm leading-6 text-muted-foreground">
                        {record.remark}
                      </p>
                    </DetailSection>
                  </>
                ) : null}

                {reorderLines.length > 0 ? (
                  <>
                    <Separator />
                    <DetailSection
                      title={translate(
                        "inv.suppliers.detail.reorder",
                        { ns: "inv" },
                        "Open replenishment needs"
                      )}
                      action={
                        <ExportCsvButton
                          onExport={() =>
                            exportCsv(
                              `reorder-${record.code}`,
                              reorderLines,
                              [
                                { header: "SKU", value: (row) => row.product.sku },
                                {
                                  header: "Product",
                                  value: (row) => row.product.name,
                                },
                                {
                                  header: "On hand",
                                  value: (row) => row.product.currentStock ?? 0,
                                },
                                { header: "Suggested qty", value: (row) => row.qty },
                                {
                                  header: "Estimated cost",
                                  value: (row) =>
                                    (
                                      row.qty *
                                      Number(row.product.purchasePrice ?? 0)
                                    ).toFixed(2),
                                },
                              ]
                            )
                          }
                        />
                      }
                    >
                      <ul className="divide-y rounded-xl border bg-card text-sm">
                        {reorderLines.slice(0, 8).map((line) => (
                          <li
                            key={line.product.id}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <span className="min-w-0 truncate">
                              {line.product.name}
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {line.product.sku}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              <span className="font-semibold">
                                {formatNumber(line.qty)}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatCurrency(
                                  line.qty *
                                    Number(line.product.purchasePrice ?? 0),
                                  locale
                                )}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </DetailSection>
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === "products" ? (
              <DetailSection
                title={translate(
                  "inv.suppliers.detail.products",
                  { ns: "inv" },
                  "Supplied products"
                )}
                action={
                  <ExportCsvButton
                    disabled={supplierProducts.length === 0}
                    onExport={() =>
                      exportCsv(`supplier-${record.code}-products`, supplierProducts, [
                        { header: "SKU", value: (row) => row.sku },
                        { header: "Product", value: (row) => row.name },
                        { header: "Category", value: (row) => row.category?.name ?? "" },
                        { header: "On hand", value: (row) => row.currentStock ?? 0 },
                        { header: "Safety stock", value: (row) => row.safetyStock ?? 0 },
                        { header: "Purchase price", value: (row) => row.purchasePrice ?? 0 },
                        {
                          header: "Stock value",
                          value: (row) => inventoryValue(row).toFixed(2),
                        },
                      ])
                    }
                  />
                }
              >
                {supplierProducts.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                    {translate(
                      "inv.suppliers.detail.noProducts",
                      { ns: "inv" },
                      "No products are sourced from this supplier yet."
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <Table style={{ tableLayout: "fixed", width: "100%" }}>
                      <TableHeader className="bg-muted/45">
                        <TableRow>
                          <TableHead className="w-[34%] min-w-44">
                            {translate(
                              "inv.products.fields.name",
                              { ns: "inv" },
                              "Product"
                            )}
                          </TableHead>
                          <TableHead className="w-32">
                            {translate(
                              "inv.products.fields.health",
                              { ns: "inv" },
                              "Stock status"
                            )}
                          </TableHead>
                          <TableHead className="w-24">
                            {translate(
                              "inv.products.fields.currentStock",
                              { ns: "inv" },
                              "On hand"
                            )}
                          </TableHead>
                          <TableHead className="w-28">
                            {translate(
                              "inv.products.fields.coverage",
                              { ns: "inv" },
                              "Cover"
                            )}
                          </TableHead>
                          <TableHead className="w-32">
                            {translate(
                              "inv.products.fields.stockValue",
                              { ns: "inv" },
                              "Value"
                            )}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierProducts.map((product) => {
                          const productStats = movements.statsById.get(product.id);
                          return (
                            <TableRow
                              key={product.id}
                              className="cursor-pointer"
                              onClick={() =>
                                navigate(`/goods/products/show/${product.id}`)
                              }
                            >
                              <TableCell className="whitespace-normal">
                                <span className="block truncate font-medium">
                                  {product.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {product.sku}
                                </span>
                              </TableCell>
                              <TableCell>
                                <StockHealthBadge
                                  health={stockHealth(product)}
                                  locale={locale}
                                />
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {formatNumber(product.currentStock)}
                              </TableCell>
                              <TableCell>
                                <CoverageLabel
                                  days={daysOfCover(
                                    Number(product.currentStock ?? 0),
                                    averageDailyIssue(productStats)
                                  )}
                                />
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {formatCurrency(inventoryValue(product), locale)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </DetailSection>
            ) : null}

            {activeTab === "performance" ? (
              <div className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile
                    label={translate(
                      "inv.suppliers.fields.onTimeRate",
                      { ns: "inv" },
                      "On-time rate"
                    )}
                    value={
                      deliveryStats?.onTimeRate === null ||
                      deliveryStats?.onTimeRate === undefined
                        ? "—"
                        : formatPercent(deliveryStats.onTimeRate, 1)
                    }
                    hint={
                      deliveryPercentile === null
                        ? undefined
                        : translate(
                            "inv.suppliers.detail.percentile",
                            {
                              ns: "inv",
                              percent: Math.round(deliveryPercentile * 100),
                            },
                            `Better than ${Math.round(deliveryPercentile * 100)}% of suppliers`
                          )
                    }
                    tone={
                      deliveryStats?.onTimeRate !== null &&
                      deliveryStats?.onTimeRate !== undefined &&
                      deliveryStats.onTimeRate < 0.8
                        ? "danger"
                        : "default"
                    }
                  />
                  <StatTile
                    label={translate(
                      "inv.suppliers.detail.averageDelay",
                      { ns: "inv" },
                      "Average delay (days)"
                    )}
                    value={
                      deliveryStats?.averageDelayDays === null ||
                      deliveryStats?.averageDelayDays === undefined
                        ? "—"
                        : deliveryStats.averageDelayDays.toFixed(1)
                    }
                  />
                  <StatTile
                    label={translate(
                      "inv.suppliers.detail.scoredOrders",
                      { ns: "inv" },
                      "Scored orders"
                    )}
                    value={formatNumber(deliveryStats?.scoredOrders ?? 0)}
                  />
                  <StatTile
                    label={translate(
                      "inv.suppliers.detail.openOrders",
                      { ns: "inv" },
                      "Open orders"
                    )}
                    value={formatNumber(deliveryStats?.openOrders ?? 0)}
                  />
                  <StatTile
                    label={translate(
                      "inv.suppliers.detail.overdueOrders",
                      { ns: "inv" },
                      "Overdue orders"
                    )}
                    value={formatNumber(deliveryStats?.overdueOrders ?? 0)}
                    tone={
                      (deliveryStats?.overdueOrders ?? 0) > 0
                        ? "warning"
                        : "default"
                    }
                  />
                </div>

                <DetailSection
                  title={translate(
                    "inv.suppliers.detail.supply",
                    { ns: "inv" },
                    `Supply activity (last ${ANALYSIS_WINDOW_DAYS} days)`
                  )}
                >
                  <DetailGrid columns={2}>
                    <DetailItem
                      label={translate(
                        "inv.suppliers.fields.receipts",
                        { ns: "inv" },
                        "Receipts"
                      )}
                      value={formatNumber(stats?.receipts ?? 0)}
                    />
                    <DetailItem
                      label={translate(
                        "inv.metrics.received",
                        { ns: "inv" },
                        "Received units"
                      )}
                      value={formatNumber(stats?.receivedQty ?? 0)}
                    />
                  </DetailGrid>
                </DetailSection>

                <DetailSection
                  title={translate(
                    "inv.suppliers.detail.onTimeTrend",
                    { ns: "inv" },
                    "12-month on-time trend"
                  )}
                >
                  {delivery.isLoading ? (
                    <Skeleton className="h-56 w-full rounded-xl" />
                  ) : (
                    <div className="rounded-xl border bg-card p-3">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart
                          data={(deliveryStats?.monthly ?? []).map((row) => ({
                            ...row,
                            rate: row.rate === null ? null : row.rate * 100,
                          }))}
                          margin={{ left: -16 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid var(--border)",
                            }}
                            formatter={(value) =>
                              formatPercent(Number(value) / 100, 1)
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="rate"
                            name={translate(
                              "inv.suppliers.fields.onTimeRate",
                              { ns: "inv" },
                              "On-time rate"
                            )}
                            stroke="var(--brand-1)"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "var(--brand-1)" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DetailSection>

                <DetailSection
                  title={translate(
                    "inv.suppliers.detail.delayDistribution",
                    { ns: "inv" },
                    "Delay distribution"
                  )}
                >
                  <div className="grid gap-2 sm:grid-cols-4">
                    {[
                      {
                        key: "onTime",
                        label: translate(
                          "inv.suppliers.detail.delay.onTime",
                          { ns: "inv" },
                          "On time"
                        ),
                        count: deliveryStats?.buckets.onTime ?? 0,
                        color: "bg-emerald-500",
                      },
                      {
                        key: "late1to3",
                        label: translate(
                          "inv.suppliers.detail.delay.late1to3",
                          { ns: "inv" },
                          "1–3 days late"
                        ),
                        count: deliveryStats?.buckets.late1to3 ?? 0,
                        color: "bg-amber-400",
                      },
                      {
                        key: "late4to6",
                        label: translate(
                          "inv.suppliers.detail.delay.late4to6",
                          { ns: "inv" },
                          "4–6 days late"
                        ),
                        count: deliveryStats?.buckets.late4to6 ?? 0,
                        color: "bg-orange-500",
                      },
                      {
                        key: "late7plus",
                        label: translate(
                          "inv.suppliers.detail.delay.late7plus",
                          { ns: "inv" },
                          "7+ days late"
                        ),
                        count: deliveryStats?.buckets.late7plus ?? 0,
                        color: "bg-red-500",
                      },
                    ].map((bucket) => (
                      <div
                        key={bucket.key}
                        className="rounded-lg border bg-card px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {bucket.label}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatNumber(bucket.count)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${bucket.color}`}
                            style={{
                              width: `${
                                (deliveryStats?.scoredOrders ?? 0) > 0
                                  ? (bucket.count /
                                      (deliveryStats?.scoredOrders ?? 1)) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>

                <DetailSection
                  title={translate(
                    "inv.suppliers.detail.cadence",
                    { ns: "inv" },
                    "Receipts by month"
                  )}
                >
                  {monthly.isLoading ? (
                    <Skeleton className="h-56 w-full rounded-xl" />
                  ) : monthlyChart.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                      {translate(
                        "inv.suppliers.detail.noReceipts",
                        { ns: "inv" },
                        "No purchase receipts recorded in the last 12 months."
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-card p-3">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyChart} margin={{ left: -16 }}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid var(--border)",
                            }}
                            formatter={(value) => formatNumber(Number(value))}
                          />
                          <Bar
                            dataKey="qty"
                            radius={[6, 6, 2, 2]}
                            fill="var(--brand-1)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DetailSection>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
