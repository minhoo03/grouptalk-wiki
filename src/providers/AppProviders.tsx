"use client";

import { OverlayProvider } from "overlay-kit";
import type { ReactNode } from "react";

import { QueryProvider } from "@/providers/QueryProvider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <OverlayProvider>{children}</OverlayProvider>
    </QueryProvider>
  );
}
