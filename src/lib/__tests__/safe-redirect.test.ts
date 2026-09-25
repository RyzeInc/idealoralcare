// @vitest-environment node

/**
 * The bug these cover: src/proxy.ts sent "http://host/partner" and the sign-in
 * page, which accepted only values starting with "/", silently swapped it for
 * /health/dashboard — so signing in from a protected page never returned you
 * to that page. The off-origin cases are the other half: this value decides
 * where a newly authenticated session lands, and it arrives from the URL.
 */

import { afterEach, describe, expect, it } from "vitest";
import { safeReturnPath } from "../safe-redirect";

const FALLBACK = "/health/dashboard";

function withOrigin(origin: string) {
  (globalThis as { window?: unknown }).window = { location: { origin } };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("safeReturnPath", () => {
  it("keeps a plain path", () => {
    expect(safeReturnPath("/partner", FALLBACK)).toBe("/partner");
  });

  it("keeps a path's query string and hash", () => {
    expect(safeReturnPath("/partner/book?tab=open#row-3", FALLBACK)).toBe(
      "/partner/book?tab=open#row-3",
    );
  });

  it("falls back when nothing was supplied", () => {
    expect(safeReturnPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeReturnPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeReturnPath("", FALLBACK)).toBe(FALLBACK);
    expect(safeReturnPath("   ", FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on a relative path with no leading slash", () => {
    expect(safeReturnPath("partner", FALLBACK)).toBe(FALLBACK);
  });

  it("reduces a same-origin absolute URL to its path", () => {
    withOrigin("https://getidealoh.com");
    expect(
      safeReturnPath("https://getidealoh.com/partner?tab=open", FALLBACK),
    ).toBe("/partner?tab=open");
  });

  it("falls back on an absolute URL for another origin", () => {
    withOrigin("https://getidealoh.com");
    expect(safeReturnPath("https://evil.example/partner", FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on an absolute URL when there is no window to compare against", () => {
    expect(safeReturnPath("https://getidealoh.com/partner", FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("falls back on a protocol-relative URL despite its leading slash", () => {
    expect(safeReturnPath("//evil.example/partner", FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on a backslash-escaped host", () => {
    expect(safeReturnPath("/\\evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on a javascript: payload", () => {
    expect(safeReturnPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
  });
});
