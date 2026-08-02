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
  movementFormDefaultValues,
  MovementFormFields,
  type MovementFormValues,
} from "./form-fields";
import {
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
} from "@/lib/inventory/constants";
import type { ProductRecord, StockMovementRecord } from "@/lib/inventory/types";

const movementDirection = (type: string, quantity: number) => {
  if (STOCK_IN_TYPES.has(type)) return 1;
  if (STOCK_OUT_TYPES.has(type)) return -1;
  return quantity >= 0 ? 1 : -1;
};

export const StockMovementCreate = () => {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate(
          "inv.movements.drawer.create.title",
          { ns: "inv" },
          "Create stock movement"
        )}
        description={translate(
          "inv.movements.drawer.create.description",
          { ns: "inv" },
          "Record an inbound or outbound movement; stock is updated automatically on submit."
        )}
        closeLabel={translate("buttons.close", "Close")}
        closeTo="/stock/movements"
        beforeClose={beforeClose}
      >
        <MovementCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
};

function MovementCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const dataProvider = useDataProvider()();
  const [submitError, setSubmitError] = useState<string>();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm<StockMovementRecord, HttpError, MovementFormValues>({
    refineCoreProps: {
      resource: "scm_stock_movements",
      action: "create",
      redirect: false,
    },
    defaultValues: movementFormDefaultValues,
  });

  void onFinish;

  const handleSubmit = async (values: MovementFormValues) => {
    setSubmitError(undefined);
    try {
      const productId = values.productId;
      const type = values.type ?? "purchase_in";
      const quantity = Number(values.quantity ?? 0);
      if (!productId) return;

      const productResponse = await dataProvider.getOne<ProductRecord>({
        resource: "scm_products",
        id: productId,
      });
      const currentStock = Number(productResponse.data.currentStock ?? 0);
      const direction = movementDirection(type, quantity);
      const beforeStock = currentStock;
      const afterStock = Math.max(0, currentStock + direction * quantity);

      await dataProvider.create<StockMovementRecord>({
        resource: "scm_stock_movements",
        variables: {
          product: { id: productId },
          type,
          quantity,
          beforeStock,
          afterStock,
          referenceNo: values.referenceNo || null,
          handler: values.handler || null,
          occurredAt: values.occurredAt || new Date().toISOString(),
          remark: values.remark || null,
        },
      });

      await dataProvider.update({
        resource: "scm_products",
        id: productId,
        variables: { currentStock: afterStock },
      });

      close({ skipBeforeClose: true });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : translate(
              "inv.movements.form.submitError",
              { ns: "inv" },
              "Submit failed, please retry"
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
          <MovementFormFields form={form} translate={translate} />
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
              : translate(
                  "inv.movements.form.create.submit",
                  { ns: "inv" },
                  "Submit and update stock"
                )}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}
