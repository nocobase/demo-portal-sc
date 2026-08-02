import {
  useActiveAuthProvider,
  useLogout,
  useTranslate,
} from "@refinedev/core";
import { resolveNocoBaseSettingsUrl } from "@nocobase/portal-sdk/runtime";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/app-shell/user-avatar";
import { UserInfo } from "@/components/app-shell/user-info";
import { CanAccess } from "@/components/access-control/can-access";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/app-shell/brand";
import { TopNavigation } from "@/components/app-shell/top-nav";
import { extensionUserMenuItems } from "@/app/extensions";

const pluginSettingsResource = {
  name: "plugin-settings",
  meta: {
    acl: {
      type: "snippet",
      name: "pm.*",
    },
  },
} as const;

export const Header = () => {
  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "z-40",
        "shrink-0",
        "border-b",
        "border-border/70",
        "bg-background/80",
        "backdrop-blur-xl",
        "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_oklch,var(--brand-2)_30%,transparent)] after:to-transparent"
      )}
    >
      <div
        className={cn(
          "mx-auto",
          "flex",
          "h-16",
          "w-full",
          "max-w-[1600px]",
          "items-center",
          "gap-3",
          "px-4",
          "md:px-6",
          "lg:px-8"
        )}
      >
        <Brand logoClassName="h-6" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <TopNavigation />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PortalInfo />
          <SettingsLink />
          <ThemeToggle />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

function PortalInfo() {
  const translate = useTranslate();
  return (
    <div className="mr-1 hidden items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 md:flex">
      <div className="min-w-0 text-right text-[11px] leading-4">
        <div className="font-semibold text-foreground">
          {translate("shell.footer.freedom", "AI builds freely.")}
        </div>
        <div className="text-muted-foreground">
          <a
            href="https://nocobase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            NocoBase
          </a>{" "}
          {translate("shell.footer.reliabilitySuffix", "keeps it reliable.")}
        </div>
      </div>
    </div>
  );
}

function SettingsLink({ className }: { className?: string }) {
  const translate = useTranslate();
  const label = translate("shell.settings", "Settings");

  return (
    <CanAccess resourceItem={pluginSettingsResource}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              render={
                <a
                  href={resolveNocoBaseSettingsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              variant="outline"
              size="icon"
              className={cn(
                "size-10 rounded-xl border-border/70 bg-background/60",
                className
              )}
            >
              <SettingsIcon />
              <span className="sr-only">{label}</span>
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </CanAccess>
  );
}

const UserDropdown = () => {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const translate = useTranslate();

  const authProvider = useActiveAuthProvider();

  if (!authProvider?.getIdentity) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <div className="px-2 py-2">
          <UserInfo />
        </div>
        {extensionUserMenuItems.map(({ id, Component }) => (
          <Component key={id} />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="mt-1 min-h-9 cursor-pointer gap-2 px-2 text-muted-foreground focus:text-foreground"
          onClick={() => {
            logout();
          }}
        >
          <LogOutIcon />
          <span>
            {isLoggingOut
              ? translate("auth.signingOut", "Signing out...")
              : translate("auth.signOut", "Sign out")}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Header.displayName = "Header";
