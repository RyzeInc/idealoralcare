import { isReservedPath } from "./rep-routing/reserved";

export type SiteLinkDestination = "landing" | "plans" | "enroll" | "scan";

export function memberSignInPath(pathname: string, fallback = "/health/sign-in") {
  const [segment, page] = pathname.split("/").filter(Boolean);
  if (page === "dashboard" && segment && !isReservedPath(segment)) return `/${segment}/sign-in`;
  return fallback;
}

export function siteBasePath(slug: string): string {
  return slug === "ideal-health" || slug === "ryze-health" ? "/health" : `/${encodeURIComponent(slug)}`;
}

/** Use the current deployment's path-based site; no custom domain is required. */
export function buildSiteEnrollmentLink({ origin, siteSlug, destination, referralCode = "" }: {
  origin: string;
  siteSlug: string;
  destination: SiteLinkDestination;
  referralCode?: string;
}): string {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol)) throw new Error("A website URL is required");
  const suffix = destination === "landing" ? "" : destination === "scan" ? "/dashboard" : `/${destination}`;
  const url = new URL(`${siteBasePath(siteSlug)}${suffix}`, base.origin);
  if (destination === "scan") url.searchParams.set("tab", "oral-scan");
  if (referralCode.trim()) url.searchParams.set("ref", referralCode.trim());
  return url.toString();
}
