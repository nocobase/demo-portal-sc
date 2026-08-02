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
import type { CategoryRecord } from "@/lib/inventory/types";

export const CategoryShow = () => {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const nestedDrawer = useOutlet();
  const { result: record, query } = useShow<CategoryRecord>({
    resource: "scm_product_categories",
    id,
  });

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          record?.name ?? "-"
        )
      }
      description={translate(
        "inv.categories.drawer.show.description",
        { ns: "inv" },
        "Category details"
      )}
      closeLabel={translate("buttons.close", "Close")}
      closeTo="/goods/categories"
      nested={nestedDrawer}
      actions={
        record ? (
          <>
            <RefreshButton
              resource="scm_product_categories"
              recordItemId={record.id}
              variant="outline"
              size="icon-sm"
              aria-label={translate("buttons.refresh", "Refresh")}
              title={translate("buttons.refresh", "Refresh")}
            >
              <RotateCw />
            </RefreshButton>
            <EditButton
              resource="scm_product_categories"
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
                "inv.categories.detail.loadError.title",
                { ns: "inv" },
                "Unable to load category"
              )}
            </AlertTitle>
          </Alert>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label={translate("inv.categories.fields.name", { ns: "inv" }, "Category name")}
                value={record.name || "-"}
              />
              <DetailItem
                label={translate("inv.categories.fields.code", { ns: "inv" }, "Category code")}
                value={record.code || "-"}
              />
            </dl>
            {record.description ? (
              <>
                <Separator />
                <section className="space-y-1">
                  <h3 className="text-sm font-medium">
                    {translate("inv.categories.fields.description", { ns: "inv" }, "Description")}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {record.description}
                  </p>
                </section>
              </>
            ) : null}
            <Separator />
            <DetailItem
              label={translate("inv.categories.fields.createdAt", { ns: "inv" }, "Created at")}
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
