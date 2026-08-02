import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { InventoryCountCreate } from "./create";
import { InventoryCountList } from "./list";
import { InventoryCountShow } from "./show";

export function InventoryCountListRoute() {
  return (
    <CanAccess resource="inventory_counts" action="list" fallback={<AccessDenied />}>
      <InventoryCountList />
    </CanAccess>
  );
}

export function InventoryCountCreateRoute() {
  return (
    <CanAccess resource="inventory_counts" action="create" fallback={<AccessDenied />}>
      <InventoryCountCreate />
    </CanAccess>
  );
}

export function InventoryCountShowRoute() {
  return (
    <CanAccess resource="inventory_counts" action="view" fallback={<AccessDenied />}>
      <InventoryCountShow />
    </CanAccess>
  );
}
