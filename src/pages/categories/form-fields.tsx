import { useTranslate } from "@refinedev/core";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RelationSelectField,
  useRelationOptions,
} from "@/components/inventory/form-selects";

export type CategoryFormValues = {
  name: string;
  code?: string | null;
  parentId?: number | null;
  description?: string | null;
};

export const categoryFormDefaultValues: CategoryFormValues = {
  name: "",
  code: "",
  parentId: undefined,
  description: "",
};

export function CategoryFormFields({
  form,
  translate,
  excludeId,
}: {
  form: UseFormReturn<CategoryFormValues>;
  translate: ReturnType<typeof useTranslate>;
  excludeId?: number;
}) {
  const { options } = useRelationOptions("scm_product_categories", "name");
  const parentOptions = options.filter(
    (option) => String(excludeId) !== option.value
  );

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="name"
        rules={{
          required: translate(
            "inv.categories.validation.name",
            { ns: "inv" },
            "Category name is required"
          ),
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate(
                "inv.categories.fields.name",
                { ns: "inv" },
                "Category name"
              )}
            </FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.categories.form.name.placeholder",
                    { ns: "inv" },
                    "e.g. Electronics"
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
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.categories.fields.code",
                  { ns: "inv" },
                  "Category code"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.categories.form.code.placeholder",
                      { ns: "inv" },
                      "e.g. ELEC-01"
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
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "inv.categories.fields.parent",
                  { ns: "inv" },
                  "Parent category"
                )}
              </FormLabel>
              <FormControl
                render={
                  <RelationSelectField
                    options={parentOptions}
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(value) =>
                      field.onChange(value ? Number(value) : undefined)
                    }
                    placeholder={translate(
                      "inv.categories.form.parent.placeholder",
                      { ns: "inv" },
                      "None (top-level)"
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
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate(
                "inv.categories.fields.description",
                { ns: "inv" },
                "Description"
              )}
            </FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.categories.form.description.placeholder",
                    { ns: "inv" },
                    "Description of the category (optional)"
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
