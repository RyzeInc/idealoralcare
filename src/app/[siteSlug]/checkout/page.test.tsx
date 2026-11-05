// @vitest-environment node
import { expect, test, vi } from "vitest";
import SiteCheckout from "./page";
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("@/app/health/checkout/page", () => ({ default: () => null }));

test("old AssureVantage checkout URLs reach the shared checkout with referral parameters", async () => {
  await expect(SiteCheckout({ params: Promise.resolve({ siteSlug: "assurevantage" }), searchParams: Promise.resolve({ ref: "100401", tier: "family" }) })).rejects.toThrow("/assurevantage/program-checkout?ref=100401&tier=family");
});
test("other sites retain their existing checkout", async () => {
  const result = await SiteCheckout({ params: Promise.resolve({ siteSlug: "flourishxv" }), searchParams: Promise.resolve({}) });
  expect(result.type).toBeTypeOf("function");
});
