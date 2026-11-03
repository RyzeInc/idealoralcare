export const PRIMARY_AUTH_ORIGIN = "https://www.getidealoh.com";
export const ASSURE_ORIGIN = "https://www.assurevantage.com";
export const SATELLITE_ORIGINS = [ASSURE_ORIGIN, "https://assurevantage.com"];

/** Only explicitly configured hosts select a brand or satellite auth context. */
export function domainSite(host: string | null | undefined) {
  const hostname = host?.toLowerCase().replace(/\.$/, "");
  if (hostname === "assurevantage.com" || hostname === "www.assurevantage.com") {
    return { slug: "assurevantage", origin: ASSURE_ORIGIN, hostname: "www.assurevantage.com", clerkDomain: "assurevantage.com" };
  }
  return null;
}

export function domainClerkOptions(host: string | null | undefined) {
  const site = domainSite(host);
  if (!site) return {};
  return {
    isSatellite: true,
    domain: site.clerkDomain,
    signInUrl: `${PRIMARY_AUTH_ORIGIN}/${site.slug}/sign-in`,
    signUpUrl: `${PRIMARY_AUTH_ORIGIN}/${site.slug}/sign-up`,
  };
}

/** Keep visible path-based routes so existing links/cart/site params agree. */
export function domainEntryPath(host: string, pathname: string): string | null {
  const site = domainSite(host);
  if (!site) return null;
  if (pathname === "/") return `/${site.slug}`;
  if (pathname === "/health" || pathname.startsWith("/health/")) return `/${site.slug}${pathname.slice(7)}`;
  return null;
}
