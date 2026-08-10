import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  ANALYSIS_WINDOW_DAYS,
  EMPTY_MOVEMENT_STATS,
  isoDaysAgo,
  type ProductMovementStats,
} from "@/lib/inventory/analytics";
import { STOCK_IN_TYPES, STOCK_OUT_TYPES } from "@/lib/inventory/constants";

type AggregateRow = {
  productId: number | string;
  type: string;
  qty: number | string | null;
  documents: number | string | null;
  lastAt: string | null;
};

/** Run a NocoBase aggregate query — the same read-only endpoint the dashboard uses. */
export function queryAggregate<T>(
  resource: string,
  body: Record<string, unknown>
): Promise<T> {
  return nocobaseClient.action(resource, "query", { body }) as Promise<T>;
}

const MEASURES = [
  { field: ["quantity"], aggregation: "sum", alias: "qty" },
  { field: ["id"], aggregation: "count", alias: "documents" },
  { field: ["occurredAt"], aggregation: "max", alias: "lastAt" },
];

const DIMENSIONS = [
  { field: ["product_id"], alias: "productId" },
  { field: ["type"], alias: "type" },
];

function foldRows(rows: AggregateRow[]): Map<number, ProductMovementStats> {
  const map = new Map<number, ProductMovementStats>();
  for (const row of rows) {
    const productId = Number(row.productId);
    if (!productId) continue;
    const stats = map.get(productId) ?? { ...EMPTY_MOVEMENT_STATS };
    const qty = Number(row.qty ?? 0);
    const documents = Number(row.documents ?? 0);
    const type = row.type ?? "";

    if (type === "purchase_in") stats.purchaseQty += qty;
    if (type === "sale_out") stats.saleQty += qty;
    if (type === "return_in") stats.returnQty += qty;
    if (type === "loss") stats.lossQty += qty;
    if (type === "adjustment") stats.adjustmentQty += qty;

    if (STOCK_IN_TYPES.has(type)) {
      stats.inQty += qty;
      stats.receipts += documents;
      stats.lastInAt = laterOf(stats.lastInAt, row.lastAt);
    }
    if (STOCK_OUT_TYPES.has(type)) {
      stats.outQty += qty;
      stats.issues += documents;
      stats.lastOutAt = laterOf(stats.lastOutAt, row.lastAt);
    }
    stats.lastMovementAt = laterOf(stats.lastMovementAt, row.lastAt);
    map.set(productId, stats);
  }
  return map;
}

function laterOf(
  current: string | undefined,
  candidate: string | null
): string | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate) > new Date(current) ? candidate : current;
}

/**
 * Per-product movement figures. Two aggregates are needed: the windowed one
 * drives demand and turnover, the lifetime one answers "when did this last
 * move", which is what dead-stock detection is about.
 */
export function useMovementStats(windowDays = ANALYSIS_WINDOW_DAYS) {
  const since = useMemo(() => isoDaysAgo(windowDays), [windowDays]);

  const windowed = useQuery<AggregateRow[]>({
    queryKey: ["inventory-movement-stats", "window", windowDays],
    queryFn: () =>
      queryAggregate<AggregateRow[]>("scm_stock_movements", {
        measures: MEASURES,
        dimensions: DIMENSIONS,
        filter: { occurredAt: { $gte: since } },
      }),
    retry: false,
  });

  const lifetime = useQuery<AggregateRow[]>({
    queryKey: ["inventory-movement-stats", "lifetime"],
    queryFn: () =>
      queryAggregate<AggregateRow[]>("scm_stock_movements", {
        measures: MEASURES,
        dimensions: DIMENSIONS,
      }),
    retry: false,
  });

  const statsById = useMemo(
    () => foldRows(windowed.data ?? []),
    [windowed.data]
  );
  const lifetimeById = useMemo(
    () => foldRows(lifetime.data ?? []),
    [lifetime.data]
  );

  // Dead stock asks about the last issue ever, not the last issue in the window.
  const merged = useMemo(() => {
    const map = new Map<number, ProductMovementStats>();
    const ids = new Set([...statsById.keys(), ...lifetimeById.keys()]);
    for (const id of ids) {
      const windowStats = statsById.get(id) ?? { ...EMPTY_MOVEMENT_STATS };
      const lifetimeStats = lifetimeById.get(id);
      map.set(id, {
        ...windowStats,
        lastInAt: lifetimeStats?.lastInAt ?? windowStats.lastInAt,
        lastOutAt: lifetimeStats?.lastOutAt ?? windowStats.lastOutAt,
        lastMovementAt:
          lifetimeStats?.lastMovementAt ?? windowStats.lastMovementAt,
      });
    }
    return map;
  }, [lifetimeById, statsById]);

  return {
    statsById: merged,
    windowDays,
    isLoading: windowed.isLoading || lifetime.isLoading,
    isError: windowed.isError || lifetime.isError,
    refetch: () => {
      void windowed.refetch();
      void lifetime.refetch();
    },
  };
}

export type MovementStatsResult = ReturnType<typeof useMovementStats>;
