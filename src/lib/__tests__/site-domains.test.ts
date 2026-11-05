import { describe, expect, test } from "vitest";
import { domainSite, domainEntryPath, domainClerkOptions, ASSURE_ORIGIN, PRIMARY_AUTH_ORIGIN } from "../site-domains";
import { safeAuthReturn, isSatelliteAuthReturn } from "../auth-return";

describe("AssureVantage domain routing", () => {
  test.each(["assurevantage.com", "www.assurevantage.com", "WWW.ASSUREVANTAGE.COM"])("selects the configured brand for %s", host => {
    expect(domainSite(host)).toMatchObject({ slug: "assurevantage", origin: ASSURE_ORIGIN });
    expect(domainEntryPath(host, "/")).toBeNull();
    expect(domainEntryPath(host, "/assurevantage")).toBe("/");
    expect(domainEntryPath(host, "/health/dashboard")).toBe("/assurevantage/dashboard");
  });
  test.each(["getidealoh.com", "www.getidealoh.com", "nexusoralhealth.com", "www.assurevantage.com.evil.test", "assurevantage.com@evil.test"])("preserves existing routing for %s", host => {
    expect(domainSite(host)).toBeNull();
    expect(domainClerkOptions(host)).toEqual({});
    expect(domainEntryPath(host, "/health")).toBeNull();
  });
  test("leaves API, assets and already-branded paths alone", () => {
    for (const path of ["/api/stripe/webhook", "/__clerk/handshake", "/brands/assurevantage/logo.png", "/assurevantage/plans"]) expect(domainEntryPath("www.assurevantage.com", path)).toBeNull();
  });
  test("uses the existing account system and branded primary-domain auth pages", () => {
    expect(domainClerkOptions("www.assurevantage.com")).toEqual({ isSatellite: true, domain: "assurevantage.com", signInUrl: `${PRIMARY_AUTH_ORIGIN}/assurevantage/sign-in`, signUpUrl: `${PRIMARY_AUTH_ORIGIN}/assurevantage/sign-up` });
  });
});

describe("cross-domain auth return allowlist", () => {
  test("admin sign-in returns to the protected console on the configured satellite", () => {
    for (const path of ["/admin", "/admin/hierarchy?tab=sites"]) {
      const destination = ASSURE_ORIGIN + path;
      expect(isSatelliteAuthReturn(destination)).toBe(true);
      expect(safeAuthReturn(destination, "/assurevantage/dashboard")).toBe(destination);
    }
    expect(isSatelliteAuthReturn("https://evil.test/admin")).toBe(false);
    expect(isSatelliteAuthReturn("https://www.assurevantage.com/administrator")).toBe(false);
  });
  test("preserves checkout and scan query parameters on the configured satellite", () => {
    for (const path of ["/assurevantage/checkout?ref=100001&plan=family", "/assurevantage/dashboard?tab=oral-scan&__clerk_synced=false"]) {
      expect(safeAuthReturn(ASSURE_ORIGIN + path, "/health/dashboard")).toBe(ASSURE_ORIGIN + path);
    }
    expect(safeAuthReturn("/assurevantage/dashboard?tab=oral-scan", "/health/dashboard")).toBe("/assurevantage/dashboard?tab=oral-scan");
  });
  test.each([
    "https://evil.test/assurevantage/dashboard",
    "https://www.assurevantage.com.evil.test/assurevantage/dashboard",
    "https://www.assurevantage.com@evil.test/assurevantage/dashboard",
    "https://evil@www.assurevantage.com/assurevantage/dashboard",
    "http://www.assurevantage.com/assurevantage/dashboard",
    "https://www.assurevantage.com/administrator",
    "https://www.assurevantage.com/assurevantage/sign-in",
    "//evil.test", "/\\evil.test", "javascript:alert(1)",
  ])("refuses an unsafe or looping destination: %s", url => {
    expect(isSatelliteAuthReturn(url)).toBe(false);
    expect(safeAuthReturn(url, "/health/dashboard")).toBe("/health/dashboard");
  });
});
