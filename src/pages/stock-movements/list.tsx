import { useGetLocale, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilterCombobox,
  DataTableFilterDropdownDateRangePicker,
  DataTableFilterDropdownNumeric,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatDateTime, formatNumber } from "@/lib/inventory/format";
import { MOVEMENT_TYPES, optionText} from "@/lib/inventory/constants";
import type { StockMovementRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";

function ColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<StockMovementRecord, TValue>;
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

export const StockMovementList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();

  const movementTypeOptions = useMemo(
    () =>
      MOVEMENT_TYPES.map((option) => ({
        value: option.value,
        label: optionText(option),
      })),
    [locale]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<StockMovementRecord>();
    return [
      columnHelper.accessor("occurredAt", {
        id: "occurredAt",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.occurredAt",
              { ns: "inv" },
              "Occurred at"
            )}
          >
            <DataTableFilterDropdownDateRangePicker
              column={column}
              defaultOperator="between"
            />
          </ColumnHeader>
        ),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDateTime(getValue(), locale)}
          </span>
        ),
      }),
      columnHelper.accessor("productId", {
        id: "product_id",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.product",
              { ns: "inv" },
              "Product"
            )}
            sortable={false}
          />
        ),
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original.product;
          if (!product) return "-";
          return (
            <button
              type="button"
              className="cursor-pointer text-left font-medium text-foreground hover:underline"
              onClick={() => navigate(`products/${product.id}`)}
            >
              {product.name}
            </button>
          );
        },
      }),
      columnHelper.accessor("type", {
        id: "type",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.type",
              { ns: "inv" },
              "Movement type"
            )}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={movementTypeOptions}
              defaultOperator="eq"
              operators={["eq"]}
            />
          </ColumnHeader>
        ),
        enableSorting: false,
        cell: ({ getValue }) => (
          <OptionBadge
            options={MOVEMENT_TYPES}
            value={getValue()}
            locale={locale}
          />
        ),
      }),
      columnHelper.accessor("quantity", {
        id: "quantity",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.quantity",
              { ns: "inv" },
              "Quantity"
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
        cell: ({ row, getValue }) => {
          const quantity = Number(getValue() ?? 0);
          const type = row.original.type ?? "";
          const isIn = ["purchase_in", "return_in", "initial"].includes(type);
          return (
            <span
              className={
                isIn ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-foreground"
              }
            >
              {isIn ? "+" : "-"}
              {formatNumber(Math.abs(quantity))}
            </span>
          );
        },
      }),
      columnHelper.accessor("afterStock", {
        id: "afterStock",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.afterStock",
              { ns: "inv" },
              "Stock after"
            )}
          />
        ),
        enableSorting: true,
        cell: ({ getValue }) => formatNumber(getValue()),
      }),
      columnHelper.accessor("referenceNo", {
        id: "referenceNo",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.referenceNo",
              { ns: "inv" },
              "Reference No."
            )}
            sortable={false}
          />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("handler", {
        id: "handler",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.handler",
              { ns: "inv" },
              "Handler"
            )}
            sortable={false}
          />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <ShowButton
              resource="scm_stock_movements"
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
  }, [locale, movementTypeOptions, translate]);

  const table = useTable<StockMovementRecord>({
    columns,
    refineCoreProps: {
      resource: "scm_stock_movements",
      syncWithLocation: false,
      meta: {
        appends: ["product"],
      },
      sorters: {
        initial: [{ field: "occurredAt", order: "desc" }],
      },
    },
  });

  const tableContext = useAIPageElementHandle({
    id: "stock-movements-table",
    title: translate(
      "inv.movements.ai.table",
      { ns: "inv" },
      "Stock movements"
    ),
    kind: "table",
    getContext: () => ({
      resource: "scm_stock_movements",
      total: table.refineCore.tableQuery.data?.total ?? 0,
      rows: (table.refineCore.tableQuery.data?.data ?? []).map((record) => ({
        id: record.id,
        product: record.product?.name,
        type: record.type,
        quantity: record.quantity,
        beforeStock: record.beforeStock,
        afterStock: record.afterStock,
        referenceNo: record.referenceNo,
        handler: record.handler,
        occurredAt: record.occurredAt,
      })),
    }),
  });

  return (
    <ListView resource="scm_stock_movements">
      <div ref={tableContext.ref}>
        <DataTable table={table} />
      </div>
    </ListView>
  );
};
