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

export type SupplierFormValues = {
  code: string;
  name: string;
  contact?: string;
  phone?: string;
  address?: string;
  remark?: string;
};

export const supplierFormDefaultValues: SupplierFormValues = {
  code: "",
  name: "",
  contact: "",
  phone: "",
  address: "",
  remark: "",
};

export function SupplierFormFields({
  form,
  translate,
}: {
  form: UseFormReturn<SupplierFormValues>;
  translate: ReturnType<typeof useTranslate>;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="code"
          rules={{
            required: translate(
              "inv.suppliers.validation.code",
              { ns: "inv" },
              "Supplier code is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.suppliers.fields.code", { ns: "inv" }, "Supplier code")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.suppliers.form.code.placeholder",
                      { ns: "inv" },
                      "e.g. SUP-001"
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
          name="name"
          rules={{
            required: translate(
              "inv.suppliers.validation.name",
              { ns: "inv" },
              "Supplier name is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.suppliers.fields.name", { ns: "inv" }, "Supplier name")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.suppliers.form.name.placeholder",
                      { ns: "inv" },
                      "e.g. South China Supply Chain Co., Ltd."
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
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.suppliers.fields.contact", { ns: "inv" }, "Contact")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "inv.suppliers.form.contact.placeholder",
                      { ns: "inv" },
                      "e.g. Manager Zhang"
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
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate("inv.suppliers.fields.phone", { ns: "inv" }, "Phone")}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    type="tel"
                    placeholder={translate(
                      "inv.suppliers.form.phone.placeholder",
                      { ns: "inv" },
                      "e.g. 13800000000"
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
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {translate("inv.suppliers.fields.address", { ns: "inv" }, "Address")}
            </FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.suppliers.form.address.placeholder",
                    { ns: "inv" },
                    "Supplier address"
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
              {translate("inv.suppliers.fields.remark", { ns: "inv" }, "Remarks")}
            </FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate(
                    "inv.suppliers.form.remark.placeholder",
                    { ns: "inv" },
                    "Notes on cooperation (optional)"
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
