/**
 * Shop compliance guard tests.
 *
 * These guards are the enforcement point for two rules in
 * docs/internal/SHOP_DESIGN.md that carry real legal exposure:
 *
 *   Rule 2 — product copy may describe what a thing is, never what it treats.
 *   Rule 4 — the shop may not carry merchants that compete with our own plans.
 *
 * If someone loosens a pattern here, they should have to delete a test to do it.
 */
import { describe, it, expect } from "vitest";
import {
  __testOnly_assertNoDiseaseClaims as assertNoDiseaseClaims,
  __testOnly_assertUsableAffiliateUrl as assertUsableAffiliateUrl,
  __testOnly_slugify as slugify,
} from "./admin";

describe("disease-claim guard", () => {
  it("accepts descriptive copy", () => {
    expect(() =>
      assertNoDiseaseClaims({
        shortDescription: "Fluoride-free toothpaste with nano-hydroxyapatite.",
        description: "A mint-flavored daily toothpaste in a recyclable tube.",
      }),
    ).not.toThrow();
  });

  it.each([
    ["prevents cavities", "prevents cavities and tartar"],
    ["treats", "treats bad breath at the source"],
    ["cures", "cures dry mouth overnight"],
    ["reverses", "reverses early enamel loss"],
    ["heals", "heals irritated gums"],
    ["gingivitis", "clinically shown to reduce gingivitis"],
    ["periodontal", "supports periodontal recovery"],
    ["disease", "fights gum disease"],
    ["diagnose", "helps diagnose enamel wear"],
    ["FDA-approved", "an FDA-approved whitening system"],
  ])("rejects %s", (_label, copy) => {
    expect(() => assertNoDiseaseClaims({ shortDescription: copy })).toThrow(
      /health claim/i,
    );
  });

  it("names the offending field so an admin can find it", () => {
    expect(() =>
      assertNoDiseaseClaims({ "highlights[2]": "prevents decay" }),
    ).toThrow(/highlights\[2\]/);
  });

  it("ignores undefined fields rather than treating them as empty strings", () => {
    expect(() =>
      assertNoDiseaseClaims({ description: undefined, name: "Ela Mint" }),
    ).not.toThrow();
  });

  it("is case-insensitive", () => {
    expect(() => assertNoDiseaseClaims({ name: "PREVENTS Cavities" })).toThrow();
  });

  it("does not fire on substrings inside ordinary words", () => {
    // "treats" must not match "retreats"; "cures" must not match "manicures".
    expect(() =>
      assertNoDiseaseClaims({ description: "Spa retreats and manicures." }),
    ).not.toThrow();
  });
});

describe("affiliate URL guard", () => {
  it("accepts an https merchant link", () => {
    expect(() =>
      assertUsableAffiliateUrl("https://www.boka.com/products/ela-mint?ref=nexus"),
    ).not.toThrow();
  });

  it("rejects a non-absolute URL", () => {
    expect(() => assertUsableAffiliateUrl("/products/ela-mint")).toThrow(
      /absolute URL/i,
    );
  });

  it("rejects http", () => {
    expect(() => assertUsableAffiliateUrl("http://boka.com/x")).toThrow(/https/i);
  });

  it.each([
    "https://careington.com/plans",
    "https://www.dentalplans.com/offer",
    "https://letsgetchecked.com/kits",
    "https://lifelinescreening.com/book",
  ])("rejects %s as competing with our own plans", (url) => {
    expect(() => assertUsableAffiliateUrl(url)).toThrow(/plan catalog/i);
  });

  it("rejects a subdomain of a competing merchant", () => {
    expect(() => assertUsableAffiliateUrl("https://shop.careington.com/x")).toThrow(
      /plan catalog/i,
    );
  });

  it("does not reject a merchant that merely contains a blocked name", () => {
    // "notcareington.com" is a different registrable domain and must pass.
    expect(() =>
      assertUsableAffiliateUrl("https://notcareington.com/x"),
    ).not.toThrow();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Boka Ela Mint Toothpaste")).toBe("boka-ela-mint-toothpaste");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("  Quip™ — Electric Brush!  ")).toBe("quip-electric-brush");
  });

  it("returns empty for input with no alphanumerics, so callers can reject it", () => {
    expect(slugify("—™—")).toBe("");
  });
});
