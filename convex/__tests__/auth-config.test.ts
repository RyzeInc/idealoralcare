import { afterEach, expect, test, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test("primary and satellite sessions use the same production trust boundary", async () => {
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://clerk.getidealoh.com");
  const config = (await import("../auth.config")).default;
  expect(config.providers).toEqual([
    { domain: "https://clerk.getidealoh.com", applicationID: "convex" },
    { domain: "https://clerk.assurevantage.com", applicationID: "convex" },
  ]);
});
test("an explicitly configured dev instance does not trust production", async () => {
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://fast-molly-5.clerk.accounts.dev");
  const config = (await import("../auth.config")).default;
  expect(config.providers).toHaveLength(1);
  expect(config.providers[0].domain).toBe("https://fast-molly-5.clerk.accounts.dev");
});
test("production fallback excludes development credentials", async () => {
  vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "");
  vi.stubEnv("CONVEX_DEPLOYMENT", "prod:production");
  const config = (await import("../auth.config")).default;
  expect(config.providers.every(provider => !provider.domain.includes("accounts.dev"))).toBe(true);
});
