import { useGetLocale, useList, useNotification, useTranslate } from "@refinedev/core";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FolderTree,
  Layers,
  Pencil,
  PackageSearch,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { KpiBar, type KpiItem } from "@/components/inventory/kpi-bar";
import {
  ExportCsvButton,
  ListToolbar,
  TableSearchInput,
} from "@/components/inventory/list-toolbar";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inventoryValue, isTracked, stockHealth } from "@/lib/inventory/analytics";
import { exportCsv } from "@/lib/inventory/csv";
import { formatCurrency, formatNumber } from "@/lib/inventory/format";
import type { CategoryRecord, ProductRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { useSearchTerm } from "@/lib/inventory/view-state";
import { cn } from "@/lib/utils";

type CategoryNode = CategoryRecord & {
  depth: number;
  childIds: number[];
  /** Own SKUs plus everything underneath — the number a buyer actually wants. */
  rollupSkus: number;
  rollupValue: number;
  rollupShortages: number;
  directSkus: number;
};

export const CategoryList = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const notification = useNotification();
  const [search, setSearch] = useSearchTerm();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const { result: categoriesResult, query: categoriesQuery } =
    useList<CategoryRecord>({
      resource: "scm_product_categories",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
    });
  const categories = useMemo(
    () => categoriesResult?.data ?? [],
    [categoriesResult?.data]
  );

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: { mode: "server", currentPage: 1, pageSize: 500 },
      errorNotification: false,
      queryOptions: { retry: false },
    });
  const products = useMemo(
    () => productsResult?.data ?? [],
    [productsResult?.data]
  );

  const directStats = useMemo(() => {
    const map = new Map<
      number,
      { skus: number; value: number; shortages: number }
    >();
    let uncategorized = 0;
    for (const product of products) {
      const categoryId = Number(
        product.category?.id ?? product.categoryId ?? product.category_id ?? 0
      );
      if (!categoryId) {
        uncategorized += 1;
        continue;
      }
      const entry = map.get(categoryId) ?? { skus: 0, value: 0, shortages: 0 };
      entry.skus += 1;
      entry.value += inventoryValue(product);
      const health = stockHealth(product);
      if (isTracked(product) && (health === "out" || health === "low")) {
        entry.shortages += 1;
      }
      map.set(categoryId, entry);
    }
    return { map, uncategorized };
  }, [products]);

  /** Depth-first flattening keeps the tree renderable inside a plain table. */
  const nodes = useMemo<CategoryNode[]>(() => {
    const childrenOf = new Map<number, CategoryRecord[]>();
    for (const category of categories) {
      const parentId = Number(category.parentId ?? 0);
      const list = childrenOf.get(parentId) ?? [];
      list.push(category);
      childrenOf.set(parentId, list);
    }

    const rollup = new Map<
      number,
      { skus: number; value: number; shortages: number }
    >();
    const computeRollup = (
      id: number
    ): { skus: number; value: number; shortages: number } => {
      const cached = rollup.get(id);
      if (cached) return cached;
      const own = directStats.map.get(id) ?? {
        skus: 0,
        value: 0,
        shortages: 0,
      };
      const total = { ...own };
      for (const child of childrenOf.get(id) ?? []) {
        const childTotals = computeRollup(child.id);
        total.skus += childTotals.skus;
        total.value += childTotals.value;
        total.shortages += childTotals.shortages;
      }
      rollup.set(id, total);
      return total;
    };

    const result: CategoryNode[] = [];
    const walk = (parentId: number, depth: number) => {
      const children = (childrenOf.get(parentId) ?? []).sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", locale)
      );
      for (const category of children) {
        const totals = computeRollup(category.id);
        result.push({
          ...category,
          depth,
          childIds: (childrenOf.get(category.id) ?? []).map((item) => item.id),
          rollupSkus: totals.skus,
          rollupValue: totals.value,
          rollupShortages: totals.shortages,
          directSkus: directStats.map.get(category.id)?.skus ?? 0,
        });
        walk(category.id, depth + 1);
      }
    };
    walk(0, 0);
    return result;
  }, [categories, directStats.map, locale]);

  const totalValue = useMemo(
    () => products.reduce((sum, product) => sum + inventoryValue(product), 0),
    [products]
  );

  const visibleNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = (node: CategoryNode) =>
      !term ||
      [node.name, node.code, node.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));

    if (term) return nodes.filter(matches);

    // Hide anything sitting under a collapsed ancestor.
    const hidden = new Set<number>();
    const result: CategoryNode[] = [];
    for (const node of nodes) {
      const parentId = Number(node.parentId ?? 0);
      if (hidden.has(parentId)) {
        hidden.add(node.id);
        continue;
      }
      result.push(node);
      if (collapsed.has(node.id)) hidden.add(node.id);
    }
    return result;
  }, [collapsed, nodes, search]);

  const toggleNode = useCallback((id: number) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    exportCsv("product-categories", nodes, [
      { header: "Level", value: (row) => row.depth + 1 },
      { header: "Name", value: (row) => row.name },
      { header: "Code", value: (row) => row.code ?? "" },
      { header: "SKUs (direct)", value: (row) => row.directSkus },
      { header: "SKUs (incl. sub)", value: (row) => row.rollupSkus },
      { header: "Stock value", value: (row) => row.rollupValue.toFixed(2) },
      { header: "SKUs to reorder", value: (row) => row.rollupShortages },
    ]);
    notification?.open?.({
      type: "success",
      message: translate(
        "inv.common.exportDone",
        { ns: "inv" },
        "Export downloaded"
      ),
    });
  }, [nodes, notification, translate]);

  const kpis = useMemo<KpiItem[]>(
    () => [
      {
        id: "categories",
        label: translate(
          "inv.categories.kpi.total",
          { ns: "inv" },
          "Categories"
        ),
        value: formatNumber(categories.length),
        icon: <FolderTree />,
      },
      {
        id: "roots",
        label: translate(
          "inv.categories.kpi.roots",
          { ns: "inv" },
          "Top level"
        ),
        value: formatNumber(nodes.filter((node) => node.depth === 0).length),
        icon: <Layers />,
      },
      {
        id: "skus",
        label: translate(
          "inv.categories.kpi.skus",
          { ns: "inv" },
          "Categorised SKUs"
        ),
        value: formatNumber(products.length - directStats.uncategorized),
        icon: <PackageSearch />,
      },
      {
        id: "uncategorized",
        label: translate(
          "inv.categories.kpi.uncategorized",
          { ns: "inv" },
          "Uncategorised SKUs"
        ),
        value: formatNumber(directStats.uncategorized),
        tone: directStats.uncategorized > 0 ? "warning" : "default",
        icon: <PackageSearch />,
      },
      {
        id: "value",
        label: translate(
          "inv.categories.kpi.value",
          { ns: "inv" },
          "Stock value"
        ),
        value: formatCurrency(totalValue, locale),
        icon: <Wallet />,
      },
    ],
    [
      categories.length,
      directStats.uncategorized,
      locale,
      nodes,
      products.length,
      totalValue,
      translate,
    ]
  );

  const pageContext = useAIPageElementHandle({
    id: "categories-tree",
    title: translate("inv.categories.ai.tree", { ns: "inv" }, "Category tree"),
    kind: "table",
    getContext: () => ({
      resource: "scm_product_categories",
      totalValue,
      uncategorized: directStats.uncategorized,
      nodes: nodes.map((node) => ({
        id: node.id,
        name: node.name,
        code: node.code,
        depth: node.depth,
        parentId: node.parentId,
        skus: node.rollupSkus,
        value: node.rollupValue,
        shortages: node.rollupShortages,
      })),
    }),
  });

  const isLoading = categoriesQuery.isLoading || productsQuery.isLoading;

  return (
    <ListView resource="scm_product_categories">
      <KpiBar items={kpis} loading={isLoading} className="xl:grid-cols-5" />

      <ListToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              setCollapsed((previous) =>
                previous.size > 0
                  ? new Set()
                  : new Set(nodes.filter((node) => node.childIds.length).map((n) => n.id))
              )
            }
          >
            {collapsed.size > 0
              ? translate(
                  "inv.categories.expandAll",
                  { ns: "inv" },
                  "Expand all"
                )
              : translate(
                  "inv.categories.collapseAll",
                  { ns: "inv" },
                  "Collapse all"
                )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={translate(
              "inv.categories.searchPlaceholder",
              { ns: "inv" },
              "Search category or code"
            )}
            className="w-full sm:w-72"
          />
          <ExportCsvButton onExport={handleExport} />
        </div>
      </ListToolbar>

      <div ref={pageContext.ref}>
        {categoriesQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.categories.detail.loadError.title",
                { ns: "inv" },
                "Unable to load categories"
              )}
            </AlertTitle>
            <AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => void categoriesQuery.refetch()}
              >
                {translate("inv.common.retry", { ns: "inv" }, "Retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : visibleNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            {translate(
              "inv.categories.empty",
              { ns: "inv" },
              "No category matches this search."
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table style={{ tableLayout: "fixed", width: "100%" }}>
              <TableHeader className="bg-muted/45">
                <TableRow>
                  <TableHead className="w-[32%] min-w-56">
                    {translate(
                      "inv.categories.fields.name",
                      { ns: "inv" },
                      "Category"
                    )}
                  </TableHead>
                  <TableHead className="w-28">
                    {translate(
                      "inv.categories.fields.directSkus",
                      { ns: "inv" },
                      "Direct SKUs"
                    )}
                  </TableHead>
                  <TableHead className="w-28">
                    {translate(
                      "inv.categories.fields.rollupSkus",
                      { ns: "inv" },
                      "Incl. sub"
                    )}
                  </TableHead>
                  <TableHead className="w-52">
                    {translate(
                      "inv.categories.fields.valueShare",
                      { ns: "inv" },
                      "Stock value / share"
                    )}
                  </TableHead>
                  <TableHead className="w-28">
                    {translate(
                      "inv.categories.fields.shortages",
                      { ns: "inv" },
                      "To reorder"
                    )}
                  </TableHead>
                  <TableHead className="w-32">
                    {translate("inv.common.actions", { ns: "inv" }, "Actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNodes.map((node) => {
                  const share =
                    totalValue > 0 ? node.rollupValue / totalValue : 0;
                  const isCollapsed = collapsed.has(node.id);
                  return (
                    <TableRow key={node.id} className="group/row">
                      <TableCell className="whitespace-normal">
                        <div
                          className="flex min-w-0 items-center gap-1"
                          style={{ paddingLeft: node.depth * 18 }}
                        >
                          {node.childIds.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleNode(node.id)}
                              aria-label={
                                isCollapsed
                                  ? translate(
                                      "inv.categories.expand",
                                      { ns: "inv" },
                                      "Expand"
                                    )
                                  : translate(
                                      "inv.categories.collapse",
                                      { ns: "inv" },
                                      "Collapse"
                                    )
                              }
                              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-[18px]" />
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-full cursor-pointer truncate text-left font-medium hover:underline"
                              onClick={() =>
                                navigate(`/goods/categories/show/${node.id}`)
                              }
                            >
                              {node.name}
                            </button>
                            {node.code ? (
                              <code className="block truncate text-xs text-muted-foreground">
                                {node.code}
                              </code>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatNumber(node.directSkus)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatNumber(node.rollupSkus)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm tabular-nums">
                            {formatCurrency(node.rollupValue, locale)}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {Math.round(share * 100)}%
                            </span>
                          </span>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--brand-1)]"
                              style={{
                                width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "tabular-nums",
                            node.rollupShortages > 0 &&
                              "font-semibold text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {formatNumber(node.rollupShortages)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover/row:opacity-100">
                          <ShowButton
                            resource="scm_product_categories"
                            recordItemId={node.id}
                            variant="ghost"
                            size="icon"
                            aria-label={translate("buttons.show", "View")}
                            title={translate("buttons.show", "View")}
                          >
                            <Eye />
                          </ShowButton>
                          <EditButton
                            resource="scm_product_categories"
                            recordItemId={node.id}
                            variant="ghost"
                            size="icon"
                            aria-label={translate("buttons.edit", "Edit")}
                            title={translate("buttons.edit", "Edit")}
                          >
                            <Pencil />
                          </EditButton>
                          <DeleteButton
                            resource="scm_product_categories"
                            recordItemId={node.id}
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            aria-label={translate("buttons.delete", "Delete")}
                            title={translate("buttons.delete", "Delete")}
                          >
                            <Trash2 />
                          </DeleteButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </ListView>
  );
};
