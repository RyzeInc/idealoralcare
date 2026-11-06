import { PRIMARY_AUTH_ORIGIN, domainSite } from "./site-domains";

/** One checkout destination per brand; payment returns never accept arbitrary client URLs. */
export function checkoutReturnUrls(
  requestUrl: string,
  fallbackOrigin: string,
  siteSlug?: string,
  bfl = false,
) {
  const request = new URL(requestUrl);
  const primaryHost = ["getidealoh.com", "www.getidealoh.com"].includes(
    request.hostname,
  );
  const local = ["localhost", "127.0.0.1"].includes(request.hostname);
  const origin = primaryHost
    ? "https://www.getidealoh.com"
    : local
      ? request.origin
      : new URL(fallbackOrigin).origin;
  const secureOrigin =
    local || request.hostname.endsWith(".vercel.app")
      ? request.origin
      : PRIMARY_AUTH_ORIGIN;
  if (siteSlug === "assurevantage" || domainSite(request.hostname)) {
    return {
      success: `${secureOrigin}/assurevantage/program-success?session_id={CHECKOUT_SESSION_ID}${bfl ? "&program=bfl" : ""}`,
      cancel: `${secureOrigin}/assurevantage/program-checkout`,
    };
  }
  const base =
    siteSlug && siteSlug !== "ideal-health"
      ? `/${encodeURIComponent(siteSlug)}`
      : "/health";
  return {
    success: `${origin}${base === "/newideal" ? "/newideal/success" : `${base}/dashboard`}?session_id={CHECKOUT_SESSION_ID}&status=success${bfl ? "&program=bfl" : ""}`,
    cancel: `${origin}${base}/checkout`,
  };
}
