// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.getidealoh.com/assurevantage/program-checkout"}
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssureLink } from "./AssureLink";
vi.mock("next/navigation", () => ({
  usePathname: () => "/assurevantage/program-checkout",
  useSearchParams: () => new URLSearchParams("ref=100001"),
}));
vi.mock("@/lib/health-plans/cart-context", () => ({
  useCartOptional: () => ({
    isLoaded: true,
    cart: {
      items: [],
      cadence: "monthly",
      paymentMethod: "ach",
      referralCode: "100001",
      referralCodeSource: "url",
    },
  }),
}));
afterEach(cleanup);
test("return links carry checkout edits to the AssureVantage site, including an empty cart", () => {
  render(<AssureLink href="/">Home</AssureLink>);
  const url = new URL(
    screen.getByRole("link", { name: "Home" }).getAttribute("href")!,
  );
  expect(url.origin).toBe("https://www.assurevantage.com");
  expect(JSON.parse(url.searchParams.get("cart")!)).toMatchObject({
    ids: [],
    paymentMethod: "ach",
    referralCode: "100001",
  });
});
test("member destinations preserve their existing authentication routing", () => {
  render(
    <AssureLink href="/assurevantage/dashboard">Member portal</AssureLink>,
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "/assurevantage/dashboard?ref=100001",
  );
});
