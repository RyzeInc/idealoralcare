// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import OfferingCatalog from "./OfferingCatalog";
import { CartProvider, useCart } from "@/lib/health-plans";

const products = [
  { _id: "essentials", slug: "essentials-employee", name: "Essentials Employee", category: "newideal", order: 1 },
  { _id: "bfl", slug: "bfl-individual", name: "Balance for Life", category: "newideal", order: 2 },
  { _id: "oral", slug: "oral-individual", name: "Oral Savings Individual", category: "dental", order: 3 },
  { _id: "essentials-family", slug: "essentials-employee-family", name: "Essentials Family", category: "newideal", order: 4 },
].map(p => {
  const monthly = p._id === "essentials-family" ? 8395 : 1995;
  return { ...p, isVisible: true, pricing: { monthlyCardCents: monthly, monthlyACHCents: monthly, annualCardCents: monthly * 10, annualACHCents: monthly * 10 } };
});
vi.mock("convex/react", () => ({ useQuery: () => products }));
vi.mock("@/convex/_generated/api", () => ({ api: { catalog: { queries: { list: "list" } } } }));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("starts empty, switches to monthly for memberships, and explains included Balance for Life", () => {
  render(<CartProvider storageNamespace="assurevantage"><OfferingCatalog /></CartProvider>);
  const bflCard = screen.getByRole("heading", { name: "Balance for Life", exact: true }).closest("article")!;
  const bflOptions = within(bflCard).getAllByRole("option");
  expect(bflOptions.map(option => option.textContent)).toEqual(["Individual + family"]);
  expect(within(bflCard).getByRole("combobox", { name: "Choose your membership" })).toHaveValue("bfl");
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).textContent).toContain("(0)");
  fireEvent.click(screen.getByRole("button", { name: "Annual", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Add Oral Care" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Balance for Life" }));
  expect(screen.queryByRole("button", { name: "Annual", exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "Upgrade to Essentials" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Upgrade to Essentials" }));
  expect(screen.getByRole("button", { name: "Included with Essentials" })).toBeDisabled();
  expect(screen.getByRole("status").textContent).toContain("Standalone Balance for Life was removed");
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).textContent).toContain("(2)");
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).getAttribute("href")).toBe("/assurevantage/program-checkout");
});

function CartSelection() {
  const { cart, subtotalCents, removeItem } = useCart();
  return (
    <>
      <output aria-label="Selected products">{cart.items.map(item => item.productId).join(",")}</output>
      <output aria-label="Cart total">{subtotalCents}</output>
      <button onClick={() => removeItem("bfl")}>Remove BFL</button>
    </>
  );
}

test("upgrading uses the chosen Essentials tier, preserves Oral Care and removes the standalone BFL charge", () => {
  render(<CartProvider storageNamespace="assurevantage"><OfferingCatalog /><CartSelection /></CartProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add Oral Care" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Balance for Life" }));
  const essentialsCard = screen.getByRole("heading", { name: "Essentials", exact: true }).closest("article")!;
  fireEvent.change(within(essentialsCard).getByRole("combobox", { name: "Choose your membership" }), { target: { value: "essentials-family" } });
  fireEvent.click(screen.getByRole("button", { name: "Upgrade to Essentials" }));
  expect(screen.getByLabelText("Selected products").textContent).toBe("oral,essentials-family");
  expect(screen.getByLabelText("Cart total").textContent).toBe("10390");
  expect(screen.getByRole("button", { name: "Included with Essentials" })).toBeDisabled();
});

test("the upgrade suggestion survives a reload and resets when standalone BFL is removed", () => {
  const view = render(<CartProvider storageNamespace="assurevantage"><OfferingCatalog /></CartProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add Balance for Life" }));
  view.unmount();
  render(<CartProvider storageNamespace="assurevantage"><OfferingCatalog /><CartSelection /></CartProvider>);
  expect(screen.getByRole("button", { name: "Upgrade to Essentials" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove BFL" }));
  expect(screen.getByRole("button", { name: "Add Essentials" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Upgrade to Essentials" })).toBeNull();
});
