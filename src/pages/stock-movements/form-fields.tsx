import { useGetLocale, useList, useOne, useTranslate } from "@refinedev/core";
import { TriangleAlert } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EnumSelectField,
  RelationSelectField,
  useRelationOptions,
} from "@/components/inventory/form-selects";
import { StatTile } from "@/components/inventory/detail-scaffold";
import {
  MOVEMENT_TYPES,
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
  type OptionItem,
} from "@/lib/inventory/constants";
import { formatNumber } from "@/lib/inventory/format";
import {
  movementInputDelta,
  type AdjustmentDirection,
} from "@/lib/inventory/stock-movement";
import type { ProductRecord, StockMovementRecord } from "@/lib/inventory/types";

export type MovementFormValues = {
  productId?: number;
  type?: string;
  adjustmentDirection?: AdjustmentDirection;
  quantity?: number;
  referenceNo?: string;
  handler?: string;
  occurredAt?: string;
  remark?: string;
};

export const toDateTimeLocal = (value?: Date | string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

export const movementFormDefaultValues: MovementFormValues = {
  productId: undefined,
  type: "purchase_in",
  adjustmentDirection: "increase",
  quantity: undefined,
  referenceNo: "",
  handler: "",
  occurredAt: toDateTimeLocal(new Date()),
  remark: "",
};

const ADJUSTMENT_DIRECTIONS: OptionItem[] = [
  {
    value: "increase",
    i18nKey: "inv.movements.adjustment.increase",
    labelZh: "盘盈（增加库存）",
    labelEn: "Gain (increase stock)",
  },
  {
    value: "decrease",
    i18nKey: "inv.movements.adjustment.decrease",
    labelZh: "盘亏（减少库存）",
    labelEn: "Loss (decrease stock)",
  },
];

export function MovementFormFields({
  form,
  translate,
}: {
  form: UseFormReturn<MovementFormValues>;
  translate: ReturnType<typeof useTranslate>;
}) {
  const getLocale = useGetLocale();
  const locale = getLocale();
  const productOptions = useRelationOptions("scm_products", "name");
  const selectedType = form.watch("type");
  const adjustmentDirection = form.watch("adjustmentDirection") ?? "increase";
  const selectedProductId = form.watch("productId");
  const quantity = Number(form.watch("quantity") ?? 0);
  const referenceNo = form.watch("referenceNo");
  const isStockIn = STOCK_IN_TYPES.has(selectedType ?? "");
  const isStockOut = STOCK_OUT_TYPES.has(selectedType ?? "");
  const isAdjustment = selectedType === "adjustment";

  const { result: product } = useOne<ProductRecord>({
    resource: "scm_products",
    id: selectedProductId,
    errorNotification: false,
    queryOptions: { enabled: Boolean(selectedProductId), retry: false },
  });

  // Reusing a document number across movements is the classic data-entry slip,
  // so surface it before the movement is posted rather than after.
  const { result: duplicateResult } = useList<StockMovementRecord>({
    resource: "scm_stock_movements",
    pagination: { mode: "server", currentPage: 1, pageSize: 1 },
    filters: referenceNo
      ? [{ field: "referenceNo", operator: "eq", value: referenceNo }]
      : undefined,
    errorNotification: false,
    queryOptions: {
      enabled: Boolean(referenceNo && referenceNo.length >= 3),
      retry: false,
    },
  });
  const duplicateReference = (duplicateResult?.data?.length ?? 0) > 0;

  const currentStock = Number(product?.currentStock ?? 0);
  const signedDelta = selectedType
    ? movementInputDelta(selectedType, quantity, adjustmentDirection)
    : 0;
  const projectedStock = currentStock + signedDelta;
  const wouldGoNegative = signedDelta < 0 && projectedStock < 0;

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="productId"
        rules={{
          required: translate(
            "inv.movements.validation.product",
            { ns: "inv" },
            "Please choose a product"
          ),
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.movements.fields.product", { ns: "inv" }, "Product")}
            </FormLabel>
            <FormControl
              render={
                <RelationSelectField
                  options={productOptions.options}
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) =>
                    field.onChange(value ? Number(value) : undefined)
                  }
                  placeholder={translate(
                    "inv.movements.form.product.placeholder",
                    { ns: "inv" },
                    "Select a product..."
                  )}
                />
              }
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="type"
          rules={{
            required: translate(
              "inv.movements.validation.type",
              { ns: "inv" },
              "Please choose a movement type"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.movements.fields.type", { ns: "inv" }, "Movement type")}
              </FormLabel>
              <FormControl
                render={
                  <EnumSelectField
                    options={MOVEMENT_TYPES}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={translate(
                      "inv.movements.form.type.placeholder",
                      { ns: "inv" },
                      "Select a type..."
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="quantity"
          rules={{
            required: translate(
              "inv.movements.validation.quantity",
              { ns: "inv" },
              "Please enter a quantity"
            ),
            validate: (value) => {
              if (value === undefined || Number(value) <= 0) {
                return translate(
                  "inv.movements.validation.quantityPositive",
                  { ns: "inv" },
                  "Quantity must be greater than 0"
                );
              }
              const nextDelta = selectedType
                ? movementInputDelta(
                    selectedType,
                    Number(value),
                    adjustmentDirection
                  )
                : 0;
              if (product && currentStock + nextDelta < 0) {
                return translate(
                  "inv.movements.validation.exceedsStock",
                  { ns: "inv", stock: currentStock },
                  `Only ${currentStock} on hand — an outbound movement cannot exceed it`
                );
              }
              return true;
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.movements.fields.quantity", { ns: "inv" }, "Quantity")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    type="number"
                    step="1"
                    min="1"
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value ? Number(event.target.value) : undefined
                      )
                    }
                    placeholder="0"
                  />
                }
              />
              <FormDescription>
                {isStockIn
                  ? translate(
                      "inv.movements.form.quantity.inDescription",
                      { ns: "inv" },
                      "This quantity increases product stock"
                    )
                  : isStockOut
                  ? translate(
                      "inv.movements.form.quantity.outDescription",
                      { ns: "inv" },
                      "This quantity decreases product stock"
                    )
                  : translate(
                      "inv.movements.form.quantity.adjustmentDescription",
                      { ns: "inv" },
                      "The adjustment direction determines whether stock increases or decreases"
                    )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {isAdjustment ? (
        <FormField
          control={form.control}
          name="adjustmentDirection"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.movements.adjustment.direction",
                  { ns: "inv" },
                  "Adjustment direction"
                )}
              </FormLabel>
              <FormControl
                render={
                  <EnumSelectField
                    options={ADJUSTMENT_DIRECTIONS}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={translate(
                      "inv.movements.adjustment.directionPlaceholder",
                      { ns: "inv" },
                      "Choose gain or loss"
                    )}
                  />
                }
              />
              <FormDescription>
                {translate(
                  "inv.movements.adjustment.directionHint",
                  { ns: "inv" },
                  "The selected direction is used by both this preview and posting."
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {product ? (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {translate(
              "inv.movements.form.impact",
              { ns: "inv" },
              "Stock impact preview"
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatTile
              label={translate(
                "inv.movements.fields.beforeStock",
                { ns: "inv" },
                "Stock before"
              )}
              value={formatNumber(currentStock)}
            />
            <StatTile
              label={translate(
                "inv.movements.fields.quantity",
                { ns: "inv" },
                "Movement"
              )}
              value={`${signedDelta >= 0 ? "+" : "-"}${formatNumber(
                Math.abs(signedDelta)
              )}`}
              tone={signedDelta >= 0 ? "success" : "danger"}
            />
            <StatTile
              label={translate(
                "inv.movements.fields.afterStock",
                { ns: "inv" },
                "Stock after"
              )}
              value={formatNumber(projectedStock)}
              tone={
                wouldGoNegative
                  ? "danger"
                  : projectedStock <= Number(product.safetyStock ?? 0)
                  ? "warning"
                  : "default"
              }
              hint={
                projectedStock <= Number(product.safetyStock ?? 0)
                  ? translate(
                      "inv.movements.form.belowSafety",
                      { ns: "inv" },
                      "Falls to or below safety stock"
                    )
                  : undefined
              }
            />
          </div>
          {wouldGoNegative ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <TriangleAlert className="size-3.5" />
              {translate(
                "inv.movements.validation.exceedsStock",
                { ns: "inv", stock: currentStock },
                `Only ${currentStock} on hand — an outbound movement cannot exceed it`
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="referenceNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.movements.fields.referenceNo",
                  { ns: "inv" },
                  "Reference No."
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.movements.form.referenceNo.placeholder",
                      { ns: "inv" },
                      "e.g. purchase order PO-20260801-001"
                    )}
                  />
                }
              />
              {duplicateReference ? (
                <FormDescription className="text-amber-600 dark:text-amber-400">
                  {translate(
                    "inv.movements.form.duplicateReference",
                    { ns: "inv" },
                    "A movement with this document number already exists."
                  )}
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="handler"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.movements.fields.handler", { ns: "inv" }, "Handler")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.movements.form.handler.placeholder",
                      { ns: "inv" },
                      "e.g. John Smith"
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="occurredAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.movements.fields.occurredAt", { ns: "inv" }, "Occurred at")}
            </FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  type="datetime-local"
                  value={toDateTimeLocal(field.value)}
                  disabled
                />
              }
            />
            <FormDescription>
              {translate(
                "inv.movements.form.occurredAt.currentOnly",
                { ns: "inv" },
                "Posting time is assigned on submit. Backdated entries require an audited server workflow."
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="remark"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.movements.fields.remark", { ns: "inv" }, "Remarks")}
            </FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.movements.form.remark.placeholder",
                    { ns: "inv" },
                    "Movement remarks (optional)"
                  )}
                />
              }
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
