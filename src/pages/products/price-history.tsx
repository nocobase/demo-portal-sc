import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DetailSection, StatTile } from "@/components/inventory/detail-scaffold";
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
import { formatPercent } from "@/lib/inventory/analytics";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/inventory/format";

type PriceHistoryRecord = {
  id: number | string;
  supplier_id?: number | string | null;
  supplier?: {
    id: number | string;
    name: string;
  } | null;
  price: number | string;
  currency: string;
  effectiveFrom: string;
};

type SupplierQuote = {
  key: string;
  name: string;
  latest: PriceHistoryRecord;
  dataKey: string;
  stroke: string;
};

type ChartRow = Record<string, number | string> & {
  effectiveFrom: string;
};

const SERIES_STROKES = [
  "var(--brand-1)",
  "var(--brand-2)",
  "var(--brand-3)",
];

function supplierKey(row: PriceHistoryRecord): string {
  return String(row.supplier?.id ?? row.supplier_id ?? "unknown");
}

function monthLabel(value: string): string {
  return value.slice(0, 7);
}

export function ProductPriceHistory(props: {
  productId: number | string;
}): React.ReactElement {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { result, query } = useList<PriceHistoryRecord>({
    resource: "scm_supplier_price_history",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    filters: [
      { field: "product_id", operator: "eq", value: props.productId },
    ],
    sorters: [{ field: "effectiveFrom", order: "asc" }],
    meta: { appends: ["supplier"] },
    errorNotification: false,
    queryOptions: { enabled: Boolean(props.productId), retry: false },
  });

  const rows = useMemo(() => result?.data ?? [], [result?.data]);
  const unknownSupplier = translate(
    "inv.products.priceHistory.unknownSupplier",
    { ns: "inv" },
    "Unknown supplier"
  );

  const suppliers = useMemo<SupplierQuote[]>(() => {
    const bySupplier = new Map<
      string,
      { name: string; latest: PriceHistoryRecord }
    >();

    rows.forEach((row) => {
      const key = supplierKey(row);
      const existing = bySupplier.get(key);
      if (
        !existing ||
        new Date(row.effectiveFrom).getTime() >=
          new Date(existing.latest.effectiveFrom).getTime()
      ) {
        bySupplier.set(key, {
          name: row.supplier?.name ?? unknownSupplier,
          latest: row,
        });
      }
    });

    return Array.from(bySupplier.entries()).map(([key, value], index) => ({
      key,
      name: value.name,
      latest: value.latest,
      dataKey: `supplier${index}`,
      stroke: SERIES_STROKES[index % SERIES_STROKES.length],
    }));
  }, [rows, unknownSupplier]);

  const chartData = useMemo<ChartRow[]>(() => {
    const seriesBySupplier = new Map(
      suppliers.map((supplier) => [supplier.key, supplier])
    );
    const byDate = new Map<string, ChartRow>();

    rows.forEach((row) => {
      const series = seriesBySupplier.get(supplierKey(row));
      if (!series) return;
      const chartRow = byDate.get(row.effectiveFrom) ?? {
        effectiveFrom: row.effectiveFrom,
      };
      chartRow[series.dataKey] = Number(row.price);
      chartRow[`${series.dataKey}Currency`] = row.currency;
      byDate.set(row.effectiveFrom, chartRow);
    });

    return Array.from(byDate.values());
  }, [rows, suppliers]);

  if (query.isLoading) {
    return <Skeleton className="h-56 w-full rounded-xl" />;
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {translate(
            "inv.products.priceHistory.loadError.title",
            { ns: "inv" },
            "Unable to load price history"
          )}
        </AlertTitle>
        <AlertDescription>
          <p>
            {translate(
              "inv.products.priceHistory.loadError.description",
              { ns: "inv" },
              "The price history request failed or you lack permission."
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => void query.refetch()}
          >
            {translate("inv.common.retry", { ns: "inv" }, "Retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        {translate(
          "inv.products.priceHistory.empty",
          { ns: "inv" },
          "No purchase price history is available for this product."
        )}
      </div>
    );
  }

  const first = rows[0];
  const current = rows[rows.length - 1];
  const firstPrice = Number(first.price);
  const currentPrice = Number(current.price);
  const change =
    firstPrice === 0 ? null : (currentPrice - firstPrice) / firstPrice;
  const latestQuotes = suppliers
    .map((supplier) => ({
      ...supplier,
      price: Number(supplier.latest.price),
    }))
    .sort((a, b) => a.price - b.price);
  const cheapest = latestQuotes[0];
  const emptyValue = translate("inv.common.emDash", { ns: "inv" }, "—");

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={translate(
            "inv.products.priceHistory.currentPrice",
            { ns: "inv" },
            "Current price"
          )}
          value={formatCurrency(current.price, locale, current.currency)}
          hint={formatDate(current.effectiveFrom, locale)}
        />
        <StatTile
          label={translate(
            "inv.products.priceHistory.change",
            { ns: "inv" },
            "Change in window"
          )}
          value={
            change === null
              ? emptyValue
              : `${change > 0 ? "+" : ""}${formatPercent(change, 1)}`
          }
          tone={
            change === null || change === 0
              ? "default"
              : change < 0
                ? "success"
                : "warning"
          }
        />
        <StatTile
          label={translate(
            "inv.products.priceHistory.lowestQuote",
            { ns: "inv" },
            "Lowest current quote"
          )}
          value={formatCurrency(
            cheapest.latest.price,
            locale,
            cheapest.latest.currency
          )}
          hint={cheapest.name}
          tone="success"
        />
        <StatTile
          label={translate(
            "inv.products.priceHistory.quotingSuppliers",
            { ns: "inv" },
            "Quoting suppliers"
          )}
          value={formatNumber(suppliers.length, locale)}
        />
      </div>

      <DetailSection
        title={translate(
          "inv.products.priceHistory.trend",
          { ns: "inv" },
          "Purchase price trend"
        )}
      >
        <div className="rounded-xl border bg-card p-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: -16 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="effectiveFrom"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={monthLabel}
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
                labelFormatter={(label) => monthLabel(String(label))}
                formatter={(value, name, item) => {
                  const tooltipRow = item.payload as ChartRow | undefined;
                  const currencyValue =
                    tooltipRow?.[`${String(item.dataKey)}Currency`];
                  const currency =
                    typeof currencyValue === "string"
                      ? currencyValue
                      : current.currency;
                  return [
                    formatCurrency(Number(value), locale, currency),
                    String(name ?? unknownSupplier),
                  ];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {suppliers.map((supplier) => (
                <Line
                  key={supplier.key}
                  type="monotone"
                  dataKey={supplier.dataKey}
                  name={supplier.name}
                  stroke={supplier.stroke}
                  strokeWidth={2}
                  dot={{ r: 3, fill: supplier.stroke }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DetailSection>

      {latestQuotes.length > 1 ? (
        <DetailSection
          title={translate(
            "inv.products.priceHistory.comparison",
            { ns: "inv" },
            "Supplier comparison"
          )}
        >
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table style={{ tableLayout: "fixed", width: "100%" }}>
              <TableHeader className="bg-muted/45">
                <TableRow>
                  <TableHead className="w-[34%]">
                    {translate(
                      "inv.products.fields.supplier",
                      { ns: "inv" },
                      "Supplier"
                    )}
                  </TableHead>
                  <TableHead className="w-32">
                    {translate(
                      "inv.products.priceHistory.latestPrice",
                      { ns: "inv" },
                      "Latest price"
                    )}
                  </TableHead>
                  <TableHead className="w-36">
                    {translate(
                      "inv.products.priceHistory.effectiveDate",
                      { ns: "inv" },
                      "Effective date"
                    )}
                  </TableHead>
                  <TableHead className="w-36 text-right">
                    {translate(
                      "inv.products.priceHistory.gapFromCheapest",
                      { ns: "inv" },
                      "Gap vs. cheapest"
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestQuotes.map((quote) => {
                  const isCheapest = quote.price === cheapest.price;
                  const gap =
                    cheapest.price === 0
                      ? quote.price === 0
                        ? 0
                        : null
                      : (quote.price - cheapest.price) / cheapest.price;
                  return (
                    <TableRow
                      key={quote.key}
                      className={
                        isCheapest
                          ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                          : undefined
                      }
                    >
                      <TableCell
                        className={
                          isCheapest
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "font-medium"
                        }
                      >
                        {quote.name}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(
                          quote.latest.price,
                          locale,
                          quote.latest.currency
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(quote.latest.effectiveFrom, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {gap === null ? emptyValue : formatPercent(gap, 1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}
