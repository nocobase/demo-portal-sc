import { type HttpError, useDataProvider, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";
import {
  CountFormFields,
  countFormDefaultValues,
  type CountFormValues,
} from "./form-fields";
import { createCountWithItems } from "./actions";

export const InventoryCountCreate = () => {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.counts.drawer.create.title",
          { ns: "inv" },
          "Create count order"
        )}
        description={translate(
          "inv.counts.drawer.create.description",
          { ns: "inv" },
          "Choose a count scope; items will be generated from current stock automatically."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo="/counting/counts"
        beforeClose={beforeClose}
      >
        <CountCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function CountCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const dataProvider = useDataProvider()();
  const [submitError, setSubmitError] = useState<string>();

  const form = useForm<any, HttpError, CountFormValues>({
    refineCoreProps: {
      resource: "scm_inventory_counts",
      action: "create",
      redirect: false,
    },
    defaultValues: countFormDefaultValues,
  });

  const handleSubmit = async (values: CountFormValues) => {
    setSubmitError(undefined);
    try {
      const count = await createCountWithItems(dataProvider, values);
      close({ skipBeforeClose: true });
      void count;
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : translate(
              "inv.counts.form.submitError",
              { ns: "inv" },
              "Failed to create, please retry"
            )
      );
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=textarea]]:min-h-32">
          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {translate("inv.common.error", { ns: "inv" }, "Something went wrong")}
              </AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          <CountFormFields form={form} translate={translate} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            {translate("buttons.cancel", "Cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? translate("inv.common.submitting", { ns: "inv" }, "Generating...")
              : translate(
                  "inv.counts.form.create.submit",
                  { ns: "inv" },
                  "Create and generate items"
                )}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
