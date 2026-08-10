import type { DataProvider } from "@refinedev/core";

import type { CountItemRecord, InventoryCountRecord } from "@/lib/inventory/types";
import { postStockMovement } from "@/lib/inventory/stock-movement";

const PAGE_SIZE = 100;

async function fetchAllCountItems(
  dataProvider: DataProvider,
  countId: number
): Promise<CountItemRecord[]> {
  const items: CountItemRecord[] = [];
  let page = 1;
  // NocoBase currently exposes a paged list, so completion must walk every page.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await dataProvider.getList<CountItemRecord>({
      resource: "scm_inventory_count_items",
      pagination: { mode: "server", currentPage: page, pageSize: PAGE_SIZE },
      filters: [{ field: "count_id", operator: "eq", value: countId }],
      sorters: [{ field: "id", order: "asc" }],
      meta: { appends: ["product"] },
    });
    items.push(...response.data);
    if (response.total <= page * PAGE_SIZE) break;
    page += 1;
  }
  return items;
}

async function fetchCurrentStocks(
  dataProvider: DataProvider,
  productIds: number[]
): Promise<Map<number, number>> {
  const stocks = new Map<number, number>();
  const uniqueIds = Array.from(new Set(productIds));
  let page = 1;
  while (uniqueIds.length > 0) {
    const response = await dataProvider.getList<{
      id: number;
      currentStock?: number | null;
    }>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: page, pageSize: PAGE_SIZE },
      filters: [{ field: "id", operator: "in", value: uniqueIds }],
      meta: { fields: ["id", "currentStock"] },
    });
    for (const product of response.data) {
      stocks.set(product.id, Number(product.currentStock ?? 0));
    }
    if (response.total <= page * PAGE_SIZE) break;
    page += 1;
  }
  return stocks;
}

async function fetchAllProducts(
  dataProvider: DataProvider,
  filter: Record<string, unknown>
): Promise<Array<{ id: number; currentStock?: number }>> {
  const products: Array<{ id: number; currentStock?: number }> = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await dataProvider.getList<any>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: page, pageSize: PAGE_SIZE },
      filters: Object.entries(filter).map(([field, value]) => ({
        field,
        operator: "eq",
        value,
      })),
      meta: { fields: ["id", "currentStock"] },
    });
    products.push(...response.data);
    if (response.total <= page * PAGE_SIZE) break;
    page += 1;
  }
  return products;
}

export async function createCountWithItems(
  dataProvider: DataProvider,
  values: {
    scope?: string;
    categoryId?: number;
    productId?: number;
    countDate?: string;
    countBy?: string;
    remark?: string;
  }
): Promise<InventoryCountRecord> {
  const scope = values.scope ?? "all";

  let products: Array<{ id: number; currentStock?: number }> = [];
  if (scope === "product" && values.productId) {
    const response = await dataProvider.getOne<any>({
      resource: "scm_products",
      id: values.productId,
      meta: { fields: ["id", "currentStock"] },
    });
    products = [response.data];
  } else {
    const filter =
      scope === "category" && values.categoryId
        ? { category_id: values.categoryId }
        : {};
    products = await fetchAllProducts(dataProvider, filter);
  }

  const countResponse = await dataProvider.create<InventoryCountRecord>({
    resource: "scm_inventory_counts",
    variables: {
      scope,
      status: "in_progress",
      countDate: values.countDate || new Date().toISOString().slice(0, 10),
      countBy: values.countBy || null,
      remark: values.remark || null,
      totalItems: 0,
      diffCount: 0,
    },
  });
  const count = countResponse.data;

  if (products.length > 0) {
    await Promise.all(
      products.map((product) =>
        dataProvider.create<CountItemRecord>({
          resource: "scm_inventory_count_items",
          variables: {
            count: { id: count.id },
            product: { id: product.id },
            systemStock: Number(product.currentStock ?? 0),
            countedStock: null,
            diffStock: 0,
            status: "pending",
            remark: null,
          },
        })
      )
    );
  }

  if (products.length !== Number(count.totalItems ?? 0)) {
    await dataProvider.update({
      resource: "scm_inventory_counts",
      id: count.id,
      variables: { totalItems: products.length },
    });
  }

  return count;
}

export async function completeCount(
  dataProvider: DataProvider,
  countId: number
): Promise<void> {
  const items = await fetchAllCountItems(dataProvider, countId);
  if (items.length === 0) {
    throw new Error("This count has no lines to post.");
  }

  const allProductIds = items.map((item) => {
    const productId = item.productId ?? item.product?.id;
    if (!productId) throw new Error(`Count line ${item.id} has no product.`);
    return productId;
  });
  if (new Set(allProductIds).size !== allProductIds.length) {
    throw new Error(
      "This count contains a duplicate product and cannot be posted safely."
    );
  }

  const openItems = items.filter((item) => item.status !== "resolved");
  const uncounted = openItems.filter(
    (item) => item.countedStock === null || item.countedStock === undefined
  );
  if (uncounted.length > 0) {
    throw new Error(
      `${uncounted.length} line(s) are still uncounted. Count them or explicitly accept the system quantities before posting.`
    );
  }

  // Check every snapshot before the first write, then check it again inside the
  // shared posting function immediately before each ledger entry is created.
  const openProductIds = openItems.map((item) => {
    const productId = item.productId ?? item.product?.id;
    if (!productId) throw new Error(`Count line ${item.id} has no product.`);
    return productId;
  });
  const currentStocks = await fetchCurrentStocks(dataProvider, openProductIds);
  for (const item of openItems) {
    const productId = item.productId ?? item.product?.id;
    if (!productId) throw new Error(`Count line ${item.id} has no product.`);
    const currentStock = currentStocks.get(productId);
    if (currentStock === undefined) {
      throw new Error(`Product #${productId} could not be loaded for posting.`);
    }
    const snapshotStock = Number(item.systemStock ?? 0);
    if (currentStock !== snapshotStock) {
      throw new Error(
        `Product #${productId} changed from ${snapshotStock} to ${currentStock} after this count was created. Refresh and recount before posting.`
      );
    }
  }

  let diffCount = 0;
  for (const item of items) {
    const systemStock = Number(item.systemStock ?? 0);
    const countedStock = Number(item.countedStock ?? systemStock);
    const diff = countedStock - systemStock;
    if (diff !== 0) diffCount += 1;

    if (item.status === "resolved") continue;
    const productId = item.productId ?? item.product?.id;
    if (!productId) throw new Error(`Count line ${item.id} has no product.`);

    await dataProvider.update({
      resource: "scm_inventory_count_items",
      id: item.id,
      variables: { countedStock, diffStock: diff, status: "resolved" },
    });
    try {
      if (diff !== 0) {
        await postStockMovement(dataProvider, {
          productId,
          type: "adjustment",
          targetStock: countedStock,
          expectedBeforeStock: systemStock,
          referenceNo: `Stocktake#${countId}`,
          handler: "Stocktake adjustment",
          remark: `Stocktake variance ${diff > 0 ? "+" : ""}${diff}`,
        });
      }
    } catch (postingError) {
      try {
        await dataProvider.update({
          resource: "scm_inventory_count_items",
          id: item.id,
          variables: {
            countedStock: item.countedStock ?? null,
            diffStock: item.diffStock ?? 0,
            status: item.status ?? "counted",
          },
        });
      } catch (rollbackError) {
        const postingMessage =
          postingError instanceof Error ? postingError.message : "unknown posting error";
        const rollbackMessage =
          rollbackError instanceof Error ? rollbackError.message : "unknown rollback error";
        throw new Error(
          `Posting failed (${postingMessage}) and the count-line rollback also failed (${rollbackMessage}). Manual reconciliation is required.`
        );
      }
      throw postingError;
    }
  }

  await dataProvider.update({
    resource: "scm_inventory_counts",
    id: countId,
    variables: {
      status: "completed",
      totalItems: items.length,
      diffCount,
    },
  });
}

/** Draft → counting. Nothing is posted yet; the sheet just opens for entry. */
export async function startCount(
  dataProvider: DataProvider,
  countId: number
): Promise<void> {
  await dataProvider.update({
    resource: "scm_inventory_counts",
    id: countId,
    variables: { status: "in_progress" },
  });
}

/**
 * "Nothing to report" for the lines still open: the counted quantity equals
 * the system quantity, which is how a counter closes a shelf with no variance.
 */
export async function acceptSystemQuantities(
  dataProvider: DataProvider,
  items: CountItemRecord[]
): Promise<number> {
  const pending = items.filter((item) => item.status === "pending");
  await Promise.all(
    pending.map((item) =>
      dataProvider.update({
        resource: "scm_inventory_count_items",
        id: item.id,
        variables: {
          countedStock: Number(item.systemStock ?? 0),
          diffStock: 0,
          status: "counted",
        },
      })
    )
  );
  return pending.length;
}

export async function saveCountItem(
  dataProvider: DataProvider,
  itemId: number,
  countedStock: number | null
): Promise<void> {
  await dataProvider.update({
    resource: "scm_inventory_count_items",
    id: itemId,
    variables: {
      countedStock,
      status: countedStock === null ? "pending" : "counted",
    },
  });
}
