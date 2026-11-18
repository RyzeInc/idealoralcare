// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.assurevantage.com/assurevantage/program-checkout"}
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssureLink } from "./AssureLink";
vi.mock("next/navigation", () => ({
  usePathname: () => "/assurevantage/program-checkout",
  useSearchParams: () => new URLSearchParams("ref=100001"),
}));
afterEach(cleanup);
test("the home link stays on AssureVantage and keeps the referral", () => {
  render(<AssureLink href="/">Home</AssureLink>);
  const url = new URL(
    screen.getByRole("link", { name: "Home" }).getAttribute("href")!,
  );
  expect(url.origin).toBe("https://www.assurevantage.com");
  expect(url.searchParams.get("ref")).toBe("100001");
  expect(url.searchParams.has("cart")).toBe(false);
});
test.each([
  "/assurevantage/dashboard",
  "/assurevantage/program-checkout",
  "/assurevantage/sign-in",
])("%s stays a same-site path", (href) => {
  render(<AssureLink href={href}>Link</AssureLink>);
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    `${href}?ref=100001`,
  );
});
