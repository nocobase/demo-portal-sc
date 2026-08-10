import { type HttpError, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";
import {
  productFormDefaultValues,
  productFormValuesToRecord,
  ProductFormFields,
} from "./form-fields";
import { useAIForm, type AIFormField } from "@/lib/inventory/ai-handle";
import type { ProductFormValues } from "./types";
import type { ProductRecord } from "@/lib/inventory/types";
import { getProductListPath } from "./paths";

export const ProductCreate = () => {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.products.drawer.create.title",
          { ns: "inv" },
          "Create product"
        )}
        description={translate(
          "inv.products.drawer.create.description",
          { ns: "inv" },
          "Maintain product master data; stock updates automatically through movements and counts."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo={getProductListPath()}
        beforeClose={beforeClose}
      >
        <ProductCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function ProductCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<ProductRecord, HttpError, ProductFormValues>({
    refineCoreProps: {
      resource: "scm_products",
      action: "create",
      redirect: false,
      onMutationSuccess: () => {
        close({ skipBeforeClose: true });
      },
    },
    defaultValues: productFormDefaultValues,
  });

  const aiFields = useMemo<AIFormField[]>(
    () => [
      { name: "name", title: "Product name", required: true },
      { name: "sku", title: "SKU", required: true },
      { name: "barcode", title: "Barcode" },
      { name: "categoryId", title: "Category", type: "number" },
      { name: "spec", title: "Specification" },
      { name: "unit", title: "Unit", type: "string" },
      { name: "purchasePrice", title: "Purchase price", type: "number" },
      { name: "salePrice", title: "Sale price", type: "number" },
      { name: "safetyStock", title: "Safety stock", type: "number" },
      { name: "status", title: "Status", type: "string" },
      { name: "supplierId", title: "Supplier", type: "number" },
      { name: "remark", title: "Remarks" },
    ],
    []
  );

  const aiFormRef = useAIForm({
    id: "products-create-form",
    title: translate("inv.products.ai.createForm", { ns: "inv" }, "Create product form"),
    fields: aiFields,
    getValues: () => productFormValuesToRecord(form.getValues()),
    setValues: (values) => {
      form.setValue("name", (values.name as string) ?? "");
      form.setValue("sku", (values.sku as string) ?? "");
      if (values.barcode) form.setValue("barcode", values.barcode as string);
      if (values.categoryId)
        form.setValue("categoryId", Number(values.categoryId));
      if (values.spec) form.setValue("spec", values.spec as string);
      if (values.unit) form.setValue("unit", values.unit as string);
      if (values.purchasePrice !== undefined)
        form.setValue("purchasePrice", Number(values.purchasePrice));
      if (values.salePrice !== undefined)
        form.setValue("salePrice", Number(values.salePrice));
      if (values.safetyStock !== undefined)
        form.setValue("safetyStock", Number(values.safetyStock));
      if (values.status) form.setValue("status", values.status as string);
      if (values.supplierId) form.setValue("supplierId", Number(values.supplierId));
      if (values.remark) form.setValue("remark", values.remark as string);
    },
  });

  return (
    <Form {...form}>
      <form
        ref={aiFormRef}
        onSubmit={form.handleSubmit((values) => {
          const record = productFormValuesToRecord(values);
          return onFinish({
            ...record,
            currentStock: 0,
          } as unknown as ProductFormValues);
        })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=textarea]]:min-h-32">
          <ProductFormFields form={form} translate={translate} readOnlyStock />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            {translate("buttons.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? translate("inv.common.submitting", { ns: "inv" }, "Submitting...")
              : translate("inv.products.form.create.submit", { ns: "inv" }, "Create product")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
