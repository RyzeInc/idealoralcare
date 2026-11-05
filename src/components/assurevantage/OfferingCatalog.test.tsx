// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import OfferingCatalog from "./OfferingCatalog";
import { CartProvider } from "@/lib/health-plans";

const products = [
  { _id: "essentials", slug: "essentials-employee", name: "Essentials Employee", category: "newideal", order: 1 },
  { _id: "bfl", slug: "bfl-individual", name: "Balance for Life", category: "newideal", order: 2 },
  { _id: "oral", slug: "oral-individual", name: "Oral Savings Individual", category: "dental", order: 3 },
].map(p => ({ ...p, isVisible: true, pricing: { monthlyCardCents: 1995, monthlyACHCents: 1995, annualCardCents: 19950, annualACHCents: 19950 } }));
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
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).textContent).toContain("(0)");
  fireEvent.click(screen.getByRole("button", { name: "Annual", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Add Oral Care" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Balance for Life" }));
  expect(screen.queryByRole("button", { name: "Annual", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add Essentials" }));
  expect(screen.getByRole("button", { name: "Included with Essentials" })).toBeDisabled();
  expect(screen.getByRole("status").textContent).toContain("Standalone Balance for Life was removed");
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).textContent).toContain("(2)");
  expect(screen.getByRole("link", { name: /Review your shared cart/ }).getAttribute("href")).toBe("/assurevantage/program-checkout");
});
