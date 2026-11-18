import { safeReturnPath } from "./safe-redirect";
import { ASSURE_ORIGIN, SATELLITE_ORIGINS } from "./site-domains";

const AUTH_PAGE = /^\/[^/]+\/(sign-in|sign-up|sso-callback|forgot-password)(?:\/|$)/;

function isAssureReturnPath(pathname: string) {
  return (
    pathname === "/assurevantage" ||
    pathname.startsWith("/assurevantage/") ||
    pathname === "/employer/upload" ||
    pathname === "/access" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/**
 * An absolute return to one of our two production hosts. Sign-in runs on the
 * Clerk primary (assurevantage.com); legacy getidealoh.com visitors come from
 * the satellite and must land back there. Auth pages are refused to avoid loops.
 */
export function isSatelliteAuthReturn(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.username || url.password || AUTH_PAGE.test(url.pathname)) return false;
    if (url.origin === ASSURE_ORIGIN) return isAssureReturnPath(url.pathname);
    return (
      SATELLITE_ORIGINS.includes(url.origin) &&
      url.pathname !== "/assurevantage" &&
      !url.pathname.startsWith("/assurevantage/")
    );
  } catch {
    return false;
  }
}

/** The cross-origin exceptions are our own two production hosts. */
export function safeAuthReturn(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (isSatelliteAuthReturn(raw)) return new URL(raw!).href;
  return safeReturnPath(raw, fallback);
}

export function navigateAfterAuth(
  target: string,
  push: (path: string) => void,
) {
  if (
    isSatelliteAuthReturn(target) &&
    new URL(target).origin !== window.location.origin
  )
    window.location.assign(target);
  else push(target);
}

export function replaceAuthLocation(target: string) {
  window.location.replace(target);
}
