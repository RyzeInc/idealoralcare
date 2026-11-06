"use client";

import { useParams } from "next/navigation";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";

/** Shared auth components also appear outside the health and white-label layouts. */
export function useMemberBasePath() {
  const params = useParams<{ siteSlug?: string }>();
  const theme = useSiteThemeOptional();
  if ((theme?.siteSlug ?? theme?.site?.slug) === "assurevantage")
    return "/assurevantage";
  return params?.siteSlug
    ? `/${encodeURIComponent(params.siteSlug)}`
    : "/health";
}
