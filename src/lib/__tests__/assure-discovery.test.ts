// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ host: "www.assurevantage.com" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
}));
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { assureMetadata } from "../assure-metadata";
import { ASSURE_PAGES } from "../assure-content";
beforeEach(() => {
  state.host = "www.assurevantage.com";
});
test("Assure discovery includes all public benefits and guides on the correct host", async () => {
  const urls = (await sitemap()).map((p) => p.url);
  expect(urls).toContain("https://www.assurevantage.com/");
  for (const slug of Object.keys(ASSURE_PAGES))
    expect(urls).toContain(
      "https://www.assurevantage.com/assurevantage/" + slug,
    );
  expect(
    urls.every((url) => url.startsWith("https://www.assurevantage.com/")),
  ).toBe(true);
  expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
  expect((await robots()).sitemap).toBe(
    "https://www.assurevantage.com/sitemap.xml",
  );
});
test("Ideal discovery remains on its historical host", async () => {
  state.host = "www.getidealoh.com";
  const urls = (await sitemap()).map((p) => p.url);
  expect(urls).toContain("https://getidealoh.com/health");
  expect(urls.some((url) => url.includes("assurevantage"))).toBe(false);
  expect((await robots()).sitemap).toBe("https://getidealoh.com/sitemap.xml");
});
test("each public page has specific metadata and a matching canonical", () => {
  for (const slug of Object.keys(ASSURE_PAGES)) {
    const meta = assureMetadata(slug);
    expect(meta.description).toBe(ASSURE_PAGES[slug].description);
    expect(meta.alternates?.canonical).toBe(
      "https://www.assurevantage.com/assurevantage/" + slug,
    );
  }
});
test.each([
  "dashboard",
  "manage-plans",
  "sign-in",
  "claim-invite",
  "program-checkout",
  "program-success",
])("%s stays out of indexing", (slug) => {
  expect(assureMetadata(slug).robots).toMatchObject({
    index: false,
    follow: false,
  });
});
