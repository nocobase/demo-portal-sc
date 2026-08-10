import { useEffect, useRef } from "react";

import type { CrudFilter } from "@refinedev/core";

type SetFilters = (
  filters: CrudFilter[],
  behavior?: "merge" | "replace"
) => void;

/**
 * Refine seeds its filter state from the permanent filters once and afterwards
 * only unions the current permanent set into it. A saved view that changes the
 * permanent set therefore leaves the previous view's conditions behind in that
 * state, so the state is reset whenever the permanent set actually changes.
 * Column filters are cleared with it, which is what switching view should do.
 */
export function usePermanentFilterSync(
  permanentFilters: CrudFilter[],
  setFilters: SetFilters
) {
  const signature = JSON.stringify(permanentFilters);
  const previous = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previous.current === signature) return;
    previous.current = signature;
    setFilters([], "replace");
  }, [setFilters, signature]);
}
