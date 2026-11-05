// @vitest-environment jsdom
import Link from "next/link";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlatformNav } from "./PlatformNav";
const state = vi.hoisted(() => ({
  site: { marketing: { oralScan: false, blog: false }, shopEnabled: false }, globalShop: true,
}));
vi.mock("@/components/providers/SiteThemeProvider", () => ({ useSiteThemeOptional: () => ({ site: state.site, isLoading: false }) }));
vi.mock("convex/react", () => ({ useQuery: () => state.globalShop }));
vi.mock("@/components/auth/MemberPortalButton", () => ({ default: () => <Link href="/assurevantage/sign-in">Member Portal</Link> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/assurevantage/plans" }));
vi.mock("@/lib/health-plans", () => ({ useCart: () => ({ cart: { items: [], cadence: "monthly" }, itemCount: 0, subtotalCents: 0, removeItem: vi.fn() }) }));
afterEach(cleanup);

test("shared navigation honors site marketing and shop switches alongside the shared cart", () => {
  const view = render(<PlatformNav />);
  fireEvent.click(screen.getByText("Explore services"));
  expect(screen.queryByRole("link", { name: "Oral Health Scan" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Blog" })).toBeNull();
  expect(screen.getByRole("link", { name: "Teledentistry" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Shop" })).toBeNull();
  expect(screen.getByRole("link", { name: /Cart \(0\)/ }).getAttribute("href")).toBe("/assurevantage/program-checkout");
  expect(screen.getByRole("link", { name: "Member Portal" })).toBeTruthy();
  state.site.shopEnabled = true;
  view.rerender(<PlatformNav />);
  expect(screen.getByRole("link", { name: "Shop" }).getAttribute("href")).toBe("/assurevantage/shop");
  state.globalShop = false;
  view.rerender(<PlatformNav />);
  expect(screen.queryByRole("link", { name: "Shop" })).toBeNull();
});
