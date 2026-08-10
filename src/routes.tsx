import {
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageSearch,
  Tags,
  Truck,
} from "lucide-react";
import type { ComponentType } from "react";
import { Navigate } from "react-router";

import { defineAppRoutes } from "@nocobase/portal-sdk/routing";

// The starter no longer needs the example routes contributed by installed
// Registry extensions. Providers, adapters, and the /dev showcase remain.
export const registryRoutesEnabled = false;

const routeComponent = <T extends ComponentType>(component: T) => ({
  default: component,
});

export const appRoutes = defineAppRoutes([
  {
    name: "dashboard",
    path: "/dashboard",
    lazy: () => import("@/pages/dashboard/route"),
    resource: {
      meta: {
        label: "Dashboard",
        i18nKey: "inv.nav.dashboard",
        i18nOptions: { ns: "inv" },
        icon: <LayoutDashboard />,
        priority: 1,
        canCreate: false,
        canDelete: false,
      },
    },
  },
  {
    name: "goods",
    path: "/goods",
    resource: {
      meta: {
        group: true,
        label: "Products",
        i18nKey: "inv.nav.goods",
        i18nOptions: { ns: "inv" },
        priority: 2,
      },
    },
    children: [
      // Group segments carry no page of their own. Without an index route they
      // render an empty shell when reached by URL or breadcrumb, so send them
      // to the group's first page instead.
      {
        name: "goods.index",
        index: true,
        element: <Navigate to="/goods/products" replace />,
      },
      {
        name: "scm_products",
        path: "products",
        lazy: () =>
          import("@/pages/products/route-components").then(
            ({ ProductListRoute }) => routeComponent(ProductListRoute)
          ),
        resource: {
          meta: {
            label: "Product",
            i18nKey: "inv.nav.products",
            i18nOptions: { ns: "inv" },
            singularLabel: "Product",
            i18nSingularKey: "inv.nav.product",
            descriptionI18nKey: "inv.nav.products.description",
            icon: <PackageSearch />,
            canCreate: true,
            canDelete: true,
            acl: { type: "collection" },
            priority: 10,
          },
        },
        children: [
          {
            name: "products.create",
            path: "create",
            resourceAction: "create",
            lazy: () =>
              import("@/pages/products/route-components").then(
                ({ ProductCreateRoute }) => routeComponent(ProductCreateRoute)
              ),
          },
          {
            name: "products.edit",
            path: "edit/:id",
            resourceAction: "edit",
            lazy: () =>
              import("@/pages/products/route-components").then(
                ({ ProductEditRoute }) => routeComponent(ProductEditRoute)
              ),
          },
          {
            name: "products.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/products/route-components").then(
                ({ ProductShowRoute }) => routeComponent(ProductShowRoute)
              ),
            children: [
              {
                name: "products.show.edit",
                path: "edit",
                lazy: () =>
                  import("@/pages/products/route-components").then(
                    ({ ProductShowEditRoute }) =>
                      routeComponent(ProductShowEditRoute)
                  ),
              },
            ],
          },
        ],
      },
      {
        name: "scm_product_categories",
        path: "categories",
        lazy: () =>
          import("@/pages/categories/route-components").then(
            ({ CategoryListRoute }) => routeComponent(CategoryListRoute)
          ),
        resource: {
          meta: {
            label: "Categories",
            i18nKey: "inv.nav.categories",
            i18nOptions: { ns: "inv" },
            singularLabel: "Category",
            i18nSingularKey: "inv.nav.category",
            descriptionI18nKey: "inv.nav.categories.description",
            icon: <Tags />,
            canCreate: true,
            canDelete: true,
            acl: { type: "collection" },
            priority: 11,
          },
        },
        children: [
          {
            name: "product_categories.create",
            path: "create",
            resourceAction: "create",
            lazy: () =>
              import("@/pages/categories/route-components").then(
                ({ CategoryCreateRoute }) => routeComponent(CategoryCreateRoute)
              ),
          },
          {
            name: "product_categories.edit",
            path: "edit/:id",
            resourceAction: "edit",
            lazy: () =>
              import("@/pages/categories/route-components").then(
                ({ CategoryEditRoute }) => routeComponent(CategoryEditRoute)
              ),
          },
          {
            name: "product_categories.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/categories/route-components").then(
                ({ CategoryShowRoute }) => routeComponent(CategoryShowRoute)
              ),
            children: [
              {
                name: "product_categories.show.edit",
                path: "edit",
                lazy: () =>
                  import("@/pages/categories/route-components").then(
                    ({ CategoryShowEditRoute }) =>
                      routeComponent(CategoryShowEditRoute)
                  ),
              },
            ],
          },
        ],
      },
      {
        name: "scm_suppliers",
        path: "suppliers",
        lazy: () =>
          import("@/pages/suppliers/route-components").then(
            ({ SupplierListRoute }) => routeComponent(SupplierListRoute)
          ),
        resource: {
          meta: {
            label: "Suppliers",
            i18nKey: "inv.nav.suppliers",
            i18nOptions: { ns: "inv" },
            singularLabel: "Supplier",
            i18nSingularKey: "inv.nav.supplier",
            descriptionI18nKey: "inv.nav.suppliers.description",
            icon: <Truck />,
            canCreate: true,
            canDelete: true,
            acl: { type: "collection" },
            priority: 12,
          },
        },
        children: [
          {
            name: "suppliers.create",
            path: "create",
            resourceAction: "create",
            lazy: () =>
              import("@/pages/suppliers/route-components").then(
                ({ SupplierCreateRoute }) => routeComponent(SupplierCreateRoute)
              ),
          },
          {
            name: "suppliers.edit",
            path: "edit/:id",
            resourceAction: "edit",
            lazy: () =>
              import("@/pages/suppliers/route-components").then(
                ({ SupplierEditRoute }) => routeComponent(SupplierEditRoute)
              ),
          },
          {
            name: "suppliers.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/suppliers/route-components").then(
                ({ SupplierShowRoute }) => routeComponent(SupplierShowRoute)
              ),
            children: [
              {
                name: "suppliers.show.edit",
                path: "edit",
                lazy: () =>
                  import("@/pages/suppliers/route-components").then(
                    ({ SupplierShowEditRoute }) =>
                      routeComponent(SupplierShowEditRoute)
                  ),
              },
            ],
          },
        ],
      },
      {
        name: "scm_purchase_orders",
        path: "purchase-orders",
        lazy: () =>
          import("@/pages/purchase-orders/route-components").then(
            ({ PurchaseOrderListRoute }) =>
              routeComponent(PurchaseOrderListRoute)
          ),
        resource: {
          meta: {
            label: "Purchase Orders",
            i18nKey: "inv.nav.purchaseOrders",
            i18nOptions: { ns: "inv" },
            singularLabel: "Purchase Order",
            i18nSingularKey: "inv.nav.purchaseOrder",
            descriptionI18nKey: "inv.nav.purchaseOrders.description",
            icon: <ClipboardList />,
            canCreate: false,
            canDelete: false,
            acl: { type: "collection" },
            priority: 13,
          },
        },
        children: [
          {
            name: "purchase_orders.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/purchase-orders/route-components").then(
                ({ PurchaseOrderShowRoute }) =>
                  routeComponent(PurchaseOrderShowRoute)
              ),
          },
        ],
      },
    ],
  },
  {
    name: "stock",
    path: "/stock",
    resource: {
      meta: {
        group: true,
        label: "Stock",
        i18nKey: "inv.nav.stock",
        i18nOptions: { ns: "inv" },
        priority: 3,
      },
    },
    children: [
      {
        name: "stock.index",
        index: true,
        element: <Navigate to="/stock/movements" replace />,
      },
      {
        name: "scm_stock_movements",
        path: "movements",
        lazy: () =>
          import("@/pages/stock-movements/route-components").then(
            ({ StockMovementListRoute }) =>
              routeComponent(StockMovementListRoute)
          ),
        resource: {
          meta: {
            label: "Stock Movements",
            i18nKey: "inv.nav.movements",
            i18nOptions: { ns: "inv" },
            singularLabel: "Stock Movement",
            i18nSingularKey: "inv.nav.movement",
            descriptionI18nKey: "inv.nav.movements.description",
            icon: <PackageCheck />,
            canCreate: true,
            canDelete: false,
            acl: { type: "collection" },
            priority: 20,
          },
        },
        children: [
          {
            name: "stock_movements.create",
            path: "create",
            resourceAction: "create",
            lazy: () =>
              import("@/pages/stock-movements/route-components").then(
                ({ StockMovementCreateRoute }) =>
                  routeComponent(StockMovementCreateRoute)
              ),
          },
          {
            name: "stock_movements.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/stock-movements/route-components").then(
                ({ StockMovementShowRoute }) =>
                  routeComponent(StockMovementShowRoute)
              ),
            children: [
              {
                name: "stock_movements.show.product",
                path: "products/:productId",
                lazy: () =>
                  import("@/pages/stock-movements/route-components").then(
                    ({ StockMovementProductShowRoute }) =>
                      routeComponent(StockMovementProductShowRoute)
                  ),
                children: [
                  {
                    name: "stock_movements.show.product.edit",
                    path: "edit",
                    lazy: () =>
                      import("@/pages/stock-movements/route-components").then(
                        ({ StockMovementProductEditRoute }) =>
                          routeComponent(StockMovementProductEditRoute)
                      ),
                  },
                ],
              },
            ],
          },
          {
            name: "stock_movements.product",
            path: "products/:id",
            lazy: () =>
              import("@/pages/products/route-components").then(
                ({ StockMovementProductRoute }) =>
                  routeComponent(StockMovementProductRoute)
              ),
            children: [
              {
                name: "stock_movements.product.edit",
                path: "edit",
                lazy: () =>
                  import("@/pages/products/route-components").then(
                    ({ StockMovementProductEditRoute }) =>
                      routeComponent(StockMovementProductEditRoute)
                  ),
              },
            ],
          },
        ],
      },
      {
        name: "stock_alerts",
        path: "alerts",
        lazy: () => import("@/pages/stock-alerts/route"),
        resource: {
          meta: {
            label: "Low Stock Alerts",
            i18nKey: "inv.nav.stockAlerts",
            i18nOptions: { ns: "inv" },
            descriptionI18nKey: "inv.nav.stockAlerts.description",
            icon: <Package />,
            canCreate: false,
            canDelete: false,
            acl: { type: "collection", resource: "scm_products" },
            priority: 21,
          },
        },
        children: [
          {
            name: "stock_alerts.product",
            path: "products/:id",
            lazy: () =>
              import("@/pages/products/route-components").then(
                ({ StockAlertProductRoute }) =>
                  routeComponent(StockAlertProductRoute)
              ),
            children: [
              {
                name: "stock_alerts.product.edit",
                path: "edit",
                lazy: () =>
                  import("@/pages/products/route-components").then(
                    ({ StockAlertProductEditRoute }) =>
                      routeComponent(StockAlertProductEditRoute)
                  ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "counting",
    path: "/counting",
    resource: {
      meta: {
        group: true,
        label: "Counting",
        i18nKey: "inv.nav.counting",
        i18nOptions: { ns: "inv" },
        priority: 4,
      },
    },
    children: [
      {
        name: "counting.index",
        index: true,
        element: <Navigate to="/counting/counts" replace />,
      },
      {
        name: "scm_inventory_counts",
        path: "counts",
        lazy: () =>
          import("@/pages/inventory-counts/route-components").then(
            ({ InventoryCountListRoute }) =>
              routeComponent(InventoryCountListRoute)
          ),
        resource: {
          meta: {
            label: "Inventory Counts",
            i18nKey: "inv.nav.inventoryCounts",
            i18nOptions: { ns: "inv" },
            singularLabel: "Inventory Count",
            i18nSingularKey: "inv.nav.inventoryCount",
            descriptionI18nKey: "inv.nav.inventoryCounts.description",
            icon: <ClipboardCheck />,
            canCreate: true,
            canDelete: false,
            acl: { type: "collection" },
            priority: 30,
          },
        },
        children: [
          {
            name: "inventory_counts.create",
            path: "create",
            resourceAction: "create",
            lazy: () =>
              import("@/pages/inventory-counts/route-components").then(
                ({ InventoryCountCreateRoute }) =>
                  routeComponent(InventoryCountCreateRoute)
              ),
          },
          {
            name: "inventory_counts.show",
            path: "show/:id",
            resourceAction: "show",
            lazy: () =>
              import("@/pages/inventory-counts/route-components").then(
                ({ InventoryCountShowRoute }) =>
                  routeComponent(InventoryCountShowRoute)
              ),
          },
        ],
      },
    ],
  },
]);
