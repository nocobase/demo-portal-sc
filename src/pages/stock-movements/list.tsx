import {
  useGetLocale,
  useNotification,
  useTranslate,
  type CrudFilter,
} from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  FileStack,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import {
  DataTableFilterCombobox,
  DataTableFilterDropdownDateRangePicker,
  DataTableFilterDropdownNumeric,
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
import { SignedQuantity } from "@/components/inventory/stock-indicators";
import { ShowButton } from "@/components/resources/buttons/show";
import { CreateButton } from "@/components/resources/buttons/create";
import { ListView } from "@/components/resources/views/list-view";
import { isoDaysAgo } from "@/lib/inventory/analytics";
import {
  MOVEMENT_TYPES,
  optionLabel,
  optionText,
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
} from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import { formatDateTime, formatNumber } from "@/lib/inventory/format";
import { setRecordContext } from "@/lib/inventory/record-context";
import type { StockMovementRecord } from "@/lib/inventory/types";
import {
  movementDisplayDirection,
  stockMovementDelta,
} from "@/lib/inventory/stock-movement";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { queryAggregate } from "@/lib/inventory/use-movement-stats";
import { usePermanentFilterSync } from "@/lib/inventory/use-permanent-filter-sync";
import {
  useActiveView,
  useSearchTerm,
  useTablePreferences,
  type SavedView,
} from "@/lib/inventory/view-state";

const MOVEMENT_VIEWS: SavedView[] = [
  {
    id: "all",
    labelKey: "inv.movements.view.all",
    labelFallback: "All movements",
    filters: [],
  },
  {
    id: "week",
    labelKey: "inv.movements.view.week",
    labelFallback: "Last 7 days",
    filters: [],
  },
  {
    id: "month",
    labelKey: "inv.movements.view.month",
    labelFallback: "Last 30 days",
    filters: [],
  },
  {
    id: "inbound",
    labelKey: "inv.movements.view.inbound",
    labelFallback: "Inbound",
    filters: [],
  },
  {
    id: "outbound",
    labelKey: "inv.movements.view.outbound",
    labelFallback: "Outbound",
    filters: [],
  },
  {
    id: "exceptions",
    labelKey: "inv.movements.view.exceptions",
    labelFallback: "Adjustments & losses",
    filters: [],
  },
];

const DEFAULT_HIDDEN_COLUMNS = ["remark"];

const IN_TYPES = Array.from(STOCK_IN_TYPES);
const OUT_TYPES = Array.from(STOCK_OUT_TYPES);
const EXCEPTION_TYPES = ["adjustment", "loss"];

type AggregateRow = {
  type: string;
  qty: number | string | null;
  before: number | string | null;
  after: number | string | null;
  documents: number | string | null;
};

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
  const notification = useNotification();

  const [activeView, setActiveView] = useActiveView("all");
  const [search, setSearch] = useSearchTerm();
  const { preferences, columnVisibility, toggleColumn, setDensity, resetColumns } =
    useTablePreferences("stock-movements", DEFAULT_HIDDEN_COLUMNS);

  /**
   * The same view is expressed twice: as Refine filters for the paged table and
   * as a NocoBase filter for the aggregate that feeds the summary strip.
   */
  const { crudFilters, aggregateFilter } = useMemo(() => {
    const crud: CrudFilter[] = [];
    const conditions: Record<string, unknown>[] = [];

    if (activeView === "week" || activeView === "month") {
      const since = isoDaysAgo(activeView === "week" ? 7 : 30);
      crud.push({ field: "occurredAt", operator: "gte", value: since });
      conditions.push({ occurredAt: { $gte: since } });
    }
    if (activeView === "inbound") {
      crud.push({ field: "type", operator: "in", value: IN_TYPES });
      conditions.push({ type: { $in: IN_TYPES } });
    }
    if (activeView === "outbound") {
      crud.push({ field: "type", operator: "in", value: OUT_TYPES });
      conditions.push({ type: { $in: OUT_TYPES } });
    }
    if (activeView === "exceptions") {
      crud.push({ field: "type", operator: "in", value: EXCEPTION_TYPES });
      conditions.push({ type: { $in: EXCEPTION_TYPES } });
    }

    const term = search.trim();
    if (term) {
      crud.push({
        operator: "or",
        value: [
          { field: "referenceNo", operator: "contains", value: term },
          { field: "handler", operator: "contains", value: term },
          { field: "remark", operator: "contains", value: term },
        ],
      });
      conditions.push({
        $or: [
          { referenceNo: { $includes: term } },
          { handler: { $includes: term } },
          { remark: { $includes: term } },
        ],
      });
    }

    return {
      crudFilters: crud,
      aggregateFilter: conditions.length ? { $and: conditions } : undefined,
    };
  }, [activeView, search]);

  const summary = useQuery<AggregateRow[]>({
    queryKey: ["movement-summary", activeView, search],
    queryFn: () =>
      queryAggregate<AggregateRow[]>("scm_stock_movements", {
        measures: [
          { field: ["quantity"], aggregation: "sum", alias: "qty" },
          { field: ["beforeStock"], aggregation: "sum", alias: "before" },
          { field: ["afterStock"], aggregation: "sum", alias: "after" },
          { field: ["id"], aggregation: "count", alias: "documents" },
        ],
        dimensions: [{ field: ["type"], alias: "type" }],
        ...(aggregateFilter ? { filter: aggregateFilter } : {}),
      }),
    retry: false,
  });

  const totals = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    let documents = 0;
    let exceptions = 0;
    let net = 0;
    for (const row of summary.data ?? []) {
      const qty = Number(row.qty ?? 0);
      const count = Number(row.documents ?? 0);
      documents += count;
      if (STOCK_IN_TYPES.has(row.type)) inbound += qty;
      if (STOCK_OUT_TYPES.has(row.type)) outbound += qty;
      if (EXCEPTION_TYPES.includes(row.type)) exceptions += count;
      net += stockMovementDelta({
        beforeStock: row.before,
        afterStock: row.after,
      });
    }
    return { inbound, outbound, documents, exceptions, net };
  }, [summary.data]);

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
        size: 170,
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDateTime(getValue(), locale)}
          </span>
        ),
      }),
      columnHelper.accessor("referenceNo", {
        id: "referenceNo",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.movements.fields.referenceNo",
              { ns: "inv" },
              "Document no."
            )}
            sortable={false}
          />
        ),
        enableSorting: false,
        size: 140,
        cell: ({ getValue }) => (
          <code className="text-xs text-muted-foreground">
            {getValue() || "-"}
          </code>
        ),
      }),
      columnHelper.accessor("productId", {
        id: "product_id",
        header: translate(
          "inv.movements.fields.product",
          { ns: "inv" },
          "Product"
        ),
        enableSorting: false,
        size: 240,
        cell: ({ row }) => {
          const product = row.original.product;
          if (!product) return "-";
          return (
            <div className="min-w-0">
              <button
                type="button"
                className="block max-w-full cursor-pointer truncate text-left font-medium text-foreground hover:underline"
                onClick={() => navigate(`products/${product.id}`)}
              >
                {product.name}
              </button>
              <span className="block truncate text-xs text-muted-foreground">
                {product.sku}
              </span>
            </div>
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
        size: 150,
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
        size: 110,
        cell: ({ row, getValue }) => {
          return (
            <SignedQuantity
              quantity={Number(getValue() ?? 0)}
              direction={movementDisplayDirection(row.original)}
            />
          );
        },
      }),
      columnHelper.display({
        id: "balance",
        size: 150,
        enableSorting: false,
        header: translate(
          "inv.movements.fields.balance",
          { ns: "inv" },
          "Balance before → after"
        ),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatNumber(row.original.beforeStock)} →{" "}
            <span className="font-medium text-foreground">
              {formatNumber(row.original.afterStock)}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("handler", {
        id: "handler",
        header: translate(
          "inv.movements.fields.handler",
          { ns: "inv" },
          "Handler"
        ),
        enableSorting: false,
        size: 140,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("remark", {
        id: "remark",
        header: translate("inv.movements.fields.remark", { ns: "inv" }, "Remark"),
        enableSorting: false,
        size: 200,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
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
        size: 80,
      }),
    ];
  }, [locale, movementTypeOptions, navigate, translate]);

  const table = useTable<StockMovementRecord>({
    columns,
    getRowId: (row) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange: () => undefined,
    refineCoreProps: {
      resource: "scm_stock_movements",
      syncWithLocation: false,
      meta: { appends: ["product"] },
      filters: { permanent: crudFilters },
      sorters: { initial: [{ field: "occurredAt", order: "desc" }] },
    },
  });

  usePermanentFilterSync(crudFilters, table.refineCore.setFilters);

  useEffect(() => {
    setRecordContext(
      "scm_stock_movements",
      (table.refineCore.tableQuery.data?.data ?? []).map((row) => row.id)
    );
  }, [table.refineCore.tableQuery.data?.data]);

  const handleExport = useCallback(() => {
    const rows = table.refineCore.tableQuery.data?.data ?? [];
    exportCsv("stock-movements", rows, [
      { header: "Occurred at", value: (row) => row.occurredAt ?? "" },
      { header: "Document no.", value: (row) => row.referenceNo ?? "" },
      { header: "Product", value: (row) => row.product?.name ?? "" },
      { header: "SKU", value: (row) => row.product?.sku ?? "" },
      { header: "Type", value: (row) => optionLabel(MOVEMENT_TYPES, row.type) },
      { header: "Quantity", value: (row) => row.quantity ?? 0 },
      { header: "Stock before", value: (row) => row.beforeStock ?? 0 },
      { header: "Stock after", value: (row) => row.afterStock ?? 0 },
      { header: "Handler", value: (row) => row.handler ?? "" },
      { header: "Remark", value: (row) => row.remark ?? "" },
    ]);
    notification?.open?.({
      type: "success",
      message: translate(
        "inv.common.exportDone",
        { ns: "inv" },
        "Export downloaded"
      ),
    });
  }, [notification, table.refineCore.tableQuery.data?.data, translate]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "documents",
        label: translate(
          "inv.movements.kpi.documents",
          { ns: "inv" },
          "Movements"
        ),
        value: formatNumber(totals.documents),
        icon: <FileStack />,
      },
      {
        id: "inbound",
        label: translate("inv.movements.kpi.inbound", { ns: "inv" }, "Inbound"),
        value: formatNumber(totals.inbound),
        tone: "success",
        icon: <ArrowDownLeft />,
        onClick: () => setActiveView("inbound"),
        active: activeView === "inbound",
      },
      {
        id: "outbound",
        label: translate(
          "inv.movements.kpi.outbound",
          { ns: "inv" },
          "Outbound"
        ),
        value: formatNumber(totals.outbound),
        tone: "danger",
        icon: <ArrowUpRight />,
        onClick: () => setActiveView("outbound"),
        active: activeView === "outbound",
      },
      {
        id: "net",
        label: translate(
          "inv.movements.kpi.net",
          { ns: "inv" },
          "Net stock change"
        ),
        value: `${totals.net >= 0 ? "+" : "-"}${formatNumber(
          Math.abs(totals.net)
        )}`,
        hint: translate(
          "inv.movements.kpi.netHint",
          { ns: "inv" },
          "Sum of stock after minus stock before, including adjustments"
        ),
        tone: totals.net >= 0 ? "success" : "warning",
        icon: <Scale />,
      },
      {
        id: "exceptions",
        label: translate(
          "inv.movements.kpi.exceptions",
          { ns: "inv" },
          "Adjustments & losses"
        ),
        value: formatNumber(totals.exceptions),
        tone: totals.exceptions > 0 ? "warning" : "default",
        icon: <TriangleAlert />,
        onClick: () => setActiveView("exceptions"),
        active: activeView === "exceptions",
      },
    ],
    [activeView, setActiveView, totals, translate]
  );

  const columnOptions = useMemo(
    () =>
      table.reactTable
        .getAllLeafColumns()
        .filter((column) => !["actions", "occurredAt"].includes(column.id))
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
    id: "stock-movements-table",
    title: translate("inv.movements.ai.table", { ns: "inv" }, "Stock movements"),
    kind: "table",
    getContext: () => ({
      resource: "scm_stock_movements",
      view: activeView,
      search,
      totals,
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
      <KpiBar items={kpis} loading={summary.isLoading} className="xl:grid-cols-5" />

      <ListToolbar>
        <SavedViewTabs
          views={MOVEMENT_VIEWS}
          activeView={activeView}
          onChange={setActiveView}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.movements.searchPlaceholder",
              { ns: "inv" },
              "Search document no., handler or remark"
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

      <div ref={tableContext.ref}>
        <InventoryTable
          table={table}
          density={preferences.density}
          onRowClick={(row) => navigate(`/stock/movements/show/${row.id}`)}
          emptyTitle={translate(
            "inv.movements.empty.title",
            { ns: "inv" },
            "No movements in this view"
          )}
          emptyDescription={translate(
            "inv.movements.empty.description",
            { ns: "inv" },
            "Widen the date range, or post the first movement for this period."
          )}
          emptyAction={<CreateButton resource="scm_stock_movements" />}
        />
      </div>
    </ListView>
  );
};
