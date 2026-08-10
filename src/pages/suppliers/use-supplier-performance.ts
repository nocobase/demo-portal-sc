import { useList } from "@refinedev/core";
import { useMemo } from "react";

import {
  inventoryValue,
  isTracked,
  stockHealth,
} from "@/lib/inventory/analytics";
import type { ProductRecord } from "@/lib/inventory/types";
import { useMovementStats } from "@/lib/inventory/use-movement-stats";

export type SupplierPerformance = {
  skuCount: number;
  /** SKUs currently out of stock or at/below safety stock. */
  shortageSkus: number;
  stockValue: number;
  /** Receipt quantity estimated at today's product purchase price (not PO spend). */
  estimatedReceiptValue: number;
  receipts: number;
  receivedQty: number;
  issuedQty: number;
  lastReceiptAt?: string;
  productIds: number[];
};

function emptyPerformance(): SupplierPerformance {
  return {
    skuCount: 0,
    shortageSkus: 0,
    stockValue: 0,
    estimatedReceiptValue: 0,
    receipts: 0,
    receivedQty: 0,
    issuedQty: 0,
    productIds: [],
  };
}

/**
 * Supplier scoring is derived, not stored: movements only carry a product, so
 * every figure here is a roll-up of that supplier's SKUs.
 */
export function useSupplierPerformance() {
  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
      meta: { appends: ["supplier", "category"] },
    });
  const products = useMemo(
    () => productsResult?.data ?? [],
    [productsResult?.data]
  );

  const movements = useMovementStats();

  const bySupplier = useMemo(() => {
    const map = new Map<number, SupplierPerformance>();
    for (const product of products) {
      const supplierId = Number(
        product.supplier?.id ?? product.supplierId ?? product.supplier_id ?? 0
      );
      if (!supplierId) continue;
      const entry = map.get(supplierId) ?? emptyPerformance();
      const stats = movements.statsById.get(product.id);
      const purchasePrice = Number(product.purchasePrice ?? 0);

      entry.skuCount += 1;
      entry.productIds.push(product.id);
      entry.stockValue += inventoryValue(product);
      entry.receipts += stats?.receipts ?? 0;
      entry.receivedQty += stats?.purchaseQty ?? 0;
      entry.issuedQty += stats?.outQty ?? 0;
      entry.estimatedReceiptValue += (stats?.purchaseQty ?? 0) * purchasePrice;

      const health = stockHealth(product);
      if (isTracked(product) && (health === "out" || health === "low")) {
        entry.shortageSkus += 1;
      }
      if (stats?.lastInAt) {
        entry.lastReceiptAt =
          !entry.lastReceiptAt ||
          new Date(stats.lastInAt) > new Date(entry.lastReceiptAt)
            ? stats.lastInAt
            : entry.lastReceiptAt;
      }
      map.set(supplierId, entry);
    }
    return map;
  }, [movements.statsById, products]);

  return {
    bySupplier,
    products,
    isLoading: productsQuery.isLoading || movements.isLoading,
    isError: productsQuery.isError || movements.isError,
    refetch: () => {
      void productsQuery.refetch();
      movements.refetch();
    },
  };
}
