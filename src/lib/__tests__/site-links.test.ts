import { describe, expect, test } from "vitest";
import { buildSiteEnrollmentLink, memberSignInPath } from "../site-links";

describe("brand enrollment links", () => {
  test("a protected brand dashboard uses the brand's sign-in page", () => {
    expect(memberSignInPath("/assurevantage/dashboard")).toBe("/assurevantage/sign-in");
    expect(memberSignInPath("/assurevantage/dashboard/family")).toBe("/assurevantage/sign-in");
    for (const path of ["/health/dashboard", "/partner/dashboard", "/admin/dashboard"]) {
      expect(memberSignInPath(path, "/custom-sign-in")).toBe("/custom-sign-in");
    }
  });
  test("works on the existing deployment before a custom domain is available", () => {
    expect(buildSiteEnrollmentLink({ origin: "https://existing.example", siteSlug: "assurevantage", destination: "plans", referralCode: "230001" }))
      .toBe("https://existing.example/assurevantage/plans?ref=230001");
  });

  test("uses the configured custom domain once supplied, keeping the broker code", () => {
    expect(buildSiteEnrollmentLink({ origin: "https://www.getidealoh.com", siteDomain: "www.assurevantage.com", siteSlug: "assurevantage", destination: "plans", referralCode: "100401" })).toBe("https://www.assurevantage.com/assurevantage/plans?ref=100401");
  });
  test.each(["https://example.com/path", "https://user:password@example.com", "https://example.com?ref=other", "//evil.example"])("rejects an invalid configured domain: %s", siteDomain => {
    expect(() => buildSiteEnrollmentLink({ origin: "https://www.getidealoh.com", siteDomain, siteSlug: "assurevantage", destination: "plans" })).toThrow();
  });

  test("scan links go to the authenticated member tool, preserving the brand", () => {
    const url = new URL(buildSiteEnrollmentLink({ origin: "https://existing.example", siteSlug: "assurevantage", destination: "scan" }));
    expect(url.pathname).toBe("/assurevantage/dashboard");
    expect(url.searchParams.get("tab")).toBe("oral-scan");
    expect(memberSignInPath(url.pathname)).toBe("/assurevantage/sign-in");
  });

  test.each(["ideal-health", "ryze-health"])("uses the primary route for %s", siteSlug => {
    expect(buildSiteEnrollmentLink({ origin: "https://existing.example/admin", siteSlug, destination: "enroll" }))
      .toBe("https://existing.example/health/enroll");
  });

  test("keeps a referral code intact as query data", () => {
    const url = new URL(buildSiteEnrollmentLink({ origin: "https://existing.example", siteSlug: "brand", destination: "landing", referralCode: " A&B#1 " }));
    expect(url.pathname).toBe("/brand");
    expect(url.searchParams.get("ref")).toBe("A&B#1");
    expect(url.hash).toBe("");
  });

  test("refuses a non-web origin", () => {
    expect(() => buildSiteEnrollmentLink({ origin: "javascript:alert(1)", siteSlug: "brand", destination: "plans" })).toThrow();
  });
});
