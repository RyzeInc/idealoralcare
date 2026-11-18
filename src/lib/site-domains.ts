export const ASSURE_ORIGIN = "https://www.assurevantage.com";
export const LEGACY_ORIGIN = "https://www.getidealoh.com";
/** Clerk's primary domain since November 18, 2026: credentials are entered here. */
export const PRIMARY_AUTH_ORIGIN = ASSURE_ORIGIN;
/** getidealoh.com is the Clerk satellite; its visitors sign in on the primary and return. */
export const SATELLITE_ORIGINS = [LEGACY_ORIGIN, "https://getidealoh.com"];

function normalizeHost(host: string | null | undefined) {
  return host?.toLowerCase().replace(/\.$/, "");
}

/** The AssureVantage brand host. */
export function domainSite(host: string | null | undefined) {
  const hostname = normalizeHost(host);
  if (hostname === "assurevantage.com" || hostname === "www.assurevantage.com") {
    return { slug: "assurevantage", origin: ASSURE_ORIGIN, hostname: "www.assurevantage.com", clerkDomain: "assurevantage.com" };
  }
  return null;
}

/** The legacy Ideal host, served as Clerk's satellite. */
export function isLegacyHost(host: string | null | undefined) {
  const hostname = normalizeHost(host);
  return hostname === "getidealoh.com" || hostname === "www.getidealoh.com";
}

export function domainClerkOptions(host: string | null | undefined) {
  if (isLegacyHost(host)) {
    return {
      isSatellite: true,
      domain: "getidealoh.com",
      signInUrl: `${PRIMARY_AUTH_ORIGIN}/assurevantage/sign-in`,
      signUpUrl: `${PRIMARY_AUTH_ORIGIN}/assurevantage/sign-up`,
    };
  }
  const site = domainSite(host);
  if (!site) return {};
  return { signInUrl: `/${site.slug}/sign-in`, signUpUrl: `/${site.slug}/sign-up` };
}

/** Keep visible path-based routes so existing links/cart/site params agree. */
export function domainEntryPath(host: string, pathname: string): string | null {
  const site = domainSite(host);
  if (!site) return null;
  if (pathname === "/assurevantage") return "/";
  if (pathname === "/newideal/checkout") return "/assurevantage/program-checkout";
  if (pathname === "/newideal/success") return "/assurevantage/program-success";
  if (pathname === "/health" || pathname.startsWith("/health/")) return `/${site.slug}${pathname.slice(7)}`;
  return null;
}

/** Every AssureVantage page, including sign-in and checkout, belongs on assurevantage.com. */
export function marketingRedirectOrigin(host: string, pathname: string): string | null {
  if (!isLegacyHost(host)) return null;
  if (pathname !== "/assurevantage" && !pathname.startsWith("/assurevantage/")) return null;
  return ASSURE_ORIGIN;
}
