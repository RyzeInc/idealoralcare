// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteThemeProvider, type SiteTheme } from "@/components/providers/SiteThemeProvider";
import { SiteMarketing } from "./SiteMarketing";
import HealthHeader from "./HealthHeader";
import { NexusHealthFooter } from "./NexusHealthFooter";
import MemberPortalButton from "@/components/auth/MemberPortalButton";
import HeroSlideshow from "./HeroSlideshow";

const mocks = vi.hoisted(() => ({
  sites: {} as Record<string, SiteTheme | undefined>,
  path: "/assurevantage/plans",
  globalShop: true,
}));
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args?: { slug?: string }) => args?.slug ? mocks.sites[args.slug] : mocks.globalShop,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.path,
  useParams: () => ({ siteSlug: mocks.path.split("/")[1] }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: false, isLoaded: true }) }));

const site = (slug: string, extra: Partial<SiteTheme> = {}): SiteTheme => ({ slug, name: slug, type: "whitelabel", ...extra });

beforeEach(() => {
  mocks.sites = { assurevantage: site("assurevantage") };
  mocks.path = "/assurevantage/plans";
  mocks.globalShop = true;
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("brand marketing", () => {
  test("the slideshow doesn't promote a disabled service", () => {
    mocks.sites.assurevantage = site("assurevantage", { marketing: { oralScan: false, teledentistry: false } });
    render(<SiteThemeProvider defaultSlug="assurevantage"><HeroSlideshow /></SiteThemeProvider>);
    expect(screen.queryByRole("img", { name: /Capture 5/ })).toBeNull();
    expect(screen.queryByRole("img", { name: /licensed dentist/ })).toBeNull();
    expect(screen.getByRole("img", { name: /Save 20-50%/ })).toBeTruthy();
  });
  test("defaults preserve existing marketing, while an explicit false hides it", () => {
    mocks.sites.assurevantage = site("assurevantage", { marketing: { oralScan: false } });
    render(<SiteThemeProvider defaultSlug="assurevantage">
      <SiteMarketing feature="oralScan">Scan promotion</SiteMarketing>
      <SiteMarketing feature="teledentistry">Dentist promotion</SiteMarketing>
    </SiteThemeProvider>);
    expect(screen.queryByText("Scan promotion")).toBeNull();
    expect(screen.getByText("Dentist promotion")).toBeTruthy();
  });

  test("doesn't flash promotions while a brand is loading", () => {
    mocks.sites.assurevantage = undefined;
    render(<SiteThemeProvider defaultSlug="assurevantage"><SiteMarketing feature="oralScan">Scan promotion</SiteMarketing></SiteThemeProvider>);
    expect(screen.queryByText("Scan promotion")).toBeNull();
  });

  test("navigation honors service switches and the site shop opt-in", () => {
    mocks.path = "/flourishxv/plans";
    mocks.sites.flourishxv = site("flourishxv", { marketing: { oralScan: false } });
    const view = render(<SiteThemeProvider defaultSlug="flourishxv"><HealthHeader /></SiteThemeProvider>);
    expect(screen.queryByRole("link", { name: "Oral Health Scan" })).toBeNull();
    expect(screen.getByRole("link", { name: "Teledentistry" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Shop" })).toBeNull();
    mocks.sites.flourishxv = site("flourishxv", { shopEnabled: true });
    view.rerender(<SiteThemeProvider defaultSlug="flourishxv"><HealthHeader /></SiteThemeProvider>);
    expect(screen.getByRole("link", { name: "Shop" }).getAttribute("href")).toBe("/flourishxv/shop");
    mocks.globalShop = false;
    view.rerender(<SiteThemeProvider defaultSlug="flourishxv"><HealthHeader /></SiteThemeProvider>);
    expect(screen.queryByRole("link", { name: "Shop" })).toBeNull();
  });

  test("the mobile menu honors the same settings and keeps member links on the brand", async () => {
    mocks.path = "/flourishxv/plans";
    mocks.sites.flourishxv = site("flourishxv", { marketing: { oralScan: false } });
    render(<SiteThemeProvider defaultSlug="flourishxv"><HealthHeader /></SiteThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("link", { name: "Oral Health Scan" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Shop" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Member Portal" }).every(link => link.getAttribute("href")?.startsWith("/flourishxv/"))).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.body.style.overflow).toBe("");
  });

  test("resource switches keep required legal links and use the brand name without an Ideal logo", () => {
    mocks.sites.assurevantage = site("assurevantage", { name: "AssureVantage", marketing: { blog: false, faq: false } });
    render(<SiteThemeProvider defaultSlug="assurevantage"><NexusHealthFooter /></SiteThemeProvider>);
    expect(screen.queryByRole("link", { name: "Blog" })).toBeNull();
    expect(screen.queryByRole("link", { name: "FAQ" })).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toBeTruthy();
    expect(screen.getByText("AssureVantage")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("switching sites cleans up CSS, title, favicon and marketing", () => {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = "/original.ico";
    document.head.appendChild(icon);
    document.title = "Original";
    mocks.sites.assurevantage = site("assurevantage", { branding: { primaryColor: "#123456", faviconUrl: "/assure.ico", customCSS: ".assure-only { color: red }" }, marketing: { oralScan: false } });
    mocks.sites.ideal = site("ideal", { name: "Ideal" });
    const view = render(<SiteThemeProvider defaultSlug="assurevantage"><SiteMarketing feature="oralScan">Scan promotion</SiteMarketing></SiteThemeProvider>);
    expect(document.head.querySelector("style[data-site-theme]")?.textContent).toContain("assure-only");
    expect(icon.getAttribute("href")).toBe("/assure.ico");
    view.rerender(<SiteThemeProvider defaultSlug="ideal"><SiteMarketing feature="oralScan">Scan promotion</SiteMarketing></SiteThemeProvider>);
    expect(document.head.querySelector("style[data-site-theme]")).toBeNull();
    expect(icon.getAttribute("href")).toBe("/original.ico");
    expect(document.documentElement.style.getPropertyValue("--brand-primary")).toBe("#1e3a5f");
    expect(screen.getByText("Scan promotion")).toBeTruthy();
    view.unmount();
    expect(document.title).toBe("Original");
    expect(document.documentElement.style.getPropertyValue("--brand-primary")).toBe("");
    icon.remove();
  });

  test("the member portal link returns to the active brand", () => {
    render(<MemberPortalButton />);
    const url = new URL(screen.getByRole("link", { name: "Member Portal" }).getAttribute("href")!, "https://existing.example");
    expect(url.pathname).toBe("/assurevantage/sign-in");
    expect(url.searchParams.get("redirect_url")).toBe("/assurevantage/dashboard");
  });
});
