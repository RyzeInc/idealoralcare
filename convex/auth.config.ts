/**
 * CONVEX AUTH CONFIGURATION
 *
 * Tells Convex which external auth providers to trust when validating JWTs.
 * Without this file, ctx.auth.getUserIdentity() always returns null.
 *
 * Domain is derived from the NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
 *   pk_test_ZmFzdC1tb2xseS01LmNsZXJrLmFjY291bnRzLmRldiQ
 *   → base64 decode → fast-molly-5.clerk.accounts.dev
 *
 * To update for production: replace the domain with your production Clerk
 * Frontend API URL (find it in Clerk Dashboard → API Keys → Frontend API URL).
 */
export default {
  providers: [
    {
      domain: "https://fast-molly-5.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
