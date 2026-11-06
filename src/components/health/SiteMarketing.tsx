"use client";

import type { ReactNode } from "react";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import {
  isSiteMarketingEnabled,
  type SiteMarketingFeature,
} from "@/convex/lib/siteMarketing";

type Props = { children: ReactNode } & (
  | { feature: SiteMarketingFeature; anyOf?: never }
  | { anyOf: SiteMarketingFeature[]; feature?: never }
);
export function SiteMarketing({ feature, anyOf, children }: Props) {
  const theme = useSiteThemeOptional();
  const features = anyOf ?? [feature!];
  if (
    theme?.isLoading ||
    !features.some((key) => isSiteMarketingEnabled(theme?.site?.marketing, key))
  )
    return null;
  return <>{children}</>;
}
