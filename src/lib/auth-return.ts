import { safeReturnPath } from "./safe-redirect";
import { ASSURE_ORIGIN } from "./site-domains";

export function isSatelliteAuthReturn(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.origin === ASSURE_ORIGIN && !url.username && !url.password &&
      (url.pathname === "/assurevantage" || url.pathname.startsWith("/assurevantage/") ||
        url.pathname === "/admin" || url.pathname.startsWith("/admin/")) &&
      !/^\/assurevantage\/(sign-in|sign-up|sso-callback|forgot-password)(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}

/** The one cross-origin exception is the configured satellite, its brand routes and its protected admin console. */
export function safeAuthReturn(raw: string | null | undefined, fallback: string): string {
  if (isSatelliteAuthReturn(raw)) return new URL(raw!).href;
  return safeReturnPath(raw, fallback);
}

export function navigateAfterAuth(target: string, push: (path: string) => void) {
  if (isSatelliteAuthReturn(target) && window.location.origin !== ASSURE_ORIGIN) window.location.assign(target);
  else push(target);
}

export function replaceAuthLocation(target: string) {
  window.location.replace(target);
}
