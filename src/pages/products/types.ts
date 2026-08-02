import type { ProductRecord } from "@/lib/inventory/types";

export type ProductFormValues = {
  sku: string;
  name: string;
  barcode?: string;
  categoryId?: number;
  spec?: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  currentStock?: number;
  safetyStock?: number;
  status?: string;
  supplierId?: number;
  remark?: string;
};

export function productFormValuesFromRecord(
  record: ProductRecord
): ProductFormValues {
  return {
    sku: record.sku ?? "",
    name: record.name ?? "",
    barcode: record.barcode ?? "",
    categoryId: record.categoryId ?? undefined,
    spec: record.spec ?? "",
    unit: record.unit ?? "piece",
    purchasePrice: record.purchasePrice ?? 0,
    salePrice: record.salePrice ?? 0,
    currentStock: record.currentStock ?? 0,
    safetyStock: record.safetyStock ?? 0,
    status: record.status ?? "on_sale",
    supplierId: record.supplierId ?? undefined,
    remark: record.remark ?? "",
  };
}
