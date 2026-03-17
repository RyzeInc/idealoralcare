// Global test setup
// This file runs before all tests

// Extend expect with jest-dom matchers when in jsdom environment
// (component tests annotate with @vitest-environment jsdom)
if (typeof window !== "undefined") {
  // We're in jsdom — set up jest-dom matchers
  (async () => {
    const { expect } = await import("vitest");
    const matchers = await import("@testing-library/jest-dom/matchers");
    expect.extend(matchers.default ?? matchers);
  })();
}

export {};
