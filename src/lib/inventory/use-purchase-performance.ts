import { useList } from "@refinedev/core";
import { useCallback, useMemo } from "react";

export type DeliveryPerformance = {
  scoredOrders: number;
  onTimeOrders: number;
  onTimeRate: number | null;
  averageDelayDays: number | null;
  worstDelayDays: number;
  /** Counts by lateness bucket. */
  buckets: {
    onTime: number;
    late1to3: number;
    late4to6: number;
    late7plus: number;
  };
  openOrders: number;
  overdueOrders: number;
  purchaseAmount: number;
  /** Ascending by month, last 12 calendar months, keyed "yyyy-MM". */
  monthly: Array<{
    month: string;
    total: number;
    onTime: number;
    rate: number | null;
  }>;
};

type PurchaseOrderRecord = {
  id: number;
  supplier_id?: number | string | null;
  supplier?: { id?: number | string | null } | null;
  orderDate?: string | null;
  promisedDate?: string | null;
  actualArrivalDate?: string | null;
  status?: string | null;
  totalAmount?: number | string | null;
};

type PerformanceAccumulator = {
  performance: DeliveryPerformance;
  positiveDelayDays: number;
};

const DAY_MS = 86_400_000;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastTwelveMonths(now = new Date()): string[] {
  const months: string[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
  }
  return months;
}

function dateBoundary(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function emptyAccumulator(months: string[]): PerformanceAccumulator {
  return {
    positiveDelayDays: 0,
    performance: {
      scoredOrders: 0,
      onTimeOrders: 0,
      onTimeRate: null,
      averageDelayDays: null,
      worstDelayDays: 0,
      buckets: { onTime: 0, late1to3: 0, late4to6: 0, late7plus: 0 },
      openOrders: 0,
      overdueOrders: 0,
      purchaseAmount: 0,
      monthly: months.map((month) => ({
        month,
        total: 0,
        onTime: 0,
        rate: null,
      })),
    },
  };
}

function addOrder(
  accumulator: PerformanceAccumulator,
  order: PurchaseOrderRecord,
  today: number
) {
  const performance = accumulator.performance;
  performance.purchaseAmount += Number(order.totalAmount ?? 0);

  const promisedAt = dateBoundary(order.promisedDate);
  const actualAt = dateBoundary(order.actualArrivalDate);
  const isOpen =
    (order.status === "placed" || order.status === "partially_received") &&
    !order.actualArrivalDate;

  if (isOpen) {
    performance.openOrders += 1;
    if (promisedAt !== null && promisedAt < today) {
      performance.overdueOrders += 1;
    }
  }

  if (promisedAt === null || actualAt === null) return;

  const delayDays = Math.floor((actualAt - promisedAt) / DAY_MS);
  const positiveDelay = Math.max(delayDays, 0);
  const onTime = delayDays <= 0;
  performance.scoredOrders += 1;
  performance.onTimeOrders += onTime ? 1 : 0;
  performance.worstDelayDays = Math.max(
    performance.worstDelayDays,
    positiveDelay
  );
  accumulator.positiveDelayDays += positiveDelay;

  if (onTime) performance.buckets.onTime += 1;
  else if (delayDays <= 3) performance.buckets.late1to3 += 1;
  else if (delayDays <= 6) performance.buckets.late4to6 += 1;
  else performance.buckets.late7plus += 1;

  const promisedMonth = monthKey(new Date(promisedAt));
  const monthly = performance.monthly.find(
    (entry) => entry.month === promisedMonth
  );
  if (monthly) {
    monthly.total += 1;
    monthly.onTime += onTime ? 1 : 0;
  }
}

function finalize(accumulator: PerformanceAccumulator): DeliveryPerformance {
  const performance = accumulator.performance;
  if (performance.scoredOrders > 0) {
    performance.onTimeRate =
      performance.onTimeOrders / performance.scoredOrders;
    performance.averageDelayDays =
      accumulator.positiveDelayDays / performance.scoredOrders;
  }
  for (const month of performance.monthly) {
    month.rate = month.total > 0 ? month.onTime / month.total : null;
  }
  return performance;
}

/**
 * Delivery scoring is derived, not stored: promised and arrival dates are
 * compared at calendar-day boundaries for every non-cancelled order.
 */
export function usePurchasePerformance(): {
  bySupplier: Map<number, DeliveryPerformance>;
  overall: DeliveryPerformance;
  /** 0..1 — share of scored suppliers this one beats. Null when unscored. */
  percentileOf: (supplierId: number) => number | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { result, query } = useList<PurchaseOrderRecord>({
    resource: "scm_purchase_orders",
    pagination: { mode: "server", currentPage: 1, pageSize: 1000 },
    errorNotification: false,
    queryOptions: { retry: false },
    meta: { appends: ["supplier"] },
    sorters: [{ field: "orderDate", order: "desc" }],
  });
  const orders = useMemo(() => result?.data ?? [], [result?.data]);
  const currentMonth = monthKey(new Date());
  const months = useMemo(() => lastTwelveMonths(), [currentMonth]);

  const { bySupplier, overall } = useMemo(() => {
    const supplierAccumulators = new Map<number, PerformanceAccumulator>();
    const overallAccumulator = emptyAccumulator(months);
    const today = dateBoundary(new Date().toISOString()) ?? Date.now();

    for (const order of orders) {
      if (order.status === "cancelled") continue;
      addOrder(overallAccumulator, order, today);

      const supplierId = Number(order.supplier?.id ?? order.supplier_id ?? 0);
      if (!supplierId) continue;
      const accumulator =
        supplierAccumulators.get(supplierId) ?? emptyAccumulator(months);
      addOrder(accumulator, order, today);
      supplierAccumulators.set(supplierId, accumulator);
    }

    return {
      bySupplier: new Map(
        [...supplierAccumulators].map(([supplierId, accumulator]) => [
          supplierId,
          finalize(accumulator),
        ])
      ),
      overall: finalize(overallAccumulator),
    };
  }, [months, orders]);

  const scoredRates = useMemo<number[]>(
    () =>
      [...bySupplier.values()]
        .flatMap((performance) =>
          performance.scoredOrders > 0 && performance.onTimeRate !== null
            ? [performance.onTimeRate]
            : []
        ),
    [bySupplier]
  );

  const percentileOf = useCallback(
    (supplierId: number): number | null => {
      const rate = bySupplier.get(supplierId)?.onTimeRate;
      if (rate === null || rate === undefined || scoredRates.length === 0) {
        return null;
      }
      return scoredRates.filter((peerRate) => peerRate < rate).length / scoredRates.length;
    },
    [bySupplier, scoredRates]
  );

  return {
    bySupplier,
    overall,
    percentileOf,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
