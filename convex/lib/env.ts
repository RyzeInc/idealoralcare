const PRODUCTION_URL = "https://getidealoh.com";
const DEV_URL = "http://localhost:3000";

function isLoopback(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

/**
 * Return the app base URL based on the current environment.
 * Production is detected via NEXT_PUBLIC_APP_ENV or NEXT_PUBLIC_APP_URL.
 *
 * A loopback NEXT_PUBLIC_APP_URL is ignored in production: this value is read
 * by Convex actions that build links for outbound email, and a stale localhost
 * override there ships unreachable links to real members.
 */
export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const isProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";

  if (configured && !(isProduction && isLoopback(configured))) return configured;
  if (process.env.NEXT_PUBLIC_APP_ENV === "development") return DEV_URL;
  return PRODUCTION_URL;
}
