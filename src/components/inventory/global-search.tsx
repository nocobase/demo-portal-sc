import { useList, useTranslate } from "@refinedev/core";
import {
  ClipboardCheck,
  PackageCheck,
  PackageSearch,
  Search,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useRecentRecords } from "@/lib/inventory/recent-records";
import type {
  InventoryCountRecord,
  ProductRecord,
  StockMovementRecord,
  SupplierRecord,
} from "@/lib/inventory/types";

const QUERY_PAGINATION = {
  mode: "server",
  currentPage: 1,
  pageSize: 5,
} as const;

export function GlobalSearch(): React.ReactElement {
  const translate = useTranslate();
  const navigate = useNavigate();
  const recentRecords = useRecentRecords(8);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const rawTerm = term.trim();
  const searchTerm = debouncedTerm.trim();
  const queryEnabled = searchTerm.length >= 2;
  const searchEnabled = rawTerm.length >= 2 && queryEnabled;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedTerm(term), 250);
    return () => window.clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const { result: productsResult, query: productsQuery } =
    useList<ProductRecord>({
      resource: "scm_products",
      pagination: QUERY_PAGINATION,
      filters: [
        {
          operator: "or",
          value: [
            { field: "name", operator: "contains", value: searchTerm },
            { field: "sku", operator: "contains", value: searchTerm },
            { field: "barcode", operator: "contains", value: searchTerm },
          ],
        },
      ],
      errorNotification: false,
      queryOptions: { enabled: queryEnabled, retry: false },
    });
  const { result: suppliersResult, query: suppliersQuery } =
    useList<SupplierRecord>({
      resource: "scm_suppliers",
      pagination: QUERY_PAGINATION,
      filters: [
        {
          operator: "or",
          value: [
            { field: "name", operator: "contains", value: searchTerm },
            { field: "code", operator: "contains", value: searchTerm },
            { field: "contact", operator: "contains", value: searchTerm },
          ],
        },
      ],
      errorNotification: false,
      queryOptions: { enabled: queryEnabled, retry: false },
    });
  const { result: countsResult, query: countsQuery } =
    useList<InventoryCountRecord>({
      resource: "scm_inventory_counts",
      pagination: QUERY_PAGINATION,
      filters: [
        {
          operator: "or",
          value: [
            { field: "countNo", operator: "contains", value: searchTerm },
            { field: "countBy", operator: "contains", value: searchTerm },
          ],
        },
      ],
      errorNotification: false,
      queryOptions: { enabled: queryEnabled, retry: false },
    });
  const { result: movementsResult, query: movementsQuery } =
    useList<StockMovementRecord>({
      resource: "scm_stock_movements",
      pagination: QUERY_PAGINATION,
      filters: [
        {
          operator: "or",
          value: [
            { field: "referenceNo", operator: "contains", value: searchTerm },
            { field: "handler", operator: "contains", value: searchTerm },
          ],
        },
      ],
      errorNotification: false,
      queryOptions: { enabled: queryEnabled, retry: false },
    });

  const products = productsResult?.data ?? [];
  const suppliers = suppliersResult?.data ?? [];
  const counts = countsResult?.data ?? [];
  const movements = movementsResult?.data ?? [];
  const isDebouncing = rawTerm.length >= 2 && rawTerm !== searchTerm;
  const isSearching =
    isDebouncing ||
    (searchEnabled &&
      [productsQuery, suppliersQuery, countsQuery, movementsQuery].some(
        (query) => query.isFetching
      ));
  const hasResults =
    products.length > 0 ||
    suppliers.length > 0 ||
    counts.length > 0 ||
    movements.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setTerm("");
      setDebouncedTerm("");
    }
  };

  const selectRecord = (path: string) => {
    handleOpenChange(false);
    navigate(path);
  };

  const recentIcon = (resource: string) => {
    if (resource === "scm_products") return <PackageSearch />;
    if (resource === "scm_suppliers") return <Truck />;
    if (resource === "scm_inventory_counts") return <ClipboardCheck />;
    return <PackageCheck />;
  };

  const placeholder = translate(
    "inv.search.placeholder",
    { ns: "inv" },
    "Search products, suppliers, counts…"
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={placeholder}
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className="hidden md:inline">{placeholder}</span>
        <Kbd className="ml-1 hidden md:inline-flex">
          {translate("inv.search.shortcut", { ns: "inv" }, "⌘K")}
        </Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={placeholder}
        description={translate(
          "inv.search.hint",
          { ns: "inv" },
          "Type at least 2 characters to search products, suppliers, count sheets and movements."
        )}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={term}
            onValueChange={setTerm}
            placeholder={placeholder}
          />
          <CommandList>
            {rawTerm.length === 0 && recentRecords.length > 0 ? (
              <CommandGroup
                heading={translate(
                  "inv.search.recent",
                  { ns: "inv" },
                  "Recently viewed"
                )}
              >
                {recentRecords.map((record) => (
                  <CommandItem
                    key={`${record.resource}-${record.id}`}
                    value={`${record.resource}-${record.id}`}
                    onSelect={() => selectRecord(record.path)}
                  >
                    {recentIcon(record.resource)}
                    <span className="min-w-0 flex-1 truncate">
                      {record.label}
                    </span>
                    {record.sublabel ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {record.sublabel}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {rawTerm.length < 2 &&
            (rawTerm.length > 0 || recentRecords.length === 0) ? (
              <CommandEmpty>
                {translate(
                  "inv.search.hint",
                  { ns: "inv" },
                  "Type at least 2 characters to search products, suppliers, count sheets and movements."
                )}
              </CommandEmpty>
            ) : null}

            {isSearching ? (
              <CommandEmpty>
                {translate(
                  "inv.search.searching",
                  { ns: "inv" },
                  "Searching…"
                )}
              </CommandEmpty>
            ) : null}

            {searchEnabled && !isSearching ? (
              <>
                {products.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "inv.search.group.products",
                      { ns: "inv" },
                      "Products"
                    )}
                  >
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={`product-${product.id}`}
                        onSelect={() =>
                          selectRecord(`/goods/products/show/${product.id}`)
                        }
                      >
                        <PackageSearch />
                        <span className="min-w-0 flex-1 truncate">
                          {product.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {product.sku}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {suppliers.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "inv.search.group.suppliers",
                      { ns: "inv" },
                      "Suppliers"
                    )}
                  >
                    {suppliers.map((supplier) => (
                      <CommandItem
                        key={supplier.id}
                        value={`supplier-${supplier.id}`}
                        onSelect={() =>
                          selectRecord(`/goods/suppliers/show/${supplier.id}`)
                        }
                      >
                        <Truck />
                        <span className="min-w-0 flex-1 truncate">
                          {supplier.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {supplier.code}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {counts.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "inv.search.group.counts",
                      { ns: "inv" },
                      "Count sheets"
                    )}
                  >
                    {counts.map((count) => (
                      <CommandItem
                        key={count.id}
                        value={`count-${count.id}`}
                        onSelect={() =>
                          selectRecord(`/counting/counts/show/${count.id}`)
                        }
                      >
                        <ClipboardCheck />
                        <span className="min-w-0 flex-1 truncate">
                          {count.countNo ?? String(count.id)}
                        </span>
                        {count.countBy ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {count.countBy}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {movements.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "inv.search.group.movements",
                      { ns: "inv" },
                      "Stock movements"
                    )}
                  >
                    {movements.map((movement) => (
                      <CommandItem
                        key={movement.id}
                        value={`movement-${movement.id}`}
                        onSelect={() =>
                          selectRecord(`/stock/movements/show/${movement.id}`)
                        }
                      >
                        <PackageCheck />
                        <span className="min-w-0 flex-1 truncate">
                          {movement.referenceNo ?? String(movement.id)}
                        </span>
                        {movement.handler ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {movement.handler}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {!hasResults ? (
                  <CommandEmpty>
                    {translate(
                      "inv.search.noResults",
                      { term: searchTerm, ns: "inv" },
                      "No records match {{term}}."
                    )}
                  </CommandEmpty>
                ) : null}
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
