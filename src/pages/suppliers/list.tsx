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
  Eye,
  Pencil,
  PackageSearch,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTableFilterDropdownText } from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { ActivityBadgeGroup } from "@/components/inventory/activity-badge-group";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import {
  ColumnSettingsMenu,
  ExportCsvButton,
  ListToolbar,
  SavedViewTabs,
  TableSearchInput,
} from "@/components/inventory/list-toolbar";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import {
  ANALYSIS_WINDOW_DAYS,
  formatPercent,
} from "@/lib/inventory/analytics";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatDate, formatNumber } from "@/lib/inventory/format";
import type { SupplierRecord } from "@/lib/inventory/types";
import { usePurchasePerformance } from "@/lib/inventory/use-purchase-performance";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import {
  useSupplierPerformance,
  type SupplierPerformance,
} from "@/pages/suppliers/use-supplier-performance";
import { usePermanentFilterSync } from "@/lib/inventory/use-permanent-filter-sync";
import {
  useActiveView,
  useSearchTerm,
  useTablePreferences,
  type SavedView,
} from "@/lib/inventory/view-state";

const SUPPLIER_VIEWS: SavedView[] = [
  {
    id: "all",
    labelKey: "inv.suppliers.view.all",
    labelFallback: "All suppliers",
    filters: [],
  },
  {
    id: "shortages",
    labelKey: "inv.suppliers.view.shortages",
    labelFallback: "With shortages",
    filters: [],
    clientResolved: true,
  },
  {
    id: "active",
    labelKey: "inv.suppliers.view.active",
    labelFallback: "Recently supplying",
    filters: [],
    clientResolved: true,
  },
  {
    id: "idle",
    labelKey: "inv.suppliers.view.idle",
    labelFallback: "No recent receipts",
    filters: [],
    clientResolved: true,
  },
  {
    id: "poorDelivery",
    labelKey: "inv.suppliers.view.poorDelivery",
    labelFallback: "Poor delivery",
    filters: [],
    clientResolved: true,
  },
  {
    id: "overdue",
    labelKey: "inv.suppliers.view.overdue",
    labelFallback: "Overdue orders",
    filters: [],
    clientResolved: true,
  },
];

const DEFAULT_HIDDEN_COLUMNS = ["address"];

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
  const notification = useNotification();

  const [activeView, setActiveView] = useActiveView("all");
  const [search, setSearch] = useSearchTerm();
  const { preferences, columnVisibility, toggleColumn, setDensity, resetColumns } =
    useTablePreferences("suppliers", DEFAULT_HIDDEN_COLUMNS);

  const performance = useSupplierPerformance();
  const performanceById = performance.bySupplier;
  const delivery = usePurchasePerformance();
  const deliveryById = delivery.bySupplier;

  const { result: suppliersResult } = useList<SupplierRecord>({
    resource: "scm_suppliers",
    pagination: { mode: "server", currentPage: 1, pageSize: 500 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const suppliers = useMemo(
    () => suppliersResult?.data ?? [],
    [suppliersResult?.data]
  );

  const buckets = useMemo(() => {
    const shortages: number[] = [];
    const active: number[] = [];
    const idle: number[] = [];
    const poorDelivery: number[] = [];
    const overdue: number[] = [];
    for (const supplier of suppliers) {
      const stats = performanceById.get(supplier.id);
      const deliveryStats = deliveryById.get(supplier.id);
      if ((stats?.shortageSkus ?? 0) > 0) shortages.push(supplier.id);
      if (stats?.lastReceiptAt) active.push(supplier.id);
      else idle.push(supplier.id);
      if (
        deliveryStats?.onTimeRate !== null &&
        deliveryStats?.onTimeRate !== undefined &&
        deliveryStats.onTimeRate < 0.8
      ) {
        poorDelivery.push(supplier.id);
      }
      if ((deliveryStats?.overdueOrders ?? 0) > 0) overdue.push(supplier.id);
    }
    return { shortages, active, idle, poorDelivery, overdue };
  }, [deliveryById, performanceById, suppliers]);

  const viewIds = useMemo<number[] | null>(() => {
    if (activeView === "shortages") return buckets.shortages;
    if (activeView === "active") return buckets.active;
    if (activeView === "idle") return buckets.idle;
    if (activeView === "poorDelivery") return buckets.poorDelivery;
    if (activeView === "overdue") return buckets.overdue;
    return null;
  }, [activeView, buckets]);

  const permanentFilters = useMemo<CrudFilter[]>(() => {
    const filters: CrudFilter[] = [];
    if (viewIds) {
      filters.push({
        field: "id",
        operator: "in",
        value: viewIds.length > 0 ? viewIds : [0],
      });
    }
    const term = search.trim();
    if (term) {
      filters.push({
        operator: "or",
        value: [
          { field: "name", operator: "contains", value: term },
          { field: "code", operator: "contains", value: term },
          { field: "contact", operator: "contains", value: term },
          { field: "phone", operator: "contains", value: term },
        ],
      });
    }
    return filters;
  }, [search, viewIds]);

  const totals = useMemo(() => {
    let skus = 0;
    let value = 0;
    let estimatedReceiptValue = 0;
    let shortage = 0;
    for (const supplier of suppliers) {
      const stats = performanceById.get(supplier.id);
      if (!stats) continue;
      skus += stats.skuCount;
      value += stats.stockValue;
      estimatedReceiptValue += stats.estimatedReceiptValue;
      shortage += stats.shortageSkus;
    }
    return {
      suppliers: suppliers.length,
      skus,
      value,
      estimatedReceiptValue,
      shortage,
    };
  }, [performanceById, suppliers]);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<SupplierRecord>();
    const statsOf = (id: number): SupplierPerformance | undefined =>
      performanceById.get(id);
    const deliveryStatsOf = (id: number) => deliveryById.get(id);

    return [
      columnHelper.accessor("name", {
        id: "name",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.suppliers.fields.name",
              { ns: "inv" },
              "Supplier"
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
        size: 240,
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-full cursor-pointer truncate text-left font-medium text-foreground hover:underline"
              onClick={() => navigate(`/goods/suppliers/show/${row.original.id}`)}
            >
              {getValue() || "-"}
            </button>
            <span className="block truncate text-xs text-muted-foreground">
              {row.original.code}
              {row.original.contact ? ` · ${row.original.contact}` : ""}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("phone", {
        id: "phone",
        header: translate("inv.suppliers.fields.phone", { ns: "inv" }, "Phone"),
        enableSorting: false,
        size: 150,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.display({
        id: "skus",
        size: 120,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.skus",
          { ns: "inv" },
          "SKUs supplied"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(statsOf(row.original.id)?.skuCount ?? 0)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "shortages",
        size: 130,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.shortages",
          { ns: "inv" },
          "SKUs to reorder"
        ),
        cell: ({ row }) => {
          const shortage = statsOf(row.original.id)?.shortageSkus ?? 0;
          return shortage > 0 ? (
            <span className="font-semibold text-amber-600 tabular-nums dark:text-amber-400">
              {formatNumber(shortage)}
            </span>
          ) : (
            <span className="tabular-nums text-muted-foreground">0</span>
          );
        },
      }),
      columnHelper.display({
        id: "stockValue",
        size: 140,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.stockValue",
          { ns: "inv" },
          "Stock value"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(statsOf(row.original.id)?.stockValue ?? 0, locale)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "estimatedReceiptValue",
        size: 140,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.estimatedReceiptValue",
          { ns: "inv" },
          "Estimated receipt value (90d)"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(
              statsOf(row.original.id)?.estimatedReceiptValue ?? 0,
              locale
            )}
          </span>
        ),
      }),
      columnHelper.display({
        id: "receipts",
        size: 120,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.receipts",
          { ns: "inv" },
          "Receipts (90d)"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(statsOf(row.original.id)?.receipts ?? 0)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "lastReceipt",
        size: 140,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.lastReceipt",
          { ns: "inv" },
          "Last receipt"
        ),
        cell: ({ row }) => {
          const last = statsOf(row.original.id)?.lastReceiptAt;
          return last ? (
            formatDate(last, locale)
          ) : (
            <span className="text-muted-foreground">
              {translate("inv.suppliers.noReceipts", { ns: "inv" }, "None")}
            </span>
          );
        },
      }),
      columnHelper.accessor("address", {
        id: "address",
        header: translate(
          "inv.suppliers.fields.address",
          { ns: "inv" },
          "Address"
        ),
        enableSorting: false,
        size: 220,
        cell: ({ getValue }) => (
          <span className="line-clamp-1 text-sm">{getValue() || "-"}</span>
        ),
      }),
      columnHelper.display({
        id: "onTimeRate",
        size: 140,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.onTimeRate",
          { ns: "inv" },
          "On-time rate"
        ),
        cell: ({ row }) => {
          const rate = deliveryStatsOf(row.original.id)?.onTimeRate;
          if (rate === null || rate === undefined) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span
              className={
                rate >= 0.95
                  ? "text-emerald-600 tabular-nums dark:text-emerald-400"
                  : rate < 0.8
                    ? "font-semibold text-red-600 tabular-nums dark:text-red-400"
                    : "tabular-nums"
              }
            >
              {formatPercent(rate, 1)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "overdue",
        size: 130,
        enableSorting: false,
        header: translate(
          "inv.suppliers.fields.overdue",
          { ns: "inv" },
          "Overdue orders"
        ),
        cell: ({ row }) => {
          const overdue = deliveryStatsOf(row.original.id)?.overdueOrders ?? 0;
          return overdue > 0 ? (
            <span className="font-semibold text-amber-600 tabular-nums dark:text-amber-400">
              {formatNumber(overdue)}
            </span>
          ) : (
            <span className="tabular-nums text-muted-foreground">0</span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
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
  }, [deliveryById, locale, navigate, performanceById, translate]);

  const table = useTable<SupplierRecord>({
    columns,
    getRowId: (row) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange: () => undefined,
    refineCoreProps: {
      resource: "scm_suppliers",
      syncWithLocation: false,
      filters: { permanent: permanentFilters },
      sorters: { initial: [{ field: "createdAt", order: "desc" }] },
    },
  });

  usePermanentFilterSync(permanentFilters, table.refineCore.setFilters);

  const handleExport = useCallback(() => {
    exportCsv("suppliers", suppliers, [
      { header: "Code", value: (row) => row.code },
      { header: "Name", value: (row) => row.name },
      { header: "Contact", value: (row) => row.contact ?? "" },
      { header: "Phone", value: (row) => row.phone ?? "" },
      {
        header: "SKUs supplied",
        value: (row) => performanceById.get(row.id)?.skuCount ?? 0,
      },
      {
        header: "SKUs to reorder",
        value: (row) => performanceById.get(row.id)?.shortageSkus ?? 0,
      },
      {
        header: "Stock value",
        value: (row) => (performanceById.get(row.id)?.stockValue ?? 0).toFixed(2),
      },
      {
        header: "Estimated receipt value at current cost (90d)",
        value: (row) =>
          (performanceById.get(row.id)?.estimatedReceiptValue ?? 0).toFixed(2),
      },
      {
        header: "Receipts (90d)",
        value: (row) => performanceById.get(row.id)?.receipts ?? 0,
      },
      {
        header: "Last receipt",
        value: (row) => performanceById.get(row.id)?.lastReceiptAt ?? "",
      },
      {
        header: translate(
          "inv.suppliers.fields.onTimeRate",
          { ns: "inv" },
          "On-time rate"
        ),
        value: (row) => formatPercent(deliveryById.get(row.id)?.onTimeRate, 1),
      },
      {
        header: translate(
          "inv.suppliers.fields.overdue",
          { ns: "inv" },
          "Overdue orders"
        ),
        value: (row) => deliveryById.get(row.id)?.overdueOrders ?? 0,
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
  }, [deliveryById, notification, performanceById, suppliers, translate]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "suppliers",
        label: translate(
          "inv.suppliers.kpi.total",
          { ns: "inv" },
          "Suppliers"
        ),
        value: formatNumber(totals.suppliers),
        icon: <Truck />,
        onClick: () => setActiveView("all"),
        active: activeView === "all",
      },
      {
        id: "skus",
        label: translate(
          "inv.suppliers.kpi.skus",
          { ns: "inv" },
          "SKUs sourced"
        ),
        value: formatNumber(totals.skus),
        icon: <PackageSearch />,
      },
      {
        id: "value",
        label: translate(
          "inv.suppliers.kpi.value",
          { ns: "inv" },
          "Stock value sourced"
        ),
        value: formatCurrency(totals.value, locale),
        icon: <Wallet />,
      },
      {
        id: "estimatedReceiptValue",
        label: translate(
          "inv.suppliers.kpi.estimatedReceiptValue",
          { ns: "inv" },
          "Estimated receipt value (90d)"
        ),
        value: formatCurrency(totals.estimatedReceiptValue, locale),
        hint: translate(
          "inv.suppliers.kpi.estimatedReceiptValueHint",
          { ns: "inv" },
          "Receipt quantity × current product cost; not actual PO spend"
        ),
        icon: <Wallet />,
      },
      {
        id: "shortage",
        label: translate(
          "inv.suppliers.kpi.shortage",
          { ns: "inv" },
          "SKUs to reorder"
        ),
        value: formatNumber(totals.shortage),
        tone: totals.shortage > 0 ? "warning" : "default",
        icon: <AlertTriangle />,
        onClick: () => setActiveView("shortages"),
        active: activeView === "shortages",
      },
      {
        id: "onTimeDelivery",
        label: translate(
          "inv.suppliers.kpi.onTimeDelivery",
          { ns: "inv" },
          "On-time delivery"
        ),
        value: formatPercent(delivery.overall.onTimeRate, 1),
        hint: translate(
          "inv.suppliers.kpi.onTimeDeliveryHint",
          { ns: "inv", count: delivery.overall.scoredOrders },
          `Across ${delivery.overall.scoredOrders} scored orders`
        ),
        tone:
          delivery.overall.onTimeRate !== null &&
          delivery.overall.onTimeRate < 0.85
            ? "danger"
            : "default",
        icon: <Truck />,
      },
    ],
    [activeView, delivery.overall, locale, setActiveView, totals, translate]
  );

  const columnOptions = useMemo(
    () =>
      table.reactTable
        .getAllLeafColumns()
        .filter((column) => !["actions", "name"].includes(column.id))
        .map((column) => ({
          id: column.id,
          label:
            typeof column.columnDef.header === "string"
              ? column.columnDef.header
              : column.id,
        })),
    [table]
  );

  const tableContext = useAIPageElementHandle({
    id: "suppliers-table",
    title: translate("inv.suppliers.ai.table", { ns: "inv" }, "Suppliers"),
    kind: "table",
    getContext: () => ({
      resource: "scm_suppliers",
      view: activeView,
      totals,
      rows: (table.refineCore.tableQuery.data?.data ?? []).map((record) => ({
        id: record.id,
        code: record.code,
        name: record.name,
        contact: record.contact,
        performance: performanceById.get(record.id),
      })),
    }),
  });

  return (
    <ListView resource="scm_suppliers">
      <KpiBar
        items={kpis}
        loading={performance.isLoading || delivery.isLoading}
      />

      <ListToolbar>
        <SavedViewTabs
          views={SUPPLIER_VIEWS}
          activeView={activeView}
          onChange={setActiveView}
          counts={{
            shortages: buckets.shortages.length,
            active: buckets.active.length,
            idle: buckets.idle.length,
            poorDelivery: buckets.poorDelivery.length,
            overdue: buckets.overdue.length,
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.suppliers.searchPlaceholder",
              { ns: "inv" },
              "Search name, code or contact"
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
          <ExportCsvButton onExport={handleExport} />
        </div>
      </ListToolbar>

      <ActivityBadgeGroup
        windowDays={ANALYSIS_WINDOW_DAYS}
        isLoading={performance.isLoading}
        isError={performance.isError}
        onRetry={performance.refetch}
      />

      <div ref={tableContext.ref}>
        <InventoryTable
          table={table}
          density={preferences.density}
          onRowClick={(row) => navigate(`/goods/suppliers/show/${row.id}`)}
          emptyTitle={translate(
            "inv.suppliers.empty.title",
            { ns: "inv" },
            "No suppliers in this view"
          )}
          emptyDescription={translate(
            "inv.suppliers.empty.description",
            { ns: "inv" },
            "Clear the search or switch back to all suppliers."
          )}
        />
      </div>
    </ListView>
  );
};
