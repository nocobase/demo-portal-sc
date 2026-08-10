import { useSyncExternalStore } from "react";

export type RecentRecord = {
  resource: string;
  id: string;
  label: string;
  sublabel?: string;
  /** Absolute in-app path to the record's detail surface. */
  path: string;
  viewedAt: string;
};

const STORAGE_KEY = "sc-inventory:recent-records";
const MAX_STORED_RECORDS = 20;
const listeners = new Set<() => void>();
let fallbackRecords: RecentRecord[] = [];

function isRecentRecord(value: unknown): value is RecentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecentRecord>;
  return (
    typeof record.resource === "string" &&
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    (record.sublabel === undefined || typeof record.sublabel === "string") &&
    typeof record.path === "string" &&
    typeof record.viewedAt === "string"
  );
}

function readRecords(): RecentRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      fallbackRecords = [];
      return fallbackRecords;
    }
    const parsed: unknown = JSON.parse(stored);
    fallbackRecords = Array.isArray(parsed)
      ? parsed.filter(isRecentRecord).slice(0, MAX_STORED_RECORDS)
      : [];
    return fallbackRecords;
  } catch {
    return fallbackRecords;
  }
}

let recordsSnapshot = readRecords();

function sameRecord(left: RecentRecord, right: RecentRecord): boolean {
  return (
    left.resource === right.resource &&
    left.id === right.id &&
    left.label === right.label &&
    left.sublabel === right.sublabel &&
    left.path === right.path &&
    left.viewedAt === right.viewedAt
  );
}

function sameList(left: RecentRecord[], right: RecentRecord[]): boolean {
  return (
    left.length === right.length &&
    left.every((record, index) => sameRecord(record, right[index]))
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RecentRecord[] {
  return recordsSnapshot;
}

export function pushRecentRecord(
  record: Omit<RecentRecord, "viewedAt">
): void {
  const current = readRecords();
  const existing = current.find(
    (item) => item.resource === record.resource && item.id === record.id
  );
  const reordered = [
    { ...record, viewedAt: existing?.viewedAt ?? "" },
    ...current.filter(
      (item) => item.resource !== record.resource || item.id !== record.id
    ),
  ].slice(0, MAX_STORED_RECORDS);

  if (sameList(current, reordered)) return;

  const next = [
    { ...record, viewedAt: new Date().toISOString() },
    ...reordered.slice(1),
  ];
  fallbackRecords = next;
  recordsSnapshot = next;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory snapshot remains usable when storage is unavailable.
  }

  listeners.forEach((listener) => listener());
}

export function useRecentRecords(limit = 8): RecentRecord[] {
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 8;
  return records.slice(0, safeLimit);
}
