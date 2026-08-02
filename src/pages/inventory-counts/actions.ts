import type { DataProvider } from "@refinedev/core";

import type { CountItemRecord, InventoryCountRecord } from "@/lib/inventory/types";

const PAGE_SIZE = 100;

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
  const itemsResponse = await dataProvider.getList<CountItemRecord>({
    resource: "scm_inventory_count_items",
    pagination: { mode: "server", currentPage: 1, pageSize: PAGE_SIZE },
    filters: [{ field: "count_id", operator: "eq", value: countId }],
    meta: { appends: ["product"] },
  });
  const items = itemsResponse.data;

  let diffCount = 0;
  for (const item of items) {
    const systemStock = Number(item.systemStock ?? 0);
    const countedStock = Number(item.countedStock ?? systemStock);
    const diff = countedStock - systemStock;
    if (diff !== 0) diffCount += 1;

    if (item.status === "resolved") continue;

    if (diff !== 0 && item.productId) {
      await dataProvider.update({
        resource: "scm_products",
        id: item.productId,
        variables: { currentStock: countedStock },
      });
      await dataProvider.create({
        resource: "scm_stock_movements",
        variables: {
          product: { id: item.productId },
          type: "adjustment",
          quantity: Math.abs(diff),
          beforeStock: systemStock,
          afterStock: countedStock,
          referenceNo: `Stocktake#${countId}`,
          handler: "Stocktake adjustment",
          occurredAt: new Date().toISOString(),
          remark: `Stocktake variance ${diff > 0 ? "+" : ""}${diff}`,
        },
      });
    }

    await dataProvider.update({
      resource: "scm_inventory_count_items",
      id: item.id,
      variables: {
        countedStock: countedStock,
        diffStock: diff,
        status: "resolved",
      },
    });
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
