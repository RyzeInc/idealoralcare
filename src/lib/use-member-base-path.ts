"use client";

import { useParams } from "next/navigation";

/** Shared auth components also appear outside the health and white-label layouts. */
export function useMemberBasePath() {
  const params = useParams<{ siteSlug?: string }>();
  return params?.siteSlug ? `/${encodeURIComponent(params.siteSlug)}` : "/health";
}
