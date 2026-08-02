export type CategoryRecord = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  parentId?: number | null;
  children?: CategoryRecord[];
  createdAt?: string;
};

export type SupplierRecord = {
  id: number;
  code: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  address?: string | null;
  remark?: string | null;
  createdAt?: string;
};

export type ProductRecord = {
  id: number;
  sku: string;
  name: string;
  barcode?: string | null;
  categoryId?: number | null;
  category_id?: number | null;
  category?: Pick<CategoryRecord, "id" | "name"> | null;
  spec?: string | null;
  unit?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  currentStock?: number | null;
  safetyStock?: number | null;
  status?: string | null;
  supplierId?: number | null;
  supplier_id?: number | null;
  supplier?: Pick<SupplierRecord, "id" | "name"> | null;
  remark?: string | null;
  createdAt?: string;
};

export type StockMovementRecord = {
  id: number;
  productId?: number | null;
  product?: Pick<ProductRecord, "id" | "name" | "sku"> | null;
  type?: string | null;
  quantity?: number | null;
  beforeStock?: number | null;
  afterStock?: number | null;
  referenceNo?: string | null;
  handler?: string | null;
  occurredAt?: string | null;
  remark?: string | null;
  createdAt?: string;
};

export type InventoryCountRecord = {
  id: number;
  countNo?: string | null;
  scope?: string | null;
  status?: string | null;
  countDate?: string | null;
  countBy?: string | null;
  totalItems?: number | null;
  diffCount?: number | null;
  remark?: string | null;
  createdAt?: string;
};

export type CountItemRecord = {
  id: number;
  countId?: number | null;
  count?: Pick<InventoryCountRecord, "id" | "countNo" | "status"> | null;
  productId?: number | null;
  product?: Pick<ProductRecord, "id" | "name" | "sku" | "unit"> | null;
  systemStock?: number | null;
  countedStock?: number | null;
  diffStock?: number | null;
  status?: string | null;
  remark?: string | null;
  createdAt?: string;
};
