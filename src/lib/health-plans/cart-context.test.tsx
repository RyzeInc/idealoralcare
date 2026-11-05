// @vitest-environment jsdom
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CartProvider, useCart } from "./cart-context";
import type { CatalogProduct } from "./types";

function product(slug: string): CatalogProduct {
  return { _id: slug, slug, name: slug, category: "newideal", description: "", inclusions: [], exclusions: [], eligibilityRules: { requiresVerification: false, disclosureText: "" }, activationBehavior: "immediate", pricing: { monthlyCardCents: 1000, monthlyACHCents: 1000, annualCardCents: 10000, annualACHCents: 10000 }, isVisible: true, isFeatured: false, order: 0 };
}
function CartHarness() {
  const { cart, addItem, setCadence, removeItem, monthlyOnly, isLoaded } = useCart();
  return <>
    <output data-testid="cart">{JSON.stringify({ cart, monthlyOnly, isLoaded })}</output>
    {["essentials-employee", "essentials-employee-family", "bfl-individual", "oral-individual"].map(slug => <button key={slug} onClick={() => addItem(product(slug))}>{slug}</button>)}
    <button onClick={() => setCadence("annual")}>annual</button>
    <button onClick={() => removeItem("essentials-employee")}>remove essentials</button>
  </>;
}
const read = () => JSON.parse(screen.getByTestId("cart").textContent!);
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name, exact: true }));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("one branded cart persists across remounts and never loads the legacy cart", () => {
  localStorage.setItem("ideal-health-cart", JSON.stringify({ items: [], cadence: "annual" }));
  const first = render(<CartProvider storageNamespace="assurevantage"><CartHarness /></CartProvider>);
  click("oral-individual");
  click("annual");
  first.unmount();
  render(<CartProvider storageNamespace="assurevantage"><CartHarness /></CartProvider>);
  expect(read().cart.items.map((i: { productId: string }) => i.productId)).toEqual(["oral-individual"]);
  expect(read().cart.cadence).toBe("annual");
});

test("Essentials replaces standalone BFL, locks the whole cart monthly, and allows annual after removal", () => {
  render(<CartProvider storageNamespace="assurevantage"><CartHarness /></CartProvider>);
  click("oral-individual"); click("annual"); click("bfl-individual");
  expect(read().cart.cadence).toBe("monthly");
  click("essentials-employee"); click("annual");
  expect(read().cart.items.map((i: { productId: string }) => i.productId)).toEqual(["oral-individual", "essentials-employee"]);
  expect(read().cart.cadence).toBe("monthly");
  expect(read().monthlyOnly).toBe(true);
  click("remove essentials"); click("annual");
  expect(read().cart.cadence).toBe("annual");
});

test("switching Essentials tier or choosing standalone BFL never charges for both memberships", () => {
  render(<CartProvider storageNamespace="assurevantage"><CartHarness /></CartProvider>);
  click("essentials-employee"); click("essentials-employee-family");
  expect(read().cart.items).toHaveLength(1);
  expect(read().cart.items[0].product.slug).toBe("essentials-employee-family");
  click("bfl-individual");
  expect(read().cart.items).toHaveLength(1);
  expect(read().cart.items[0].product.slug).toBe("bfl-individual");
});

test("repairs conflicting saved carts before checkout and keeps referral attribution", () => {
  localStorage.setItem("ideal-health-cart:assurevantage", JSON.stringify({
    items: ["bfl-individual", "essentials-employee", "oral-individual"].map(slug => ({ productId: slug, product: product(slug), addedAt: 0 })),
    cadence: "annual", paymentMethod: "card", compareItems: [], referralCode: "100401", referralCodeSource: "url",
  }));
  render(<CartProvider storageNamespace="assurevantage"><CartHarness /></CartProvider>);
  expect(read().cart.items).toHaveLength(2);
  expect(read().cart.cadence).toBe("monthly");
  expect(read().cart.referralCode).toBe("100401");
});
