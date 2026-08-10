import { useCallback, useEffect, useSyncExternalStore } from "react";

// The list publishes its ordered ids because the routed drawer cannot reconstruct its filters and sorting.
const STORAGE_PREFIX = "sc-inventory:record-context:";
const EMPTY_IDS: string[] = [];
const recordIds = new Map<string, string[]>();
const listeners = new Map<string, Set<() => void>>();

function readRecordIds(resource: string): string[] {
  const cached = recordIds.get(resource);
  if (cached) return cached;

  let ids = EMPTY_IDS;
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${resource}`);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) ids = parsed.map(String);
  } catch {
    ids = EMPTY_IDS;
  }

  recordIds.set(resource, ids);
  return ids;
}

function subscribe(resource: string, listener: () => void): () => void {
  const resourceListeners = listeners.get(resource) ?? new Set<() => void>();
  resourceListeners.add(listener);
  listeners.set(resource, resourceListeners);

  return () => {
    resourceListeners.delete(listener);
    if (resourceListeners.size === 0) listeners.delete(resource);
  };
}

// Ignore shortcuts intended for browser commands or editable fields.
function shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches("input, textarea, select")
  );
}

export function setRecordContext(
  resource: string,
  ids: Array<number | string>
): void {
  const nextIds = ids.map(String);
  const serialized = JSON.stringify(nextIds);
  const cachedValue = JSON.stringify(readRecordIds(resource));
  let storedValue: string | null = null;
  let storageAvailable = false;

  try {
    storedValue = sessionStorage.getItem(`${STORAGE_PREFIX}${resource}`);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }

  if (
    cachedValue === serialized &&
    (!storageAvailable || storedValue === serialized)
  ) return;

  if (!storageAvailable || storedValue !== serialized) {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${resource}`, serialized);
    } catch {
      // The in-memory value remains available when storage is blocked.
    }
  }
  if (cachedValue !== serialized) {
    recordIds.set(resource, nextIds);
    listeners.get(resource)?.forEach((listener) => listener());
  }
}

export function useRecordNavigation(
  resource: string,
  currentId?: string | number
): {
  previousId?: string | number;
  nextId?: string | number;
  /** 1-based position of the current record, 0 when it is not in the set. */
  position: number;
  total: number;
} {
  const subscribeToResource = useCallback(
    (listener: () => void) => subscribe(resource, listener),
    [resource]
  );
  const getSnapshot = useCallback(() => readRecordIds(resource), [resource]);
  const ids = useSyncExternalStore(
    subscribeToResource,
    getSnapshot,
    () => EMPTY_IDS
  );
  const index = currentId === undefined ? -1 : ids.indexOf(String(currentId));

  if (index === -1) {
    return {
      previousId: undefined,
      nextId: undefined,
      position: 0,
      total: ids.length,
    };
  }

  return {
    previousId: ids[index - 1],
    nextId: ids[index + 1],
    position: index + 1,
    total: ids.length,
  };
}

export function useRecordKeyboardNavigation(options: {
  onPrevious?: () => void;
  onNext?: () => void;
  onEdit?: () => void;
  enabled?: boolean;
}): void {
  const { onPrevious, onNext, onEdit, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event)) return;

      const key = event.key.toLowerCase();
      const action =
        key === "k" || key === "arrowup"
          ? onPrevious
          : key === "j" || key === "arrowdown"
            ? onNext
            : key === "e"
              ? onEdit
              : undefined;

      if (!action) return;
      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onEdit, onNext, onPrevious]);
}
