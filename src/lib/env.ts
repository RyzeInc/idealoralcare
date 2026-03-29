const PRODUCTION_URL = "https://getidealoh.com";
const DEV_URL = "http://localhost:3000";

/**
 * Return the app base URL based on the current environment.
 * Production is detected via NEXT_PUBLIC_APP_ENV or NEXT_PUBLIC_APP_URL.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_APP_ENV === "development") return DEV_URL;
  return PRODUCTION_URL;
}
