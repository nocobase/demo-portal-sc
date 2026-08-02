import { useGetLocale, useShow, useTranslate } from "@refinedev/core";
import { RotateCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { OptionBadge } from "@/components/inventory/option-badge";
import { formatDate, formatNumber } from "@/lib/inventory/format";
import { COUNT_SCOPES, COUNT_STATUS } from "@/lib/inventory/constants";
import type { InventoryCountRecord } from "@/lib/inventory/types";
import { useAIPageElementHandle } from "@/lib/inventory/ai-handle";
import { CountItemsPanel } from "./items-panel";

export const InventoryCountShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { id } = useParams<{ id: string }>();
  const [version, setVersion] = useState(0);
  const { result: record, query } = useShow<InventoryCountRecord>({
    resource: "scm_inventory_counts",
    id,
  });

  const onChanged = useCallback(() => {
    setVersion((value) => value + 1);
    void query.refetch();
  }, [query]);

  void version;

  const detailContext = useAIPageElementHandle({
    id: `inventory-counts-detail-${id ?? "current"}`,
    title: `${translate(
      "inv.counts.ai.detail",
      { ns: "inv" },
      "Count order details"
    )}: ${record?.countNo ?? record?.id ?? ""}`,
    kind: "detail",
    getContext: () => ({
      resource: "scm_inventory_counts",
      record: {
        id: record?.id,
        countNo: record?.countNo,
        scope: record?.scope,
        status: record?.status,
        countDate: record?.countDate,
        countBy: record?.countBy,
        totalItems: record?.totalItems,
        diffCount: record?.diffCount,
        remark: record?.remark,
      },
    }),
  });

  return (
    <RouteDrawer
      className="lg:w-[56vw] lg:min-w-[48rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.countNo ?? `#${record?.id ?? ""}`
        )
      }
      description={translate(
        "inv.counts.drawer.show.description",
        { ns: "inv" },
        "Enter counted quantities and complete the count; stock is adjusted automatically for each variance."
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/counting/counts"
      actions={
        record ? (
          <RefreshButton
            resource="scm_inventory_counts"
            recordItemId={record.id}
            variant="outline"
            size="icon-sm"
            aria-label={translate("buttons.refresh", "Refresh")}
            title={translate("buttons.refresh", "Refresh")}
            onClick={() => {
              void query.refetch();
            }}
          >
            <RotateCw />
          </RefreshButton>
        ) : null
      }
    >
      <div
        ref={detailContext.ref}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.counts.detail.loadError.title",
                { ns: "inv" },
                "Unable to load count order"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <OptionBadge
                options={COUNT_STATUS}
                value={record.status}
                locale={locale}
              />
              <OptionBadge
                options={COUNT_SCOPES}
                value={record.scope}
                locale={locale}
              />
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailItem
                label={translate(
                  "inv.counts.fields.countDate",
                  { ns: "inv" },
                  "Count date"
                )}
                value={formatDate(record.countDate, locale)}
              />
              <DetailItem
                label={translate("inv.counts.fields.countBy", { ns: "inv" }, "Counted by")}
                value={record.countBy || "-"}
              />
              <DetailItem
                label={translate(
                  "inv.counts.fields.diffCount",
                  { ns: "inv" },
                  "Diff items"
                )}
                value={formatNumber(record.diffCount)}
              />
            </dl>

            {record.remark ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {record.remark}
              </p>
            ) : null}

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-medium">
                {translate(
                  "inv.counts.items.title",
                  { ns: "inv" },
                  "Count items"
                )}
              </h3>
              <CountItemsPanel count={record} onChanged={onChanged} />
            </section>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
