import { useTranslate, type BaseRecord, type HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { flexRender } from "@tanstack/react-table";
import { Inbox, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getCommonStyles } from "@/components/data-table/data-table-styles";
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
import type { TableDensity } from "@/lib/inventory/view-state";
import { cn } from "@/lib/utils";

type InventoryTableProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
  density?: TableDensity;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: TData) => void;
};

const densityCell: Record<TableDensity, string> = {
  compact: "py-1",
  comfortable: "py-2.5",
};

/**
 * The list surface shared by every inventory page. It adds what the base
 * DataTable does not cover: density, a real error state with retry, an empty
 * state that can carry a call to action, and row hover affordances.
 */
export function InventoryTable<TData extends BaseRecord>({
  table,
  density = "comfortable",
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
}: InventoryTableProps<TData>) {
  const translate = useTranslate();
  const {
    reactTable: { getHeaderGroups, getRowModel, getAllColumns },
    refineCore: {
      tableQuery,
      currentPage,
      setCurrentPage,
      pageCount,
      pageSize,
      setPageSize,
    },
  } = table;

  const columns = getAllColumns();
  const leafColumns = table.reactTable.getVisibleLeafColumns();
  const isLoading = tableQuery.isLoading;
  const hasError = isError ?? tableQuery.isError;

  // Keep row actions reachable on wide tables.
  useEffect(() => {
    if (!leafColumns.some((column) => column.id === "actions")) return;
    const pinned = table.reactTable.getState().columnPinning;
    if (pinned?.right?.includes("actions")) return;
    table.reactTable.setColumnPinning((previous) => ({
      ...previous,
      right: ["actions"],
    }));
  }, [leafColumns, table]);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({
    horizontal: false,
    vertical: false,
  });

  useEffect(() => {
    const checkOverflow = () => {
      if (!tableRef.current || !containerRef.current) return;
      setIsOverflowing({
        horizontal:
          tableRef.current.offsetWidth > containerRef.current.clientWidth,
        vertical:
          tableRef.current.offsetHeight > containerRef.current.clientHeight,
      });
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    const timeoutId = setTimeout(checkOverflow, 100);
    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [tableQuery.data?.data, pageSize, density]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
        <TriangleAlert className="size-8 text-destructive" />
        <div className="text-base font-semibold">
          {translate(
            "inv.common.loadError.title",
            { ns: "inv" },
            "Could not load this list"
          )}
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          {translate(
            "inv.common.loadError.description",
            { ns: "inv" },
            "The request failed or you lack permission on this collection."
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (onRetry ? onRetry() : void tableQuery.refetch())}
        >
          <RotateCw className="size-3.5" />
          {translate("inv.common.retry", { ns: "inv" }, "Retry")}
        </Button>
      </div>
    );
  }

  const rows = getRowModel().rows;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <Table ref={tableRef} style={{ tableLayout: "fixed", width: "100%" }}>
          <TableHeader className="bg-muted/45">
            {getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={getCommonStyles({
                      column: header.column,
                      isOverflowing,
                    })}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              Array.from({ length: pageSize < 1 ? 1 : Math.min(pageSize, 10) }).map(
                (_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`} aria-hidden="true">
                    {leafColumns.map((column) => (
                      <TableCell
                        key={`skeleton-${rowIndex}-${column.id}`}
                        style={getCommonStyles({ column, isOverflowing })}
                        className={densityCell[density]}
                      >
                        <Skeleton className="h-4 w-full max-w-[75%]" />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              )
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.original?.id ?? row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "group/row",
                    onRowClick && "cursor-pointer",
                    row.getIsSelected() && "bg-accent/40"
                  )}
                  onClick={
                    onRowClick
                      ? (event) => {
                          // Let checkboxes, links and row buttons win the click.
                          if (
                            (event.target as HTMLElement).closest(
                              "button, a, input, [role='checkbox']"
                            )
                          ) {
                            return;
                          }
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={getCommonStyles({
                        column: cell.column,
                        isOverflowing,
                      })}
                      className={densityCell[density]}
                    >
                      <div className="truncate">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-80 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="size-8 text-muted-foreground/60" />
                    <div className="text-base font-semibold">
                      {emptyTitle ??
                        translate(
                          "inv.common.empty.title",
                          { ns: "inv" },
                          "Nothing matches this view"
                        )}
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {emptyDescription ??
                        translate(
                          "inv.common.empty.description",
                          { ns: "inv" },
                          "Clear the filters or switch to another saved view."
                        )}
                    </p>
                    {emptyAction ? <div className="mt-2">{emptyAction}</div> : null}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && rows.length > 0 ? (
        <DataTablePagination
          currentPage={currentPage}
          pageCount={pageCount}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={tableQuery.data?.total}
        />
      ) : null}
    </div>
  );
}

/** Selection cell shared by the list pages that support bulk actions. */
export function RowSelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-3.5 cursor-pointer accent-primary align-middle"
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
