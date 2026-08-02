import { useGetLocale, useList, useShow, useTranslate } from "@refinedev/core";
import { useNavigate, useOutlet } from "react-router";
import { Pencil, RotateCw } from "lucide-react";
import { useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { EditButton } from "@/components/resources/buttons/edit";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/inventory/format";
import {
  optionLabel,
  MOVEMENT_TYPES,
  PRODUCT_STATUS,
  PRODUCT_UNITS,
} from "@/lib/inventory/constants";
import type { ProductRecord, StockMovementRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";

type ProductShowProps = {
  closeTo?: string;
  id?: string;
};

export const ProductShow = ({
  closeTo = "/goods/products",
  id: idOverride,
}: ProductShowProps) => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const id = idOverride ?? routeId;
  const nestedDrawer = useOutlet();
  const { result: record, query } = useShow<ProductRecord>({
    resource: "scm_products",
    id,
    meta: {
      appends: ["category", "supplier"],
    },
  });

  const { result: movementsResult } = useList<StockMovementRecord>({
    resource: "scm_stock_movements",
    pagination: { mode: "server", currentPage: 1, pageSize: 5 },
    filters: record?.id
      ? [{ field: "product_id", operator: "eq", value: record.id }]
      : undefined,
    sorters: [{ field: "occurredAt", order: "desc" }],
    errorNotification: false,
    queryOptions: { enabled: Boolean(record?.id), retry: false },
    meta: { appends: ["product"] },
  });
  const movements = movementsResult?.data ?? [];

  const currentStock = record?.currentStock ?? 0;
  const safetyStock = record?.safetyStock ?? 0;
  const isLowStock =
    record?.status !== "stopped" && currentStock <= safetyStock;

  const detailContext = useAIPageElementHandle({
    id: `products-detail-${id ?? "current"}`,
    title: `${translate(
      "inv.products.ai.detail",
      { ns: "inv" },
      "Product details"
    )}: ${record?.name ?? ""}`,
    kind: "detail",
    getContext: () => ({
      resource: "scm_products",
      record: {
        id: record?.id,
        sku: record?.sku,
        name: record?.name,
        barcode: record?.barcode,
        category: record?.category?.name,
        spec: record?.spec,
        unit: record?.unit,
        purchasePrice: record?.purchasePrice,
        salePrice: record?.salePrice,
        currentStock: record?.currentStock,
        safetyStock: record?.safetyStock,
        status: record?.status,
        supplier: record?.supplier?.name,
        remark: record?.remark,
        recentMovements: movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          quantity: movement.quantity,
          afterStock: movement.afterStock,
          occurredAt: movement.occurredAt,
        })),
      },
    }),
  });

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-48" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.products.drawer.show.description",
        { ns: "inv" },
        "Review product master data and live stock."
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo={closeTo}
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <RefreshButton
              resource="scm_products"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <EditButton
              resource="scm_products"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.edit", "Edit")}
              title={translate("buttons.edit", "Edit")}
              onClick={() => navigate("edit")}
            >
              <Pencil />
            </EditButton>
          </>
        ) : null
      }
    >
      <div
        ref={detailContext.ref}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.products.detail.loadError.title",
                { ns: "inv" },
                "Unable to load product"
              )}
            </AlertTitle>
            <AlertDescription>
              {translate(
                "inv.products.detail.loadError.description",
                { ns: "inv" },
                "The product may no longer exist, or you lack view permission."
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <OptionBadge
                  options={PRODUCT_STATUS}
                  value={record.status}
                  locale={locale}
                />
                {isLowStock ? (
                  <OptionBadge
                    options={[]}
                    value={null}
                    locale={locale}
                    className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  />
                ) : null}
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label={translate("inv.products.fields.sku", { ns: "inv" }, "SKU")}
                  value={record.sku || "-"}
                />
                <DetailItem
                  label={translate("inv.products.fields.category", { ns: "inv" }, "Category")}
                  value={record.category?.name || "-"}
                />
                <DetailItem
                  label={translate("inv.products.fields.spec", { ns: "inv" }, "Specification")}
                  value={record.spec || "-"}
                />
                <DetailItem
                  label={translate("inv.products.fields.unit", { ns: "inv" }, "Unit")}
                  value={optionLabel(PRODUCT_UNITS, record.unit, locale)}
                />
                <DetailItem
                  label={translate("inv.products.fields.barcode", { ns: "inv" }, "Barcode")}
                  value={record.barcode || "-"}
                />
                <DetailItem
                  label={translate("inv.products.fields.supplier", { ns: "inv" }, "Supplier")}
                  value={record.supplier?.name || "-"}
                />
              </dl>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-medium">
                {translate(
                  "inv.products.detail.stock",
                  { ns: "inv" },
                  "Stock & pricing"
                )}
              </h3>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label={translate("inv.products.fields.currentStock", { ns: "inv" }, "Current stock")}
                  value={formatNumber(currentStock)}
                  strong
                  danger={isLowStock}
                />
                <DetailItem
                  label={translate("inv.products.fields.safetyStock", { ns: "inv" }, "Safety stock")}
                  value={formatNumber(safetyStock)}
                />
                <DetailItem
                  label={translate("inv.products.fields.purchasePrice", { ns: "inv" }, "Purchase price")}
                  value={formatCurrency(record.purchasePrice, locale)}
                />
                <DetailItem
                  label={translate("inv.products.fields.salePrice", { ns: "inv" }, "Sale price")}
                  value={formatCurrency(record.salePrice, locale)}
                />
              </dl>
            </section>

            {record.remark ? (
              <>
                <Separator />
                <section className="space-y-1">
                  <h3 className="text-sm font-medium">
                    {translate("inv.products.fields.remark", { ns: "inv" }, "Remarks")}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {record.remark}
                  </p>
                </section>
              </>
            ) : null}

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-medium">
                {translate(
                  "inv.products.detail.recentMovements",
                  { ns: "inv" },
                  "Recent stock movements"
                )}
              </h3>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {translate(
                    "inv.products.detail.noMovements",
                    { ns: "inv" },
                    "No movements yet"
                  )}
                </p>
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {movements.map((movement) => (
                    <li
                      key={movement.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <OptionBadge
                          options={MOVEMENT_TYPES}
                          value={movement.type}
                          locale={locale}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(movement.occurredAt, locale)}
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {Number(movement.quantity) >= 0 ? "+" : ""}
                        {formatNumber(movement.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};

function DetailItem({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          "text-sm break-words " +
          (strong
            ? danger
              ? "font-semibold text-amber-600 dark:text-amber-400"
              : "font-semibold"
            : "font-medium")
        }
      >
        {value}
      </dd>
    </div>
  );
}
