import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Package,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
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
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { formatCurrency, formatNumber } from "@/lib/inventory/format";
import type { ProductRecord } from "@/lib/inventory/types";

const BUILD_STORY: BuildStory = {
  models: ["DeepSeek V4 Flash 0731"],
  intro: {
    en: "Inventory management — products, stock, suppliers, movements, counts.",
    zh: "库存管理 —— 商品、库存、供应商、出入库、盘点。",
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

type KpiProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  to?: string;
  tone?: "default" | "warning";
};

const toneClasses: Record<string, string> = {
  default:
    "bg-gradient-to-br from-(--brand-1) to-(--brand-2) text-white shadow-sm shadow-brand-1/25",
  warning:
    "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25",
};

function KpiCard({ label, value, hint, icon, to, tone = "default" }: KpiProps) {
  const content = (
    <Card className="surface-card group h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={`grid size-9 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${toneClasses[tone]}`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block transition-opacity hover:opacity-90">
      {content}
    </Link>
  ) : (
    content
  );
}

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
  const now = new Date();

  const baseKpis = useAggregateQuery<Array<{ product_count: number; total_stock: number }>>(
    "scm_products",
    {
      measures: [
        { field: ["id"], aggregation: "count", alias: "product_count" },
        { field: ["currentStock"], aggregation: "sum", alias: "total_stock" },
      ],
    }
  );

  const pendingCounts = useAggregateQuery<
    Array<{ pending_count: number }>
  >("scm_inventory_counts", {
    measures: [{ field: ["id"], aggregation: "count", alias: "pending_count" }],
    filter: { status: { $in: ["draft", "in_progress"] } },
  });

  const trendData = useAggregateQuery<
    Array<{ total_qty: number; date: string; type?: string }>
  >("scm_stock_movements", {
    measures: [{ field: ["quantity"], aggregation: "sum", alias: "total_qty" }],
    dimensions: [
      { field: ["occurredAt"], alias: "date", format: "YYYY-MM-DD" },
      { field: ["type"], alias: "type" },
    ],
    orders: [{ field: ["occurredAt"], alias: "date", order: "asc" }],
    filter: {
      $and: [
        { occurredAt: { $gte: `${now.getFullYear()}-07-01T00:00:00.000Z` } },
        { type: { $in: ["purchase_in", "sale_out", "return_in"] } },
      ],
    },
  });

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 200 },
      errorNotification: false,
      queryOptions: { retry: false },
      meta: { appends: ["category"] },
    });
  const products = productsResult?.data ?? [];

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) =>
          product.status !== "stopped" &&
          Number(product.currentStock ?? 0) <= Number(product.safetyStock ?? 0)
      ).length,
    [products]
  );

  const inventoryValue = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum + Number(product.currentStock ?? 0) * Number(product.purchasePrice ?? 0),
        0
      ),
    [products]
  );

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      const category = product.category?.name ?? translate(
        "inv.dashboard.uncategorized",
        { ns: "inv" },
        "Uncategorized"
      );
      map.set(category, (map.get(category) ?? 0) + Number(product.currentStock ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [products, translate]);

  const trendChartData = useMemo(() => {
    const map = new Map<string, { date: string; inbound: number; outbound: number }>();
    for (const row of trendData.data ?? []) {
      const entry =
        map.get(row.date) ?? { date: row.date, inbound: 0, outbound: 0 };
      if (row.type === "purchase_in" || row.type === "return_in") {
        entry.inbound += Number(row.total_qty ?? 0);
      } else {
        entry.outbound += Number(row.total_qty ?? 0);
      }
      map.set(row.date, entry);
    }
    return Array.from(map.values());
  }, [trendData.data]);

  const totalInbound = useMemo(
    () => trendChartData.reduce((sum, row) => sum + row.inbound, 0),
    [trendChartData]
  );
  const totalOutbound = useMemo(
    () => trendChartData.reduce((sum, row) => sum + row.outbound, 0),
    [trendChartData]
  );

  const pageElement = useAIPageElementHandle({
    id: "dashboard-overview",
    title: translate("inv.dashboard.ai.title", { ns: "inv" }, "Dashboard inventory overview"),
    kind: "detail",
    getContext: () => ({
      productCount: baseKpis.data?.[0]?.product_count ?? 0,
      totalStock: baseKpis.data?.[0]?.total_stock ?? 0,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      lowStockCount,
      pendingCounts: pendingCounts.data?.[0]?.pending_count ?? 0,
      totalInbound,
      totalOutbound,
      categoryDistribution: categoryDistribution.slice(0, 12),
      trend: trendChartData.slice(-14),
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.productCount",
            { ns: "inv" },
            "Products"
          )}
          value={
            baseKpis.isLoading
              ? "…"
              : formatNumber(baseKpis.data?.[0]?.product_count)
          }
          icon={<Package className="size-4" />}
          to="/goods/products"
        />
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.totalStock",
            { ns: "inv" },
            "Total stock"
          )}
          value={
            baseKpis.isLoading
              ? "…"
              : formatNumber(baseKpis.data?.[0]?.total_stock)
          }
          hint={translate(
            "inv.dashboard.kpi.totalStockHint",
            { ns: "inv" },
            "Total units on hand"
          )}
          icon={<Boxes className="size-4" />}
        />
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.inventoryValue",
            { ns: "inv" },
            "Inventory value"
          )}
          value={productsQuery.isLoading ? "…" : formatCurrency(inventoryValue, locale)}
          hint={translate(
            "inv.dashboard.kpi.inventoryValueHint",
            { ns: "inv" },
            "Estimated at purchase price"
          )}
          icon={<TrendingUp className="size-4" />}
        />
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.lowStock",
            { ns: "inv" },
            "Low stock alerts"
          )}
          value={productsQuery.isLoading ? "…" : formatNumber(lowStockCount)}
          icon={<AlertTriangle className="size-4" />}
          tone={lowStockCount > 0 ? "warning" : "default"}
          to="/stock/alerts"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.pendingCounts",
            { ns: "inv" },
            "Active counts"
          )}
          value={
            pendingCounts.isLoading
              ? "…"
              : formatNumber(pendingCounts.data?.[0]?.pending_count)
          }
          icon={<ClipboardCheck className="size-4" />}
          to="/counting/counts"
        />
        <KpiCard
          label={translate(
            "inv.dashboard.kpi.monthInbound",
            { ns: "inv" },
            "Recent inbound"
          )}
          value={formatNumber(totalInbound)}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.categoryStock",
                { ns: "inv" },
                "Stock by category"
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
                <BarChart data={categoryDistribution} margin={{ left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)" }}
                    formatter={(value) => [formatNumber(Number(value)), translate("inv.dashboard.chart.stockQty", { ns: "inv" }, "Stock qty")]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 2, 2]} fill="var(--brand-1)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">
              {translate(
                "inv.dashboard.chart.trend",
                { ns: "inv" },
                "Recent in/out trend"
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)" }}
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
                    dot={{ r: 2.5, fill: "var(--brand-1)" }}
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
                    dot={{ r: 2.5, fill: "var(--brand-3)" }}
                    activeDot={{ r: 4.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
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
