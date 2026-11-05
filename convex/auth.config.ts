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
const PROD_SATELLITE_CLERK = "https://clerk.assurevantage.com";

/**
 * Satellite sessions use their own issuer URL, signed by the same Clerk
 * instance as the primary domain. Keep the production allowlist explicit;
 * never accept arbitrary issuers or mix the development app into production.
 */
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
const productionIssuers = [PROD_CLERK, PROD_SATELLITE_CLERK];
const domains = issuer
  ? productionIssuers.includes(issuer) ? productionIssuers : [issuer]
  : process.env.CONVEX_DEPLOYMENT?.startsWith("prod:")
    ? productionIssuers
    : [DEV_CLERK, ...productionIssuers];

const authConfig = {
  providers: domains.map(domain => ({ domain, applicationID: "convex" })),
};

export default authConfig;
