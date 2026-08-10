import { useGetLocale, useList, useNotification, useTranslate } from "@refinedev/core";
import {
  CircleSlash,
  Layers,
  PackageSearch,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router";

import { ActivityBadgeGroup } from "@/components/inventory/activity-badge-group";
import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import { ExportCsvButton } from "@/components/inventory/list-toolbar";
import {
  CoverageLabel,
  StockHealthBadge,
  StockLevelMeter,
} from "@/components/inventory/stock-indicators";
import { ListView } from "@/components/resources/views/list-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ANALYSIS_WINDOW_DAYS,
  averageDailyIssue,
  DEAD_STOCK_DAYS,
  daysOfCover,
  daysSince,
  isDeadStock,
  isTracked,
  OVERSTOCK_FACTOR,
  REORDER_COVER_DAYS,
  stockHealth,
  suggestedReorderQty,
} from "@/lib/inventory/analytics";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatDate, formatNumber } from "@/lib/inventory/format";
import type { ProductRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { useMovementStats } from "@/lib/inventory/use-movement-stats";
import { cn } from "@/lib/utils";

type RuleId = "out" | "low" | "over" | "dead";

type AlertRow = {
  product: ProductRecord;
  health: ReturnType<typeof stockHealth>;
  cover: number | null;
  reorderQty: number;
  reorderCost: number;
  lastOutAt?: string;
  idleDays: number | null;
};

export const StockAlertsPage = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const notification = useNotification();
  const [activeRule, setActiveRule] = useState<RuleId>("low");
  const [groupBySupplier, setGroupBySupplier] = useState(false);

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
      meta: { appends: ["category", "supplier"] },
    });
  const products = useMemo(
    () => productsResult?.data ?? [],
    [productsResult?.data]
  );

  const movements = useMovementStats();

  const rows = useMemo<AlertRow[]>(() => {
    const now = new Date();
    return products.filter(isTracked).map((product) => {
      const stats = movements.statsById.get(product.id);
      const reorderQty = suggestedReorderQty(product, stats);
      return {
        product,
        health: stockHealth(product),
        cover: daysOfCover(
          Number(product.currentStock ?? 0),
          averageDailyIssue(stats)
        ),
        reorderQty,
        reorderCost: reorderQty * Number(product.purchasePrice ?? 0),
        lastOutAt: stats?.lastOutAt,
        idleDays: daysSince(stats?.lastOutAt, now),
      };
    });
  }, [movements.statsById, products]);

  const buckets = useMemo(() => {
    const now = new Date();
    const out = rows.filter((row) => row.health === "out");
    const low = rows.filter(
      (row) => row.health === "low" || row.health === "watch"
    );
    const over = rows.filter((row) => row.health === "over");
    const dead = rows.filter((row) =>
      isDeadStock(row.product, movements.statsById.get(row.product.id), now)
    );
    return { out, low, over, dead };
  }, [movements.statsById, rows]);

  const rules = useMemo(
    () => [
      {
        id: "out" as const,
        label: translate(
          "inv.alerts.rule.out",
          { ns: "inv" },
          "Out of stock"
        ),
        rule: translate(
          "inv.alerts.rule.out.definition",
          { ns: "inv" },
          "On hand = 0 and the SKU is still traded"
        ),
        icon: <CircleSlash />,
        rows: buckets.out,
        tone: "danger" as const,
      },
      {
        id: "low" as const,
        label: translate(
          "inv.alerts.rule.low",
          { ns: "inv" },
          "Below safety stock"
        ),
        rule: translate(
          "inv.alerts.rule.low.definition",
          { ns: "inv" },
          "On hand at or under 1.5 × safety stock"
        ),
        icon: <TriangleAlert />,
        rows: buckets.low,
        tone: "warning" as const,
      },
      {
        id: "over" as const,
        label: translate("inv.alerts.rule.over", { ns: "inv" }, "Overstock"),
        rule: translate(
          "inv.alerts.rule.over.definition",
          { ns: "inv", factor: OVERSTOCK_FACTOR },
          `On hand at or above ${OVERSTOCK_FACTOR} × safety stock`
        ),
        icon: <TrendingUp />,
        rows: buckets.over,
        tone: "info" as const,
      },
      {
        id: "dead" as const,
        label: translate("inv.alerts.rule.dead", { ns: "inv" }, "Dead stock"),
        rule: translate(
          "inv.alerts.rule.dead.definition",
          { ns: "inv", days: DEAD_STOCK_DAYS },
          `Stock on hand with no issue for ${DEAD_STOCK_DAYS} days`
        ),
        icon: <Layers />,
        rows: buckets.dead,
        tone: "info" as const,
      },
    ],
    [buckets, translate]
  );

  const activeRows = useMemo(
    () => rules.find((rule) => rule.id === activeRule)?.rows ?? [],
    [activeRule, rules]
  );

  /** Everything that needs buying, regardless of which rule tab is open. */
  const replenishment = useMemo(
    () =>
      [...buckets.out, ...buckets.low]
        .filter((row) => row.reorderQty > 0)
        .sort((a, b) => b.reorderCost - a.reorderCost),
    [buckets.low, buckets.out]
  );

  const replenishmentBySupplier = useMemo(() => {
    const map = new Map<
      string,
      { supplier: string; rows: AlertRow[]; qty: number; cost: number }
    >();
    for (const row of replenishment) {
      const supplier =
        row.product.supplier?.name ??
        translate("inv.alerts.noSupplier", { ns: "inv" }, "No supplier");
      const entry =
        map.get(supplier) ?? { supplier, rows: [], qty: 0, cost: 0 };
      entry.rows.push(row);
      entry.qty += row.reorderQty;
      entry.cost += row.reorderCost;
      map.set(supplier, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [replenishment, translate]);

  const replenishmentCost = useMemo(
    () => replenishment.reduce((sum, row) => sum + row.reorderCost, 0),
    [replenishment]
  );

  const exportProposal = useCallback(() => {
    exportCsv("replenishment-proposal", replenishment, [
      { header: "SKU", value: (row) => row.product.sku },
      { header: "Product", value: (row) => row.product.name },
      { header: "Supplier", value: (row) => row.product.supplier?.name ?? "" },
      { header: "On hand", value: (row) => row.product.currentStock ?? 0 },
      { header: "Safety stock", value: (row) => row.product.safetyStock ?? 0 },
      {
        header: "Days of cover",
        value: (row) => (row.cover === null ? "" : Math.floor(row.cover)),
      },
      { header: "Suggested order qty", value: (row) => row.reorderQty },
      { header: "Unit cost", value: (row) => row.product.purchasePrice ?? 0 },
      { header: "Estimated cost", value: (row) => row.reorderCost.toFixed(2) },
    ]);
    notification?.open?.({
      type: "success",
      message: translate(
        "inv.alerts.proposalExported",
        { ns: "inv" },
        "Replenishment proposal downloaded"
      ),
    });
  }, [notification, replenishment, translate]);

  const kpis = useMemo<KpiItem[]>(
    () =>
      rules.map((rule) => ({
        id: rule.id,
        label: rule.label,
        value: formatNumber(rule.rows.length),
        hint: rule.rule,
        icon: rule.icon,
        tone: rule.rows.length > 0 ? rule.tone : "default",
        onClick: () => setActiveRule(rule.id),
        active: activeRule === rule.id,
      })),
    [activeRule, rules]
  );

  const pageContext = useAIPageElementHandle({
    id: "stock-alerts",
    title: translate("inv.alerts.ai.title", { ns: "inv" }, "Stock alerts"),
    kind: "detail",
    getContext: () => ({
      rules: rules.map((rule) => ({
        id: rule.id,
        definition: rule.rule,
        count: rule.rows.length,
      })),
      replenishment: {
        lines: replenishment.length,
        estimatedCost: Math.round(replenishmentCost * 100) / 100,
        bySupplier: replenishmentBySupplier.map((group) => ({
          supplier: group.supplier,
          lines: group.rows.length,
          qty: group.qty,
          cost: Math.round(group.cost * 100) / 100,
        })),
      },
      topLines: replenishment.slice(0, 20).map((row) => ({
        sku: row.product.sku,
        name: row.product.name,
        onHand: row.product.currentStock,
        safety: row.product.safetyStock,
        suggestedQty: row.reorderQty,
        estimatedCost: row.reorderCost,
        supplier: row.product.supplier?.name,
      })),
    }),
  });

  return (
    <ListView resource="stock_alerts">
      <div ref={pageContext.ref} className="flex flex-col gap-6">
        <KpiBar
          items={kpis}
          loading={productsQuery.isLoading}
          className="xl:grid-cols-4"
        />

        <ActivityBadgeGroup
          windowDays={ANALYSIS_WINDOW_DAYS}
          isLoading={movements.isLoading}
          isError={movements.isError}
          onRetry={movements.refetch}
        />

        {productsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.stockAlerts.loadError",
                { ns: "inv" },
                "Unable to load alert data"
              )}
            </AlertTitle>
            <AlertDescription>
              {translate(
                "inv.stockAlerts.loadError.description",
                { ns: "inv" },
                "Check that you have permission to view products."
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => void productsQuery.refetch()}
              >
                {translate("inv.common.retry", { ns: "inv" }, "Retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">
                {rules.find((rule) => rule.id === activeRule)?.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {rules.find((rule) => rule.id === activeRule)?.rule}
              </p>
            </div>
            <ExportCsvButton
              disabled={activeRows.length === 0}
              onExport={() =>
                exportCsv(`stock-alerts-${activeRule}`, activeRows, [
                  { header: "SKU", value: (row) => row.product.sku },
                  { header: "Product", value: (row) => row.product.name },
                  {
                    header: "Category",
                    value: (row) => row.product.category?.name ?? "",
                  },
                  {
                    header: "Supplier",
                    value: (row) => row.product.supplier?.name ?? "",
                  },
                  { header: "On hand", value: (row) => row.product.currentStock ?? 0 },
                  {
                    header: "Safety stock",
                    value: (row) => row.product.safetyStock ?? 0,
                  },
                  {
                    header: "Days of cover",
                    value: (row) =>
                      row.cover === null ? "" : Math.floor(row.cover),
                  },
                  { header: "Suggested order qty", value: (row) => row.reorderQty },
                ])
              }
            />
          </div>

          {productsQuery.isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : activeRows.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              {translate(
                "inv.alerts.ruleEmpty",
                { ns: "inv" },
                "No SKU currently matches this rule."
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table style={{ tableLayout: "fixed", width: "100%" }}>
                <TableHeader className="bg-muted/45">
                  <TableRow>
                    <TableHead className="w-[26%] min-w-48">
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
                    <TableHead className="w-40">
                      {translate(
                        "inv.products.fields.stockVsSafety",
                        { ns: "inv" },
                        "On hand / safety"
                      )}
                    </TableHead>
                    <TableHead className="w-28">
                      {activeRule === "dead"
                        ? translate(
                            "inv.alerts.idleDays",
                            { ns: "inv" },
                            "Idle days"
                          )
                        : translate(
                            "inv.products.fields.coverage",
                            { ns: "inv" },
                            "Days of cover"
                          )}
                    </TableHead>
                    <TableHead className="w-32">
                      {translate(
                        "inv.alerts.suggestedQty",
                        { ns: "inv" },
                        "Suggested order"
                      )}
                    </TableHead>
                    <TableHead className="w-36">
                      {translate(
                        "inv.products.fields.supplier",
                        { ns: "inv" },
                        "Supplier"
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRows.map((row) => (
                    <TableRow
                      key={row.product.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`products/${row.product.id}`)}
                    >
                      <TableCell className="whitespace-normal">
                        <div className="min-w-0">
                          <span className="block truncate font-medium">
                            {row.product.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.product.sku}
                            {row.product.category?.name
                              ? ` · ${row.product.category.name}`
                              : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StockHealthBadge health={row.health} locale={locale} />
                      </TableCell>
                      <TableCell>
                        <StockLevelMeter
                          stock={Number(row.product.currentStock ?? 0)}
                          safety={Number(row.product.safetyStock ?? 0)}
                          health={row.health}
                        />
                      </TableCell>
                      <TableCell>
                        {activeRule === "dead" ? (
                          <span className="text-sm tabular-nums">
                            {row.idleDays === null
                              ? translate(
                                  "inv.alerts.neverIssued",
                                  { ns: "inv" },
                                  "Never issued"
                                )
                              : formatNumber(row.idleDays)}
                          </span>
                        ) : (
                          <CoverageLabel days={row.cover} />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.reorderQty > 0 ? (
                          <div>
                            <span className="font-semibold tabular-nums">
                              {formatNumber(row.reorderQty)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatCurrency(row.reorderCost, locale)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="truncate text-sm">
                        {row.product.supplier?.name ?? "-"}
                        {activeRule === "dead" && row.lastOutAt ? (
                          <span className="block text-xs text-muted-foreground">
                            {translate(
                              "inv.metrics.lastIssue",
                              { ns: "inv" },
                              "Last issue"
                            )}{" "}
                            {formatDate(row.lastOutAt, locale)}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-base font-semibold">
                <ShoppingCart className="size-4" />
                {translate(
                  "inv.alerts.proposal.title",
                  { ns: "inv" },
                  "Replenishment proposal"
                )}
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                {translate(
                  "inv.alerts.proposal.description",
                  { ns: "inv", days: REORDER_COVER_DAYS },
                  `Every out-of-stock and below-safety SKU, ordered up to safety stock plus ${REORDER_COVER_DAYS} days of recent demand.`
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setGroupBySupplier((previous) => !previous)}
              >
                {groupBySupplier
                  ? translate(
                      "inv.alerts.proposal.showLines",
                      { ns: "inv" },
                      "Show lines"
                    )
                  : translate(
                      "inv.alerts.proposal.groupBySupplier",
                      { ns: "inv" },
                      "Group by supplier"
                    )}
              </Button>
              <ExportCsvButton
                disabled={replenishment.length === 0}
                onExport={exportProposal}
                label={translate(
                  "inv.alerts.proposal.export",
                  { ns: "inv" },
                  "Export proposal"
                )}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>
              <span className="text-muted-foreground">
                {translate("inv.alerts.proposal.lines", { ns: "inv" }, "Lines")}
              </span>{" "}
              <span className="font-semibold tabular-nums">
                {formatNumber(replenishment.length)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">
                {translate(
                  "inv.alerts.proposal.suppliers",
                  { ns: "inv" },
                  "Suppliers"
                )}
              </span>{" "}
              <span className="font-semibold tabular-nums">
                {formatNumber(replenishmentBySupplier.length)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">
                {translate(
                  "inv.alerts.proposal.cost",
                  { ns: "inv" },
                  "Estimated spend"
                )}
              </span>{" "}
              <span className="font-semibold">
                {formatCurrency(replenishmentCost, locale)}
              </span>
            </span>
          </div>

          {replenishment.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              {translate(
                "inv.stockAlerts.empty",
                { ns: "inv" },
                "Great — no low-stock products right now."
              )}
            </div>
          ) : groupBySupplier ? (
            <ul className="divide-y rounded-lg border">
              {replenishmentBySupplier.map((group) => (
                <li key={group.supplier} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{group.supplier}</span>
                    <span className="text-sm tabular-nums">
                      {formatNumber(group.rows.length)}{" "}
                      <span className="text-muted-foreground">
                        {translate(
                          "inv.alerts.proposal.lines",
                          { ns: "inv" },
                          "lines"
                        )}
                      </span>{" "}
                      · {formatNumber(group.qty)}{" "}
                      <span className="text-muted-foreground">
                        {translate(
                          "inv.alerts.proposal.units",
                          { ns: "inv" },
                          "units"
                        )}
                      </span>{" "}
                      ·{" "}
                      <span className="font-semibold">
                        {formatCurrency(group.cost, locale)}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {group.rows
                      .slice(0, 4)
                      .map((row) => `${row.product.sku} ×${row.reorderQty}`)
                      .join(" · ")}
                    {group.rows.length > 4 ? " …" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table style={{ tableLayout: "fixed", width: "100%" }}>
                <TableHeader className="bg-muted/45">
                  <TableRow>
                    <TableHead className="w-[32%] min-w-48">
                      {translate(
                        "inv.products.fields.name",
                        { ns: "inv" },
                        "Product"
                      )}
                    </TableHead>
                    <TableHead className="w-28">
                      {translate(
                        "inv.products.fields.currentStock",
                        { ns: "inv" },
                        "On hand"
                      )}
                    </TableHead>
                    <TableHead className="w-32">
                      {translate(
                        "inv.alerts.suggestedQty",
                        { ns: "inv" },
                        "Suggested order"
                      )}
                    </TableHead>
                    <TableHead className="w-32">
                      {translate(
                        "inv.alerts.proposal.cost",
                        { ns: "inv" },
                        "Estimated cost"
                      )}
                    </TableHead>
                    <TableHead className="w-36">
                      {translate(
                        "inv.products.fields.supplier",
                        { ns: "inv" },
                        "Supplier"
                      )}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replenishment.map((row) => (
                    <TableRow key={row.product.id}>
                      <TableCell className="whitespace-normal">
                        <button
                          type="button"
                          className="block max-w-full cursor-pointer truncate text-left font-medium hover:underline"
                          onClick={() => navigate(`products/${row.product.id}`)}
                        >
                          {row.product.name}
                        </button>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.product.sku}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular-nums",
                          row.health === "out" &&
                            "font-semibold text-red-600 dark:text-red-400"
                        )}
                      >
                        {formatNumber(row.product.currentStock)}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatNumber(row.reorderQty)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(row.reorderCost, locale)}
                      </TableCell>
                      <TableCell className="truncate text-sm">
                        {row.product.supplier?.name ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/goods/products?view=shortage")}
          >
            <PackageSearch className="size-4" />
            {translate(
              "inv.alerts.openProducts",
              { ns: "inv" },
              "Open these SKUs in the product list"
            )}
          </Button>
        </div>
      </div>
      <Outlet />
    </ListView>
  );
};
