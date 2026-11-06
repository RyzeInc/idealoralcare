// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  userId: "member-one" as string | null,
  query: vi.fn(),
  setAuth: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: mocks.userId,
    getToken: async () => "signed-session",
  }),
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.query;
    setAuth = mocks.setAuth;
  },
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    subscriptions: {
      queries: {
        getMyDashboard: "dashboard",
        getMyEntitlements: "entitlements",
        getMemberCardDataPublic: "card",
      },
    },
  },
}));
vi.mock("@/lib/essentials-packet-pdf", () => ({
  ESSENTIALS_VENDOR_CODES: {
    lyric: { url: "example.com", phone: "123" },
    questSelect: { labLine: "123" },
    rxValet: { url: "example.com", phone: "123" },
    balanceForLife: { url: "https://example.com", phone: "123" },
  },
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = "member-one";
  mocks.query.mockImplementation(async (name) =>
    name === "dashboard"
      ? {
          role: "primary",
          bundle: { status: "active", cadence: "monthly" },
          nextRenewalDate: 123,
          upcomingChargeAmount: 5895,
        }
      : name === "entitlements"
        ? [
            {
              productId: "essentials",
              status: "active",
              product: { slug: "essentials-employee", name: "Essentials" },
            },
          ]
        : {
            memberName: "Example Member",
            memberId: "example",
            effectiveDate: "Jan 1, 2026",
            planName: "Essentials",
            essentialsMemberNumber: "private-member",
            essentialsGroupNumber: "private-group",
            bflMemberCode: "private-code",
            ssn: "must-never-leave-server",
          },
  );
});
test("anonymous visitors receive no member data", async () => {
  mocks.userId = null;
  const response = await GET();
  expect(response.status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
});
test("Essentials exposes its four benefits and keeps unrelated private profile fields out", async () => {
  const response = await GET();
  const data = await response.json();
  expect(data.benefits.map((b: { key: string }) => b.key)).toEqual([
    "virtual-care",
    "labs",
    "pharmacy",
    "balance-for-life",
  ]);
  expect(data.profile.essentialsMemberNumber).toBe("private-member");
  expect(JSON.stringify(data)).not.toContain("must-never-leave-server");
  expect(mocks.query).toHaveBeenCalledWith(
    "card",
    expect.objectContaining({ customerId: "member-one" }),
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
});
test("oral-only membership never exposes Essentials or BFL access identifiers", async () => {
  mocks.query.mockImplementation(async (name) =>
    name === "dashboard"
      ? {
          role: "dependent",
          bundle: { status: "active", cadence: "monthly" },
          nextRenewalDate: null,
          upcomingChargeAmount: null,
        }
      : name === "entitlements"
        ? [
            {
              productId: "oral",
              status: "active",
              product: { slug: "oral-health-family", name: "Oral Care" },
            },
          ]
        : {
            memberId: "example",
            effectiveDate: "Jan 1, 2026",
            essentialsMemberNumber: "private-member",
            essentialsGroupNumber: "private-group",
            bflMemberCode: "private-code",
          },
  );
  const response = await GET();
  const data = await response.json();
  expect(data.benefits.map((b: { key: string }) => b.key)).toEqual([
    "oral-health-scan",
    "teledentistry",
    "discount",
  ]);
  expect(data.profile.essentialsMemberNumber).toBeNull();
  expect(data.profile.bflMemberCode).toBeNull();
});
test("a service outage returns a recoverable error with no private response body", async () => {
  mocks.query.mockRejectedValue(new Error("internal secret"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("internal secret");
});
