import { expect, test, vi } from "vitest";
import SiteSlugLayout from "./layout";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { query = mocks.query; } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

test.each(["onboarding", "suspended", "terminated"])("a %s brand is not a public enrollment site", async status => {
  mocks.query.mockResolvedValue({ _id: "site_1", status });
  await expect(SiteSlugLayout({ params: Promise.resolve({ siteSlug: "assurevantage" }), children: null })).rejects.toThrow("NOT_FOUND");
});

test("the legacy synthetic fallback cannot publish an unknown brand", async () => {
  mocks.query.mockResolvedValue({ _id: "pending", status: "active" });
  await expect(SiteSlugLayout({ params: Promise.resolve({ siteSlug: "unknown" }), children: null })).rejects.toThrow("NOT_FOUND");
});

test("an active configured brand remains available", async () => {
  mocks.query.mockResolvedValue({ _id: "site_1", status: "active" });
  await expect(SiteSlugLayout({ params: Promise.resolve({ siteSlug: "assurevantage" }), children: null })).resolves.toBeTruthy();
});
