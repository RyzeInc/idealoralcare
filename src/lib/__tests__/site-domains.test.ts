import { describe, expect, test } from "vitest";
import { domainSite, domainEntryPath, domainClerkOptions, isLegacyHost, marketingRedirectOrigin, ASSURE_ORIGIN, LEGACY_ORIGIN, PRIMARY_AUTH_ORIGIN } from "../site-domains";
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
    expect(domainEntryPath(host, "/health")).toBeNull();
  });
  test("leaves API, assets and already-branded paths alone", () => {
    for (const path of ["/api/stripe/webhook", "/__clerk/handshake", "/brands/assurevantage/logo.png", "/assurevantage/plans"]) expect(domainEntryPath("www.assurevantage.com", path)).toBeNull();
  });
});

describe("Clerk domains", () => {
  test("assurevantage.com is the primary and signs in on its own pages", () => {
    expect(PRIMARY_AUTH_ORIGIN).toBe(ASSURE_ORIGIN);
    expect(domainClerkOptions("www.assurevantage.com")).toEqual({ signInUrl: "/assurevantage/sign-in", signUpUrl: "/assurevantage/sign-up" });
  });
  test.each(["getidealoh.com", "www.getidealoh.com"])("%s is the satellite and signs in on the primary", host => {
    expect(isLegacyHost(host)).toBe(true);
    expect(domainClerkOptions(host)).toEqual({ isSatellite: true, domain: "getidealoh.com", signInUrl: `${ASSURE_ORIGIN}/assurevantage/sign-in`, signUpUrl: `${ASSURE_ORIGIN}/assurevantage/sign-up` });
  });
  test.each(["localhost", "idealoralcare.vercel.app", "nexusoralhealth.com", "getidealoh.com.evil.test"])("%s keeps its own single-domain configuration", host => {
    expect(isLegacyHost(host)).toBe(false);
    expect(domainClerkOptions(host)).toEqual({});
  });
});

describe("cross-domain auth return allowlist", () => {
  test("admin sign-in returns to the protected console on AssureVantage", () => {
    for (const path of ["/admin", "/admin/hierarchy?tab=sites"]) {
      const destination = ASSURE_ORIGIN + path;
      expect(isSatelliteAuthReturn(destination)).toBe(true);
      expect(safeAuthReturn(destination, "/assurevantage/dashboard")).toBe(destination);
    }
    expect(isSatelliteAuthReturn("https://evil.test/admin")).toBe(false);
    expect(isSatelliteAuthReturn("https://www.assurevantage.com/administrator")).toBe(false);
  });
  test("preserves checkout and scan query parameters on AssureVantage", () => {
    for (const path of ["/assurevantage/checkout?ref=100001&plan=family", "/assurevantage/dashboard?tab=oral-scan&__clerk_synced=false"]) {
      expect(safeAuthReturn(ASSURE_ORIGIN + path, "/health/dashboard")).toBe(ASSURE_ORIGIN + path);
    }
    expect(safeAuthReturn("/assurevantage/dashboard?tab=oral-scan", "/health/dashboard")).toBe("/assurevantage/dashboard?tab=oral-scan");
  });
  test("legacy members return to their getidealoh.com destination after signing in on the primary", () => {
    for (const path of ["/health/dashboard", "/newideal/checkout?ref=100001", "/cmg/dashboard", "/admin"]) {
      expect(safeAuthReturn(LEGACY_ORIGIN + path, "/assurevantage/dashboard")).toBe(LEGACY_ORIGIN + path);
    }
  });
  test.each([
    "https://evil.test/assurevantage/dashboard",
    "https://www.assurevantage.com.evil.test/assurevantage/dashboard",
    "https://www.assurevantage.com@evil.test/assurevantage/dashboard",
    "https://evil@www.assurevantage.com/assurevantage/dashboard",
    "http://www.assurevantage.com/assurevantage/dashboard",
    "https://www.assurevantage.com/administrator",
    "https://www.assurevantage.com/assurevantage/sign-in",
    "https://www.getidealoh.com/health/sign-in",
    "https://www.getidealoh.com/assurevantage/dashboard",
    "https://www.getidealoh.com.evil.test/health/dashboard",
    "//evil.test", "/\\evil.test", "javascript:alert(1)",
  ])("refuses an unsafe or looping destination: %s", url => {
    expect(isSatelliteAuthReturn(url)).toBe(false);
    expect(safeAuthReturn(url, "/health/dashboard")).toBe("/health/dashboard");
  });
});

test("every AssureVantage page on getidealoh.com moves to assurevantage.com", () => {
  for (const path of ["/assurevantage/checkout", "/assurevantage/program-checkout", "/assurevantage/program-success", "/assurevantage/sign-in", "/assurevantage/essentials"]) {
    expect(marketingRedirectOrigin("www.getidealoh.com", path)).toBe(ASSURE_ORIGIN);
  }
  expect(marketingRedirectOrigin("www.getidealoh.com", "/health/checkout")).toBeNull();
  expect(marketingRedirectOrigin("www.assurevantage.com", "/assurevantage/sign-in")).toBeNull();
});
