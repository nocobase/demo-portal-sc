import { useGetLocale, useList, useShow, useTranslate } from "@refinedev/core";
import { Pencil, RotateCw } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import {
  CopyLinkButton,
  DetailGrid,
  DetailItem,
  DetailSection,
  StatTile,
} from "@/components/inventory/detail-scaffold";
import { ExportCsvButton } from "@/components/inventory/list-toolbar";
import { StockHealthBadge } from "@/components/inventory/stock-indicators";
import { EditButton } from "@/components/resources/buttons/edit";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { inventoryValue, isTracked, stockHealth } from "@/lib/inventory/analytics";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/inventory/format";
import type { CategoryRecord, ProductRecord } from "@/lib/inventory/types";

export const CategoryShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const nestedDrawer = useOutlet();

  const { result: record, query } = useShow<CategoryRecord>({
    resource: "scm_product_categories",
    id,
    meta: { appends: ["parent"] },
  });

  const { result: childrenResult } = useList<CategoryRecord>({
    resource: "scm_product_categories",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    filters: record?.id
      ? [{ field: "parentId", operator: "eq", value: record.id }]
      : undefined,
    errorNotification: false,
    queryOptions: { enabled: Boolean(record?.id), retry: false },
  });
  const children = useMemo(
    () => childrenResult?.data ?? [],
    [childrenResult?.data]
  );

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 200 },
      filters: record?.id
        ? [{ field: "category_id", operator: "eq", value: record.id }]
        : undefined,
      sorters: [{ field: "currentStock", order: "asc" }],
      errorNotification: false,
      queryOptions: { enabled: Boolean(record?.id), retry: false },
    });
  const products = useMemo(
    () => productsResult?.data ?? [],
    [productsResult?.data]
  );

  const totals = useMemo(() => {
    let value = 0;
    let units = 0;
    let shortages = 0;
    for (const product of products) {
      value += inventoryValue(product);
      units += Number(product.currentStock ?? 0);
      const health = stockHealth(product);
      if (isTracked(product) && (health === "out" || health === "low")) {
        shortages += 1;
      }
    }
    return { value, units, shortages };
  }, [products]);

  return (
    <RouteDrawer
      className="lg:w-[52vw] lg:min-w-[44rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.categories.drawer.show.description",
        { ns: "inv" },
        "Category details"
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/goods/categories"
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <CopyLinkButton />
            <RefreshButton
              resource="scm_product_categories"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <EditButton
              resource="scm_product_categories"
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
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.categories.detail.loadError.title",
                { ns: "inv" },
                "Unable to load category"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={translate(
                  "inv.categories.fields.directSkus",
                  { ns: "inv" },
                  "Direct SKUs"
                )}
                value={formatNumber(products.length)}
              />
              <StatTile
                label={translate(
                  "inv.dashboard.kpi.totalStock",
                  { ns: "inv" },
                  "Units on hand"
                )}
                value={formatNumber(totals.units)}
              />
              <StatTile
                label={translate(
                  "inv.products.fields.stockValue",
                  { ns: "inv" },
                  "Stock value"
                )}
                value={formatCurrency(totals.value, locale)}
              />
              <StatTile
                label={translate(
                  "inv.categories.fields.shortages",
                  { ns: "inv" },
                  "To reorder"
                )}
                value={formatNumber(totals.shortages)}
                tone={totals.shortages > 0 ? "warning" : "default"}
              />
            </div>

            <DetailSection>
              <DetailGrid>
                <DetailItem
                  label={translate(
                    "inv.categories.fields.code",
                    { ns: "inv" },
                    "Code"
                  )}
                  value={record.code || "-"}
                />
                <DetailItem
                  label={translate(
                    "inv.categories.fields.parent",
                    { ns: "inv" },
                    "Parent category"
                  )}
                  value={
                    record.parentId ? (
                      <button
                        type="button"
                        className="cursor-pointer font-medium hover:underline"
                        onClick={() =>
                          navigate(`/goods/categories/show/${record.parentId}`)
                        }
                      >
                        #{record.parentId}
                      </button>
                    ) : (
                      translate(
                        "inv.categories.topLevel",
                        { ns: "inv" },
                        "Top level"
                      )
                    )
                  }
                />
                <DetailItem
                  label={translate(
                    "inv.categories.fields.description",
                    { ns: "inv" },
                    "Description"
                  )}
                  value={record.description || "-"}
                />
                <DetailItem
                  label={translate(
                    "inv.categories.fields.createdAt",
                    { ns: "inv" },
                    "Created at"
                  )}
                  value={formatDateTime(record.createdAt, locale)}
                />
              </DetailGrid>
            </DetailSection>

            {children.length > 0 ? (
              <>
                <Separator />
                <DetailSection
                  title={translate(
                    "inv.categories.detail.children",
                    { ns: "inv" },
                    "Subcategories"
                  )}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() =>
                          navigate(`/goods/categories/show/${child.id}`)
                        }
                        className="cursor-pointer rounded-md border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                </DetailSection>
              </>
            ) : null}

            <Separator />

            <DetailSection
              title={translate(
                "inv.categories.detail.products",
                { ns: "inv" },
                "Products in this category"
              )}
              action={
                <ExportCsvButton
                  disabled={products.length === 0}
                  onExport={() =>
                    exportCsv(`category-${record.code ?? record.id}`, products, [
                      { header: "SKU", value: (row) => row.sku },
                      { header: "Product", value: (row) => row.name },
                      { header: "On hand", value: (row) => row.currentStock ?? 0 },
                      {
                        header: "Safety stock",
                        value: (row) => row.safetyStock ?? 0,
                      },
                      {
                        header: "Stock value",
                        value: (row) => inventoryValue(row).toFixed(2),
                      },
                    ])
                  }
                />
              }
            >
              {productsQuery.isLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : products.length === 0 ? (
                <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                  {translate(
                    "inv.categories.detail.noProducts",
                    { ns: "inv" },
                    "No products are assigned to this category yet."
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <Table style={{ tableLayout: "fixed", width: "100%" }}>
                    <TableHeader className="bg-muted/45">
                      <TableRow>
                        <TableHead className="w-[40%] min-w-44">
                          {translate(
                            "inv.products.fields.name",
                            { ns: "inv" },
                            "Product"
                          )}
                        </TableHead>
                        <TableHead className="w-32">
                          {translate(
                            "inv.products.fields.health",
                            { ns: "inv" },
                            "Stock status"
                          )}
                        </TableHead>
                        <TableHead className="w-24">
                          {translate(
                            "inv.products.fields.currentStock",
                            { ns: "inv" },
                            "On hand"
                          )}
                        </TableHead>
                        <TableHead className="w-32">
                          {translate(
                            "inv.products.fields.stockValue",
                            { ns: "inv" },
                            "Value"
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer"
                          onClick={() =>
                            navigate(`/goods/products/show/${product.id}`)
                          }
                        >
                          <TableCell className="whitespace-normal">
                            <span className="block truncate font-medium">
                              {product.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {product.sku}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StockHealthBadge
                              health={stockHealth(product)}
                              locale={locale}
                            />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatNumber(product.currentStock)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatCurrency(inventoryValue(product), locale)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DetailSection>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
