// @vitest-environment jsdom
/**
 * AdminSidebar — component tests.
 *
 * Covers the three behaviours that make a 28-item menu usable, and the one
 * that must not be cosmetic: role gating.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import React from "react";

let mockPathname = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => mockPathname),
}));

type LinkProps = React.ComponentProps<"a"> & { href: string };

vi.mock("next/link", () => ({
  // preventDefault keeps jsdom from logging "navigation to another Document"
  // on every link click, while still running the component's own handler.
  default: ({ href, children, onClick, ...rest }: LinkProps) =>
    React.createElement(
      "a",
      {
        href,
        ...rest,
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onClick?.(event);
        },
      },
      children,
    ),
}));

let mockAuth = { isLoaded: true };
vi.mock("@clerk/nextjs", () => ({
  useAuth: vi.fn(() => mockAuth),
  // Renders a Clerk portal in the real thing; the sidebar only needs it to exist.
  UserButton: () => React.createElement("div", { "data-testid": "user-button" }),
}));

// The sidebar's only query is getMyAdminProfile. `null` means "not staff",
// `undefined` means "still loading" — both are meaningful states here.
type AdminProfile = { role: "owner" | "editor"; name: string; email: string } | null | undefined;
let mockProfile: AdminProfile = { role: "editor", name: "Dana Ruiz", email: "dana@example.com" };
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockProfile),
}));

import { AdminSidebar } from "../AdminSidebar";

const nav = () => screen.getByRole("navigation", { name: /admin navigation/i });
const links = () => within(nav()).getAllByRole("link");
const labels = () => links().map((link) => link.textContent);

beforeEach(() => {
  mockPathname = "/admin";
  mockAuth = { isLoaded: true };
  mockProfile = { role: "editor", name: "Dana Ruiz", email: "dana@example.com" };
  window.localStorage.clear();
});

afterEach(cleanup);

describe("role gating", () => {
  test("hides Dev Tools from an editor", () => {
    render(<AdminSidebar />);
    expect(labels()).not.toContain("Dev Tools");
  });

  test("shows Dev Tools to an owner", () => {
    mockProfile = { role: "owner", name: "Sam Okafor", email: "sam@example.com" };
    render(<AdminSidebar />);
    expect(labels()).toContain("Dev Tools");
  });

  test("hides the CRM from someone with no admin record", () => {
    mockProfile = null;
    render(<AdminSidebar />);
    expect(labels()).not.toContain("CRM");
  });

  test("renders nothing but a loading note until Clerk resolves", () => {
    mockAuth = { isLoaded: false };
    render(<AdminSidebar />);
    expect(within(nav()).queryAllByRole("link")).toHaveLength(0);
    expect(within(nav()).getByText(/loading/i)).toBeInTheDocument();
  });
});

describe("active state", () => {
  test("marks only the dashboard as current on /admin", () => {
    render(<AdminSidebar />);
    const current = links().filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Dashboard"]);
  });

  test("does not light both List-Bill entries on the invoices page", () => {
    // The prefix trap: /admin/list-bill-invoices starts with /admin/list-bill.
    mockPathname = "/admin/list-bill-invoices";
    render(<AdminSidebar />);
    const current = links().filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["List-Bill Invoices"]);
  });

  test("keeps the CRM lit on a nested CRM page", () => {
    mockPathname = "/admin/crm/contacts/abc123";
    render(<AdminSidebar />);
    const current = links().filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["CRM"]);
  });
});

describe("filter", () => {
  test("narrows the menu to matching entries", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    await user.type(screen.getByLabelText(/filter admin navigation/i), "vendor");

    expect(labels()).toEqual(["Vendor Files", "Vendor Statements"]);
  });

  test("matches keyword aliases that never appear on screen", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    await user.type(screen.getByLabelText(/filter admin navigation/i), "churn");

    expect(labels()).toEqual(["Insights"]);
  });

  test("reports when nothing matches instead of showing a blank menu", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    await user.type(screen.getByLabelText(/filter admin navigation/i), "zzzzz");

    expect(within(nav()).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(/no matches/i);
  });

  test("clears back to the full menu", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    const full = labels().length;

    await user.type(screen.getByLabelText(/filter admin navigation/i), "vendor");
    await user.click(screen.getByLabelText(/clear filter/i));

    expect(labels()).toHaveLength(full);
  });

  test("surfaces hits from a section the user has collapsed", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(screen.getByRole("button", { name: /operations/i }));
    expect(labels()).not.toContain("Vendor Files");

    await user.type(screen.getByLabelText(/filter admin navigation/i), "vendor");
    expect(labels()).toContain("Vendor Files");
  });
});

describe("collapsible sections", () => {
  test("folds a section away and restores it", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    const toggle = screen.getByRole("button", { name: /finance/i });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(labels()).not.toContain("Billing");

    await user.click(toggle);
    expect(labels()).toContain("Billing");
  });

  test("remembers the fold across a remount", async () => {
    const user = userEvent.setup();
    const first = render(<AdminSidebar />);
    await user.click(screen.getByRole("button", { name: /finance/i }));
    first.unmount();

    render(<AdminSidebar />);
    expect(screen.getByRole("button", { name: /finance/i })).toHaveAttribute("aria-expanded", "false");
    expect(labels()).not.toContain("Billing");
  });

  test("ignores a corrupted stored preference rather than failing to render", () => {
    window.localStorage.setItem("admin-nav-collapsed-sections", "{ not json");
    render(<AdminSidebar />);
    expect(labels()).toContain("Billing");
  });
});

describe("navigation callback", () => {
  test("notifies the shell on a link click, so the mobile drawer can close", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AdminSidebar onNavigate={onNavigate} />);

    await user.click(within(nav()).getByText("Members"));
    expect(onNavigate).toHaveBeenCalled();
  });
});
