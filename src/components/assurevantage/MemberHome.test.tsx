// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ signedIn: true, fetch: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: state.signedIn,
    user: state.signedIn ? { id: "member-one", firstName: "Example" } : null,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/health/ProfileCompletionPrompt", () => ({
  default: () => null,
}));
vi.mock("@/components/health/FamilySection", () => ({ default: () => null }));
vi.mock("@/components/health/tabs/OralScanTab", () => ({
  default: () => null,
}));
vi.mock("@/components/health/tabs/ProviderSearchTab", () => ({
  default: () => null,
}));
vi.mock("@/components/health/tabs/TeledentistryTab", () => ({
  default: () => null,
}));
import { MemberHome } from "./MemberHome";
const membership = {
  products: [
    {
      id: "essentials",
      slug: "essentials-employee",
      name: "Essentials",
      status: "active",
    },
  ],
  benefits: [
    {
      key: "virtual-care",
      title: "Lyric virtual care",
      url: "https://example.com",
    },
    { key: "labs", title: "QuestSelect labs", url: "https://example.com" },
  ],
  role: "primary",
  bundle: { status: "active", cadence: "monthly" },
  nextRenewalDate: null,
  upcomingChargeAmount: 5895,
  profile: {
    memberName: "Example Member",
    memberId: "example",
    effectiveDate: "Jan 1, 2026",
    essentialsMemberNumber: "member-number",
  },
};
beforeEach(() => {
  state.signedIn = true;
  state.fetch.mockReset();
  state.fetch.mockResolvedValue({ ok: true, json: async () => membership });
  vi.stubGlobal("fetch", state.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("purchased programs have access cards and the matching document selection", async () => {
  render(<MemberHome />);
  expect(
    await screen.findByRole("heading", { name: "Lyric virtual care" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "QuestSelect labs" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Welcome packet/ }).getAttribute("href"),
  ).toContain("productId=essentials");
});
test("future-effective memberships do not advertise usable provider access", async () => {
  state.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      ...membership,
      profile: { ...membership.profile, effectiveDate: "Jan 1, 2100" },
    }),
  });
  render(<MemberHome />);
  await screen.findByText(/effective date is in the future/);
  expect(
    screen.queryByRole("link", { name: "Open Lyric virtual care ↗" }),
  ).toBeNull();
});
test("private state is cleared when the account signs out", async () => {
  const view = render(<MemberHome />);
  await screen.findByText("Example Member");
  state.signedIn = false;
  view.rerender(<MemberHome />);
  await waitFor(() => expect(screen.queryByText("Example Member")).toBeNull());
});
test("an unavailable membership service provides recovery instead of crashing", async () => {
  state.fetch.mockResolvedValue({
    ok: false,
    json: async () => ({
      error: "Membership information is temporarily unavailable.",
    }),
  });
  render(<MemberHome />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "temporarily unavailable",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
