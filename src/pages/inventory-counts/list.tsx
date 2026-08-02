import { useGetLocale, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilterCombobox,
  DataTableFilterDropdownDateSinglePicker,
  DataTableFilterDropdownText,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatDate, formatNumber } from "@/lib/inventory/format";
import { COUNT_SCOPES, COUNT_STATUS } from "@/lib/inventory/constants";
import type { InventoryCountRecord } from "@/lib/inventory/types";

function ColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<InventoryCountRecord, TValue>;
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

export const InventoryCountList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();

  const statusOptions = useMemo(
    () =>
      COUNT_STATUS.map((option) => ({
        value: option.value,
        label: locale === "en-US" ? option.labelEn : option.labelZh,
      })),
    [locale]
  );
  const scopeOptions = useMemo(
    () =>
      COUNT_SCOPES.map((option) => ({
        value: option.value,
        label: locale === "en-US" ? option.labelEn : option.labelZh,
      })),
    [locale]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<InventoryCountRecord>();
    return [
      columnHelper.accessor("countNo", {
        id: "countNo",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.countNo",
              { ns: "inv" },
              "Count No."
            )}
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
            onClick={() => navigate(`/counting/counts/show/${row.original.id}`)}
          >
            {getValue() || `#${row.original.id}`}
          </button>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.counts.fields.status", { ns: "inv" }, "Status")}
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
        cell: ({ getValue }) => (
          <OptionBadge options={COUNT_STATUS} value={getValue()} locale={locale} />
        ),
      }),
      columnHelper.accessor("scope", {
        id: "scope",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.counts.fields.scope", { ns: "inv" }, "Scope")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={scopeOptions}
              defaultOperator="eq"
              operators={["eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: false,
        cell: ({ getValue }) => (
          <OptionBadge options={COUNT_SCOPES} value={getValue()} locale={locale} />
        ),
      }),
      columnHelper.accessor("countDate", {
        id: "countDate",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.countDate",
              { ns: "inv" },
              "Count date"
            )}
          >
            <DataTableFilterDropdownDateSinglePicker
              column={column}
              defaultOperator="eq"
            />
          </ColumnHeader>
        ),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue(), locale),
      }),
      columnHelper.accessor("countBy", {
        id: "countBy",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.counts.fields.countBy", { ns: "inv" }, "Counted by")}
            sortable={false}
          />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("totalItems", {
        id: "totalItems",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.totalItems",
              { ns: "inv" },
              "Items"
            )}
          />
        ),
        enableSorting: true,
        cell: ({ getValue }) => formatNumber(getValue()),
      }),
      columnHelper.accessor("diffCount", {
        id: "diffCount",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.diffCount",
              { ns: "inv" },
              "Diff items"
            )}
          />
        ),
        enableSorting: true,
        cell: ({ getValue }) => {
          const value = Number(getValue() ?? 0);
          return value > 0 ? (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatNumber(value)}
            </span>
          ) : (
            formatNumber(value)
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <ShowButton
              resource="scm_inventory_counts"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("buttons.show", "View")}
              title={translate("buttons.show", "View")}
            >
              <Eye />
            </ShowButton>
          </div>
        ),
        enableSorting: false,
        size: 64,
      }),
    ];
  }, [locale, navigate, scopeOptions, statusOptions, translate]);

  const table = useTable<InventoryCountRecord>({
    columns,
    refineCoreProps: {
      resource: "scm_inventory_counts",
      syncWithLocation: false,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView resource="scm_inventory_counts">
      <DataTable table={table} />
    </ListView>
  );
};
