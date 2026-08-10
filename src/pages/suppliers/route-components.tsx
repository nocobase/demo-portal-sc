import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { SupplierCreate } from "./create";
import { SupplierEdit } from "./edit";
import { SupplierList } from "./list";
import { SupplierShow } from "./show";

export function SupplierListRoute() {
  return (
    <CanAccess resource="scm_suppliers" action="list" fallback={<AccessDenied />}>
      <SupplierList />
    </CanAccess>
  );
}

export function SupplierCreateRoute() {
  return (
    <CanAccess resource="scm_suppliers" action="create" fallback={<AccessDenied />}>
      <SupplierCreate />
    </CanAccess>
  );
}

export function SupplierEditRoute() {
  return (
    <CanAccess resource="scm_suppliers" action="update" fallback={<AccessDenied />}>
      <SupplierEdit />
    </CanAccess>
  );
}

export function SupplierShowRoute() {
  return (
    <CanAccess resource="scm_suppliers" action="view" fallback={<AccessDenied />}>
      <SupplierShow />
    </CanAccess>
  );
}

export function SupplierShowEditRoute() {
  return (
    <CanAccess resource="scm_suppliers" action="update" fallback={<AccessDenied />}>
      <SupplierEdit returnTo="show" />
    </CanAccess>
  );
}
