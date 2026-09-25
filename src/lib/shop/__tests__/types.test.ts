/**
 * Price display tests.
 *
 * We don't control merchant pricing and we don't re-scrape it, so a bare
 * "$29.99" would be a claim we can't stand behind. Every rendered price must
 * read as approximate and say when we looked.
 */
import { describe, it, expect } from "vitest";
import { formatCapturedPrice } from "../types";

describe("formatCapturedPrice", () => {
  it("returns null when there is no price, so the card renders nothing", () => {
    expect(formatCapturedPrice(undefined, Date.now())).toBeNull();
  });

  it("qualifies the amount as approximate and stamps the capture date", () => {
    const captured = new Date("2026-07-15T12:00:00Z").getTime();
    const result = formatCapturedPrice(2800, captured);
    expect(result).toContain("About $28.00");
    expect(result).toMatch(/Jul 1[45], 2026/); // Local timezone may shift the day
    expect(result).toContain("Merchant's price at checkout applies.");
  });

  it("still qualifies the amount when no capture time was recorded", () => {
    expect(formatCapturedPrice(1599, undefined)).toBe(
      "About $15.99 at the merchant",
    );
  });

  it("never renders a bare currency amount", () => {
    const result = formatCapturedPrice(999, Date.now());
    expect(result).not.toMatch(/^\$/);
    expect(result?.toLowerCase()).toContain("about");
  });

  it("formats a zero price rather than treating it as missing", () => {
    expect(formatCapturedPrice(0, undefined)).toBe("About $0.00 at the merchant");
  });
});
