import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { PurchaseOrderList } from "./list";
import { PurchaseOrderShow } from "./show";

export function PurchaseOrderListRoute() {
  return (
    <CanAccess
      resource="scm_purchase_orders"
      action="list"
      fallback={<AccessDenied />}
    >
      <PurchaseOrderList />
    </CanAccess>
  );
}

export function PurchaseOrderShowRoute() {
  return (
    <CanAccess
      resource="scm_purchase_orders"
      action="view"
      fallback={<AccessDenied />}
    >
      <PurchaseOrderShow />
    </CanAccess>
  );
}
