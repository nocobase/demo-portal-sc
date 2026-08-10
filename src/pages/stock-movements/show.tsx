import { useGetLocale, useList, useShow, useTranslate } from "@refinedev/core";
import { ArrowRight, ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import {
  CopyLinkButton,
  DetailGrid,
  DetailItem,
  DetailSection,
  PrintButton,
} from "@/components/inventory/detail-scaffold";
import { OptionBadge } from "@/components/inventory/option-badge";
import {
  PrintDocumentHeader,
  PrintSignatureRow,
} from "@/components/inventory/print-document";
import { SignedQuantity } from "@/components/inventory/stock-indicators";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import {
  MOVEMENT_TYPES,
  optionLabel,
} from "@/lib/inventory/constants";
import { formatDateTime, formatNumber } from "@/lib/inventory/format";
import {
  useRecordKeyboardNavigation,
  useRecordNavigation,
} from "@/lib/inventory/record-context";
import { pushRecentRecord } from "@/lib/inventory/recent-records";
import type { StockMovementRecord } from "@/lib/inventory/types";
import {
  movementDisplayDirection,
  stockMovementDelta,
} from "@/lib/inventory/stock-movement";

type MovementDetail = StockMovementRecord & {
  createdBy?: { id: number; nickname?: string | null } | null;
};

export const StockMovementShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const nestedDrawer = useOutlet();
  const { id } = useParams<{ id: string }>();
  const navigation = useRecordNavigation("scm_stock_movements", id);
  const { result: record, query } = useShow<MovementDetail>({
    resource: "scm_stock_movements",
    id,
    meta: {
      appends: ["product", "createdBy"],
    },
  });

  useEffect(() => {
    if (!record?.id) return;
    pushRecentRecord({
      resource: "scm_stock_movements",
      id: String(record.id),
      label: record.referenceNo ?? String(record.id),
      sublabel: record.product?.name ?? undefined,
      path: `/stock/movements/show/${record.id}`,
    });
  }, [record?.id, record?.product?.name, record?.referenceNo]);

  // Surrounding movements make a single document reviewable in context: an
  // auditor checks that this line's opening balance matches the previous close.
  const { result: siblingsResult } = useList<StockMovementRecord>({
    resource: "scm_stock_movements",
    pagination: { mode: "server", currentPage: 1, pageSize: 8 },
    filters: record?.productId
      ? [{ field: "product_id", operator: "eq", value: record.productId }]
      : undefined,
    sorters: [{ field: "occurredAt", order: "desc" }],
    errorNotification: false,
    queryOptions: { enabled: Boolean(record?.productId), retry: false },
  });
  const siblings = useMemo(
    () => siblingsResult?.data ?? [],
    [siblingsResult?.data]
  );

  const quantity = Number(record?.quantity ?? 0);
  const direction = record ? movementDisplayDirection(record) : "flat";
  const delta = record ? stockMovementDelta(record) : 0;

  useRecordKeyboardNavigation({
    onPrevious:
      navigation.previousId === undefined
        ? undefined
        : () =>
            navigate(
              `/stock/movements/show/${navigation.previousId}${location.search}`
            ),
    onNext:
      navigation.nextId === undefined
        ? undefined
        : () =>
            navigate(
              `/stock/movements/show/${navigation.nextId}${location.search}`
            ),
  });

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.referenceNo ||
          `${optionLabel(MOVEMENT_TYPES, record?.type)} #${record?.id ?? ""}`
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
          <>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={navigation.previousId === undefined}
              aria-label={translate(
                "inv.nav.previousRecord",
                { ns: "inv" },
                "Previous record (K)"
              )}
              title={translate(
                "inv.nav.previousRecord",
                { ns: "inv" },
                "Previous record (K)"
              )}
              onClick={() =>
                navigate(
                  `/stock/movements/show/${navigation.previousId}${location.search}`
                )
              }
            >
              <ChevronUp />
            </Button>
            {navigation.total > 0 ? (
              <span className="px-1 text-xs tabular-nums text-muted-foreground">
                {translate(
                  "inv.nav.recordPosition",
                  {
                    ns: "inv",
                    position: navigation.position,
                    total: navigation.total,
                  },
                  "{{position}} / {{total}}"
                )}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={navigation.nextId === undefined}
              aria-label={translate(
                "inv.nav.nextRecord",
                { ns: "inv" },
                "Next record (J)"
              )}
              title={translate(
                "inv.nav.nextRecord",
                { ns: "inv" },
                "Next record (J)"
              )}
              onClick={() =>
                navigate(
                  `/stock/movements/show/${navigation.nextId}${location.search}`
                )
              }
            >
              <ChevronDown />
            </Button>
            <CopyLinkButton />
            <PrintButton />
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
          </>
        ) : null
      }
    >
      <div className="print-document min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
            <PrintDocumentHeader
              title={translate(
                "inv.print.movementVoucher",
                { ns: "inv" },
                "Stock Movement Voucher"
              )}
              documentNo={record.referenceNo}
              meta={[
                {
                  label: translate(
                    "inv.movements.fields.product",
                    { ns: "inv" },
                    "Product"
                  ),
                  value: record.product
                    ? `${record.product.name ?? "-"} (${record.product.sku ?? "-"})`
                    : "-",
                },
                {
                  label: translate(
                    "inv.movements.fields.type",
                    { ns: "inv" },
                    "Type"
                  ),
                  value: optionLabel(MOVEMENT_TYPES, record.type),
                },
                {
                  label: translate(
                    "inv.movements.fields.quantity",
                    { ns: "inv" },
                    "Quantity"
                  ),
                  value: formatNumber(record.quantity, locale),
                },
                {
                  label: translate(
                    "inv.movements.fields.beforeStock",
                    { ns: "inv" },
                    "Stock before"
                  ),
                  value: formatNumber(record.beforeStock, locale),
                },
                {
                  label: translate(
                    "inv.movements.fields.afterStock",
                    { ns: "inv" },
                    "Stock after"
                  ),
                  value: formatNumber(record.afterStock, locale),
                },
                {
                  label: translate(
                    "inv.movements.fields.occurredAt",
                    { ns: "inv" },
                    "Occurred at"
                  ),
                  value: formatDateTime(record.occurredAt, locale),
                },
                {
                  label: translate(
                    "inv.movements.fields.handler",
                    { ns: "inv" },
                    "Handler"
                  ),
                  value: record.handler || "-",
                },
              ]}
            />

            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                <SignedQuantity
                  quantity={quantity}
                  direction={direction}
                  className="text-xl"
                />
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm tabular-nums">
                <span className="text-muted-foreground">
                  {translate(
                    "inv.movements.fields.beforeStock",
                    { ns: "inv" },
                    "Stock before"
                  )}
                </span>
                <span className="font-medium">
                  {formatNumber(record.beforeStock)}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {translate(
                    "inv.movements.fields.afterStock",
                    { ns: "inv" },
                    "Stock after"
                  )}
                </span>
                <span className="font-semibold">
                  {formatNumber(record.afterStock)}
                </span>
                <span
                  className={
                    delta >= 0
                      ? "ml-auto text-emerald-600 dark:text-emerald-400"
                      : "ml-auto text-red-600 dark:text-red-400"
                  }
                >
                  {delta >= 0 ? "+" : ""}
                  {formatNumber(delta)}
                </span>
              </div>
            </div>

            <DetailSection
              title={translate(
                "inv.movements.detail.document",
                { ns: "inv" },
                "Document"
              )}
            >
              <DetailGrid>
                <DetailItem
                  label={translate(
                    "inv.movements.fields.product",
                    { ns: "inv" },
                    "Product"
                  )}
                  value={
                    record.product ? (
                      <button
                        type="button"
                        className="cursor-pointer font-medium text-foreground hover:underline"
                        onClick={() => navigate(`products/${record.product?.id}`)}
                      >
                        {record.product.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {record.product.sku}
                        </span>
                      </button>
                    ) : (
                      "-"
                    )
                  }
                />
                <DetailItem
                  label={translate(
                    "inv.movements.fields.referenceNo",
                    { ns: "inv" },
                    "Document no."
                  )}
                  value={record.referenceNo || "-"}
                />
                <DetailItem
                  label={translate(
                    "inv.movements.fields.handler",
                    { ns: "inv" },
                    "Handler"
                  )}
                  value={record.handler || "-"}
                />
                <DetailItem
                  label={translate(
                    "inv.movements.fields.occurredAt",
                    { ns: "inv" },
                    "Occurred at"
                  )}
                  value={formatDateTime(record.occurredAt, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.movements.fields.bookedAt",
                    { ns: "inv" },
                    "Booked into the system"
                  )}
                  value={formatDateTime(record.createdAt, locale)}
                />
                <DetailItem
                  label={translate(
                    "inv.movements.fields.bookedBy",
                    { ns: "inv" },
                    "Booked by"
                  )}
                  value={record.createdBy?.nickname || "-"}
                />
              </DetailGrid>
            </DetailSection>

            {record.remark ? (
              <>
                <Separator />
                <DetailSection
                  title={translate(
                    "inv.movements.fields.remark",
                    { ns: "inv" },
                    "Remarks"
                  )}
                >
                  <p className="text-sm leading-6 text-muted-foreground">
                    {record.remark}
                  </p>
                </DetailSection>
              </>
            ) : null}

            {siblings.length > 1 ? (
              <>
                <Separator className="print-hidden" />
                <DetailSection
                  className="print-hidden"
                  title={translate(
                    "inv.movements.detail.context",
                    { ns: "inv" },
                    "Recent movements for this product"
                  )}
                  action={
                    record.product ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          navigate(
                            `/goods/products/show/${record.product?.id}`
                          )
                        }
                      >
                        {translate(
                          "inv.movements.detail.openLedger",
                          { ns: "inv" },
                          "Open full ledger"
                        )}
                      </Button>
                    ) : null
                  }
                >
                  <ul className="divide-y rounded-xl border bg-card">
                    {siblings.map((movement) => {
                      return (
                        <li
                          key={movement.id}
                          className={
                            "flex items-center justify-between gap-3 px-4 py-2.5 text-sm" +
                            (movement.id === record.id ? " bg-accent/50" : "")
                          }
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <OptionBadge
                              options={MOVEMENT_TYPES}
                              value={movement.type}
                              locale={locale}
                            />
                            <span className="truncate text-xs text-muted-foreground">
                              {formatDateTime(movement.occurredAt, locale)}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatNumber(movement.beforeStock)} →{" "}
                              {formatNumber(movement.afterStock)}
                            </span>
                            <SignedQuantity
                              quantity={Number(movement.quantity ?? 0)}
                              direction={movementDisplayDirection(movement)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </DetailSection>
              </>
            ) : null}

            <PrintSignatureRow
              labels={[
                translate(
                  "inv.print.preparedBy",
                  { ns: "inv" },
                  "Prepared by"
                ),
                translate(
                  "inv.print.receivedBy",
                  { ns: "inv" },
                  "Received by"
                ),
                translate(
                  "inv.print.approvedBy",
                  { ns: "inv" },
                  "Approved by"
                ),
              ]}
            />
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};
