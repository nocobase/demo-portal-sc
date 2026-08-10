import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { CrudFilter } from "@refinedev/core";

const STORAGE_PREFIX = "sc-inventory";

/**
 * Column layout, density and page size are per-user workspace settings, so they
 * live in localStorage rather than in the URL.
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, (value: T | ((previous: T) => T)) => void] {
  const storageKey = `${STORAGE_PREFIX}:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Private-mode browsers reject writes; the in-memory state still works.
    }
  }, [storageKey, value]);

  return [value, setValue];
}

export type TableDensity = "compact" | "comfortable";

export type TablePreferences = {
  hiddenColumns: string[];
  density: TableDensity;
};

export const DEFAULT_TABLE_PREFERENCES: TablePreferences = {
  hiddenColumns: [],
  density: "comfortable",
};

export function useTablePreferences(key: string, defaults?: string[]) {
  const [preferences, setPreferences] = usePersistentState<TablePreferences>(
    `table:${key}`,
    { ...DEFAULT_TABLE_PREFERENCES, hiddenColumns: defaults ?? [] }
  );

  const toggleColumn = useCallback(
    (columnId: string) =>
      setPreferences((previous) => ({
        ...previous,
        hiddenColumns: previous.hiddenColumns.includes(columnId)
          ? previous.hiddenColumns.filter((id) => id !== columnId)
          : [...previous.hiddenColumns, columnId],
      })),
    [setPreferences]
  );

  const setDensity = useCallback(
    (density: TableDensity) =>
      setPreferences((previous) => ({ ...previous, density })),
    [setPreferences]
  );

  const resetColumns = useCallback(
    () =>
      setPreferences((previous) => ({
        ...previous,
        hiddenColumns: defaults ?? [],
      })),
    [defaults, setPreferences]
  );

  const columnVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    preferences.hiddenColumns.forEach((id) => {
      visibility[id] = false;
    });
    return visibility;
  }, [preferences.hiddenColumns]);

  return {
    preferences,
    columnVisibility,
    toggleColumn,
    setDensity,
    resetColumns,
  };
}

/**
 * A saved view is a named filter set. Built-in views ship with the page; the
 * filters they carry are handed straight to Refine so paging and totals stay
 * server-side.
 */
export type SavedView = {
  id: string;
  labelKey: string;
  labelFallback: string;
  filters: CrudFilter[];
  /** Views whose filters depend on values computed in the browser. */
  clientResolved?: boolean;
  description?: string;
};

/** The active view id lives in the URL so a filtered list can be shared. */
export function useActiveView(defaultView: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get("view") ?? defaultView;

  const setActiveView = useCallback(
    (view: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (view === defaultView) next.delete("view");
          else next.set("view", view);
          return next;
        },
        { replace: true }
      );
    },
    [defaultView, setSearchParams]
  );

  return [activeView, setActiveView] as const;
}

/** Free-text search term, also mirrored into the URL for shareable links. */
export function useSearchTerm(param = "q") {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get(param) ?? "";

  const setTerm = useCallback(
    (value: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (!value) next.delete(param);
          else next.set(param, value);
          return next;
        },
        { replace: true }
      );
    },
    [param, setSearchParams]
  );

  return [term, setTerm] as const;
}
