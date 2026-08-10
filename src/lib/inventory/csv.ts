export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
  }
  return lines.join("\r\n");
}

/** Prefix a BOM so Excel opens non-ASCII exports in the right encoding. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[]
): void {
  downloadCsv(csvFilename(filename), toCsv(rows, columns));
}

/** `products` becomes `products-2026-08-09.csv`. */
export function csvFilename(base: string, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `${base}-${stamp}.csv`;
}
