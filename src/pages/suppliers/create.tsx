import { type HttpError, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

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

export const SupplierCreate = () => {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.suppliers.drawer.create.title",
          { ns: "inv" },
          "Create supplier"
        )}
        description={translate(
          "inv.suppliers.drawer.create.description",
          { ns: "inv" },
          "Maintain supplier master data for product sourcing."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo="/goods/suppliers"
        beforeClose={beforeClose}
      >
        <SupplierCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function SupplierCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<any, HttpError, SupplierFormValues>({
    refineCoreProps: {
      resource: "scm_suppliers",
      action: "create",
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
              ? translate("inv.common.submitting", { ns: "inv" }, "Submitting...")
              : translate("inv.suppliers.form.create.submit", { ns: "inv" }, "Create supplier")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
