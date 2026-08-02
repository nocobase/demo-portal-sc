import { useGetLocale, useShow, useTranslate } from "@refinedev/core";
import { RotateCw } from "lucide-react";
import { useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatDateTime, formatNumber } from "@/lib/inventory/format";
import { MOVEMENT_TYPES } from "@/lib/inventory/constants";
import type { StockMovementRecord } from "@/lib/inventory/types";

export const StockMovementShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const nestedDrawer = useOutlet();
  const { id } = useParams<{ id: string }>();
  const { result: record, query } = useShow<StockMovementRecord>({
    resource: "scm_stock_movements",
    id,
    meta: {
      appends: ["product"],
    },
  });

  const quantity = Number(record?.quantity ?? 0);
  const isIn = ["purchase_in", "return_in", "initial"].includes(
    record?.type ?? ""
  );

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.product?.name ?? "-"
        )
      }
      description={translate(
        "inv.movements.drawer.show.description",
        { ns: "inv" },
        "Stock movement details"
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/stock/movements"
      nested={nestedDrawer}
      actions={
        record ? (
          <RefreshButton
            resource="scm_stock_movements"
            recordItemId={record.id}
            variant="outline"
            size="icon-sm"
            aria-label={translate("buttons.refresh", "Refresh")}
            title={translate("buttons.refresh", "Refresh")}
          >
            <RotateCw />
          </RefreshButton>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.movements.detail.loadError.title",
                { ns: "inv" },
                "Unable to load movement"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <OptionBadge
                  options={MOVEMENT_TYPES}
                  value={record.type}
                  locale={locale}
                />
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(record.occurredAt, locale)}
                </span>
              </div>
              <span
                className={
                  "text-xl font-semibold " +
                  (isIn
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground")
                }
              >
                {isIn ? "+" : "-"}
                {formatNumber(Math.abs(quantity))}
              </span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label={translate("inv.movements.fields.product", { ns: "inv" }, "Product")}
                value={
                  record.product ? (
                    <button
                      type="button"
                      className="cursor-pointer font-medium text-foreground hover:underline"
                      onClick={() => navigate(`products/${record.product?.id}`)}
                    >
                      {record.product.name}
                    </button>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailItem
                label={translate("inv.movements.fields.referenceNo", { ns: "inv" }, "Reference No.")}
                value={record.referenceNo || "-"}
              />
              <DetailItem
                label={translate("inv.movements.fields.beforeStock", { ns: "inv" }, "Stock before")}
                value={formatNumber(record.beforeStock)}
              />
              <DetailItem
                label={translate("inv.movements.fields.afterStock", { ns: "inv" }, "Stock after")}
                value={formatNumber(record.afterStock)}
              />
              <DetailItem
                label={translate("inv.movements.fields.handler", { ns: "inv" }, "Handler")}
                value={record.handler || "-"}
              />
              <DetailItem
                label={translate("inv.movements.fields.occurredAt", { ns: "inv" }, "Occurred at")}
                value={formatDateTime(record.occurredAt, locale)}
              />
            </dl>

            {record.remark ? (
              <>
                <Separator />
                <section className="space-y-1">
                  <h3 className="text-sm font-medium">
                    {translate("inv.movements.fields.remark", { ns: "inv" }, "Remarks")}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {record.remark}
                  </p>
                </section>
              </>
            ) : null}
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
