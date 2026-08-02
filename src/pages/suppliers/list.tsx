import { useGetLocale, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterDropdownText } from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import type { SupplierRecord } from "@/lib/inventory/types";

function ColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<SupplierRecord, TValue>;
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

export const SupplierList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<SupplierRecord>();
    return [
      columnHelper.accessor("name", {
        id: "name",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.suppliers.fields.name", { ns: "inv" }, "Supplier name")}
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
        cell: ({ row, getValue }) => (
          <button
            type="button"
            className="cursor-pointer text-left font-medium text-foreground hover:underline"
            onClick={() =>
              navigate(`/goods/suppliers/show/${row.original.id}`)
            }
          >
            {getValue() || "-"}
          </button>
        ),
      }),
      columnHelper.accessor("code", {
        id: "code",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.suppliers.fields.code", { ns: "inv" }, "Code")}
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
        cell: ({ getValue }) => (
          <code className="text-xs text-muted-foreground">{getValue() || "-"}</code>
        ),
      }),
      columnHelper.accessor("contact", {
        id: "contact",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.suppliers.fields.contact", { ns: "inv" }, "Contact")}
          />
        ),
        enableSorting: true,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("phone", {
        id: "phone",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.suppliers.fields.phone", { ns: "inv" }, "Phone")}
          />
        ),
        enableSorting: true,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("address", {
        id: "address",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.suppliers.fields.address", { ns: "inv" }, "Address")}
            sortable={false}
          />
        ),
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="line-clamp-1">{getValue() || "-"}</span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <EditButton
              resource="scm_suppliers"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("buttons.edit", "Edit")}
              title={translate("buttons.edit", "Edit")}
            >
              <Pencil />
            </EditButton>
            <ShowButton
              resource="scm_suppliers"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("buttons.show", "View")}
              title={translate("buttons.show", "View")}
            >
              <Eye />
            </ShowButton>
            <DeleteButton
              resource="scm_suppliers"
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
  }, [locale, navigate, translate]);

  const table = useTable<SupplierRecord>({
    columns,
    refineCoreProps: {
      resource: "scm_suppliers",
      syncWithLocation: false,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView resource="scm_suppliers">
      <DataTable table={table} />
    </ListView>
  );
};
