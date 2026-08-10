import type { DataProvider } from "@refinedev/core";

import { STOCK_IN_TYPES, STOCK_OUT_TYPES } from "@/lib/inventory/constants";
import type {
  ProductRecord,
  StockMovementRecord,
} from "@/lib/inventory/types";

export type AdjustmentDirection = "increase" | "decrease";

type MovementBalances = {
  beforeStock?: number | string | null;
  afterStock?: number | string | null;
};

export function stockMovementDelta(movement: MovementBalances): number {
  const before = Number(movement.beforeStock);
  const after = Number(movement.afterStock);
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : 0;
}

export function movementInputDelta(
  type: string,
  quantity: number,
  adjustmentDirection: AdjustmentDirection = "increase"
): number {
  const absoluteQuantity = Math.abs(quantity);
  if (STOCK_IN_TYPES.has(type)) return absoluteQuantity;
  if (STOCK_OUT_TYPES.has(type)) return -absoluteQuantity;
  if (type === "adjustment") {
    return adjustmentDirection === "decrease"
      ? -absoluteQuantity
      : absoluteQuantity;
  }
  throw new Error(`Unsupported stock movement type: ${type}`);
}

export function movementDisplayDirection(
  movement: MovementBalances
): "in" | "out" | "flat" {
  const delta = stockMovementDelta(movement);
  return delta > 0 ? "in" : delta < 0 ? "out" : "flat";
}

export type PostStockMovementInput = {
  productId: number;
  type: string;
  quantity?: number;
  adjustmentDirection?: AdjustmentDirection;
  targetStock?: number;
  expectedBeforeStock?: number;
  referenceNo?: string | null;
  handler?: string | null;
  remark?: string | null;
};

/**
 * The single front-end posting path. The API currently has no transactional
 * action, so a failed balance update removes the just-created ledger row.
 * expectedBeforeStock catches stale stocktake snapshots and obvious races.
 */
export async function postStockMovement(
  dataProvider: DataProvider,
  input: PostStockMovementInput
): Promise<StockMovementRecord> {
  const productResponse = await dataProvider.getOne<ProductRecord>({
    resource: "scm_products",
    id: input.productId,
  });
  const beforeStock = Number(productResponse.data.currentStock ?? 0);

  if (
    input.expectedBeforeStock !== undefined &&
    beforeStock !== input.expectedBeforeStock
  ) {
    throw new Error(
      `Stock changed from ${input.expectedBeforeStock} to ${beforeStock}; refresh and recount before posting.`
    );
  }

  const delta =
    input.targetStock !== undefined
      ? input.targetStock - beforeStock
      : movementInputDelta(
          input.type,
          Number(input.quantity ?? 0),
          input.adjustmentDirection
        );
  const afterStock = beforeStock + delta;
  if (!Number.isFinite(afterStock) || afterStock < 0) {
    throw new Error(
      `Movement would produce an invalid stock balance (${afterStock}).`
    );
  }

  const created = await dataProvider.create<StockMovementRecord>({
    resource: "scm_stock_movements",
    variables: {
      product: { id: input.productId },
      type: input.type,
      quantity: Math.abs(delta),
      beforeStock,
      afterStock,
      referenceNo: input.referenceNo || null,
      handler: input.handler || null,
      occurredAt: new Date().toISOString(),
      remark: input.remark || null,
    },
  });

  try {
    await dataProvider.update({
      resource: "scm_products",
      id: input.productId,
      variables: { currentStock: afterStock },
    });
  } catch (updateError) {
    try {
      await dataProvider.deleteOne({
        resource: "scm_stock_movements",
        id: created.data.id,
      });
    } catch (rollbackError) {
      const updateMessage =
        updateError instanceof Error ? updateError.message : "unknown update error";
      const rollbackMessage =
        rollbackError instanceof Error
          ? rollbackError.message
          : "unknown rollback error";
      throw new Error(
        `Stock update failed (${updateMessage}) and the ledger rollback also failed (${rollbackMessage}). Manual reconciliation is required.`
      );
    }
    throw updateError;
  }

  return created.data;
}
