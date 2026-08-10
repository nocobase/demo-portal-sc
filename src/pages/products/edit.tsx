import { type HttpError, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useMemo } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";
import { ProductFormFields, productFormValuesToRecord } from "./form-fields";
import { type ProductFormValues } from "./types";
import type { ProductRecord } from "@/lib/inventory/types";
import { useAIForm, type AIFormField } from "@/lib/inventory/ai-handle";
import { getProductListPath, getProductShowPath } from "./paths";

export const ProductEdit = ({
  returnTo = "list",
  showCloseToBase,
  id: idOverride,
}: {
  returnTo?: "list" | "show";
  showCloseToBase?: string;
  id?: string;
}) => {
  const translate = useTranslate();
  const { id: routeId } = useParams<{ id: string }>();
  const id = idOverride ?? routeId;
  const closeTo =
    returnTo === "show" && id
      ? showCloseToBase
        ? `${showCloseToBase.replace(/\/$/, "")}/${encodeURIComponent(id)}`
        : getProductShowPath(id)
      : getProductListPath();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.products.drawer.edit.title",
          { ns: "inv" },
          "Edit product"
        )}
        description={translate(
          "inv.products.drawer.edit.description",
          { ns: "inv" },
          "Update product base information."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <ProductEditForm id={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function ProductEditForm({ id }: { id?: string }) {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<ProductRecord, HttpError, ProductFormValues>({
    refineCoreProps: {
      action: "edit",
      resource: "scm_products",
      id,
      redirect: false,
      meta: {
        appends: ["category", "supplier"],
      },
      queryOptions: {
        select: (response) => {
          const record = response?.data;
          if (!record) return response;
          return {
            ...response,
            data: {
              ...record,
              categoryId: record.category_id ?? record.categoryId,
              supplierId: record.supplier_id ?? record.supplierId,
            },
          };
        },
      },
      onMutationSuccess: () => {
        close({ skipBeforeClose: true });
      },
    },
  });

  const aiFields = useMemo<AIFormField[]>(
    () => [
      { name: "name", title: "Product name", required: true },
      { name: "sku", title: "SKU", required: true },
      { name: "barcode", title: "Barcode" },
      { name: "categoryId", title: "Category", type: "number" },
      { name: "spec", title: "Specification" },
      { name: "unit", title: "Unit" },
      { name: "purchasePrice", title: "Purchase price", type: "number" },
      { name: "salePrice", title: "Sale price", type: "number" },
      { name: "safetyStock", title: "Safety stock", type: "number" },
      { name: "status", title: "Status" },
      { name: "supplierId", title: "Supplier", type: "number" },
      { name: "remark", title: "Remarks" },
    ],
    []
  );

  const aiFormRef = useAIForm({
    id: `products-edit-form-${id ?? "current"}`,
    title: translate("inv.products.ai.editForm", { ns: "inv" }, "Edit product form"),
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
      if (values.supplierId)
        form.setValue("supplierId", Number(values.supplierId));
      if (values.remark) form.setValue("remark", values.remark as string);
    },
  });

  const values = form.watch();
  void values;

  return (
    <Form {...form}>
      <form
        ref={aiFormRef}
        onSubmit={form.handleSubmit((formValues) =>
          onFinish(
            productFormValuesToRecord(formValues) as unknown as ProductFormValues
          )
        )}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=textarea]]:min-h-32">
          <ProductFormFields
            form={form}
            translate={translate}
            readOnlyStock
            recordId={id}
          />
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
              ? translate("inv.common.saving", { ns: "inv" }, "Saving...")
              : translate("inv.products.form.edit.submit", { ns: "inv" }, "Save changes")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
