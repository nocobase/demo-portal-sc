import { useList, useTranslate } from "@refinedev/core";
import { Eye } from "lucide-react";
import { useMemo } from "react";
import { Outlet, useNavigate } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/inventory/format";
import type { ProductRecord } from "@/lib/inventory/types";

export const StockAlertsPage = () => {
  const translate = useTranslate();
  const navigate = useNavigate();

  const { result: productsResult, query: productsQuery } = useList<ProductRecord>({
    resource: "scm_products",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
    meta: { appends: ["category"] },
  });
  const products = productsResult?.data ?? [];

  const lowStockProducts = useMemo(
    () =>
      products
        .filter(
          (product: ProductRecord) =>
            product.status !== "stopped" &&
            Number(product.currentStock ?? 0) <= Number(product.safetyStock ?? 0)
        )
        .sort(
          (a: ProductRecord, b: ProductRecord) =>
            Number(a.currentStock ?? 0) - Number(b.currentStock ?? 0)
        ),
    [products]
  );

  return (
    <ListView resource="stock_alerts">
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {translate(
          "inv.stockAlerts.description",
          { ns: "inv" },
          "The following products are at or below their safety stock and should be reordered soon."
        )}
      </div>

      {productsQuery.isLoading ? (
        <LoadingState className="min-h-64" />
      ) : productsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {translate(
              "inv.stockAlerts.loadError",
              { ns: "inv" },
              "Unable to load alert data"
            )}
          </AlertTitle>
          <AlertDescription>
            {translate(
              "inv.stockAlerts.loadError.description",
              { ns: "inv" },
              "Check that you have permission to view products."
            )}
          </AlertDescription>
        </Alert>
      ) : lowStockProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          {translate(
            "inv.stockAlerts.empty",
            { ns: "inv" },
            "Great — no low-stock products right now."
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table style={{ tableLayout: "fixed", width: "100%" }}>
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead>
                  {translate("inv.products.fields.name", { ns: "inv" }, "Product name")}
                </TableHead>
                <TableHead className="w-28">
                  {translate("inv.products.fields.sku", { ns: "inv" }, "Code")}
                </TableHead>
                <TableHead className="w-32">
                  {translate(
                    "inv.products.fields.currentStock",
                    { ns: "inv" },
                    "Current stock"
                  )}
                </TableHead>
                <TableHead className="w-32">
                  {translate(
                    "inv.products.fields.safetyStock",
                    { ns: "inv" },
                    "Safety stock"
                  )}
                </TableHead>
                <TableHead className="w-40">
                  {translate("inv.products.fields.category", { ns: "inv" }, "Category")}
                </TableHead>
                <TableHead className="w-20">
                  {translate("inv.common.actions", { ns: "inv" }, "Actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="cursor-pointer text-left font-medium text-foreground hover:underline"
                      onClick={() => navigate(`products/${product.id}`)}
                    >
                      {product.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{product.sku}</code>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatNumber(product.currentStock)}
                    </span>
                  </TableCell>
                  <TableCell>{formatNumber(product.safetyStock)}</TableCell>
                  <TableCell>{product.category?.name ?? "-"}</TableCell>
                  <TableCell>
                    <ShowButton
                      resource="scm_products"
                      recordItemId={product.id}
                      variant="ghost"
                      size="icon"
                      aria-label={translate("buttons.show", "View")}
                      title={translate("buttons.show", "View")}
                    >
                      <Eye />
                    </ShowButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {lowStockProducts.length > 0 ? (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/goods/products/create")}
          >
            {translate(
              "inv.stockAlerts.createProduct",
              { ns: "inv" },
              "Create product"
            )}
          </Button>
        </div>
      ) : null}
      <Outlet />
    </ListView>
  );
};
