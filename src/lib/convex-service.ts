/**
 * Server-only: the shared secret that tells Convex a call came from our own
 * Next.js server (a verified webhook, or a route that has already checked the
 * signed-in user). See convex/lib/serviceAuth.ts.
 *
 * Never import this from a client component — the value must not reach the
 * browser. It has no NEXT_PUBLIC_ prefix, so Next keeps it server-side.
 */
export function convexServiceSecret(): string {
  const secret = process.env.CONVEX_SERVICE_SECRET;
  if (!secret) {
    throw new Error("CONVEX_SERVICE_SECRET is not set — server-to-Convex calls cannot authenticate.");
  }
  return secret;
}
