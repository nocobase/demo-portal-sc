import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { StockMovementCreate } from "./create";
import { StockMovementList } from "./list";
import { StockMovementProductEdit, StockMovementProductShow } from "./product-from-show";
import { StockMovementShow } from "./show";

export function StockMovementListRoute() {
  return (
    <CanAccess resource="scm_stock_movements" action="list" fallback={<AccessDenied />}>
      <StockMovementList />
    </CanAccess>
  );
}

export function StockMovementCreateRoute() {
  return (
    <CanAccess resource="scm_stock_movements" action="create" fallback={<AccessDenied />}>
      <StockMovementCreate />
    </CanAccess>
  );
}

export function StockMovementShowRoute() {
  return (
    <CanAccess resource="scm_stock_movements" action="view" fallback={<AccessDenied />}>
      <StockMovementShow />
    </CanAccess>
  );
}

export function StockMovementProductShowRoute() {
  return (
    <CanAccess resource="scm_products" action="view" fallback={<AccessDenied />}>
      <StockMovementProductShow />
    </CanAccess>
  );
}

export function StockMovementProductEditRoute() {
  return (
    <CanAccess resource="scm_products" action="update" fallback={<AccessDenied />}>
      <StockMovementProductEdit />
    </CanAccess>
  );
}
