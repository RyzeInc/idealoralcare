// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DashboardTabs from "./DashboardTabs";
import { memberDashboardTab } from "@/lib/member-dashboard";

vi.mock("@/components/providers/SiteThemeProvider", () => ({
  useSiteThemeOptional: () => ({ site: { slug: "assurevantage", name: "AssureVantage", marketing: { oralScan: false } } }),
}));
vi.mock("./tabs/OverviewTab", () => ({ default: () => <div>Member overview</div> }));
vi.mock("./tabs/OralScanTab", () => ({ default: () => <div>Member scan tool</div> }));

const props = { firstName: null, email: null, fullName: null, memberSince: null, hasSubscriptions: true, subscriptions: [], userId: "member_1", memberCardData: null };
afterEach(cleanup);

describe("member scan entry link", () => {
  test("opens the scan tab without hiding purchased tools when marketing is disabled", async () => {
    render(<DashboardTabs {...props} initialTab="oral-scan" />);
    expect(await screen.findByText("Member scan tool")).toBeTruthy();
    expect(screen.queryByText("Member overview")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("ordinary dashboard visits still open Overview", () => {
    render(<DashboardTabs {...props} />);
    expect(screen.getByText("Member overview")).toBeTruthy();
  });

  test("unknown or repeated tab parameters fall back to Overview", () => {
    expect(memberDashboardTab("oral-scan")).toBe("oral-scan");
    expect(memberDashboardTab("not-a-tab")).toBe("overview");
    expect(memberDashboardTab(["oral-scan", "overview"])).toBe("overview");
    expect(memberDashboardTab(undefined)).toBe("overview");
  });
});
