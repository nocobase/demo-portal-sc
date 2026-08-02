// Prompt that lets a visitor rebuild this app from scratch with their own
// coding agent. Derived from the live data model, pages and workflows of
// this portal, so it describes what the app actually is.
// English only - it is meant to be pasted into a coding agent.

export function buildReplicatePrompt() {
  return `Build a "Stock Control" app on NocoBase with your coding agent.

What it is: warehouse stock control: products and categories, suppliers, stock movements in and out, and physical inventory counts reconciled line by line.

Data model (collection - purpose; key fields):
  scm_inventory_count_items - one counted line inside a stocktake
      fields: status (pending|counted|resolved), countedStock, count_id, remark, product_id, diffStock, systemStock
      relations: count -> scm_inventory_counts, product -> scm_products
  scm_inventory_counts - inventory counts
      fields: status (draft|in_progress|completed|cancelled), scope (all|category|product), countBy, countNo, status_sort, diffCount, totalItems, remark, countDate
      relations: items -> scm_inventory_count_items
  scm_product_categories - product categories
      fields: description, parentId, code, name
      relations: children -> scm_product_categories, parent -> scm_product_categories
  scm_products - products
      fields: unit (piece|box|case|kg|meter), status (on_sale|stopped|new), category_id, remark, safetyStock, purchasePrice, barcode, supplier_id, salePrice
      relations: category -> scm_product_categories, supplier -> scm_suppliers
  scm_stock_movements - stock movements
      fields: type (purchase_in|sale_out|return_in|adjustment|loss), remark, afterStock, product_id, referenceNo, occurredAt, quantity, beforeStock, handler
      relations: product -> scm_products
  scm_suppliers - suppliers
      fields: phone, code, remark, address, name, contact

Pages:
  /counting, /dashboard, /goods, /stock
  Each resource page is a list with search/filter plus create, edit and detail dialogs.

Seed data: about 153 rows in total, e.g. scm_inventory_count_items ~84, scm_stock_movements ~25, scm_products ~18.
Keep every seeded value in English.

Build in this order: data model -> pages -> workflows -> roles/permissions -> seed data.
After each page, open it and confirm it renders and its create/edit dialogs work before moving on.`;
}
