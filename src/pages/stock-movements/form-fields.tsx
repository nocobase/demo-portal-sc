import { useGetLocale, useTranslate } from "@refinedev/core";
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
import { MOVEMENT_TYPES, STOCK_IN_TYPES } from "@/lib/inventory/constants";

export type MovementFormValues = {
  productId?: number;
  type?: string;
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
  quantity: undefined,
  referenceNo: "",
  handler: "",
  occurredAt: toDateTimeLocal(new Date()),
  remark: "",
};

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
  const isStockIn = STOCK_IN_TYPES.has(selectedType ?? "");

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
                    locale={locale}
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
            validate: (value) =>
              value !== undefined && Number(value) > 0
                ? true
                : translate(
                    "inv.movements.validation.quantityPositive",
                    { ns: "inv" },
                    "Quantity must be greater than 0"
                  ),
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
                    min="0"
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
                  : translate(
                      "inv.movements.form.quantity.outDescription",
                      { ns: "inv" },
                      "This quantity decreases product stock"
                    )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

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
                  value={field.value ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value ? new Date(value).toISOString() : undefined);
                  }}
                />
              }
            />
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
