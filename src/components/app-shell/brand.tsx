import { assetUrl, cn } from "@/lib/utils";

const APP_NAME = "Stock Control";

type BrandLogoProps = {
  className?: string;
};

// Default NocoBase logo mark (light + dark variants).
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <>
      <img
        src={assetUrl("/logo-mark.png")}
        alt="NocoBase"
        className={cn("h-7 w-auto shrink-0 dark:hidden", className)}
      />
      <img
        src={assetUrl("/logo-mark-dark.png")}
        alt="NocoBase"
        className={cn("hidden h-7 w-auto shrink-0 dark:block", className)}
      />
    </>
  );
}

export function BrandWordmark({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center overflow-hidden text-base font-semibold tracking-tight",
        className
      )}
    >
      {APP_NAME}
    </span>
  );
}

type BrandProps = {
  className?: string;
  logoClassName?: string;
  showText?: boolean;
};

// NocoBase logo | App name
export function Brand({ className, logoClassName, showText = true }: BrandProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandLogo className={logoClassName} />
      {showText && (
        <>
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <BrandWordmark />
        </>
      )}
    </div>
  );
}
