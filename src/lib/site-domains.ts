export const PRIMARY_AUTH_ORIGIN = "https://www.getidealoh.com";
export const ASSURE_ORIGIN = "https://www.assurevantage.com";
export const SATELLITE_ORIGINS = [ASSURE_ORIGIN, "https://assurevantage.com"];

/** Clerk satellite transport only; AssureVantage is the primary business brand. */
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
  if (pathname === "/assurevantage") return "/";
  if (pathname === "/health" || pathname.startsWith("/health/")) return `/${site.slug}${pathname.slice(7)}`;
  return null;
}

/** New-brand pages belong on the new domain. Clerk's primary auth pages stay here. */
export function marketingRedirectOrigin(host: string, pathname: string): string | null {
  const hostname = host.toLowerCase().replace(/\.$/, "");
  if (hostname !== "getidealoh.com" && hostname !== "www.getidealoh.com") return null;
  if (pathname !== "/assurevantage" && !pathname.startsWith("/assurevantage/")) return null;
  const section = pathname.split("/")[2];
  if (["sign-in", "sign-up", "forgot-password", "sso-callback"].includes(section)) return null;
  return ASSURE_ORIGIN;
}
