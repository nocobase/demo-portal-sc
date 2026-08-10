import {
  useGetLocale,
  useList,
  useNotification,
  useTranslate,
  type CrudFilter,
} from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Eye,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import {
  DataTableFilterCombobox,
  DataTableFilterDropdownText,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import {
  ColumnSettingsMenu,
  ExportCsvButton,
  ListToolbar,
  SavedViewTabs,
  TableSearchInput,
} from "@/components/inventory/list-toolbar";
import { OptionBadge } from "@/components/inventory/option-badge";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import {
  optionText,
  type OptionItem,
} from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatDate, formatNumber } from "@/lib/inventory/format";
import { usePermanentFilterSync } from "@/lib/inventory/use-permanent-filter-sync";
import {
  useActiveView,
  useSearchTerm,
  useTablePreferences,
  type SavedView,
} from "@/lib/inventory/view-state";

type PurchaseOrderRecord = {
  id: number;
  orderNo?: string | null;
  supplier_id?: number | null;
  supplier?: { id: number; name?: string | null } | null;
  orderDate?: string | null;
  promisedDate?: string | null;
  actualArrivalDate?: string | null;
  status?: string | null;
  totalAmount?: number | string | null;
  remark?: string | null;
};

export const PURCHASE_ORDER_STATUS: OptionItem[] = [
  {
    value: "draft",
    i18nKey: "inv.option.purchaseOrderStatus.draft",
    labelZh: "草稿",
    labelEn: "Draft",
    color: "default",
  },
  {
    value: "placed",
    i18nKey: "inv.option.purchaseOrderStatus.placed",
    labelZh: "已下单",
    labelEn: "Placed",
    color: "blue",
  },
  {
    value: "partially_received",
    i18nKey: "inv.option.purchaseOrderStatus.partially_received",
    labelZh: "部分收货",
    labelEn: "Partially received",
    color: "gold",
  },
  {
    value: "received",
    i18nKey: "inv.option.purchaseOrderStatus.received",
    labelZh: "已收货",
    labelEn: "Received",
    color: "green",
  },
  {
    value: "cancelled",
    i18nKey: "inv.option.purchaseOrderStatus.cancelled",
    labelZh: "已取消",
    labelEn: "Cancelled",
    color: "red",
  },
];

const PURCHASE_ORDER_VIEWS: SavedView[] = [
  {
    id: "all",
    labelKey: "inv.purchaseOrders.view.all",
    labelFallback: "All orders",
    filters: [],
  },
  {
    id: "open",
    labelKey: "inv.purchaseOrders.view.open",
    labelFallback: "Open",
    filters: [
      {
        field: "status",
        operator: "in",
        value: ["placed", "partially_received"],
      },
    ],
  },
  {
    id: "overdue",
    labelKey: "inv.purchaseOrders.view.overdue",
    labelFallback: "Overdue",
    filters: [],
    clientResolved: true,
  },
  {
    id: "received",
    labelKey: "inv.purchaseOrders.view.received",
    labelFallback: "Received",
    filters: [{ field: "status", operator: "eq", value: "received" }],
  },
  {
    id: "draft",
    labelKey: "inv.purchaseOrders.view.draft",
    labelFallback: "Draft",
    filters: [{ field: "status", operator: "eq", value: "draft" }],
  },
  {
    id: "cancelled",
    labelKey: "inv.purchaseOrders.view.cancelled",
    labelFallback: "Cancelled",
    filters: [{ field: "status", operator: "eq", value: "cancelled" }],
  },
];

const DAY_MS = 86_400_000;
const DEFAULT_HIDDEN_COLUMNS: string[] = [];

function dateBoundary(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isOpenOrder(order: PurchaseOrderRecord): boolean {
  return (
    (order.status === "placed" || order.status === "partially_received") &&
    !order.actualArrivalDate
  );
}

function overdueDays(order: PurchaseOrderRecord, today: number): number {
  if (!isOpenOrder(order)) return 0;
  const promisedAt = dateBoundary(order.promisedDate);
  if (promisedAt === null || promisedAt >= today) return 0;
  return Math.floor((today - promisedAt) / DAY_MS);
}

function ColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<PurchaseOrderRecord, TValue>;
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

export const PurchaseOrderList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const notification = useNotification();
  const [activeView, setActiveView] = useActiveView("all");
  const [search, setSearch] = useSearchTerm();
  const { preferences, columnVisibility, toggleColumn, setDensity, resetColumns } =
    useTablePreferences("purchase-orders", DEFAULT_HIDDEN_COLUMNS);

  const { result: allOrdersResult, query: allOrdersQuery } =
    useList<PurchaseOrderRecord>({
      resource: "scm_purchase_orders",
      pagination: { mode: "server", currentPage: 1, pageSize: 1000 },
      sorters: [{ field: "orderDate", order: "desc" }],
      meta: { appends: ["supplier"] },
      errorNotification: false,
      queryOptions: { retry: false },
    });
  const allOrders = useMemo(
    () => allOrdersResult?.data ?? [],
    [allOrdersResult?.data]
  );
  const today = dateBoundary(new Date().toISOString()) ?? Date.now();

  const summary = useMemo(() => {
    const ids = {
      overdue: [] as number[],
      open: [] as number[],
      received: [] as number[],
      draft: [] as number[],
      cancelled: [] as number[],
    };
    let purchaseAmount = 0;

    for (const order of allOrders) {
      if (isOpenOrder(order)) ids.open.push(order.id);
      if (overdueDays(order, today) > 0) ids.overdue.push(order.id);
      if (order.status === "received") ids.received.push(order.id);
      if (order.status === "draft") ids.draft.push(order.id);
      if (order.status === "cancelled") ids.cancelled.push(order.id);
      else purchaseAmount += Number(order.totalAmount ?? 0);
    }

    return { ids, purchaseAmount };
  }, [allOrders, today]);

  const permanentFilters = useMemo<CrudFilter[]>(() => {
    const filters: CrudFilter[] = [];
    const view = PURCHASE_ORDER_VIEWS.find((item) => item.id === activeView);
    if (view && !view.clientResolved) filters.push(...view.filters);
    if (activeView === "overdue") {
      filters.push({
        field: "id",
        operator: "in",
        value: summary.ids.overdue.length > 0 ? summary.ids.overdue : [0],
      });
    }
    const term = search.trim();
    if (term) {
      filters.push({
        operator: "or",
        value: [
          { field: "orderNo", operator: "contains", value: term },
          { field: "supplier.name", operator: "contains", value: term },
        ],
      });
    }
    return filters;
  }, [activeView, search, summary.ids.overdue]);

  const statusOptions = useMemo(
    () =>
      PURCHASE_ORDER_STATUS.map((option) => ({
        value: option.value,
        label: optionText(option),
      })),
    [locale]
  );

  const deliveryLabel = useCallback(
    (order: PurchaseOrderRecord) => {
      if (order.status === "draft" || order.status === "cancelled") {
        return {
          label: translate("inv.common.emDash", { ns: "inv" }, "—"),
          className: "text-muted-foreground",
        };
      }
      const promisedAt = dateBoundary(order.promisedDate);
      if (promisedAt === null) {
        return {
          label: translate("inv.common.emDash", { ns: "inv" }, "—"),
          className: "text-muted-foreground",
        };
      }
      const actualAt = dateBoundary(order.actualArrivalDate);
      if (actualAt !== null) {
        const days = Math.floor((actualAt - promisedAt) / DAY_MS);
        if (days <= 0) {
          return {
            label: translate(
              "inv.purchaseOrders.delivery.onTime",
              { ns: "inv" },
              "On time"
            ),
            className: "text-emerald-600 dark:text-emerald-400",
          };
        }
        return {
          label: translate(
            "inv.purchaseOrders.delivery.lateDaysShort",
            { ns: "inv", days },
            "Late {{days}} d"
          ),
          className: "font-semibold text-red-600 dark:text-red-400",
        };
      }
      if (!isOpenOrder(order)) {
        return {
          label: translate("inv.common.emDash", { ns: "inv" }, "—"),
          className: "text-muted-foreground",
        };
      }
      if (promisedAt < today) {
        const days = Math.floor((today - promisedAt) / DAY_MS);
        return {
          label: translate(
            "inv.purchaseOrders.delivery.overdueDaysShort",
            { ns: "inv", days },
            "Overdue {{days}} d"
          ),
          className: "font-semibold text-amber-600 dark:text-amber-400",
        };
      }
      const days = Math.ceil((promisedAt - today) / DAY_MS);
      return {
        label: translate(
          "inv.purchaseOrders.delivery.dueInDaysShort",
          { ns: "inv", days },
          "Due in {{days}} d"
        ),
        className: "text-muted-foreground",
      };
    },
    [today, translate]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<PurchaseOrderRecord>();

    return [
      columnHelper.accessor("orderNo", {
        id: "orderNo",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.purchaseOrders.fields.orderNo",
              { ns: "inv" },
              "Order no."
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
        size: 180,
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-full cursor-pointer truncate text-left font-medium text-foreground hover:underline"
              onClick={() =>
                navigate(`/goods/purchase-orders/show/${row.original.id}`)
              }
            >
              {getValue() ||
                translate("inv.common.emDash", { ns: "inv" }, "—")}
            </button>
            <span className="block truncate text-xs text-muted-foreground">
              {formatDate(row.original.orderDate, locale)}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("supplier_id", {
        id: "supplier",
        header: translate(
          "inv.purchaseOrders.fields.supplier",
          { ns: "inv" },
          "Supplier"
        ),
        enableSorting: false,
        size: 190,
        cell: ({ row }) =>
          row.original.supplier?.id ? (
            <button
              type="button"
              className="max-w-full cursor-pointer truncate text-left hover:underline"
              onClick={() =>
                navigate(`/goods/suppliers/show/${row.original.supplier?.id}`)
              }
            >
              {row.original.supplier.name ||
                translate("inv.common.emDash", { ns: "inv" }, "—")}
            </button>
          ) : (
            <span className="text-muted-foreground">
              {translate("inv.common.emDash", { ns: "inv" }, "—")}
            </span>
          ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.purchaseOrders.fields.status",
              { ns: "inv" },
              "Status"
            )}
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
        size: 150,
        cell: ({ getValue }) => (
          <OptionBadge
            options={PURCHASE_ORDER_STATUS}
            value={getValue()}
            locale={locale}
            empty={translate("inv.common.emDash", { ns: "inv" }, "—")}
          />
        ),
      }),
      columnHelper.accessor("promisedDate", {
        id: "promisedDate",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.purchaseOrders.fields.promisedDate",
              { ns: "inv" },
              "Promised date"
            )}
          />
        ),
        enableSorting: true,
        size: 140,
        cell: ({ getValue }) => formatDate(getValue(), locale),
      }),
      columnHelper.accessor("actualArrivalDate", {
        id: "actualArrivalDate",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.purchaseOrders.fields.actualArrivalDate",
              { ns: "inv" },
              "Arrival date"
            )}
          />
        ),
        enableSorting: true,
        size: 140,
        cell: ({ getValue }) => formatDate(getValue(), locale),
      }),
      columnHelper.display({
        id: "delivery",
        header: translate(
          "inv.purchaseOrders.fields.delivery",
          { ns: "inv" },
          "Delivery"
        ),
        enableSorting: false,
        size: 140,
        cell: ({ row }) => {
          const delivery = deliveryLabel(row.original);
          return (
            <span className={`${delivery.className} tabular-nums`}>
              {delivery.label}
            </span>
          );
        },
      }),
      columnHelper.accessor("totalAmount", {
        id: "totalAmount",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.purchaseOrders.fields.totalAmount",
              { ns: "inv" },
              "Total amount"
            )}
          />
        ),
        enableSorting: true,
        size: 150,
        cell: ({ getValue }) => (
          <span className="tabular-nums">
            {formatCurrency(getValue(), locale)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        enableSorting: false,
        size: 72,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
            <ShowButton
              resource="scm_purchase_orders"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate(
                "inv.common.view",
                { ns: "inv" },
                "View"
              )}
              title={translate("inv.common.view", { ns: "inv" }, "View")}
            >
              <Eye />
            </ShowButton>
          </div>
        ),
      }),
    ];
  }, [deliveryLabel, locale, navigate, statusOptions, translate]);

  const table = useTable<PurchaseOrderRecord>({
    columns,
    getRowId: (row) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange: () => undefined,
    refineCoreProps: {
      resource: "scm_purchase_orders",
      syncWithLocation: false,
      meta: { appends: ["supplier"] },
      filters: { permanent: permanentFilters },
      sorters: { initial: [{ field: "orderDate", order: "desc" }] },
    },
  });

  usePermanentFilterSync(permanentFilters, table.refineCore.setFilters);

  const handleExport = useCallback(() => {
    exportCsv("purchase-orders", allOrders, [
      {
        header: translate(
          "inv.purchaseOrders.fields.orderNo",
          { ns: "inv" },
          "Order no."
        ),
        value: (row) => row.orderNo ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.supplier",
          { ns: "inv" },
          "Supplier"
        ),
        value: (row) => row.supplier?.name ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.orderDate",
          { ns: "inv" },
          "Order date"
        ),
        value: (row) => row.orderDate ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.promisedDate",
          { ns: "inv" },
          "Promised date"
        ),
        value: (row) => row.promisedDate ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.actualArrivalDate",
          { ns: "inv" },
          "Arrival date"
        ),
        value: (row) => row.actualArrivalDate ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.status",
          { ns: "inv" },
          "Status"
        ),
        value: (row) => row.status ?? "",
      },
      {
        header: translate(
          "inv.purchaseOrders.fields.totalAmount",
          { ns: "inv" },
          "Total amount"
        ),
        value: (row) => Number(row.totalAmount ?? 0).toFixed(2),
      },
    ]);
    notification?.open?.({
      type: "success",
      message: translate(
        "inv.common.exportDone",
        { ns: "inv" },
        "Export downloaded"
      ),
    });
  }, [allOrders, notification, translate]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "total",
        label: translate(
          "inv.purchaseOrders.kpi.total",
          { ns: "inv" },
          "Total orders"
        ),
        value: formatNumber(allOrders.length, locale),
        icon: <ClipboardList />,
        onClick: () => setActiveView("all"),
        active: activeView === "all",
      },
      {
        id: "open",
        label: translate(
          "inv.purchaseOrders.kpi.open",
          { ns: "inv" },
          "Open orders"
        ),
        value: formatNumber(summary.ids.open.length, locale),
        icon: <ShoppingCart />,
        onClick: () => setActiveView("open"),
        active: activeView === "open",
      },
      {
        id: "overdue",
        label: translate(
          "inv.purchaseOrders.kpi.overdue",
          { ns: "inv" },
          "Overdue orders"
        ),
        value: formatNumber(summary.ids.overdue.length, locale),
        tone: summary.ids.overdue.length > 0 ? "danger" : "default",
        icon: <AlertTriangle />,
        onClick: () => setActiveView("overdue"),
        active: activeView === "overdue",
      },
      {
        id: "amount",
        label: translate(
          "inv.purchaseOrders.kpi.amount",
          { ns: "inv" },
          "Purchase amount"
        ),
        value: formatCurrency(summary.purchaseAmount, locale),
        icon: <DollarSign />,
      },
      {
        id: "received",
        label: translate(
          "inv.purchaseOrders.kpi.received",
          { ns: "inv" },
          "Received orders"
        ),
        value: formatNumber(summary.ids.received.length, locale),
        tone: "success",
        icon: <PackageCheck />,
        onClick: () => setActiveView("received"),
        active: activeView === "received",
      },
    ],
    [activeView, allOrders.length, locale, setActiveView, summary, translate]
  );

  const columnOptions = useMemo(
    () =>
      table.reactTable
        .getAllLeafColumns()
        .filter((column) => !["actions", "orderNo"].includes(column.id))
        .map((column) => ({
          id: column.id,
          label:
            typeof column.columnDef.header === "string"
              ? column.columnDef.header
              : column.id,
        })),
    [table]
  );

  return (
    <ListView resource="scm_purchase_orders">
      <KpiBar items={kpis} loading={allOrdersQuery.isLoading} />

      <ListToolbar>
        <SavedViewTabs
          views={PURCHASE_ORDER_VIEWS}
          activeView={activeView}
          onChange={setActiveView}
          counts={{
            all: allOrders.length,
            open: summary.ids.open.length,
            overdue: summary.ids.overdue.length,
            received: summary.ids.received.length,
            draft: summary.ids.draft.length,
            cancelled: summary.ids.cancelled.length,
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.purchaseOrders.searchPlaceholder",
              { ns: "inv" },
              "Search order no. or supplier"
            )}
            className="w-full sm:w-72"
          />
          <ColumnSettingsMenu
            columns={columnOptions}
            hiddenColumns={preferences.hiddenColumns}
            onToggleColumn={toggleColumn}
            onReset={resetColumns}
            density={preferences.density}
            onDensityChange={setDensity}
          />
          <ExportCsvButton
            onExport={handleExport}
            disabled={allOrdersQuery.isLoading || allOrders.length === 0}
          />
        </div>
      </ListToolbar>

      <InventoryTable
        table={table}
        density={preferences.density}
        onRowClick={(row) =>
          navigate(`/goods/purchase-orders/show/${row.id}`)
        }
        emptyTitle={translate(
          "inv.purchaseOrders.empty.title",
          { ns: "inv" },
          "No purchase orders in this view"
        )}
        emptyDescription={translate(
          "inv.purchaseOrders.empty.description",
          { ns: "inv" },
          "Clear the search or switch back to all orders."
        )}
      />
    </ListView>
  );
};
