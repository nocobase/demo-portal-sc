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
  ClipboardCheck,
  ClipboardList,
  Eye,
  PlayCircle,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import {
  DataTableFilterCombobox,
  DataTableFilterDropdownDateSinglePicker,
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
import {
  CountProgressBar,
  type CountProgress,
} from "@/pages/inventory-counts/count-progress";
import { ShowButton } from "@/components/resources/buttons/show";
import { CreateButton } from "@/components/resources/buttons/create";
import { ListView } from "@/components/resources/views/list-view";
import { formatPercent } from "@/lib/inventory/analytics";
import {
  COUNT_SCOPES,
  COUNT_STATUS,
  optionLabel,
  optionText,
} from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import { formatDate, formatNumber } from "@/lib/inventory/format";
import type { InventoryCountRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { queryAggregate } from "@/lib/inventory/use-movement-stats";
import { usePermanentFilterSync } from "@/lib/inventory/use-permanent-filter-sync";
import {
  useActiveView,
  useSearchTerm,
  useTablePreferences,
  type SavedView,
} from "@/lib/inventory/view-state";

const COUNT_VIEWS: SavedView[] = [
  {
    id: "all",
    labelKey: "inv.counts.view.all",
    labelFallback: "All counts",
    filters: [],
  },
  {
    id: "open",
    labelKey: "inv.counts.view.open",
    labelFallback: "Open",
    filters: [
      { field: "status", operator: "in", value: ["draft", "in_progress"] },
    ],
  },
  {
    id: "review",
    labelKey: "inv.counts.view.review",
    labelFallback: "With variances",
    filters: [{ field: "diffCount", operator: "gt", value: 0 }],
  },
  {
    id: "completed",
    labelKey: "inv.counts.view.completed",
    labelFallback: "Posted",
    filters: [{ field: "status", operator: "eq", value: "completed" }],
  },
  {
    id: "cancelled",
    labelKey: "inv.counts.view.cancelled",
    labelFallback: "Cancelled",
    filters: [{ field: "status", operator: "eq", value: "cancelled" }],
  },
];

const DEFAULT_HIDDEN_COLUMNS = ["scope"];

type CountItemAggregateRow = {
  countId: number | string;
  status: string;
  items: number | string | null;
};

type CountStatusAggregateRow = {
  status: string;
  counts: number | string | null;
  variances: number | string | null;
  items: number | string | null;
};

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
  const notification = useNotification();

  const [activeView, setActiveView] = useActiveView("all");
  const [search, setSearch] = useSearchTerm();
  const { preferences, columnVisibility, toggleColumn, setDensity, resetColumns } =
    useTablePreferences("inventory-counts", DEFAULT_HIDDEN_COLUMNS);

  const permanentFilters = useMemo<CrudFilter[]>(() => {
    const view = COUNT_VIEWS.find((item) => item.id === activeView);
    const filters: CrudFilter[] = view ? [...view.filters] : [];
    const term = search.trim();
    if (term) {
      filters.push({
        operator: "or",
        value: [
          { field: "countNo", operator: "contains", value: term },
          { field: "countBy", operator: "contains", value: term },
          { field: "remark", operator: "contains", value: term },
        ],
      });
    }
    return filters;
  }, [activeView, search]);

  /** Line-level progress lives on the items, so it comes from an aggregate. */
  const itemProgress = useQuery<CountItemAggregateRow[]>({
    queryKey: ["count-item-progress"],
    queryFn: () =>
      queryAggregate<CountItemAggregateRow[]>("scm_inventory_count_items", {
        measures: [{ field: ["id"], aggregation: "count", alias: "items" }],
        dimensions: [
          { field: ["count_id"], alias: "countId" },
          { field: ["status"], alias: "status" },
        ],
      }),
    retry: false,
  });

  const progressById = useMemo(() => {
    const map = new Map<number, CountProgress>();
    for (const row of itemProgress.data ?? []) {
      const countId = Number(row.countId);
      if (!countId) continue;
      const entry =
        map.get(countId) ?? { total: 0, counted: 0, pending: 0, resolved: 0 };
      const items = Number(row.items ?? 0);
      entry.total += items;
      if (row.status === "counted") entry.counted += items;
      if (row.status === "pending") entry.pending += items;
      if (row.status === "resolved") entry.resolved += items;
      map.set(countId, entry);
    }
    return map;
  }, [itemProgress.data]);

  const statusSummary = useQuery<CountStatusAggregateRow[]>({
    queryKey: ["count-status-summary"],
    queryFn: () =>
      queryAggregate<CountStatusAggregateRow[]>("scm_inventory_counts", {
        measures: [
          { field: ["id"], aggregation: "count", alias: "counts" },
          { field: ["diffCount"], aggregation: "sum", alias: "variances" },
          { field: ["totalItems"], aggregation: "sum", alias: "items" },
        ],
        dimensions: [{ field: ["status"], alias: "status" }],
      }),
    retry: false,
  });

  const totals = useMemo(() => {
    let counts = 0;
    let open = 0;
    let completed = 0;
    let variances = 0;
    let items = 0;
    for (const row of statusSummary.data ?? []) {
      const value = Number(row.counts ?? 0);
      counts += value;
      items += Number(row.items ?? 0);
      variances += Number(row.variances ?? 0);
      if (row.status === "draft" || row.status === "in_progress") open += value;
      if (row.status === "completed") completed += value;
    }
    return {
      counts,
      open,
      completed,
      variances,
      items,
      varianceRate: items > 0 ? variances / items : null,
    };
  }, [statusSummary.data]);

  const statusOptions = useMemo(
    () =>
      COUNT_STATUS.map((option) => ({
        value: option.value,
        label: optionText(option),
      })),
    [locale]
  );
  const scopeOptions = useMemo(
    () =>
      COUNT_SCOPES.map((option) => ({
        value: option.value,
        label: optionText(option),
      })),
    [locale]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<InventoryCountRecord>();
    return [
      columnHelper.accessor("countNo", {
        id: "countNo",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.countNo",
              { ns: "inv" },
              "Count no."
            )}
          />
        ),
        enableSorting: true,
        size: 180,
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-full cursor-pointer truncate text-left font-medium text-foreground hover:underline"
              onClick={() => navigate(`/counting/counts/show/${row.original.id}`)}
            >
              {getValue() || `#${row.original.id}`}
            </button>
            <span className="block truncate text-xs text-muted-foreground">
              {optionLabel(COUNT_SCOPES, row.original.scope)}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.counts.fields.status", { ns: "inv" }, "Stage")}
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
            options={COUNT_STATUS}
            value={getValue()}
            locale={locale}
          />
        ),
      }),
      columnHelper.display({
        id: "progress",
        size: 190,
        enableSorting: false,
        header: translate(
          "inv.counts.fields.progress",
          { ns: "inv" },
          "Count progress"
        ),
        cell: ({ row }) => (
          <CountProgressBar
            progress={progressById.get(row.original.id)}
            fallbackTotal={Number(row.original.totalItems ?? 0)}
          />
        ),
      }),
      columnHelper.accessor("diffCount", {
        id: "diffCount",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.counts.fields.diffCount",
              { ns: "inv" },
              "Variances"
            )}
          />
        ),
        enableSorting: true,
        size: 120,
        cell: ({ getValue }) => {
          const value = Number(getValue() ?? 0);
          return value > 0 ? (
            <span className="font-semibold text-amber-600 tabular-nums dark:text-amber-400">
              {formatNumber(value)}
            </span>
          ) : (
            <span className="tabular-nums text-muted-foreground">0</span>
          );
        },
      }),
      columnHelper.display({
        id: "varianceRate",
        size: 130,
        enableSorting: false,
        header: translate(
          "inv.counts.fields.varianceRate",
          { ns: "inv" },
          "Variance rate"
        ),
        cell: ({ row }) => {
          const total =
            progressById.get(row.original.id)?.total ??
            Number(row.original.totalItems ?? 0);
          const rate = total > 0 ? Number(row.original.diffCount ?? 0) / total : null;
          return (
            <span
              className={
                rate !== null && rate >= 0.1
                  ? "font-semibold text-red-600 tabular-nums dark:text-red-400"
                  : "tabular-nums"
              }
            >
              {formatPercent(rate, 1)}
            </span>
          );
        },
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
        size: 140,
        cell: ({ getValue }) => formatDate(getValue(), locale),
      }),
      columnHelper.accessor("countBy", {
        id: "countBy",
        header: translate(
          "inv.counts.fields.countBy",
          { ns: "inv" },
          "Counted by"
        ),
        enableSorting: false,
        size: 150,
        cell: ({ getValue }) => getValue() || "-",
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
        size: 140,
        cell: ({ getValue }) => (
          <OptionBadge
            options={COUNT_SCOPES}
            value={getValue()}
            locale={locale}
          />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
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
        size: 80,
      }),
    ];
  }, [locale, navigate, progressById, scopeOptions, statusOptions, translate]);

  const table = useTable<InventoryCountRecord>({
    columns,
    getRowId: (row) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange: () => undefined,
    refineCoreProps: {
      resource: "scm_inventory_counts",
      syncWithLocation: false,
      filters: { permanent: permanentFilters },
      sorters: { initial: [{ field: "createdAt", order: "desc" }] },
    },
  });

  usePermanentFilterSync(permanentFilters, table.refineCore.setFilters);

  const handleExport = useCallback(() => {
    const rows = table.refineCore.tableQuery.data?.data ?? [];
    exportCsv("inventory-counts", rows, [
      { header: "Count no.", value: (row) => row.countNo ?? "" },
      { header: "Stage", value: (row) => optionLabel(COUNT_STATUS, row.status) },
      { header: "Scope", value: (row) => optionLabel(COUNT_SCOPES, row.scope) },
      { header: "Count date", value: (row) => row.countDate ?? "" },
      { header: "Counted by", value: (row) => row.countBy ?? "" },
      {
        header: "Lines",
        value: (row) => progressById.get(row.id)?.total ?? row.totalItems ?? 0,
      },
      { header: "Variances", value: (row) => row.diffCount ?? 0 },
      { header: "Notes", value: (row) => row.remark ?? "" },
    ]);
    notification?.open?.({
      type: "success",
      message: translate(
        "inv.common.exportDone",
        { ns: "inv" },
        "Export downloaded"
      ),
    });
  }, [
    notification,
    progressById,
    table.refineCore.tableQuery.data?.data,
    translate,
  ]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "counts",
        label: translate("inv.counts.kpi.total", { ns: "inv" }, "Count sheets"),
        value: formatNumber(totals.counts),
        icon: <ClipboardList />,
        onClick: () => setActiveView("all"),
        active: activeView === "all",
      },
      {
        id: "open",
        label: translate("inv.counts.kpi.open", { ns: "inv" }, "Open"),
        value: formatNumber(totals.open),
        tone: totals.open > 0 ? "info" : "default",
        icon: <PlayCircle />,
        onClick: () => setActiveView("open"),
        active: activeView === "open",
      },
      {
        id: "completed",
        label: translate("inv.counts.kpi.posted", { ns: "inv" }, "Posted"),
        value: formatNumber(totals.completed),
        tone: "success",
        icon: <ClipboardCheck />,
        onClick: () => setActiveView("completed"),
        active: activeView === "completed",
      },
      {
        id: "variances",
        label: translate(
          "inv.counts.kpi.variances",
          { ns: "inv" },
          "Variance lines"
        ),
        value: formatNumber(totals.variances),
        tone: totals.variances > 0 ? "warning" : "default",
        icon: <TriangleAlert />,
        onClick: () => setActiveView("review"),
        active: activeView === "review",
      },
      {
        id: "rate",
        label: translate(
          "inv.counts.kpi.varianceRate",
          { ns: "inv" },
          "Variance rate"
        ),
        value: formatPercent(totals.varianceRate, 1),
        hint: translate(
          "inv.counts.kpi.varianceRateHint",
          { ns: "inv" },
          "Variance lines over counted lines"
        ),
        tone:
          totals.varianceRate !== null && totals.varianceRate >= 0.1
            ? "danger"
            : "default",
        icon: <Scale />,
      },
    ],
    [activeView, setActiveView, totals, translate]
  );

  const columnOptions = useMemo(
    () =>
      table.reactTable
        .getAllLeafColumns()
        .filter((column) => !["actions", "countNo"].includes(column.id))
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
    id: "inventory-counts-table",
    title: translate("inv.counts.ai.table", { ns: "inv" }, "Inventory counts"),
    kind: "table",
    getContext: () => ({
      resource: "scm_inventory_counts",
      view: activeView,
      totals,
      rows: (table.refineCore.tableQuery.data?.data ?? []).map((record) => ({
        id: record.id,
        countNo: record.countNo,
        status: record.status,
        scope: record.scope,
        countDate: record.countDate,
        countBy: record.countBy,
        totalItems: record.totalItems,
        diffCount: record.diffCount,
        progress: progressById.get(record.id),
      })),
    }),
  });

  return (
    <ListView resource="scm_inventory_counts">
      <KpiBar
        items={kpis}
        loading={statusSummary.isLoading}
        className="xl:grid-cols-5"
      />

      <ListToolbar>
        <SavedViewTabs
          views={COUNT_VIEWS}
          activeView={activeView}
          onChange={setActiveView}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.counts.searchPlaceholder",
              { ns: "inv" },
              "Search count no. or counter"
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
          onRowClick={(row) => navigate(`/counting/counts/show/${row.id}`)}
          emptyTitle={translate(
            "inv.counts.empty.title",
            { ns: "inv" },
            "No count sheets in this view"
          )}
          emptyDescription={translate(
            "inv.counts.empty.description",
            { ns: "inv" },
            "Start a new count to generate lines from current stock."
          )}
          emptyAction={<CreateButton resource="scm_inventory_counts" />}
        />
      </div>
    </ListView>
  );
};
