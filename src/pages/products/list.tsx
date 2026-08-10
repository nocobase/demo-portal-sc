import {
  useDeleteMany,
  useGetLocale,
  useList,
  useNotification,
  useTranslate,
  useUpdateMany,
  type CrudFilter,
} from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import {
  AlertTriangle,
  Boxes,
  CircleSlash,
  Eye,
  Layers,
  Package,
  PackagePlus,
  Pencil,
  Snowflake,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import {
  DataTableFilterCombobox,
  DataTableFilterDropdownNumeric,
  DataTableFilterDropdownText,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { ActivityBadgeGroup } from "@/components/inventory/activity-badge-group";
import {
  InventoryTable,
  RowSelectionCheckbox,
} from "@/components/inventory/inventory-table";
import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import {
  BulkActionBar,
  ColumnSettingsMenu,
  ExportCsvButton,
  ListToolbar,
  SavedViewTabs,
  TableSearchInput,
} from "@/components/inventory/list-toolbar";
import { OptionBadge } from "@/components/inventory/option-badge";
import {
  AbcBadge,
  CoverageLabel,
  StockHealthBadge,
  StockLevelMeter,
} from "@/components/inventory/stock-indicators";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { Button } from "@/components/ui/button";
import {
  ANALYSIS_WINDOW_DAYS,
  averageDailyIssue,
  classifyAbc,
  daysOfCover,
  formatPercent,
  formatRatio,
  inventoryValue,
  isDeadStock,
  isTracked,
  marginRate,
  stockHealth,
  turnoverRatio,
  type StockHealth,
} from "@/lib/inventory/analytics";
import {
  optionLabel,
  optionText,
  PRODUCT_STATUS,
  PRODUCT_UNITS,
} from "@/lib/inventory/constants";
import { exportCsv } from "@/lib/inventory/csv";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/inventory/format";
import { setRecordContext } from "@/lib/inventory/record-context";
import type { CategoryRecord, ProductRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { useMovementStats } from "@/lib/inventory/use-movement-stats";
import { usePermanentFilterSync } from "@/lib/inventory/use-permanent-filter-sync";
import {
  useActiveView,
  useSearchTerm,
  useTablePreferences,
  type SavedView,
} from "@/lib/inventory/view-state";

const PRODUCT_VIEWS: SavedView[] = [
  {
    id: "all",
    labelKey: "inv.products.view.all",
    labelFallback: "All SKUs",
    filters: [],
  },
  {
    id: "shortage",
    labelKey: "inv.products.view.shortage",
    labelFallback: "Needs reorder",
    filters: [],
    clientResolved: true,
  },
  {
    id: "out",
    labelKey: "inv.products.view.out",
    labelFallback: "Out of stock",
    filters: [],
    clientResolved: true,
  },
  {
    id: "over",
    labelKey: "inv.products.view.over",
    labelFallback: "Overstock",
    filters: [],
    clientResolved: true,
  },
  {
    id: "dead",
    labelKey: "inv.products.view.dead",
    labelFallback: "Dead stock",
    filters: [],
    clientResolved: true,
  },
  {
    id: "classA",
    labelKey: "inv.products.view.classA",
    labelFallback: "Class A",
    filters: [],
    clientResolved: true,
  },
  {
    id: "stopped",
    labelKey: "inv.products.view.stopped",
    labelFallback: "Discontinued",
    filters: [{ field: "status", operator: "eq", value: "stopped" }],
  },
];

const DEFAULT_HIDDEN_COLUMNS = ["purchasePrice", "margin", "updatedAt"];

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
  const notification = useNotification();

  const [activeView, setActiveView] = useActiveView("all");
  const [search, setSearch] = useSearchTerm();
  const { preferences, columnVisibility, toggleColumn, setDensity, resetColumns } =
    useTablePreferences("products", DEFAULT_HIDDEN_COLUMNS);

  const { result: categoriesResult } = useList<CategoryRecord>({
    resource: "scm_product_categories",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const categoryOptions = useMemo(
    () =>
      (categoriesResult?.data ?? [])
        .map((item) => ({
          value: String(item.id),
          label: item.name ?? String(item.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [categoriesResult?.data, locale]
  );

  // The whole catalogue is needed for the KPI strip, the ABC split and the
  // saved views whose rule compares two columns (stock against safety stock).
  const { result: catalogueResult, query: catalogueQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
      meta: { appends: ["category", "supplier"] },
    });
  const catalogue = useMemo(
    () => catalogueResult?.data ?? [],
    [catalogueResult?.data]
  );

  const movements = useMovementStats();
  const statsById = movements.statsById;

  const abcById = useMemo(
    () =>
      classifyAbc(
        catalogue.map((product) => ({
          id: product.id,
          value:
            (statsById.get(product.id)?.outQty ?? 0) *
            Number(product.purchasePrice ?? 0),
        }))
      ),
    [catalogue, statsById]
  );

  const derived = useMemo(() => {
    const now = new Date();
    const map = new Map<
      number,
      {
        health: StockHealth;
        cover: number | null;
        turnover: number | null;
        value: number;
        dead: boolean;
      }
    >();
    for (const product of catalogue) {
      const stats = statsById.get(product.id);
      map.set(product.id, {
        health: stockHealth(product),
        cover: daysOfCover(
          Number(product.currentStock ?? 0),
          averageDailyIssue(stats)
        ),
        turnover: turnoverRatio(
          stats?.outQty ?? 0,
          Number(product.currentStock ?? 0)
        ),
        value: inventoryValue(product),
        dead: isDeadStock(product, stats, now),
      });
    }
    return map;
  }, [catalogue, statsById]);

  const buckets = useMemo(() => {
    const shortage: number[] = [];
    const out: number[] = [];
    const over: number[] = [];
    const dead: number[] = [];
    const classA: number[] = [];
    for (const product of catalogue) {
      const info = derived.get(product.id);
      if (!info) continue;
      if (abcById.get(product.id) === "A") classA.push(product.id);
      if (!isTracked(product)) continue;
      if (info.health === "out") out.push(product.id);
      if (info.health === "out" || info.health === "low")
        shortage.push(product.id);
      if (info.health === "over") over.push(product.id);
      if (info.dead) dead.push(product.id);
    }
    return { shortage, out, over, dead, classA };
  }, [abcById, catalogue, derived]);

  const totals = useMemo(() => {
    let units = 0;
    let value = 0;
    for (const product of catalogue) {
      units += Number(product.currentStock ?? 0);
      value += inventoryValue(product);
    }
    return { skus: catalogue.length, units, value };
  }, [catalogue]);

  /** Client-resolved views are pushed to the server as an explicit id list. */
  const viewIds = useMemo<number[] | null>(() => {
    switch (activeView) {
      case "shortage":
        return buckets.shortage;
      case "out":
        return buckets.out;
      case "over":
        return buckets.over;
      case "dead":
        return buckets.dead;
      case "classA":
        return buckets.classA;
      default:
        return null;
    }
  }, [activeView, buckets]);

  const permanentFilters = useMemo<CrudFilter[]>(() => {
    const filters: CrudFilter[] = [];
    const view = PRODUCT_VIEWS.find((item) => item.id === activeView);
    if (view && !view.clientResolved) filters.push(...view.filters);
    if (viewIds) {
      // An empty bucket must return nothing rather than everything.
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
          { field: "sku", operator: "contains", value: term },
          { field: "barcode", operator: "contains", value: term },
        ],
      });
    }
    return filters;
  }, [activeView, search, viewIds]);

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
      columnHelper.display({
        id: "select",
        size: 44,
        enableSorting: false,
        header: ({ table }) => (
          <RowSelectionCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
            label={translate("inv.common.selectAll", { ns: "inv" }, "Select all")}
          />
        ),
        cell: ({ row }) => (
          <RowSelectionCheckbox
            checked={row.getIsSelected()}
            onChange={(checked) => row.toggleSelected(checked)}
            label={translate("inv.common.selectRow", { ns: "inv" }, "Select row")}
          />
        ),
      }),
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
        size: 280,
        cell: ({ row, getValue }) => (
          <div className="min-w-0">
            <button
              type="button"
              className="block max-w-full cursor-pointer truncate text-left font-medium text-foreground hover:underline"
              onClick={() => navigate(`/goods/products/show/${row.original.id}`)}
            >
              {getValue() || "-"}
            </button>
            <span className="block truncate text-xs text-muted-foreground">
              {row.original.sku}
              {row.original.spec ? ` · ${row.original.spec}` : ""}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("sku", {
        id: "sku",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate("inv.products.fields.sku", { ns: "inv" }, "SKU")}
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
        size: 130,
        cell: ({ getValue }) => (
          <code className="text-xs text-muted-foreground">
            {getValue() || "-"}
          </code>
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
        size: 150,
        cell: ({ row }) => row.original.category?.name ?? "-",
      }),
      columnHelper.display({
        id: "health",
        size: 150,
        enableSorting: false,
        header: translate(
          "inv.products.fields.health",
          { ns: "inv" },
          "Stock status"
        ),
        cell: ({ row }) => {
          const info = derived.get(row.original.id);
          if (!info) return "-";
          return (
            <div className="flex items-center gap-1.5">
              <StockHealthBadge health={info.health} locale={locale} />
              {info.dead ? (
                <span
                  title={translate(
                    "inv.products.view.dead",
                    { ns: "inv" },
                    "Dead stock"
                  )}
                >
                  <Snowflake className="size-3.5 text-blue-500" />
                </span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor("currentStock", {
        id: "currentStock",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.stockVsSafety",
              { ns: "inv" },
              "On hand / safety"
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
        size: 160,
        cell: ({ row }) => {
          const info = derived.get(row.original.id);
          return (
            <StockLevelMeter
              stock={Number(row.original.currentStock ?? 0)}
              safety={Number(row.original.safetyStock ?? 0)}
              health={info?.health ?? "healthy"}
            />
          );
        },
      }),
      columnHelper.display({
        id: "coverage",
        size: 120,
        enableSorting: false,
        header: translate(
          "inv.products.fields.coverage",
          { ns: "inv" },
          "Days of cover"
        ),
        cell: ({ row }) => (
          <CoverageLabel days={derived.get(row.original.id)?.cover ?? null} />
        ),
      }),
      columnHelper.display({
        id: "abc",
        size: 100,
        enableSorting: false,
        header: translate("inv.products.fields.abc", { ns: "inv" }, "ABC"),
        cell: ({ row }) => (
          <AbcBadge abc={abcById.get(row.original.id)} locale={locale} />
        ),
      }),
      columnHelper.display({
        id: "turnover",
        size: 110,
        enableSorting: false,
        header: translate(
          "inv.products.fields.turnover",
          { ns: "inv" },
          "Turns / yr"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRatio(derived.get(row.original.id)?.turnover)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "value",
        size: 130,
        enableSorting: false,
        header: translate(
          "inv.products.fields.stockValue",
          { ns: "inv" },
          "Value on hand"
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(derived.get(row.original.id)?.value ?? 0, locale)}
          </span>
        ),
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
      columnHelper.accessor("purchasePrice", {
        id: "purchasePrice",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.purchasePrice",
              { ns: "inv" },
              "Purchase price"
            )}
          />
        ),
        enableSorting: true,
        size: 130,
        cell: ({ getValue }) => formatCurrency(getValue(), locale),
      }),
      columnHelper.display({
        id: "margin",
        size: 100,
        enableSorting: false,
        header: translate("inv.products.fields.margin", { ns: "inv" }, "Margin"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPercent(marginRate(row.original), 0)}
          </span>
        ),
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
        size: 100,
        cell: ({ getValue }) => optionLabel(PRODUCT_UNITS, getValue()),
      }),
      columnHelper.accessor("supplierId", {
        id: "supplier_id",
        header: translate(
          "inv.products.fields.supplier",
          { ns: "inv" },
          "Supplier"
        ),
        enableSorting: false,
        size: 160,
        cell: ({ row }) =>
          row.original.supplier ? (
            <button
              type="button"
              className="cursor-pointer truncate text-left hover:underline"
              onClick={() =>
                navigate(`/goods/suppliers/show/${row.original.supplier?.id}`)
              }
            >
              {row.original.supplier.name}
            </button>
          ) : (
            "-"
          ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.status",
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
        size: 120,
        cell: ({ getValue }) => (
          <OptionBadge
            options={PRODUCT_STATUS}
            value={getValue()}
            locale={locale}
          />
        ),
      }),
      columnHelper.accessor("createdAt", {
        id: "updatedAt",
        header: ({ column }) => (
          <ColumnHeader
            column={column}
            label={translate(
              "inv.products.fields.createdAt",
              { ns: "inv" },
              "Created"
            )}
          />
        ),
        enableSorting: true,
        size: 130,
        cell: ({ getValue }) => formatDate(getValue(), locale),
      }),
      columnHelper.display({
        id: "actions",
        header: translate("inv.common.actions", { ns: "inv" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={translate(
                "inv.products.action.newMovement",
                { ns: "inv" },
                "Record movement"
              )}
              title={translate(
                "inv.products.action.newMovement",
                { ns: "inv" },
                "Record movement"
              )}
              onClick={() =>
                navigate(
                  `/stock/movements/create?productId=${row.original.id}`
                )
              }
            >
              <PackagePlus />
            </Button>
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
        size: 160,
      }),
    ];
  }, [
    abcById,
    categoryOptions,
    derived,
    locale,
    navigate,
    statusOptions,
    translate,
  ]);

  const table = useTable<ProductRecord>({
    columns,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange: () => undefined,
    refineCoreProps: {
      resource: "scm_products",
      syncWithLocation: false,
      meta: { appends: ["category", "supplier"] },
      filters: { permanent: permanentFilters },
      sorters: { initial: [{ field: "createdAt", order: "desc" }] },
    },
  });

  usePermanentFilterSync(permanentFilters, table.refineCore.setFilters);

  useEffect(() => {
    setRecordContext(
      "scm_products",
      (table.refineCore.tableQuery.data?.data ?? []).map((row) => row.id)
    );
  }, [table.refineCore.tableQuery.data?.data]);

  const selectedRows = table.reactTable.getSelectedRowModel().rows;
  const selectedIds = useMemo(
    () => selectedRows.map((row) => row.original.id),
    [selectedRows]
  );

  const { mutate: updateMany, mutation: updateManyMutation } =
    useUpdateMany<ProductRecord>();
  const { mutate: deleteMany, mutation: deleteManyMutation } =
    useDeleteMany<ProductRecord>();
  const isMutating =
    updateManyMutation.isPending || deleteManyMutation.isPending;

  const clearSelection = useCallback(
    () => table.reactTable.resetRowSelection(),
    [table]
  );

  const applyStatus = useCallback(
    (status: string) => {
      updateMany(
        {
          resource: "scm_products",
          ids: selectedIds,
          values: { status },
          successNotification: {
            type: "success",
            message: translate(
              "inv.products.bulk.statusApplied",
              { ns: "inv", count: selectedIds.length },
              `${selectedIds.length} product(s) updated`
            ),
          },
        },
        {
          onSuccess: () => {
            clearSelection();
            void catalogueQuery.refetch();
          },
        }
      );
    },
    [clearSelection, catalogueQuery, selectedIds, translate, updateMany]
  );

  const removeSelected = useCallback(() => {
    const confirmed = window.confirm(
      translate(
        "inv.products.bulk.deleteConfirm",
        { ns: "inv", count: selectedIds.length },
        `Delete ${selectedIds.length} product(s)? This cannot be undone.`
      )
    );
    if (!confirmed) return;
    deleteMany(
      { resource: "scm_products", ids: selectedIds },
      {
        onSuccess: () => {
          clearSelection();
          void catalogueQuery.refetch();
        },
      }
    );
  }, [clearSelection, catalogueQuery, deleteMany, selectedIds, translate]);

  /** Export mirrors the active view, not just the page currently rendered. */
  const exportRows = useMemo(() => {
    const idSet = viewIds ? new Set(viewIds) : null;
    const term = search.trim().toLowerCase();
    return catalogue.filter((product) => {
      if (idSet && !idSet.has(product.id)) return false;
      if (activeView === "stopped" && product.status !== "stopped") return false;
      if (!term) return true;
      return [product.name, product.sku, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [activeView, catalogue, search, viewIds]);

  const handleExport = useCallback(() => {
    const rows = selectedIds.length
      ? catalogue.filter((product) => selectedIds.includes(product.id))
      : exportRows;
    exportCsv("products", rows, [
      { header: "SKU", value: (row) => row.sku },
      { header: "Name", value: (row) => row.name },
      { header: "Category", value: (row) => row.category?.name ?? "" },
      { header: "Supplier", value: (row) => row.supplier?.name ?? "" },
      { header: "Unit", value: (row) => row.unit ?? "" },
      { header: "Status", value: (row) => row.status ?? "" },
      { header: "On hand", value: (row) => row.currentStock ?? 0 },
      { header: "Safety stock", value: (row) => row.safetyStock ?? 0 },
      {
        header: "Stock status",
        value: (row) => derived.get(row.id)?.health ?? "",
      },
      { header: "ABC class", value: (row) => abcById.get(row.id) ?? "" },
      {
        header: "Days of cover",
        value: (row) => {
          const cover = derived.get(row.id)?.cover;
          return cover === null || cover === undefined ? "" : Math.floor(cover);
        },
      },
      {
        header: "Turns per year",
        value: (row) => {
          const turns = derived.get(row.id)?.turnover;
          return turns === null || turns === undefined ? "" : turns.toFixed(2);
        },
      },
      { header: "Purchase price", value: (row) => row.purchasePrice ?? 0 },
      { header: "Sale price", value: (row) => row.salePrice ?? 0 },
      { header: "Value on hand", value: (row) => derived.get(row.id)?.value ?? 0 },
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
    abcById,
    catalogue,
    derived,
    exportRows,
    notification,
    selectedIds,
    translate,
  ]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "skus",
        label: translate("inv.products.kpi.skus", { ns: "inv" }, "Active SKUs"),
        value: formatNumber(totals.skus),
        icon: <Package />,
        onClick: () => setActiveView("all"),
        active: activeView === "all",
      },
      {
        id: "units",
        label: translate(
          "inv.products.kpi.units",
          { ns: "inv" },
          "Units on hand"
        ),
        value: formatNumber(totals.units),
        icon: <Boxes />,
      },
      {
        id: "value",
        label: translate(
          "inv.products.kpi.value",
          { ns: "inv" },
          "Inventory value"
        ),
        value: formatCurrency(totals.value, locale),
        hint: translate(
          "inv.products.kpi.valueHint",
          { ns: "inv" },
          "At purchase cost"
        ),
        icon: <Wallet />,
      },
      {
        id: "shortage",
        label: translate(
          "inv.products.kpi.shortage",
          { ns: "inv" },
          "Needs reorder"
        ),
        value: formatNumber(buckets.shortage.length),
        tone: buckets.shortage.length > 0 ? "warning" : "default",
        icon: <AlertTriangle />,
        onClick: () => setActiveView("shortage"),
        active: activeView === "shortage",
      },
      {
        id: "out",
        label: translate(
          "inv.products.kpi.out",
          { ns: "inv" },
          "Out of stock"
        ),
        value: formatNumber(buckets.out.length),
        tone: buckets.out.length > 0 ? "danger" : "default",
        icon: <CircleSlash />,
        onClick: () => setActiveView("out"),
        active: activeView === "out",
      },
      {
        id: "dead",
        label: translate("inv.products.kpi.dead", { ns: "inv" }, "Dead stock"),
        value: formatNumber(buckets.dead.length),
        hint: translate(
          "inv.products.kpi.deadHint",
          { ns: "inv", days: ANALYSIS_WINDOW_DAYS },
          "No issue in 60 days"
        ),
        tone: buckets.dead.length > 0 ? "info" : "default",
        icon: <Layers />,
        onClick: () => setActiveView("dead"),
        active: activeView === "dead",
      },
    ],
    [activeView, buckets, locale, setActiveView, totals, translate]
  );

  const viewCounts = useMemo(
    () => ({
      shortage: buckets.shortage.length,
      out: buckets.out.length,
      over: buckets.over.length,
      dead: buckets.dead.length,
      classA: buckets.classA.length,
    }),
    [buckets]
  );

  const columnOptions = useMemo(
    () =>
      table.reactTable
        .getAllLeafColumns()
        .filter((column) => !["select", "actions", "name"].includes(column.id))
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
    id: "products-table",
    title: translate("inv.products.ai.table", { ns: "inv" }, "Products table"),
    kind: "table",
    getContext: () => ({
      resource: "scm_products",
      view: activeView,
      search,
      page: table.refineCore.currentPage,
      pageSize: table.refineCore.pageSize,
      total: table.refineCore.tableQuery.data?.total ?? 0,
      portfolio: totals,
      alerts: {
        shortage: buckets.shortage.length,
        outOfStock: buckets.out.length,
        overstock: buckets.over.length,
        deadStock: buckets.dead.length,
      },
      rows: (table.refineCore.tableQuery.data?.data ?? []).map((record) => ({
        id: record.id,
        sku: record.sku,
        name: record.name,
        category: record.category?.name,
        supplier: record.supplier?.name,
        unit: record.unit,
        currentStock: record.currentStock,
        safetyStock: record.safetyStock,
        salePrice: record.salePrice,
        status: record.status,
        health: derived.get(record.id)?.health,
        abc: abcById.get(record.id),
      })),
    }),
  });

  return (
    <ListView resource="scm_products">
      <KpiBar items={kpis} loading={catalogueQuery.isLoading} />

      <ListToolbar>
        <SavedViewTabs
          views={PRODUCT_VIEWS}
          activeView={activeView}
          onChange={setActiveView}
          counts={viewCounts}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.products.searchPlaceholder",
              { ns: "inv" },
              "Search name, SKU or barcode"
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

      <BulkActionBar selectedCount={selectedIds.length} onClear={clearSelection}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isMutating}
          onClick={() => applyStatus("on_sale")}
        >
          {translate(
            "inv.products.bulk.markOnSale",
            { ns: "inv" },
            "Mark on sale"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isMutating}
          onClick={() => applyStatus("stopped")}
        >
          {translate(
            "inv.products.bulk.markStopped",
            { ns: "inv" },
            "Discontinue"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleExport}
        >
          {translate("inv.common.exportSelected", { ns: "inv" }, "Export selected")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={isMutating}
          onClick={removeSelected}
        >
          {translate("buttons.delete", "Delete")}
        </Button>
      </BulkActionBar>

      <ActivityBadgeGroup
        windowDays={ANALYSIS_WINDOW_DAYS}
        isLoading={movements.isLoading}
        isError={movements.isError}
        onRetry={movements.refetch}
      />

      <div ref={tableContext.ref}>
        <InventoryTable
          table={table}
          density={preferences.density}
          onRowClick={(row) => navigate(`/goods/products/show/${row.id}`)}
          emptyTitle={translate(
            "inv.products.empty.title",
            { ns: "inv" },
            "No products in this view"
          )}
          emptyDescription={translate(
            "inv.products.empty.description",
            { ns: "inv" },
            "Switch saved view, clear the search, or create a new product."
          )}
          emptyAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveView("all")}
            >
              {translate("inv.products.view.all", { ns: "inv" }, "All SKUs")}
            </Button>
          }
        />
      </div>
    </ListView>
  );
};
