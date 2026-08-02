import {
  useLink,
  useMenu,
  useTranslate,
  useUserFriendlyName,
  type TreeMenuItem,
} from "@refinedev/core";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getResourceLabel } from "@/components/resources/resource-label";
import {
  filterMenuItemsByAcl,
  useAclState,
} from "@nocobase/portal-sdk/acl";
import { cn } from "@/lib/utils";

export function TopNavigation() {
  const { menuItems, selectedKey } = useMenu();
  const acl = useAclState();
  const allowedMenuItems =
    acl.status === "ready"
      ? filterMenuItemsByAcl(menuItems, acl.permissions)
      : [];

  return (
    <nav className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1">
      {allowedMenuItems.map((item) => (
        <TopNavItem
          key={item.key || item.name}
          item={item}
          selectedKey={selectedKey}
        />
      ))}
    </nav>
  );
}

function TopNavItem({
  item,
  selectedKey,
}: {
  item: TreeMenuItem;
  selectedKey?: string;
}) {
  const Link = useLink();
  const isSelected = isTreeItemSelected(item, selectedKey);

  const children = (item.children ?? []).filter(
    (child) => child.route && !child.meta?.group
  );

  if (children.length > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 shrink-0 gap-1 rounded-lg px-3 text-sm font-medium transition-all duration-200",
                isSelected
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_14%,transparent)] hover:bg-primary/15"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <ItemIcon item={item} isSelected={isSelected} />
              <span>{useMenuItemLabel(item)}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56 p-1.5">
          {children.map((child) => (
            <DropdownMenuItem
              key={child.key || child.name}
              className={cn(
                "min-h-9 cursor-pointer gap-2 px-2",
                isTreeItemSelected(child, selectedKey) &&
                  "bg-accent text-accent-foreground"
              )}
              render={
                child.route ? (
                  <Link
                    to={child.route}
                    className="flex w-full items-center gap-2"
                  />
                ) : undefined
              }
            >
              <ItemIcon
                item={child}
                isSelected={isTreeItemSelected(child, selectedKey)}
              />
              <span>{useMenuItemLabel(child)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!item.route) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 shrink-0 gap-1 rounded-lg px-3 text-sm font-medium transition-all duration-200",
        isSelected
          ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_14%,transparent)] hover:bg-primary/15"
          : "text-foreground hover:bg-accent"
      )}
      render={<Link to={item.route} className="flex items-center gap-1.5" />}
    >
      <ItemIcon item={item} isSelected={isSelected} />
      <span>{useMenuItemLabel(item)}</span>
    </Button>
  );
}

function ItemIcon({
  item,
  isSelected,
}: {
  item: TreeMenuItem;
  isSelected?: boolean;
}) {
  const icon = item.meta?.icon ?? item.icon;
  if (!icon) return null;
  return (
    <span className={cn("w-4", !isSelected && "text-muted-foreground")}>
      {icon}
    </span>
  );
}

function useMenuItemLabel(item: TreeMenuItem) {
  const translate = useTranslate();
  const getUserFriendlyName = useUserFriendlyName();

  return getResourceLabel(
    item,
    "plural",
    translate,
    getUserFriendlyName,
    item.name
  );
}

function isTreeItemSelected(item: TreeMenuItem, selectedKey?: string) {
  return (
    item.key === selectedKey || Boolean(selectedKey?.startsWith(`${item.key}/`))
  );
}
