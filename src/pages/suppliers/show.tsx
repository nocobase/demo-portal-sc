import { useGetLocale, useShow, useTranslate } from "@refinedev/core";
import { useNavigate, useOutlet } from "react-router";
import { Pencil, RotateCw } from "lucide-react";
import { useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { EditButton } from "@/components/resources/buttons/edit";
import { RefreshButton } from "@/components/resources/buttons/refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { formatDateTime } from "@/lib/inventory/format";
import type { SupplierRecord } from "@/lib/inventory/types";

export const SupplierShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const nestedDrawer = useOutlet();
  const { result: record, query } = useShow<SupplierRecord>({
    resource: "scm_suppliers",
    id,
  });

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-44" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.suppliers.drawer.show.description",
        { ns: "inv" },
        "Supplier details"
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/goods/suppliers"
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <RefreshButton
              resource="scm_suppliers"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <EditButton
              resource="scm_suppliers"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.edit", "Edit")}
              title={translate("buttons.edit", "Edit")}
              onClick={() => navigate("edit")}
            >
              <Pencil />
            </EditButton>
          </>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertTitle>
              {translate(
                "inv.suppliers.detail.loadError.title",
                { ns: "inv" },
                "Unable to load supplier"
              )}
            </AlertTitle>
            <AlertDescription>
              {translate(
                "inv.suppliers.detail.loadError.description",
                { ns: "inv" },
                "The supplier may no longer exist, or you lack view permission."
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label={translate("inv.suppliers.fields.code", { ns: "inv" }, "Supplier code")}
                value={record.code || "-"}
              />
              <DetailItem
                label={translate("inv.suppliers.fields.contact", { ns: "inv" }, "Contact")}
                value={record.contact || "-"}
              />
              <DetailItem
                label={translate("inv.suppliers.fields.phone", { ns: "inv" }, "Phone")}
                value={record.phone || "-"}
              />
              <DetailItem
                label={translate("inv.suppliers.fields.address", { ns: "inv" }, "Address")}
                value={record.address || "-"}
              />
            </dl>
            {record.remark ? (
              <>
                <Separator />
                <section className="space-y-1">
                  <h3 className="text-sm font-medium">
                    {translate("inv.suppliers.fields.remark", { ns: "inv" }, "Remarks")}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {record.remark}
                  </p>
                </section>
              </>
            ) : null}
            <Separator />
            <DetailItem
              label={translate("inv.suppliers.fields.createdAt", { ns: "inv" }, "Created at")}
              value={formatDateTime(record.createdAt, locale)}
            />
          </div>
        )}
      </div>
    </RouteDrawer>
  );
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
