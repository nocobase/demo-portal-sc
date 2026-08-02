import { type HttpError, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";
import {
  SupplierFormFields,
  supplierFormDefaultValues,
  type SupplierFormValues,
} from "./form-fields";

export const SupplierEdit = ({
  returnTo = "list",
}: {
  returnTo?: "list" | "show";
}) => {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const closeTo =
    returnTo === "show" && id
      ? `/goods/suppliers/show/${encodeURIComponent(id)}`
      : "/goods/suppliers";
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.suppliers.drawer.edit.title",
          { ns: "inv" },
          "Edit supplier"
        )}
        description={translate(
          "inv.suppliers.drawer.edit.description",
          { ns: "inv" },
          "Update supplier information."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <SupplierEditForm id={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function SupplierEditForm({ id }: { id?: string }) {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<any, HttpError, SupplierFormValues>({
    refineCoreProps: {
      action: "edit",
      resource: "scm_suppliers",
      id,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: supplierFormDefaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onFinish(values))}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=textarea]]:min-h-32">
          <SupplierFormFields form={form} translate={translate} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            {translate("buttons.cancel", "Cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? translate("inv.common.saving", { ns: "inv" }, "Saving...")
              : translate("inv.suppliers.form.edit.submit", { ns: "inv" }, "Save changes")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
