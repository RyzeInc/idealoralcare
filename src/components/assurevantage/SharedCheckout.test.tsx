// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SharedCheckout from "./SharedCheckout";
const state = vi.hoisted(() => ({
  isLoaded: false,
  cart: {
    items: [] as Array<{ product: { slug: string } }>,
    cadence: "monthly",
    paymentMethod: "card",
  },
  syncProductPricing: vi.fn(),
}));
vi.mock("@/lib/health-plans", () => ({ useCart: () => state }));
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("./UnifiedCheckout", () => ({
  UnifiedCheckout: () => <p>Unified checkout</p>,
}));
vi.mock("./AssureLink", () => ({
  AssureLink: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
afterEach(cleanup);
test("waits for saved cart", () => {
  state.isLoaded = false;
  render(<SharedCheckout />);
  expect(screen.getByRole("status").textContent).toContain("Loading your cart");
});
test.each([
  "oral-individual",
  "bfl-individual",
  "essentials-employee",
  "oralcare-employee",
])(
  "%s uses the same public checkout without an authentication gate",
  (slug) => {
    state.isLoaded = true;
    state.cart.items = [{ product: { slug } }];
    render(<SharedCheckout />);
    expect(screen.getByText("Unified checkout")).toBeTruthy();
  },
);
test("an empty cart offers memberships without requiring an account", () => {
  state.isLoaded = true;
  state.cart.items = [];
  render(<SharedCheckout />);
  expect(
    screen.getByRole("link", { name: "Explore memberships" }),
  ).toBeTruthy();
  expect(screen.queryByText("Unified checkout")).toBeNull();
});
