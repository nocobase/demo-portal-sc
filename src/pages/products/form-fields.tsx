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
import type { ProductFormValues } from "./types";
import {
  EnumSelectField,
  RelationSelectField,
  useRelationOptions,
} from "@/components/inventory/form-selects";
import { PRODUCT_STATUS, PRODUCT_UNITS } from "@/lib/inventory/constants";

type Translate = ReturnType<typeof useTranslate>;

export function ProductFormFields({
  form,
  translate,
  readOnlyStock = false,
}: {
  form: UseFormReturn<ProductFormValues>;
  translate: Translate;
  readOnlyStock?: boolean;
}) {
  const getLocale = useGetLocale();
  const locale = getLocale();
  const categoryOptions = useRelationOptions("scm_product_categories", "name");
  const supplierOptions = useRelationOptions("scm_suppliers", "name");

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="name"
        rules={{
          required: translate(
            "inv.products.validation.name",
            { ns: "inv" },
            "Product name is required"
          ),
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.products.fields.name", { ns: "inv" }, "Product name")}
            </FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.products.form.name.placeholder",
                    { ns: "inv" },
                    "e.g. Wireless earbuds"
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
          name="sku"
          rules={{
            required: translate(
              "inv.products.validation.sku",
              { ns: "inv" },
              "SKU is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.products.fields.sku", { ns: "inv" }, "SKU")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.products.form.sku.placeholder",
                      { ns: "inv" },
                      "e.g. SKU-1001"
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
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.barcode",
                  { ns: "inv" },
                  "Barcode"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.products.form.barcode.placeholder",
                      { ns: "inv" },
                      "optional, e.g. EAN-13"
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.category",
                  { ns: "inv" },
                  "Category"
                )}
              </FormLabel>
              <FormControl
                render={
                  <RelationSelectField
                    options={categoryOptions.options}
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(value) =>
                      field.onChange(value ? Number(value) : undefined)
                    }
                    placeholder={translate(
                      "inv.products.form.category.placeholder",
                      { ns: "inv" },
                      "Select a category..."
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
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.products.fields.unit", { ns: "inv" }, "Unit")}
              </FormLabel>
              <FormControl
                render={
                  <EnumSelectField
                    options={PRODUCT_UNITS}
                    value={field.value}
                    onValueChange={field.onChange}
                    locale={locale}
                    placeholder={translate(
                      "inv.products.form.unit.placeholder",
                      { ns: "inv" },
                      "Select a unit..."
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="spec"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.spec",
                  { ns: "inv" },
                  "Specification"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.products.form.spec.placeholder",
                      { ns: "inv" },
                      "e.g. Black 128GB"
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
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.status",
                  { ns: "inv" },
                  "Status"
                )}
              </FormLabel>
              <FormControl
                render={
                  <EnumSelectField
                    options={PRODUCT_STATUS}
                    value={field.value}
                    onValueChange={field.onChange}
                    locale={locale}
                    placeholder={translate(
                      "inv.products.form.status.placeholder",
                      { ns: "inv" },
                      "Select a status..."
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="purchasePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.purchasePrice",
                  { ns: "inv" },
                  "Purchase price"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.value ?? ""}
                    placeholder="0.00"
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="salePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.salePrice",
                  { ns: "inv" },
                  "Sale price"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.value ?? ""}
                    placeholder="0.00"
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="safetyStock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.products.fields.safetyStock",
                  { ns: "inv" },
                  "Safety stock"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    type="number"
                    step="1"
                    min="0"
                    value={field.value ?? ""}
                    placeholder="0"
                  />
                }
              />
              <FormDescription>
                {translate(
                  "inv.products.form.safetyStock.description",
                  { ns: "inv" },
                  "Products below this value trigger low-stock alerts"
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="supplierId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate(
                "inv.products.fields.supplier",
                { ns: "inv" },
                "Supplier"
              )}
            </FormLabel>
            <FormControl
              render={
                <RelationSelectField
                  options={supplierOptions.options}
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) =>
                    field.onChange(value ? Number(value) : undefined)
                  }
                  placeholder={translate(
                    "inv.products.form.supplier.placeholder",
                    { ns: "inv" },
                    "Select a supplier..."
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
        name="remark"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.products.fields.remark", { ns: "inv" }, "Remarks")}
            </FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.products.form.remark.placeholder",
                    { ns: "inv" },
                    "Additional notes (optional)"
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
        name="currentStock"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate(
                "inv.products.fields.currentStock",
                { ns: "inv" },
                "Current stock"
              )}
            </FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  type="number"
                  step="1"
                  min="0"
                  value={field.value ?? 0}
                  disabled={readOnlyStock}
                  onChange={(event) => {
                    field.onChange(
                      event.target.value ? Number(event.target.value) : 0
                    );
                  }}
                  placeholder="0"
                />
              }
            />
            <FormDescription>
              {readOnlyStock
                ? translate(
                    "inv.products.form.currentStock.readonly",
                    { ns: "inv" },
                    "Stock is adjusted automatically through movements and counts"
                  )
                : translate(
                    "inv.products.form.currentStock.description",
                    { ns: "inv" },
                    "Initial stock; adjust later via stock movements"
                  )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export const productFormDefaultValues: ProductFormValues = {
  sku: "",
  name: "",
  barcode: "",
  categoryId: undefined,
  spec: "",
  unit: "piece",
  purchasePrice: 0,
  salePrice: 0,
  currentStock: 0,
  safetyStock: 0,
  status: "on_sale",
  supplierId: undefined,
  remark: "",
};

export function productFormValuesToRecord(
  values: ProductFormValues
): Record<string, unknown> {
  return {
    sku: values.sku,
    name: values.name,
    barcode: values.barcode || null,
    category: values.categoryId ? { id: values.categoryId } : null,
    spec: values.spec || null,
    unit: values.unit || null,
    purchasePrice: values.purchasePrice ?? 0,
    salePrice: values.salePrice ?? 0,
    currentStock: values.currentStock ?? 0,
    safetyStock: values.safetyStock ?? 0,
    status: values.status || "on_sale",
    supplier: values.supplierId ? { id: values.supplierId } : null,
    remark: values.remark || null,
  };
}

