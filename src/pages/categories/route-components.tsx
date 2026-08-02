import { AccessDenied } from "@/components/access-control/access-denied";
import { CanAccess } from "@/components/access-control/can-access";
import { CategoryCreate } from "./create";
import { CategoryEdit } from "./edit";
import { CategoryList } from "./list";
import { CategoryShow } from "./show";

export function CategoryListRoute() {
  return (
    <CanAccess resource="product_categories" action="list" fallback={<AccessDenied />}>
      <CategoryList />
    </CanAccess>
  );
}

export function CategoryCreateRoute() {
  return (
    <CanAccess resource="product_categories" action="create" fallback={<AccessDenied />}>
      <CategoryCreate />
    </CanAccess>
  );
}

export function CategoryEditRoute() {
  return (
    <CanAccess resource="product_categories" action="update" fallback={<AccessDenied />}>
      <CategoryEdit />
    </CanAccess>
  );
}

export function CategoryShowRoute() {
  return (
    <CanAccess resource="product_categories" action="view" fallback={<AccessDenied />}>
      <CategoryShow />
    </CanAccess>
  );
}

export function CategoryShowEditRoute() {
  return (
    <CanAccess resource="product_categories" action="update" fallback={<AccessDenied />}>
      <CategoryEdit returnTo="show" />
    </CanAccess>
  );
}
