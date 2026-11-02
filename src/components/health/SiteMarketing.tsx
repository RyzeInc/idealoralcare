"use client";

import type { ReactNode } from "react";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import { isSiteMarketingEnabled, type SiteMarketingFeature } from "@/convex/lib/siteMarketing";

export function SiteMarketing({ feature, children }: { feature: SiteMarketingFeature; children: ReactNode }) {
  const theme = useSiteThemeOptional();
  if (theme?.isLoading || !isSiteMarketingEnabled(theme?.site?.marketing, feature)) return null;
  return <>{children}</>;
}
