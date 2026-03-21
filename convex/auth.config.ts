/**
 * CONVEX AUTH CONFIGURATION
 *
 * Tells Convex which external auth providers to trust when validating JWTs.
 * Without this file, ctx.auth.getUserIdentity() always returns null.
 *
 * Dev domain is derived from the dev NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
 *   pk_test_ZmFzdC1tb2xseS01LmNsZXJrLmFjY291bnRzLmRldiQ
 *   → base64 decode → fast-molly-5.clerk.accounts.dev
 *
 * For production, set CLERK_JWT_ISSUER_DOMAIN in Convex Dashboard →
 * Settings → Environment Variables. Value should be your production Clerk
 * Frontend API URL (find it in Clerk Dashboard → Configure → Domains →
 * "Frontend API URL"), e.g. "https://clerk.getidealoh.com".
 */
const providers: { domain: string; applicationID: string }[] = [
  // Dev Clerk instance (local development)
  {
    domain: "https://fast-molly-5.clerk.accounts.dev",
    applicationID: "convex",
  },
  // Production Clerk instance (getidealoh.com)
  // Frontend API URL from Clerk Dashboard → Configure → Domains → Frontend API URL
  {
    domain: "https://clerk.getidealoh.com",
    applicationID: "convex",
  },
];

// Optional override via env var (e.g. if the production domain changes)
// NOTE: process.env here is read from your LOCAL environment at `npx convex deploy` time,
// NOT from the Convex dashboard. Set it in .env.local if needed.
if (process.env.CLERK_JWT_ISSUER_DOMAIN && !providers.some(p => p.domain === process.env.CLERK_JWT_ISSUER_DOMAIN)) {
  providers.push({
    domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
    applicationID: "convex",
  });
}

export default { providers };
