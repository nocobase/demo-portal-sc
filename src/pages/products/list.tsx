import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilterCombobox,
  DataTableFilterDropdownNumeric,
  DataTableFilterDropdownText,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatCurrency, formatNumber } from "@/lib/inventory/format";
import {
  optionLabel,
  optionText,
  PRODUCT_STATUS,
  PRODUCT_UNITS,
} from "@/lib/inventory/constants";
import type { ProductRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";

function ColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<ProductRecord, TValue>;
  label: string;
  sortable?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      {sortable ? <DataTableSorter column={column} /> : null}
      {children}
    </div>
  );
}

export const ProductList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();

  const { result: categoriesResult } = useList<any>({
    resource: "scm_product_categories",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const categoryOptions = useMemo(
    () =>
      (categoriesResult?.data ?? [])
        .map((item: any) => ({
          value: String(item.id),
          label: item.name ?? String(item.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [categoriesResult?.data, locale]
  );

  const statusOptions = useMemo(
    () =>
      PRODUCT_STATUS.map((option) => ({
        value: option.value,
        label: optionText(option),
      })),
    [locale]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<ProductRecord>();

    return [
      columnHelper.accessor("name", {
        id: "name",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.name",
              { ns: "inv" },
              "Product name"
            )}
          >
            <DataTableFilterDropdownText
              column={column}
              table={table}
              defaultOperator="contains"
              operators={["contains", "eq", "startswith"]}
            />
          </ColumnHeader>
        ),
        enableSorting: true,
        size: 320,
        cell: ({ row, getValue }) => (
          <button
            type="button"
            className="cursor-pointer text-left font-medium text-foreground hover:underline"
            onClick={() => navigate(`/goods/products/show/${row.original.id}`)}
          >
            {getValue() || "-"}
          </button>
        ),
      }),
      columnHelper.accessor("sku", {
        id: "sku",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.products.fields.sku", { ns: "inv" }, "Code")}
          >
            <DataTableFilterDropdownText
              column={column}
              table={table}
              defaultOperator="contains"
              operators={["contains", "eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: true,
        size: 120,
        cell: ({ getValue }) => (
          <code className="text-xs text-muted-foreground">{getValue() || "-"}</code>
        ),
      }),
      columnHelper.accessor("categoryId", {
        id: "category_id",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.category",
              { ns: "inv" },
              "Category"
            )}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={categoryOptions}
              defaultOperator="eq"
              operators={["eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: false,
        size: 160,
        cell: ({ row }) => row.original.category?.name ?? "-",
      }),
      columnHelper.accessor("unit", {
        id: "unit",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.products.fields.unit", { ns: "inv" }, "Unit")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={PRODUCT_UNITS.map((option) => ({
                value: option.value,
                label: optionText(option),
              }))}
              defaultOperator="eq"
              operators={["eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: false,
        size: 90,
        cell: ({ getValue }) => optionLabel(PRODUCT_UNITS, getValue()),
      }),
      columnHelper.accessor("currentStock", {
        id: "currentStock",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.currentStock",
              { ns: "inv" },
              "Stock"
            )}
          >
            <DataTableFilterDropdownNumeric
              column={column}
              table={table}
              operators={["eq", "gt", "lt", "gte", "lte"]}
            />
          </ColumnHeader>
        ),
        enableSorting: true,
        size: 110,
        cell: ({ getValue }) => formatNumber(getValue()),
      }),
      columnHelper.accessor("salePrice", {
        id: "salePrice",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.salePrice",
              { ns: "inv" },
              "Sale price"
            )}
          />
        ),
        enableSorting: true,
        size: 120,
        cell: ({ getValue }) => formatCurrency(getValue(), locale),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.products.fields.status", { ns: "inv" }, "Status")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={statusOptions}
              defaultOperator="eq"
              operators={["eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: false,
        size: 130,
        cell: ({ getValue }) => (
          <OptionBadge
            options={PRODUCT_STATUS}
            value={getValue()}
            locale={locale}
          />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <EditButton
              resource="scm_products"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("buttons.edit", "Edit")}
              title={translate("buttons.edit", "Edit")}
            >
              <Pencil />
            </EditButton>
            <ShowButton
              resource="scm_products"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("buttons.show", "View")}
              title={translate("buttons.show", "View")}
            >
              <Eye />
            </ShowButton>
            <DeleteButton
              resource="scm_products"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label={translate("buttons.delete", "Delete")}
              title={translate("buttons.delete", "Delete")}
            >
              <Trash2 />
            </DeleteButton>
          </div>
        ),
        enableSorting: false,
        size: 132,
      }),
    ];
  }, [categoryOptions, locale, navigate, statusOptions, translate]);

  const table = useTable<ProductRecord>({
    columns,
    refineCoreProps: {
      resource: "scm_products",
      syncWithLocation: false,
      meta: {
        appends: ["category", "supplier"],
      },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  const tableContext = useAIPageElementHandle({
    id: "products-table",
    title: translate("inv.products.ai.table", { ns: "inv" }, "Products table"),
    kind: "table",
    getContext: () => ({
      resource: "scm_products",
      page: table.refineCore.currentPage,
      pageSize: table.refineCore.pageSize,
      total: table.refineCore.tableQuery.data?.total ?? 0,
      rows: (table.refineCore.tableQuery.data?.data ?? []).map((record) => ({
        id: record.id,
        sku: record.sku,
        name: record.name,
        category: record.category?.name,
        unit: record.unit,
        currentStock: record.currentStock,
        safetyStock: record.safetyStock,
        salePrice: record.salePrice,
        status: record.status,
      })),
    }),
  });

  return (
    <ListView resource="scm_products">
      <div ref={tableContext.ref}>
        <DataTable table={table} />
      </div>
    </ListView>
  );
};
