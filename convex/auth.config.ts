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
const DEV_CLERK = "https://fast-molly-5.clerk.accounts.dev";
const PROD_CLERK = "https://clerk.getidealoh.com";

/**
 * Trust exactly one Clerk instance per deployment. Set CLERK_JWT_ISSUER_DOMAIN
 * on each Convex deployment (production: https://clerk.getidealoh.com). Without
 * it, both instances are trusted, as before — which lets anyone who signs up
 * on the dev Clerk app present a token production accepts, so set it on prod.
 */
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
const providers: { domain: string; applicationID: string }[] = issuer
  ? [{ domain: issuer, applicationID: "convex" }]
  : [
      { domain: DEV_CLERK, applicationID: "convex" },
      { domain: PROD_CLERK, applicationID: "convex" },
    ];

export default { providers };
