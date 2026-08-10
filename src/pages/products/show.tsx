import { useGetLocale, useList, useShow, useTranslate } from "@refinedev/core";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  Pencil,
  PackagePlus,
  RotateCw,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { ActivityTimeline, type TimelineEvent } from "@/components/inventory/activity-timeline";
import {
  CopyLinkButton,
  DetailGrid,
  DetailItem,
  DetailSection,
  DetailTabs,
  StatTile,
} from "@/components/inventory/detail-scaffold";
import { OptionBadge } from "@/components/inventory/option-badge";
import {
  AbcBadge,
  CoverageLabel,
  SignedQuantity,
  StockHealthBadge,
  StockLevelMeter,
} from "@/components/inventory/stock-indicators";
import { EditButton } from "@/components/resources/buttons/edit";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  classifyAbc,
  daysOfCover,
  formatPercent,
  formatRatio,
  inventoryValue,
  marginRate,
  stockHealth,
  suggestedReorderQty,
  turnoverRatio,
} from "@/lib/inventory/analytics";
import {
  MOVEMENT_TYPES,
  optionLabel,
  PRODUCT_STATUS,
  PRODUCT_UNITS,
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
} from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/inventory/format";
import {
  useRecordKeyboardNavigation,
  useRecordNavigation,
} from "@/lib/inventory/record-context";
import { pushRecentRecord } from "@/lib/inventory/recent-records";
import type { ProductRecord, StockMovementRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { useMovementStats } from "@/lib/inventory/use-movement-stats";
import { movementDisplayDirection } from "@/lib/inventory/stock-movement";
import { cn } from "@/lib/utils";
import { ProductPriceHistory } from "@/pages/products/price-history";

type ProductShowProps = {
  closeTo?: string;
  id?: string;
};

type ProductDetail = ProductRecord & {
  updatedAt?: string | null;
  createdBy?: { id: number; nickname?: string | null } | null;
  updatedBy?: { id: number; nickname?: string | null } | null;
};

type DetailTab = "overview" | "ledger" | "pricing" | "activity";

export const ProductShow = ({
  closeTo = "/goods/products",
  id: idOverride,
}: ProductShowProps) => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const id = idOverride ?? routeId;
  const navigation = useRecordNavigation("scm_products", id);
  const nestedDrawer = useOutlet();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [ledgerType, setLedgerType] = useState<string>("all");

  const { result: record, query } = useShow<ProductDetail>({
    resource: "scm_products",
    id,
    meta: {
      appends: ["category", "supplier", "createdBy", "updatedBy"],
    },
  });

  useEffect(() => {
    if (!record?.id) return;
    pushRecentRecord({
      resource: "scm_products",
      id: String(record.id),
      label: record.name,
      sublabel: record.sku,
      path: `/goods/products/show/${record.id}`,
    });
  }, [record?.id, record?.name, record?.sku]);

  // The full ledger, not the last five rows: an inventory detail page is where
  // an auditor reconstructs how the current balance came to be.
  const { result: movementsResult, query: movementsQuery } =
    useList<StockMovementRecord>({
      resource: "scm_stock_movements",
      pagination: { mode: "server", currentPage: 1, pageSize: 200 },
      filters: record?.id
        ? [{ field: "product_id", operator: "eq", value: record.id }]
        : undefined,
      sorters: [{ field: "occurredAt", order: "desc" }],
      errorNotification: false,
      queryOptions: { enabled: Boolean(record?.id), retry: false },
    });
  const movements = useMemo(
    () => movementsResult?.data ?? [],
    [movementsResult?.data]
  );

  // ABC is a portfolio ranking, so it needs the catalogue, not this one record.
  const { result: catalogueResult } = useList<ProductRecord>({
    resource: "scm_products",
    pagination: { mode: "server", currentPage: 1, pageSize: 500 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const stats = useMovementStats();
  const productStats = record?.id ? stats.statsById.get(record.id) : undefined;

  const abc = useMemo(() => {
    const catalogue = catalogueResult?.data ?? [];
    if (!record?.id || catalogue.length === 0) return undefined;
    return classifyAbc(
      catalogue.map((product) => ({
        id: product.id,
        value:
          (stats.statsById.get(product.id)?.outQty ?? 0) *
          Number(product.purchasePrice ?? 0),
      }))
    ).get(record.id);
  }, [catalogueResult?.data, record?.id, stats.statsById]);

  const currentStock = Number(record?.currentStock ?? 0);
  const safetyStock = Number(record?.safetyStock ?? 0);
  const health = record ? stockHealth(record) : "healthy";
  const cover = daysOfCover(currentStock, averageDailyIssue(productStats));
  const turns = turnoverRatio(productStats?.outQty ?? 0, currentStock);
  const reorderQty = record ? suggestedReorderQty(record, productStats) : 0;

  const ledgerRows = useMemo(() => {
    if (ledgerType === "all") return movements;
    if (ledgerType === "in")
      return movements.filter((row) => STOCK_IN_TYPES.has(row.type ?? ""));
    if (ledgerType === "out")
      return movements.filter((row) => STOCK_OUT_TYPES.has(row.type ?? ""));
    return movements.filter((row) => row.type === "adjustment");
  }, [ledgerType, movements]);

  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = movements.map((movement) => {
      const direction = movementDisplayDirection(movement);
      return {
        id: `movement-${movement.id}`,
        tone:
          direction === "in"
            ? "in"
            : direction === "out"
            ? "out"
            : "warning",
        icon: direction === "in" ? <ArrowDownLeft /> : <ArrowUpRight />,
        title: optionLabel(MOVEMENT_TYPES, movement.type),
        description: (
          <span>
            {translate(
              "inv.movements.fields.beforeStock",
              { ns: "inv" },
              "Stock before"
            )}{" "}
            {formatNumber(movement.beforeStock)} →{" "}
            {formatNumber(movement.afterStock)}
            {movement.referenceNo ? ` · ${movement.referenceNo}` : ""}
            {movement.remark ? ` · ${movement.remark}` : ""}
          </span>
        ),
        at: movement.occurredAt,
        actor: movement.handler,
        amount: (
          <SignedQuantity
            quantity={Number(movement.quantity ?? 0)}
            direction={direction}
          />
        ),
      };
    });

    if (record?.updatedAt && record.updatedAt !== record.createdAt) {
      events.push({
        id: "record-updated",
        tone: "neutral",
        icon: <SlidersHorizontal />,
        title: translate(
          "inv.activity.recordUpdated",
          { ns: "inv" },
          "Master data updated"
        ),
        at: record.updatedAt,
        actor: record.updatedBy?.nickname,
      });
    }
    if (record?.createdAt) {
      events.push({
        id: "record-created",
        tone: "success",
        icon: <FilePlus2 />,
        title: translate(
          "inv.activity.systemRecordCreated",
          { ns: "inv" },
          "System record created"
        ),
        at: record.createdAt,
        actor: record.createdBy?.nickname,
      });
    }

    return events.sort(
      (a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()
    );
  }, [movements, record, translate]);

  const detailContext = useAIPageElementHandle({
    id: `products-detail-${id ?? "current"}`,
    title: `${translate(
      "inv.products.ai.detail",
      { ns: "inv" },
      "Product details"
    )}: ${record?.name ?? ""}`,
    kind: "detail",
    getContext: () => ({
      resource: "scm_products",
      record: {
        id: record?.id,
        sku: record?.sku,
        name: record?.name,
        category: record?.category?.name,
        supplier: record?.supplier?.name,
        unit: record?.unit,
        purchasePrice: record?.purchasePrice,
        salePrice: record?.salePrice,
        currentStock,
        safetyStock,
        status: record?.status,
        health,
        abc,
        daysOfCover: cover,
        turnsPerYear: turns,
        suggestedReorderQty: reorderQty,
        valueOnHand: record ? inventoryValue(record) : 0,
      },
      ledger: movements.slice(0, 30).map((movement) => ({
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        beforeStock: movement.beforeStock,
        afterStock: movement.afterStock,
        referenceNo: movement.referenceNo,
        handler: movement.handler,
        occurredAt: movement.occurredAt,
      })),
    }),
  });

  const tabs = useMemo(
    () => [
      {
        id: "overview" as const,
        label: translate("inv.tabs.overview", { ns: "inv" }, "Overview"),
      },
      {
        id: "ledger" as const,
        label: translate("inv.tabs.ledger", { ns: "inv" }, "Stock ledger"),
        badge: movements.length,
      },
      {
        id: "pricing" as const,
        label: translate("inv.tabs.pricing", { ns: "inv" }, "Pricing"),
      },
      {
        id: "activity" as const,
        label: translate("inv.tabs.activity", { ns: "inv" }, "Activity"),
        badge: timeline.length,
      },
    ],
    [movements.length, timeline.length, translate]
  );

  useRecordKeyboardNavigation({
    onPrevious:
      navigation.previousId === undefined
        ? undefined
        : () =>
            navigate(
              `/goods/products/show/${navigation.previousId}${location.search}`
            ),
    onNext:
      navigation.nextId === undefined
        ? undefined
        : () =>
            navigate(`/goods/products/show/${navigation.nextId}${location.search}`),
    onEdit: () => navigate("edit"),
  });

  return (
    <RouteDrawer
      className="lg:w-[58vw] lg:min-w-[50rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-48" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.products.drawer.show.description",
        { ns: "inv" },
        "Review product master data and live stock."
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo={closeTo}
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={navigation.previousId === undefined}
              aria-label={translate(
                "inv.nav.previousRecord",
                { ns: "inv" },
                "Previous record (K)"
              )}
              title={translate(
                "inv.nav.previousRecord",
                { ns: "inv" },
                "Previous record (K)"
              )}
              onClick={() =>
                navigate(
                  `/goods/products/show/${navigation.previousId}${location.search}`
                )
              }
            >
              <ChevronUp />
            </Button>
            {navigation.total > 0 ? (
              <span className="px-1 text-xs tabular-nums text-muted-foreground">
                {translate(
                  "inv.nav.recordPosition",
                  {
                    ns: "inv",
                    position: navigation.position,
                    total: navigation.total,
                  },
                  "{{position}} / {{total}}"
                )}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={navigation.nextId === undefined}
              aria-label={translate(
                "inv.nav.nextRecord",
                { ns: "inv" },
                "Next record (J)"
              )}
              title={translate(
                "inv.nav.nextRecord",
                { ns: "inv" },
                "Next record (J)"
              )}
              onClick={() =>
                navigate(
                  `/goods/products/show/${navigation.nextId}${location.search}`
                )
              }
            >
              <ChevronDown />
            </Button>
            <CopyLinkButton />
            <RefreshButton
              resource="scm_products"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={translate(
                "inv.products.action.newMovement",
                { ns: "inv" },
                "Record movement"
              )}
              title={translate(
                "inv.products.action.newMovement",
                { ns: "inv" },
                "Record movement"
              )}
              onClick={() =>
                navigate(`/stock/movements/create?productId=${record.id}`)
              }
            >
              <PackagePlus />
            </Button>
            <EditButton
              resource="scm_products"
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
      <div
        ref={detailContext.ref}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.products.detail.loadError.title",
                { ns: "inv" },
                "Unable to load product"
              )}
            </AlertTitle>
            <AlertDescription>
              {translate(
                "inv.products.detail.loadError.description",
                { ns: "inv" },
                "The product may no longer exist, or you lack view permission."
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {record.sku}
              </code>
              <OptionBadge
                options={PRODUCT_STATUS}
                value={record.status}
                locale={locale}
              />
              <StockHealthBadge health={health} locale={locale} />
              <AbcBadge abc={abc} locale={locale} />
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile
                label={translate(
                  "inv.products.fields.currentStock",
                  { ns: "inv" },
                  "On hand"
                )}
                value={formatNumber(currentStock)}
                hint={optionLabel(PRODUCT_UNITS, record.unit)}
                tone={
                  health === "out"
                    ? "danger"
                    : health === "low"
                    ? "warning"
                    : "default"
                }
              />
              <StatTile
                label={translate(
                  "inv.products.fields.safetyStock",
                  { ns: "inv" },
                  "Safety stock"
                )}
                value={formatNumber(safetyStock)}
              />
              <StatTile
                label={translate(
                  "inv.products.fields.coverage",
                  { ns: "inv" },
                  "Days of cover"
                )}
                value={<CoverageLabel days={cover} className="text-lg" />}
              />
              <StatTile
                label={translate(
                  "inv.products.fields.turnover",
                  { ns: "inv" },
                  "Turns / yr"
                )}
                value={formatRatio(turns)}
                hint={translate(
                  "inv.metrics.windowShort",
                  { ns: "inv", days: ANALYSIS_WINDOW_DAYS },
                  `Last ${ANALYSIS_WINDOW_DAYS} days`
                )}
              />
              <StatTile
                label={translate(
                  "inv.products.fields.stockValue",
                  { ns: "inv" },
                  "Value on hand"
                )}
                value={formatCurrency(inventoryValue(record), locale)}
              />
              <StatTile
                label={translate(
                  "inv.products.fields.reorderQty",
                  { ns: "inv" },
                  "Suggested reorder"
                )}
                value={reorderQty > 0 ? formatNumber(reorderQty) : "—"}
                tone={reorderQty > 0 ? "warning" : "default"}
                hint={
                  reorderQty > 0
                    ? formatCurrency(
                        reorderQty * Number(record.purchasePrice ?? 0),
                        locale
                      )
                    : undefined
                }
              />
            </div>

            <StockLevelMeter
              stock={currentStock}
              safety={safetyStock}
              health={health}
            />

            <DetailTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            {activeTab === "overview" ? (
              <div className="space-y-5">
                <DetailSection
                  title={translate(
                    "inv.products.detail.master",
                    { ns: "inv" },
                    "Master data"
                  )}
                >
                  <DetailGrid>
                    <DetailItem
                      label={translate(
                        "inv.products.fields.category",
                        { ns: "inv" },
                        "Category"
                      )}
                      value={record.category?.name || "-"}
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.supplier",
                        { ns: "inv" },
                        "Supplier"
                      )}
                      value={
                        record.supplier ? (
                          <button
                            type="button"
                            className="cursor-pointer font-medium hover:underline"
                            onClick={() =>
                              navigate(
                                `/goods/suppliers/show/${record.supplier?.id}`
                              )
                            }
                          >
                            {record.supplier.name}
                          </button>
                        ) : (
                          "-"
                        )
                      }
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.spec",
                        { ns: "inv" },
                        "Specification"
                      )}
                      value={record.spec || "-"}
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.barcode",
                        { ns: "inv" },
                        "Barcode"
                      )}
                      value={record.barcode || "-"}
                    />
                  </DetailGrid>
                </DetailSection>

                <Separator />

                <DetailSection
                  title={translate(
                    "inv.products.detail.pricing",
                    { ns: "inv" },
                    "Cost & pricing"
                  )}
                >
                  <DetailGrid columns={4}>
                    <DetailItem
                      label={translate(
                        "inv.products.fields.purchasePrice",
                        { ns: "inv" },
                        "Purchase price"
                      )}
                      value={formatCurrency(record.purchasePrice, locale)}
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.salePrice",
                        { ns: "inv" },
                        "Sale price"
                      )}
                      value={formatCurrency(record.salePrice, locale)}
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.margin",
                        { ns: "inv" },
                        "Margin"
                      )}
                      value={formatPercent(marginRate(record), 1)}
                      tone="success"
                    />
                    <DetailItem
                      label={translate(
                        "inv.products.fields.marginValue",
                        { ns: "inv" },
                        "Unit margin"
                      )}
                      value={formatCurrency(
                        Number(record.salePrice ?? 0) -
                          Number(record.purchasePrice ?? 0),
                        locale
                      )}
                    />
                  </DetailGrid>
                </DetailSection>

                <Separator />

                <DetailSection
                  title={translate(
                    "inv.products.detail.flow",
                    { ns: "inv" },
                    `Flow in the last ${ANALYSIS_WINDOW_DAYS} days`
                  )}
                >
                  <DetailGrid columns={4}>
                    <DetailItem
                      label={translate(
                        "inv.metrics.received",
                        { ns: "inv" },
                        "Received"
                      )}
                      value={formatNumber(productStats?.inQty ?? 0)}
                      tone="success"
                    />
                    <DetailItem
                      label={translate(
                        "inv.metrics.issued",
                        { ns: "inv" },
                        "Issued"
                      )}
                      value={formatNumber(productStats?.outQty ?? 0)}
                    />
                    <DetailItem
                      label={translate(
                        "inv.metrics.lastReceipt",
                        { ns: "inv" },
                        "Last receipt"
                      )}
                      value={formatDate(productStats?.lastInAt, locale)}
                    />
                    <DetailItem
                      label={translate(
                        "inv.metrics.lastIssue",
                        { ns: "inv" },
                        "Last issue"
                      )}
                      value={formatDate(productStats?.lastOutAt, locale)}
                    />
                  </DetailGrid>
                </DetailSection>

                {record.remark ? (
                  <>
                    <Separator />
                    <DetailSection
                      title={translate(
                        "inv.products.fields.remark",
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
              </div>
            ) : null}

            {activeTab === "ledger" ? (
              <DetailSection
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={ledgerRows.length === 0}
                    onClick={() =>
                      exportCsv(`ledger-${record.sku}`, ledgerRows, [
                        { header: "Occurred at", value: (row) => row.occurredAt ?? "" },
                        { header: "Type", value: (row) => row.type ?? "" },
                        { header: "Quantity", value: (row) => row.quantity ?? 0 },
                        { header: "Stock before", value: (row) => row.beforeStock ?? 0 },
                        { header: "Stock after", value: (row) => row.afterStock ?? 0 },
                        { header: "Reference", value: (row) => row.referenceNo ?? "" },
                        { header: "Handler", value: (row) => row.handler ?? "" },
                        { header: "Remark", value: (row) => row.remark ?? "" },
                      ])
                    }
                  >
                    {translate("inv.common.exportCsv", { ns: "inv" }, "Export CSV")}
                  </Button>
                }
                title={
                  <span className="flex items-center gap-1.5">
                    <ScrollText className="size-4" />
                    {translate(
                      "inv.products.detail.ledger",
                      { ns: "inv" },
                      "Stock ledger"
                    )}
                  </span>
                }
              >
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: "all", label: translate("inv.ledger.filter.all", { ns: "inv" }, "All") },
                    { id: "in", label: translate("inv.ledger.filter.in", { ns: "inv" }, "Inbound") },
                    { id: "out", label: translate("inv.ledger.filter.out", { ns: "inv" }, "Outbound") },
                    {
                      id: "adjustment",
                      label: translate(
                        "inv.ledger.filter.adjustment",
                        { ns: "inv" },
                        "Adjustments"
                      ),
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLedgerType(option.id)}
                      className={cn(
                        "h-7 cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors",
                        ledgerType === option.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {movementsQuery.isLoading ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : ledgerRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                    {translate(
                      "inv.products.detail.noMovements",
                      { ns: "inv" },
                      "No movements yet"
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <Table style={{ tableLayout: "fixed", width: "100%" }}>
                      <TableHeader className="bg-muted/45">
                        <TableRow>
                          <TableHead className="w-36">
                            {translate(
                              "inv.movements.fields.occurredAt",
                              { ns: "inv" },
                              "Occurred at"
                            )}
                          </TableHead>
                          <TableHead className="w-32">
                            {translate(
                              "inv.movements.fields.type",
                              { ns: "inv" },
                              "Type"
                            )}
                          </TableHead>
                          <TableHead className="w-24 text-right">
                            {translate(
                              "inv.movements.fields.quantity",
                              { ns: "inv" },
                              "Qty"
                            )}
                          </TableHead>
                          <TableHead className="w-28">
                            {translate(
                              "inv.movements.fields.balance",
                              { ns: "inv" },
                              "Balance"
                            )}
                          </TableHead>
                          <TableHead className="w-32">
                            {translate(
                              "inv.movements.fields.referenceNo",
                              { ns: "inv" },
                              "Reference"
                            )}
                          </TableHead>
                          <TableHead className="w-28">
                            {translate(
                              "inv.movements.fields.handler",
                              { ns: "inv" },
                              "Handler"
                            )}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerRows.map((movement) => {
                          return (
                            <TableRow
                              key={movement.id}
                              className="cursor-pointer"
                              onClick={() =>
                                navigate(`/stock/movements/show/${movement.id}`)
                              }
                            >
                              <TableCell className="whitespace-nowrap text-xs">
                                {formatDateTime(movement.occurredAt, locale)}
                              </TableCell>
                              <TableCell>
                                <OptionBadge
                                  options={MOVEMENT_TYPES}
                                  value={movement.type}
                                  locale={locale}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <SignedQuantity
                                  quantity={Number(movement.quantity ?? 0)}
                                  direction={movementDisplayDirection(movement)}
                                />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-muted-foreground">
                                {formatNumber(movement.beforeStock)} →{" "}
                                <span className="font-medium text-foreground">
                                  {formatNumber(movement.afterStock)}
                                </span>
                              </TableCell>
                              <TableCell className="truncate text-xs">
                                {movement.referenceNo || "-"}
                              </TableCell>
                              <TableCell className="truncate text-xs">
                                {movement.handler || "-"}
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

            {activeTab === "pricing" ? (
              <ProductPriceHistory productId={record.id} />
            ) : null}

            {activeTab === "activity" ? (
              <DetailSection
                title={translate(
                  "inv.activity.title",
                  { ns: "inv" },
                  "Activity & audit trail"
                )}
              >
                <ActivityTimeline
                  events={timeline}
                  locale={locale}
                  emptyText={translate(
                    "inv.activity.empty",
                    { ns: "inv" },
                    "No activity recorded yet."
                  )}
                />
              </DetailSection>
            ) : null}
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
