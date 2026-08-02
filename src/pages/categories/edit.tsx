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
  CategoryFormFields,
  categoryFormDefaultValues,
  type CategoryFormValues,
} from "./form-fields";

export const CategoryEdit = ({
  returnTo = "list",
}: {
  returnTo?: "list" | "show";
}) => {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const closeTo =
    returnTo === "show" && id
      ? `/goods/categories/show/${encodeURIComponent(id)}`
      : "/goods/categories";
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.categories.drawer.edit.title",
          { ns: "inv" },
          "Edit category"
        )}
        description={translate(
          "inv.categories.drawer.edit.description",
          { ns: "inv" },
          "Update category information."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <CategoryEditForm id={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function CategoryEditForm({ id }: { id?: string }) {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<any, HttpError, CategoryFormValues>({
    refineCoreProps: {
      action: "edit",
      resource: "scm_product_categories",
      id,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: categoryFormDefaultValues,
  });

  const numericId = id ? Number(id) : undefined;

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
          <CategoryFormFields
            form={form}
            translate={translate}
            excludeId={numericId}
          />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            {translate("buttons.cancel", "Cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? translate("inv.common.saving", { ns: "inv" }, "Saving...")
              : translate("inv.categories.form.edit.submit", { ns: "inv" }, "Save changes")}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
