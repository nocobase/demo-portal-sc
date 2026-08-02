"use client";

import { Header } from "@/components/app-shell/header";
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";
import { PageErrorBoundary } from "./page-error-boundary";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="app-bg flex min-h-svh flex-col bg-muted/25">
      <Header />
      <main
        className={cn(
          "@container/main",
          "mx-auto",
          "max-w-[1600px]",
          "relative",
          "w-full",
          "flex",
          "flex-col",
          "flex-1",
          "px-4",
          "py-5",
          "md:p-6",
          "lg:px-8",
          "lg:py-7"
        )}
      >
        <PageErrorBoundary>{children}</PageErrorBoundary>
      </main>
    </div>
  );
}

Layout.displayName = "Layout";
