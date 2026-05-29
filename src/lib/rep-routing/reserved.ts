/**
 * Reserved URL path segments that must NOT be usable as rep code slugs.
 * A slug matching any of these would shadow a real site section.
 *
 * Used by:
 *  - src/app/[agentSlug]/page.tsx  (route guard)
 *  - convex/admin/repCodes.ts      (create / update validation)
 */
export const RESERVED_PATHS = new Set([
  // Next.js internals
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  // Top-level app sections
  "admin",
  "api",
  "health",
  "newideal",
  "bootstrap",
  "debug",
  // Auth routes
  "login",
  "signup",
  "sign-in",
  "sign-up",
  "sign-out",
  "sso-callback",
  // Generic info pages
  "about",
  "contact",
  "privacy",
  "terms",
  "legal",
  // Health / newideal inner routes (top-level only; guard against code collision)
  "plans",
  "checkout",
  "enroll",
  "dashboard",
  "claim-invite",
  "manage-plans",
  "oral-health-scan",
  "dental",
  "discount",
  "teledentistry",
  "how-it-works",
  "faq",
  "blog",
  "compare",
  "success",
  "essentials",
  "oralcare",
]);

export function isReservedPath(segment: string): boolean {
  return RESERVED_PATHS.has(segment.toLowerCase());
}
