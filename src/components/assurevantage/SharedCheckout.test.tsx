// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SharedCheckout from "./SharedCheckout";
const state = vi.hoisted(() => ({
  isLoaded: false,
  cart: { items: [] as Array<{ product: { slug: string } }> },
}));
vi.mock("@/lib/health-plans", () => ({ useCart: () => state }));
vi.mock("@/app/newideal/checkout/page.client", () => ({
  default: () => <p>Membership checkout</p>,
}));
vi.mock("@/app/health/checkout/page.client", () => ({
  CheckoutContent: () => <p>Oral checkout</p>,
}));
vi.mock("@/components/auth/SatelliteAuthRedirect", () => ({
  SatelliteAuthRedirect: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
afterEach(cleanup);

test("waits for saved cart before choosing checkout", () => {
  state.isLoaded = false;
  render(<SharedCheckout />);
  expect(screen.getByRole("status").textContent).toContain("Loading your cart");
  expect(screen.queryByText("Oral checkout")).toBeNull();
});
test("oral-only cart uses the existing oral checkout without creating a new provider", () => {
  state.isLoaded = true;
  state.cart.items = [{ product: { slug: "oral-individual" } }];
  render(<SharedCheckout />);
  expect(screen.getByText("Oral checkout")).toBeTruthy();
});
test.each(["bfl-individual", "essentials-employee", "oralcare-employee"])(
  "routes %s to program agreements",
  (slug) => {
    state.isLoaded = true;
    state.cart.items = [
      { product: { slug } },
      { product: { slug: "oral-individual" } },
    ];
    render(<SharedCheckout />);
    expect(screen.getByText("Membership checkout")).toBeTruthy();
  },
);

test("an empty cart offers membership discovery before requiring sign-in", () => {
  state.isLoaded = true;
  state.cart.items = [];
  render(<SharedCheckout />);
  expect(
    screen
      .getByRole("link", { name: "Explore memberships" })
      .getAttribute("href"),
  ).toBe("/assurevantage/program-plans");
  expect(screen.queryByText("Membership checkout")).toBeNull();
});
