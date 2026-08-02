export const getProductListPath = () => "/goods/products";
export const getProductShowPath = (id: string | number) =>
  `/goods/products/show/${encodeURIComponent(id)}`;
export const getProductEditPath = (id: string | number) =>
  `/goods/products/edit/${encodeURIComponent(id)}`;
