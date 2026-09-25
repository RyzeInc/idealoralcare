// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import type { Id } from "@/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  push: vi.fn(),
  tab: "overview",
}));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: () => mocks.mutate,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/partner/members/test",
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams({ tab: mocks.tab }),
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div>Account diagnostics</div>,
}));
vi.mock("@/components/admin/MemberCommunications", () => ({
  MemberCommunications: () => <div>Communications</div>,
}));
import { MemberWorkspace } from "./MemberWorkspace";

const memberId = "test-member" as Id<"memberProfiles">;
const fixture = () => ({
  member: {
    firstName: "Casey",
    lastName: "Rivera",
    memberId: "MEM-100",
    memberType: "active",
    memberRole: "primary",
    dependentCount: 0,
    groupName: "Example Group",
    siteName: "Ideal",
    mrrCents: 0,
    createdAt: 1750000000000,
    email: "casey@example.com",
    phone: "555-0100",
  },
  isAdmin: false,
  viewerId: "broker",
  billingSource: "comp",
  employerPays: false,
  raw: null,
  listBill: null,
  subscription: null,
  notes: [],
  alerts: [],
  documents: [],
  agreements: [],
  invoices: [],
  family: [],
  services: [],
  timeline: [],
  truncated: false,
});
beforeEach(() => {
  mocks.query.mockReturnValue(fixture());
  mocks.mutate.mockReset().mockResolvedValue("saved");
  mocks.push.mockReset();
  mocks.tab = "overview";
});
afterEach(cleanup);

describe("member workspace interactions", () => {
  test("shows loading and missing-member states", () => {
    mocks.query.mockReturnValue(undefined);
    const view = render(
      <MemberWorkspace memberId={memberId} portal="partner" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading member workspace",
    );
    mocks.query.mockReturnValue(null);
    view.rerender(<MemberWorkspace memberId={memberId} portal="partner" />);
    expect(
      screen.getByRole("heading", { name: "Member not found" }),
    ).toBeInTheDocument();
  });

  test("broker navigation is scoped, deep links are safe, and zero-dollar coverage is explicit", async () => {
    mocks.tab = "account";
    render(<MemberWorkspace memberId={memberId} portal="partner" />);
    expect(screen.queryByText("Account diagnostics")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Member sections" });
    expect(within(nav).queryByText("Communications")).not.toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole("button", { name: "Notes" }));
    expect(mocks.push).toHaveBeenCalledWith("/partner/members/test?tab=notes", {
      scroll: false,
    });
  });

  test("broker notes save through the mutation and failed saves preserve entered content", async () => {
    mocks.mutate.mockRejectedValueOnce(new Error("Connection unavailable"));
    render(<MemberWorkspace memberId={memberId} portal="partner" />);
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText("Note", { exact: true }),
      "Call back on Friday",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection unavailable",
    );
    expect(within(dialog).getByLabelText("Note", { exact: true })).toHaveValue(
      "Call back on Friday",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.mutate).toHaveBeenLastCalledWith({
      memberId,
      content: "Call back on Friday",
      noteType: "general",
      visibility: "shared",
      isPinned: false,
    });
  });

  test("expired and resolved alerts stay out of the active view; authors can resolve their alerts", async () => {
    const base = {
      authorId: "broker",
      authorName: "Broker",
      severity: "info",
      visibility: "shared",
      createdAt: 1750000000000,
    };
    mocks.query.mockReturnValue({
      ...fixture(),
      alerts: [
        { ...base, _id: "active", title: "Follow up" },
        { ...base, _id: "expired", title: "Old reminder", expiresAt: 1 },
        {
          ...base,
          _id: "resolved",
          title: "Completed reminder",
          resolvedAt: 2,
        },
      ],
    });
    mocks.tab = "alerts";
    render(<MemberWorkspace memberId={memberId} portal="partner" />);
    expect(screen.queryByText("Old reminder")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed reminder")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ alertId: "active" });
    await userEvent.selectOptions(screen.getByLabelText("Alert status"), "all");
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
  });

  test("admins can edit contact and address fields without changing member lifecycle", async () => {
    mocks.query.mockReturnValue({
      ...fixture(),
      isAdmin: true,
      raw: {
        dateOfBirth: "1980-01-01",
        address: {
          line1: "1 Main",
          city: "Town",
          state: "FL",
          postalCode: "12345",
          country: "US",
        },
      },
    });
    mocks.tab = "personal";
    render(<MemberWorkspace memberId={memberId} portal="admin" />);
    await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = screen.getByRole("dialog");
    const phone = within(dialog).getByLabelText("Phone", { exact: true });
    await userEvent.clear(phone);
    await userEvent.type(phone, "555-0111");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId,
        phone: "555-0111",
        address: expect.objectContaining({ line1: "1 Main" }),
      }),
    );
    expect(mocks.mutate.mock.calls[0][0]).not.toHaveProperty("memberType");
  });
});
