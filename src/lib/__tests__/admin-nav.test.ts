import { describe, expect, it } from "vitest";
import {
  ADMIN_NAVIGATION,
  CRM_NAV_ITEMS,
  activeHref,
  matchesQuery,
  navDestinations,
  visibleNavigation,
  type AdminNavItem,
} from "../admin-nav";

const STAFF = { isOwner: false, isStaff: true };
const OWNER = { isOwner: true, isStaff: true };
const OUTSIDER = { isOwner: false, isStaff: false };

const item = (over: Partial<AdminNavItem> = {}): AdminNavItem => ({
  label: "Members",
  href: "/admin/members",
  icon: "Users",
  tooltip: "All people in your plans.",
  ...over,
});

describe("activeHref", () => {
  const hrefs = ["/admin", "/admin/list-bill", "/admin/list-bill-invoices", "/admin/crm"];

  it("matches the dashboard only on an exact path", () => {
    expect(activeHref("/admin", hrefs)).toBe("/admin");
    expect(activeHref("/admin/members", hrefs)).toBe(null);
  });

  it("prefers the longest match, so sibling prefixes do not both light up", () => {
    // The bug this rule exists for: startsWith() lights /admin/list-bill on
    // every /admin/list-bill-invoices page.
    expect(activeHref("/admin/list-bill-invoices", hrefs)).toBe("/admin/list-bill-invoices");
    expect(activeHref("/admin/list-bill-invoices/grp_1", hrefs)).toBe("/admin/list-bill-invoices");
    expect(activeHref("/admin/list-bill", hrefs)).toBe("/admin/list-bill");
  });

  it("does not match a path that merely shares a prefix with a href", () => {
    expect(activeHref("/admin/list-billing-report", ["/admin/list-bill"])).toBe(null);
  });

  it("keeps a parent active on its own detail pages", () => {
    expect(activeHref("/admin/crm/contacts/abc123", hrefs)).toBe("/admin/crm");
  });

  it("returns null when nothing matches", () => {
    expect(activeHref("/partner", hrefs)).toBe(null);
  });
});

describe("matchesQuery", () => {
  it("matches on label, ignoring case", () => {
    expect(matchesQuery(item(), "Members & Partners", "MEMB")).toBe(true);
  });

  it("matches on keyword aliases the label never mentions", () => {
    const insights = item({ label: "Insights", keywords: ["churn", "retention"] });
    expect(matchesQuery(insights, "Overview", "churn")).toBe(true);
  });

  it("matches on the section name", () => {
    expect(matchesQuery(item(), "Members & Partners", "partners")).toBe(true);
  });

  it("requires every term, so multi-word queries narrow rather than widen", () => {
    const shop = item({ label: "Shop", keywords: ["affiliate", "products"] });
    expect(matchesQuery(shop, "Finance", "shop affiliate")).toBe(true);
    expect(matchesQuery(shop, "Finance", "shop eligibility")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesQuery(item(), "Members & Partners", "   ")).toBe(true);
  });
});

describe("visibility", () => {
  it("hides owner-only entries from editors", () => {
    const staffHrefs = visibleNavigation(STAFF).flatMap((s) => s.items.map((i) => i.href));
    const ownerHrefs = visibleNavigation(OWNER).flatMap((s) => s.items.map((i) => i.href));
    expect(staffHrefs).not.toContain("/admin/dev-tools");
    expect(ownerHrefs).toContain("/admin/dev-tools");
  });

  it("hides the CRM from anyone without an admin record", () => {
    const hrefs = visibleNavigation(OUTSIDER).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/admin/crm");
  });

  it("drops sections that end up empty rather than rendering a bare heading", () => {
    const sections = visibleNavigation(OUTSIDER).map((s) => s.section);
    expect(sections).not.toContain("Sales");
  });
});

describe("navDestinations", () => {
  it("exposes CRM sub-pages so the palette can reach them from anywhere", () => {
    const hrefs = navDestinations(STAFF).map((d) => d.href);
    expect(hrefs).toContain("/admin/crm/campaigns");
    expect(hrefs).toContain("/admin/crm/import");
  });

  it("withholds CRM sub-pages from anyone who cannot see the CRM at all", () => {
    const hrefs = navDestinations(OUTSIDER).map((d) => d.href);
    expect(hrefs.some((href) => href.startsWith("/admin/crm"))).toBe(false);
  });

  it("lists each href once even though CRM Home appears in both lists", () => {
    const hrefs = navDestinations(OWNER).map((d) => d.href);
    expect(hrefs.length).toBe(new Set(hrefs).size);
  });

  it("labels each destination with a section, so duplicate labels stay distinguishable", () => {
    const destinations = navDestinations(STAFF);
    const settings = destinations.filter((d) => d.label.endsWith("Settings"));
    expect(settings.map((d) => `${d.section} · ${d.label}`).sort()).toEqual([
      "CRM · CRM Settings",
      "System · Site Settings",
    ]);
  });
});

describe("navigation model", () => {
  it("gives every item a tooltip — the sidebar shows it on hover and the filter searches it", () => {
    const all = [...ADMIN_NAVIGATION.flatMap((s) => s.items), ...CRM_NAV_ITEMS];
    expect(all.filter((i) => !i.tooltip.trim()).map((i) => i.href)).toEqual([]);
  });

  it("has no duplicate hrefs within a section", () => {
    for (const section of ADMIN_NAVIGATION) {
      const hrefs = section.items.map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});
