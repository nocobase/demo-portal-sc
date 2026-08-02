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
  CategoryFormFields,
  categoryFormDefaultValues,
  type CategoryFormValues,
} from "./form-fields";

export const CategoryCreate = () => {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.categories.drawer.create.title",
          { ns: "inv" },
          "Create category"
        )}
        description={translate(
          "inv.categories.drawer.create.description",
          { ns: "inv" },
          "Organize products into a category hierarchy."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo="/goods/categories"
        beforeClose={beforeClose}
      >
        <CategoryCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function CategoryCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<any, HttpError, CategoryFormValues>({
    refineCoreProps: {
      resource: "scm_product_categories",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: categoryFormDefaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onFinish({
            name: values.name,
            code: values.code || null,
            parentId: values.parentId ?? null,
            description: values.description || null,
          })
        )}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=textarea]]:min-h-32">
          <CategoryFormFields form={form} translate={translate} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            {translate("buttons.cancel", "Cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? translate("inv.common.submitting", { ns: "inv" }, "Submitting...")
              : translate("inv.categories.form.create.submit", { ns: "inv" }, "Create category")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
