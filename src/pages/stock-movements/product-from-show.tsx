import { useParams } from "react-router";

import { ProductEdit } from "@/pages/products/edit";
import { ProductShow } from "@/pages/products/show";

export function StockMovementProductShow() {
  const { id, productId } = useParams<{ id: string; productId: string }>();

  if (!productId) return null;

  const closeTo = id
    ? `/stock/movements/show/${encodeURIComponent(id)}`
    : "/stock/movements";

  return <ProductShow id={productId} closeTo={closeTo} />;
}

export function StockMovementProductEdit() {
  const { id, productId } = useParams<{ id: string; productId: string }>();

  if (!productId) return null;

  return (
    <ProductEdit
      id={productId}
      returnTo="show"
      showCloseToBase={
        id
          ? `/stock/movements/show/${encodeURIComponent(id)}/products`
          : undefined
      }
    />
  );
}
