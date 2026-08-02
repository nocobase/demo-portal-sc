import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { ProductCreate } from "./create";
import { ProductEdit } from "./edit";
import { ProductList } from "./list";
import { ProductShow } from "./show";

export function ProductListRoute() {
  return (
    <CanAccess resource="scm_products" action="list" fallback={<AccessDenied />}>
      <ProductList />
    </CanAccess>
  );
}

export function ProductCreateRoute() {
  return (
    <CanAccess resource="scm_products" action="create" fallback={<AccessDenied />}>
      <ProductCreate />
    </CanAccess>
  );
}

export function ProductEditRoute() {
  return (
    <CanAccess resource="scm_products" action="update" fallback={<AccessDenied />}>
      <ProductEdit />
    </CanAccess>
  );
}

export function ProductShowRoute() {
  return (
    <CanAccess resource="scm_products" action="view" fallback={<AccessDenied />}>
      <ProductShow />
    </CanAccess>
  );
}

export function ProductShowEditRoute() {
  return (
    <CanAccess resource="products" action="update" fallback={<AccessDenied />}>
      <ProductEdit returnTo="show" />
    </CanAccess>
  );
}

export function StockMovementProductRoute() {
  return (
    <CanAccess resource="products" action="view" fallback={<AccessDenied />}>
      <ProductShow closeTo="/stock/movements" />
    </CanAccess>
  );
}

export function StockMovementProductEditRoute() {
  return (
    <CanAccess resource="products" action="update" fallback={<AccessDenied />}>
      <ProductEdit returnTo="show" showCloseToBase="/stock/movements/products" />
    </CanAccess>
  );
}

export function StockAlertProductRoute() {
  return (
    <CanAccess resource="products" action="view" fallback={<AccessDenied />}>
      <ProductShow closeTo="/stock/alerts" />
    </CanAccess>
  );
}

export function StockAlertProductEditRoute() {
  return (
    <CanAccess resource="products" action="update" fallback={<AccessDenied />}>
      <ProductEdit returnTo="show" showCloseToBase="/stock/alerts/products" />
    </CanAccess>
  );
}
