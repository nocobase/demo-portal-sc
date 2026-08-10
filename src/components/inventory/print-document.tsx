import { useTranslate } from "@refinedev/core";
import type React from "react";

import { formatDateTime } from "@/lib/inventory/format";
import { cn } from "@/lib/utils";

export function PrintDocumentHeader(props: {
  /** Document type, e.g. "Stock Movement Voucher". */
  title: string;
  /** The business document number, printed large. */
  documentNo?: string | null;
  /** Label/value pairs printed in a two-column grid under the title. */
  meta?: Array<{ label: string; value: React.ReactNode }>;
}): React.ReactElement {
  const translate = useTranslate();
  const printedAt = formatDateTime(new Date().toISOString());

  return (
    <header className={cn("print-only space-y-4 border-b pb-4")}>
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.documentNo ? (
          <div className="mt-1 text-xl font-medium tabular-nums">
            {props.documentNo}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {translate(
            "inv.print.printedAt",
            { ns: "inv", datetime: printedAt },
            "Printed at {{datetime}}"
          )}
        </p>
      </div>
      {props.meta?.length ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {props.meta.map((item, index) => (
            <div key={`${item.label}-${index}`} className="contents">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export function PrintSignatureRow(props: {
  labels: string[];
}): React.ReactElement {
  return (
    <div className={cn("print-only pt-8")}>
      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: `repeat(${props.labels.length}, minmax(0, 1fr))`,
        }}
      >
        {props.labels.map((label) => (
          <div key={label} className="text-sm">
            <div>{label}</div>
            <div className="h-12 border-b" />
          </div>
        ))}
      </div>
    </div>
  );
}
