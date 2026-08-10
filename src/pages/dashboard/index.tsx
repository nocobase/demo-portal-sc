import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CircleSlash,
  ClipboardCheck,
  Package,
  RefreshCcw,
  Snowflake,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BuildStoryBanner,
  type BuildStory,
} from "@/components/build-story/build-story-banner";
import { AIEmployeeShortcut } from "@/extensions/nocobase-ai/components";
import type { AIEmployeeTask } from "@/extensions/nocobase-ai/providers";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import {
  CoverageLabel,
  StockHealthBadge,
} from "@/components/inventory/stock-indicators";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import {
  averageDailyIssue,
  classifyAbc,
  daysOfCover,
  formatRatio,
  inventoryValue,
  isDeadStock,
  isTracked,
  isoDaysAgo,
  stockHealth,
} from "@/lib/inventory/analytics";
import { MOVEMENT_TYPES, optionLabel } from "@/lib/inventory/constants";
import { formatCurrency, formatNumber } from "@/lib/inventory/format";
import type { ProductRecord } from "@/lib/inventory/types";
import { useMovementStats } from "@/lib/inventory/use-movement-stats";
import { stockMovementDelta } from "@/lib/inventory/stock-movement";
import { cn } from "@/lib/utils";

const BUILD_STORY: BuildStory = {
  models: ["DeepSeek V4 Flash 0731"],
  intro: {
    en: "A warehouse stock control system — product records, stock movements and low-stock alerts in one place, so you always see what's left and when to reorder. This whole system was designed and built end-to-end by an AI coding agent. You can connect your own coding agent and keep developing it.",
    zh: "仓库的库存管理系统:商品资料、出入库流水、库存预警都在一处,货还剩多少、什么时候该补货看得明明白白。整套系统从设计到实现,都由 AI coding agent 完成。你可以接入你的 Coding Agent,继续开发它。",
  },
  tracks: [
    {
      label: {
        en: "Data model — products, stock, suppliers",
        zh: "数据建模 — 商品/库存/供应商",
      },
      models: ["DeepSeek V4 Flash 0731"],
      start: 0,
      minutes: 12,
    },
    {
      label: {
        en: "Pages — dashboard, goods, stock, counts",
        zh: "页面 — 工作台/商品/库存/盘点",
      },
      models: ["DeepSeek V4 Flash 0731"],
      start: 12,
      minutes: 22,
    },
    {
      label: { en: "Wire-up & polish", zh: "联调与打磨" },
      models: ["DeepSeek V4 Flash 0731"],
      start: 34,
      minutes: 11,
    },
  ],
  roles: [
    {
      name: { en: "Warehouse Operator", zh: "Warehouse Operator" },
      can: { en: "Products, stock, suppliers", zh: "商品、库存、供应商" },
      account: "warehouse_demo@scm.demo",
      password: "demo123456",
    },
    {
      name: { en: "Stocktaker", zh: "Stocktaker" },
      can: { en: "Inventory counts & items", zh: "盘点单与明细" },
      account: "stocktaker_demo@scm.demo",
      password: "demo123456",
    },
    {
      name: { en: "Viewer", zh: "Viewer" },
      can: { en: "Read-only across the app", zh: "全应用只读" },
      account: "viewer_demo@scm.demo",
      password: "demo123456",
    },
  ],
};

const RANGE_OPTIONS = [7, 30, 90, 365] as const;

function useAggregateQuery<T>(
  resource: string,
  body: Record<string, unknown>,
  enabled = true
) {
  return useQuery<T>({
    queryKey: ["inventory-aggregate", resource, body],
    queryFn: () =>
      nocobaseClient.action(resource, "query", {
        body,
      }) as Promise<T>,
    enabled,
    retry: false,
  });
}

export const DashboardPage = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeDays = Number(searchParams.get("range")) || 30;
  const setRangeDays = (days: number) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (days === 30) next.delete("range");
        else next.set("range", String(days));
        return next;
      },
      { replace: true }
    );

  const since = useMemo(() => isoDaysAgo(rangeDays), [rangeDays]);

  const pendingCounts = useAggregateQuery<Array<{ pending_count: number }>>(
    "scm_inventory_counts",
    {
      measures: [{ field: ["id"], aggregation: "count", alias: "pending_count" }],
      filter: { status: { $in: ["draft", "in_progress"] } },
    }
  );

  const trendData = useAggregateQuery<
    Array<{
      total_qty: number;
      total_before: number;
      total_after: number;
      date: string;
      type?: string;
    }>
  >("scm_stock_movements", {
    measures: [
      { field: ["quantity"], aggregation: "sum", alias: "total_qty" },
      { field: ["beforeStock"], aggregation: "sum", alias: "total_before" },
      { field: ["afterStock"], aggregation: "sum", alias: "total_after" },
    ],
    dimensions: [
      { field: ["occurredAt"], alias: "date", format: "YYYY-MM-DD" },
      { field: ["type"], alias: "type" },
    ],
    orders: [{ field: ["occurredAt"], alias: "date", order: "asc" }],
    filter: { occurredAt: { $gte: since } },
  });

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
      meta: { appends: ["category"] },
    });
  const products = useMemo(
    () => productsResult?.data ?? [],
    [productsResult?.data]
  );

  const movements = useMovementStats(rangeDays);
  const statsById = movements.statsById;

  const portfolio = useMemo(() => {
    const now = new Date();
    let units = 0;
    let value = 0;
    let cogs = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let deadValue = 0;
    let deadCount = 0;
    for (const product of products) {
      const stats = statsById.get(product.id);
      units += Number(product.currentStock ?? 0);
      value += inventoryValue(product);
      cogs += (stats?.outQty ?? 0) * Number(product.purchasePrice ?? 0);
      if (!isTracked(product)) continue;
      const health = stockHealth(product);
      if (health === "out") outOfStock += 1;
      if (health === "low") lowStock += 1;
      if (isDeadStock(product, stats, now)) {
        deadCount += 1;
        deadValue += inventoryValue(product);
      }
    }
    return {
      skus: products.length,
      units,
      value,
      cogs,
      outOfStock,
      lowStock,
      deadValue,
      deadCount,
      turns: value > 0 ? (cogs * (365 / rangeDays)) / value : null,
    };
  }, [products, rangeDays, statsById]);

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, { name: string; value: number; units: number }>();
    for (const product of products) {
      const name =
        product.category?.name ??
        translate("inv.dashboard.uncategorized", { ns: "inv" }, "Uncategorized");
      const entry = map.get(name) ?? { name, value: 0, units: 0 };
      entry.value += inventoryValue(product);
      entry.units += Number(product.currentStock ?? 0);
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [products, translate]);

  const trendChartData = useMemo(() => {
    const map = new Map<
      string,
      { date: string; inbound: number; outbound: number }
    >();
    for (const row of trendData.data ?? []) {
      const entry = map.get(row.date) ?? {
        date: row.date,
        inbound: 0,
        outbound: 0,
      };
      if (["purchase_in", "return_in", "initial"].includes(row.type ?? "")) {
        entry.inbound += Number(row.total_qty ?? 0);
      } else if (["sale_out", "loss"].includes(row.type ?? "")) {
        entry.outbound += Number(row.total_qty ?? 0);
      }
      map.set(row.date, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [trendData.data]);

  const movementMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of trendData.data ?? []) {
      const type = row.type ?? "";
      map.set(type, (map.get(type) ?? 0) + Number(row.total_qty ?? 0));
    }
    return MOVEMENT_TYPES.filter((option) => map.has(option.value)).map(
      (option) => ({
        name: optionLabel(MOVEMENT_TYPES, option.value),
        value: map.get(option.value) ?? 0,
      })
    );
  }, [trendData.data]);

  const totals = useMemo(() => {
    const inbound = trendChartData.reduce((sum, row) => sum + row.inbound, 0);
    const outbound = trendChartData.reduce((sum, row) => sum + row.outbound, 0);
    const net = (trendData.data ?? []).reduce(
      (sum, row) =>
        sum +
        stockMovementDelta({
          beforeStock: row.total_before,
          afterStock: row.total_after,
        }),
      0
    );
    return { inbound, outbound, net };
  }, [trendChartData, trendData.data]);

  const abcSummary = useMemo(() => {
    const classes = classifyAbc(
      products.map((product) => ({
        id: product.id,
        value: (statsById.get(product.id)?.outQty ?? 0) * Number(product.purchasePrice ?? 0),
      }))
    );
    const summary = {
      A: { skus: 0, value: 0 },
      B: { skus: 0, value: 0 },
      C: { skus: 0, value: 0 },
    };
    for (const product of products) {
      const abc = classes.get(product.id) ?? "C";
      summary[abc].skus += 1;
      summary[abc].value += inventoryValue(product);
    }
    return summary;
  }, [products, statsById]);

  const topMovers = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          consumption:
            (statsById.get(product.id)?.outQty ?? 0) *
            Number(product.purchasePrice ?? 0),
          qty: statsById.get(product.id)?.outQty ?? 0,
        }))
        .filter((row) => row.qty > 0)
        .sort((a, b) => b.consumption - a.consumption)
        .slice(0, 8),
    [products, statsById]
  );

  const watchlist = useMemo(
    () =>
      products
        .filter(isTracked)
        .map((product) => ({
          product,
          health: stockHealth(product),
          cover: daysOfCover(
            Number(product.currentStock ?? 0),
            averageDailyIssue(statsById.get(product.id), rangeDays)
          ),
        }))
        .filter((row) => row.health === "out" || row.health === "low")
        .sort((a, b) => (a.cover ?? 0) - (b.cover ?? 0))
        .slice(0, 6),
    [products, rangeDays, statsById]
  );

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "value",
        label: translate(
          "inv.dashboard.kpi.inventoryValue",
          { ns: "inv" },
          "Inventory value"
        ),
        value: formatCurrency(portfolio.value, locale),
        hint: translate(
          "inv.dashboard.kpi.inventoryValueHint",
          { ns: "inv" },
          "Estimated at purchase price"
        ),
        icon: <Wallet />,
      },
      {
        id: "turns",
        label: translate(
          "inv.dashboard.kpi.turns",
          { ns: "inv" },
          "Turns / yr"
        ),
        value: formatRatio(portfolio.turns),
        hint: translate(
          "inv.dashboard.kpi.turnsHint",
          { ns: "inv" },
          "Annualised cost of goods issued over stock value"
        ),
        icon: <RefreshCcw />,
      },
      {
        id: "skus",
        label: translate(
          "inv.dashboard.kpi.productCount",
          { ns: "inv" },
          "Products"
        ),
        value: formatNumber(portfolio.skus),
        icon: <Package />,
        onClick: () => navigate("/goods/products"),
      },
      {
        id: "units",
        label: translate(
          "inv.dashboard.kpi.totalStock",
          { ns: "inv" },
          "Units on hand"
        ),
        value: formatNumber(portfolio.units),
        icon: <Boxes />,
      },
      {
        id: "out",
        label: translate(
          "inv.dashboard.kpi.outOfStock",
          { ns: "inv" },
          "Out of stock"
        ),
        value: formatNumber(portfolio.outOfStock),
        tone: portfolio.outOfStock > 0 ? "danger" : "default",
        icon: <CircleSlash />,
        onClick: () => navigate("/goods/products?view=out"),
      },
      {
        id: "low",
        label: translate(
          "inv.dashboard.kpi.lowStock",
          { ns: "inv" },
          "Low stock alerts"
        ),
        value: formatNumber(portfolio.lowStock),
        tone: portfolio.lowStock > 0 ? "warning" : "default",
        icon: <AlertTriangle />,
        onClick: () => navigate("/stock/alerts"),
      },
    ],
    [locale, navigate, portfolio, translate]
  );

  const secondaryKpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "inbound",
        label: translate(
          "inv.dashboard.kpi.inbound",
          { ns: "inv" },
          "Inbound units"
        ),
        value: formatNumber(totals.inbound),
        tone: "success",
        icon: <TrendingUp />,
        onClick: () => navigate("/stock/movements?view=inbound"),
      },
      {
        id: "outbound",
        label: translate(
          "inv.dashboard.kpi.outbound",
          { ns: "inv" },
          "Outbound units"
        ),
        value: formatNumber(totals.outbound),
        tone: "danger",
        icon: <TrendingUp />,
        onClick: () => navigate("/stock/movements?view=outbound"),
      },
      {
        id: "net",
        label: translate(
          "inv.dashboard.kpi.net",
          { ns: "inv" },
          "Net stock change"
        ),
        value: `${totals.net >= 0 ? "+" : "-"}${formatNumber(
          Math.abs(totals.net)
        )}`,
        hint: translate(
          "inv.dashboard.kpi.netHint",
          { ns: "inv" },
          "Ledger change, including signed adjustments"
        ),
        tone: totals.net >= 0 ? "success" : "warning",
        icon: <Boxes />,
      },
      {
        id: "dead",
        label: translate(
          "inv.dashboard.kpi.deadValue",
          { ns: "inv" },
          "Dead stock value"
        ),
        value: formatCurrency(portfolio.deadValue, locale),
        hint: `${formatNumber(portfolio.deadCount)} ${translate(
          "inv.dashboard.kpi.deadSkus",
          { ns: "inv" },
          "SKUs"
        )}`,
        tone: portfolio.deadValue > 0 ? "info" : "default",
        icon: <Snowflake />,
        onClick: () => navigate("/goods/products?view=dead"),
      },
      {
        id: "counts",
        label: translate(
          "inv.dashboard.kpi.pendingCounts",
          { ns: "inv" },
          "Active counts"
        ),
        value: formatNumber(pendingCounts.data?.[0]?.pending_count ?? 0),
        icon: <ClipboardCheck />,
        onClick: () => navigate("/counting/counts?view=open"),
      },
    ],
    [locale, navigate, pendingCounts.data, portfolio, totals, translate]
  );

  const pageElement = useAIPageElementHandle({
    id: "dashboard-overview",
    title: translate(
      "inv.dashboard.ai.title",
      { ns: "inv" },
      "Dashboard inventory overview"
    ),
    kind: "detail",
    getContext: () => ({
      rangeDays,
      portfolio: {
        ...portfolio,
        value: Math.round(portfolio.value * 100) / 100,
        cogs: Math.round(portfolio.cogs * 100) / 100,
        deadValue: Math.round(portfolio.deadValue * 100) / 100,
      },
      flow: totals,
      abc: abcSummary,
      categoryDistribution: categoryDistribution.slice(0, 12),
      trend: trendChartData.slice(-30),
      topMovers: topMovers.map((row) => ({
        sku: row.product.sku,
        name: row.product.name,
        issuedQty: row.qty,
        consumptionValue: Math.round(row.consumption * 100) / 100,
      })),
      watchlist: watchlist.map((row) => ({
        sku: row.product.sku,
        name: row.product.name,
        onHand: row.product.currentStock,
        safety: row.product.safetyStock,
        daysOfCover: row.cover,
      })),
    }),
  });

  const stockHealthTask: AIEmployeeTask = {
    title: translate(
      "inv.dashboard.ai.task",
      { ns: "inv" },
      "Analyze stock health"
    ),
    message: {
      system:
        "You are a warehouse inventory analyst. Based on the dashboard data, identify low-stock risks and unusual in/out trends, and give restock suggestions. Answer concisely and professionally in English.",
      user: "Please analyze the current dashboard inventory data and give suggestions.",
    },
    autoSend: true,
  };

  const abcRows = (["A", "B", "C"] as const).map((abc) => ({
    abc,
    ...abcSummary[abc],
  }));
  const abcTotalValue = abcRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div ref={pageElement.ref} className="animate-page-enter flex flex-col gap-6">
      <BuildStoryBanner story={BUILD_STORY} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">
            {translate("inv.dashboard.title", { ns: "inv" }, "Dashboard")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {translate(
              "inv.dashboard.description",
              { ns: "inv" },
              "Inventory overview and recent movement trends."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            {RANGE_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors",
                  rangeDays === days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {translate(
                  "inv.dashboard.range.days",
                  { ns: "inv", count: days },
                  `${days}d`
                )}
              </button>
            ))}
          </div>
          <AIEmployeeShortcut
            aiEmployee="viz"
            size={40}
            label={translate(
              "inv.dashboard.ai.button",
              { ns: "inv" },
              "Stock analysis"
            )}
            tasks={[stockHealthTask]}
          />
        </div>
      </div>

      <KpiBar items={kpis} loading={productsQuery.isLoading} />
      <KpiBar
        items={secondaryKpis}
        loading={trendData.isLoading}
        className="xl:grid-cols-5"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.trend",
                { ns: "inv" },
                "Inbound vs outbound"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : trendChartData.length === 0 ? (
              <EmptyChart
                text={translate(
                  "inv.dashboard.chart.empty",
                  { ns: "inv" },
                  "No data"
                )}
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChartData} margin={{ left: -12 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
                    }}
                    formatter={(value) => formatNumber(Number(value))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="inbound"
                    name={translate(
                      "inv.dashboard.chart.inbound",
                      { ns: "inv" },
                      "Inbound"
                    )}
                    stroke="var(--brand-1)"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "var(--brand-1)" }}
                    activeDot={{ r: 4.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="outbound"
                    name={translate(
                      "inv.dashboard.chart.outbound",
                      { ns: "inv" },
                      "Outbound"
                    )}
                    stroke="var(--brand-3)"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: "var(--brand-3)" }}
                    activeDot={{ r: 4.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.categoryValue",
                { ns: "inv" },
                "Stock value by category"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : categoryDistribution.length === 0 ? (
              <EmptyChart
                text={translate(
                  "inv.dashboard.chart.empty",
                  { ns: "inv" },
                  "No data"
                )}
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryDistribution} margin={{ left: -4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={52}
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
                    formatter={(value) => [
                      formatCurrency(Number(value), locale),
                      translate(
                        "inv.products.fields.stockValue",
                        { ns: "inv" },
                        "Stock value"
                      ),
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 2, 2]}
                    fill="var(--brand-1)"
                    className="cursor-pointer"
                    onClick={() => navigate("/goods/categories")}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.abc",
                { ns: "inv" },
                "ABC composition"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              abcRows.map((row) => {
                const share = abcTotalValue > 0 ? row.value / abcTotalValue : 0;
                return (
                  <div key={row.abc} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">
                        {translate(
                          `inv.option.abc.${row.abc}`,
                          { ns: "inv" },
                          `Class ${row.abc}`
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(row.skus)}{" "}
                        {translate("inv.dashboard.kpi.deadSkus", { ns: "inv" }, "SKUs")}
                        {" · "}
                        {formatCurrency(row.value, locale)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.abc === "A" && "bg-emerald-500",
                          row.abc === "B" && "bg-blue-500",
                          row.abc === "C" && "bg-neutral-400"
                        )}
                        style={{ width: `${Math.max(share * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.topMovers",
                { ns: "inv" },
                "Top consumption"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movements.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : topMovers.length === 0 ? (
              <EmptyChart
                text={translate(
                  "inv.dashboard.chart.empty",
                  { ns: "inv" },
                  "No data"
                )}
              />
            ) : (
              <ul className="space-y-2">
                {topMovers.map((row) => {
                  const share =
                    topMovers[0].consumption > 0
                      ? row.consumption / topMovers[0].consumption
                      : 0;
                  return (
                    <li key={row.product.id}>
                      <button
                        type="button"
                        className="w-full cursor-pointer text-left"
                        onClick={() =>
                          navigate(`/goods/products/show/${row.product.id}`)
                        }
                      >
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium hover:underline">
                            {row.product.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatCurrency(row.consumption, locale)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[var(--brand-3)]"
                            style={{ width: `${Math.max(share * 100, 3)}%` }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.watchlist",
                { ns: "inv" },
                "Shortage watchlist"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : watchlist.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
                {translate(
                  "inv.stockAlerts.empty",
                  { ns: "inv" },
                  "Great — no low-stock products right now."
                )}
              </div>
            ) : (
              <ul className="divide-y">
                {watchlist.map((row) => (
                  <li key={row.product.id} className="py-2 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                      onClick={() =>
                        navigate(`/goods/products/show/${row.product.id}`)
                      }
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium hover:underline">
                          {row.product.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatNumber(row.product.currentStock)} /{" "}
                          {formatNumber(row.product.safetyStock)}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StockHealthBadge health={row.health} locale={locale} />
                        <CoverageLabel days={row.cover} className="text-xs" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/stock/alerts"
              className="mt-3 block text-xs font-medium text-primary hover:underline"
            >
              {translate(
                "inv.dashboard.chart.openAlerts",
                { ns: "inv" },
                "Open all alerts"
              )}
            </Link>
          </CardContent>
        </Card>
      </div>

      {movementMix.length > 0 ? (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.movementMix",
                { ns: "inv" },
                "Movement mix by type"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movementMix} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
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
                  dataKey="value"
                  radius={[2, 6, 6, 2]}
                  fill="var(--brand-2)"
                  className="cursor-pointer"
                  onClick={() => navigate("/stock/movements")}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
