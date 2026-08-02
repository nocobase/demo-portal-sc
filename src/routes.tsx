import {
  ClipboardCheck,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackageSearch,
  Tags,
  Truck,
} from "lucide-react";

import { defineAppRoutes } from "@nocobase/portal-sdk/routing";
import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { DashboardPage } from "@/pages/dashboard";
import { StockAlertsPage } from "@/pages/stock-alerts";
import { CategoryCreate } from "@/pages/categories/create";
import { CategoryEdit } from "@/pages/categories/edit";
import { CategoryList } from "@/pages/categories/list";
import { CategoryShow } from "@/pages/categories/show";
import { InventoryCountCreate } from "@/pages/inventory-counts/create";
import { InventoryCountList } from "@/pages/inventory-counts/list";
import { InventoryCountShow } from "@/pages/inventory-counts/show";
import { ProductCreate } from "@/pages/products/create";
import { ProductEdit } from "@/pages/products/edit";
import { ProductList } from "@/pages/products/list";
import { ProductShow } from "@/pages/products/show";
import { StockMovementCreate } from "@/pages/stock-movements/create";
import { StockMovementList } from "@/pages/stock-movements/list";
import { StockMovementShow } from "@/pages/stock-movements/show";
import {
  StockMovementProductEdit,
  StockMovementProductShow,
} from "@/pages/stock-movements/product-from-show";
import { SupplierCreate } from "@/pages/suppliers/create";
import { SupplierEdit } from "@/pages/suppliers/edit";
import { SupplierList } from "@/pages/suppliers/list";
import { SupplierShow } from "@/pages/suppliers/show";

// The starter no longer needs the example routes contributed by installed
// Registry extensions. Providers, adapters, and the /dev showcase remain.
export const registryRoutesEnabled = false;

const routeGuarded = (resource: string, action: string, node: React.ReactNode) => (
  <CanAccess resource={resource} action={action} fallback={<AccessDenied />}>
    {node}
  </CanAccess>
);

export const appRoutes = defineAppRoutes([
  {
    name: "dashboard",
    path: "/dashboard",
    element: <DashboardPage />,
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
      {
        name: "scm_products",
        path: "products",
        element: routeGuarded("scm_products", "list", <ProductList />),
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
            element: routeGuarded("scm_products", "create", <ProductCreate />),
          },
          {
            name: "products.edit",
            path: "edit/:id",
            resourceAction: "edit",
            element: routeGuarded("scm_products", "update", <ProductEdit />),
          },
          {
            name: "products.show",
            path: "show/:id",
            resourceAction: "show",
            element: routeGuarded("scm_products", "view", <ProductShow />),
            children: [
              {
                name: "products.show.edit",
                path: "edit",
                element: routeGuarded(
                  "products",
                  "update",
                  <ProductEdit returnTo="show" />
                ),
              },
            ],
          },
        ],
      },
      {
        name: "scm_product_categories",
        path: "categories",
        element: routeGuarded(
          "product_categories",
          "list",
          <CategoryList />
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
            element: routeGuarded(
              "product_categories",
              "create",
              <CategoryCreate />
            ),
          },
          {
            name: "product_categories.edit",
            path: "edit/:id",
            resourceAction: "edit",
            element: routeGuarded(
              "product_categories",
              "update",
              <CategoryEdit />
            ),
          },
          {
            name: "product_categories.show",
            path: "show/:id",
            resourceAction: "show",
            element: routeGuarded(
              "product_categories",
              "view",
              <CategoryShow />
            ),
            children: [
              {
                name: "product_categories.show.edit",
                path: "edit",
                element: routeGuarded(
                  "product_categories",
                  "update",
                  <CategoryEdit returnTo="show" />
                ),
              },
            ],
          },
        ],
      },
      {
        name: "scm_suppliers",
        path: "suppliers",
        element: routeGuarded("scm_suppliers", "list", <SupplierList />),
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
            element: routeGuarded("scm_suppliers", "create", <SupplierCreate />),
          },
          {
            name: "suppliers.edit",
            path: "edit/:id",
            resourceAction: "edit",
            element: routeGuarded("scm_suppliers", "update", <SupplierEdit />),
          },
          {
            name: "suppliers.show",
            path: "show/:id",
            resourceAction: "show",
            element: routeGuarded("scm_suppliers", "view", <SupplierShow />),
            children: [
              {
                name: "suppliers.show.edit",
                path: "edit",
                element: routeGuarded(
                  "suppliers",
                  "update",
                  <SupplierEdit returnTo="show" />
                ),
              },
            ],
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
        name: "scm_stock_movements",
        path: "movements",
        element: routeGuarded(
          "stock_movements",
          "list",
          <StockMovementList />
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
            element: routeGuarded(
              "stock_movements",
              "create",
              <StockMovementCreate />
            ),
          },
          {
            name: "stock_movements.show",
            path: "show/:id",
            resourceAction: "show",
            element: routeGuarded(
              "stock_movements",
              "view",
              <StockMovementShow />
            ),
            children: [
              {
                name: "stock_movements.show.product",
                path: "products/:productId",
                element: routeGuarded(
                  "products",
                  "view",
                  <StockMovementProductShow />
                ),
                children: [
                  {
                    name: "stock_movements.show.product.edit",
                    path: "edit",
                    element: routeGuarded(
                      "products",
                      "update",
                      <StockMovementProductEdit />
                    ),
                  },
                ],
              },
            ],
          },
          {
            name: "stock_movements.product",
            path: "products/:id",
            element: routeGuarded(
              "products",
              "view",
              <ProductShow closeTo="/stock/movements" />
            ),
            children: [
              {
                name: "stock_movements.product.edit",
                path: "edit",
                element: routeGuarded(
                  "products",
                  "update",
                  <ProductEdit
                    returnTo="show"
                    showCloseToBase="/stock/movements/products"
                  />
                ),
              },
            ],
          },
        ],
      },
      {
        name: "stock_alerts",
        path: "alerts",
        element: <StockAlertsPage />,
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
            element: routeGuarded(
              "products",
              "view",
              <ProductShow closeTo="/stock/alerts" />
            ),
            children: [
              {
                name: "stock_alerts.product.edit",
                path: "edit",
                element: routeGuarded(
                  "products",
                  "update",
                  <ProductEdit
                    returnTo="show"
                    showCloseToBase="/stock/alerts/products"
                  />
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
        name: "scm_inventory_counts",
        path: "counts",
        element: routeGuarded(
          "inventory_counts",
          "list",
          <InventoryCountList />
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
            element: routeGuarded(
              "inventory_counts",
              "create",
              <InventoryCountCreate />
            ),
          },
          {
            name: "inventory_counts.show",
            path: "show/:id",
            resourceAction: "show",
            element: routeGuarded(
              "inventory_counts",
              "view",
              <InventoryCountShow />
            ),
          },
        ],
      },
    ],
  },
]);
