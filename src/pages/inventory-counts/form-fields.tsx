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
import { COUNT_SCOPES } from "@/lib/inventory/constants";

export type CountFormValues = {
  scope?: string;
  categoryId?: number;
  productId?: number;
  countDate?: string;
  countBy?: string;
  remark?: string;
};

export const countFormDefaultValues: CountFormValues = {
  scope: "all",
  categoryId: undefined,
  productId: undefined,
  countDate: new Date().toISOString().slice(0, 10),
  countBy: "",
  remark: "",
};

export function CountFormFields({
  form,
  translate,
}: {
  form: UseFormReturn<CountFormValues>;
  translate: ReturnType<typeof useTranslate>;
}) {
  const getLocale = useGetLocale();
  const locale = getLocale();
  const categoryOptions = useRelationOptions("scm_product_categories", "name");
  const productOptions = useRelationOptions("scm_products", "name");
  const scope = form.watch("scope");

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="scope"
        rules={{
          required: translate(
            "inv.counts.validation.scope",
            { ns: "inv" },
            "Please choose a count scope"
          ),
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.counts.fields.scope", { ns: "inv" }, "Count scope")}
            </FormLabel>
            <FormControl
              render={
                <EnumSelectField
                  options={COUNT_SCOPES}
                  value={field.value}
                  onValueChange={field.onChange}
                  locale={locale}
                  placeholder={translate(
                    "inv.counts.form.scope.placeholder",
                    { ns: "inv" },
                    "Select a scope..."
                  )}
                />
              }
            />
            <FormDescription>
              {translate(
                "inv.counts.form.scope.description",
                { ns: "inv" },
                "Items will be generated automatically for the chosen scope"
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {scope === "category" ? (
        <FormField
          control={form.control}
          name="categoryId"
          rules={{
            required: translate(
              "inv.counts.validation.category",
              { ns: "inv" },
              "Please choose a category"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.counts.fields.category", { ns: "inv" }, "Category")}
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
                      "inv.counts.form.category.placeholder",
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
      ) : null}

      {scope === "product" ? (
        <FormField
          control={form.control}
          name="productId"
          rules={{
            required: translate(
              "inv.counts.validation.product",
              { ns: "inv" },
              "Please choose a product"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.counts.fields.product", { ns: "inv" }, "Product")}
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
                      "inv.counts.form.product.placeholder",
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
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="countDate"
          rules={{
            required: translate(
              "inv.counts.validation.countDate",
              { ns: "inv" },
              "Please choose a count date"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.counts.fields.countDate",
                  { ns: "inv" },
                  "Count date"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    type="date"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="countBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.counts.fields.countBy", { ns: "inv" }, "Counted by")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.counts.form.countBy.placeholder",
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
        name="remark"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.counts.fields.remark", { ns: "inv" }, "Remarks")}
            </FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.counts.form.remark.placeholder",
                    { ns: "inv" },
                    "Count remarks (optional)"
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
