// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  user: {
    id: "member-one",
    fullName: "Example Member",
    firstName: "Example",
    emailAddresses: [],
  } as {
    id: string;
    fullName: string;
    firstName: string;
    emailAddresses: never[];
  } | null,
  query: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: async () => state.user,
  auth: async () => ({ getToken: async () => "own-session" }),
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = state.query;
    setAuth = vi.fn();
  },
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    subscriptions: {
      queries: {
        getMemberCardDataPublic: "card",
        getCustomerBundlePublic: "bundle",
        getMyEntitlements: "entitlements",
      },
    },
  },
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  state.user = {
    id: "member-one",
    fullName: "Example Member",
    firstName: "Example",
    emailAddresses: [],
  };
  state.query.mockImplementation(async (name) =>
    name === "card"
      ? { memberName: "Example Member" }
      : name === "entitlements"
        ? [
            {
              productId: "my-plan",
              product: { slug: "essentials-employee", name: "Essentials" },
            },
          ]
        : null,
  );
});
test("anonymous document requests are rejected before any member lookup", async () => {
  state.user = null;
  const response = await GET(
    new NextRequest(
      "https://www.assurevantage.com/api/documents?type=packet&productId=other-plan",
    ),
  );
  expect(response.status).toBe(401);
  expect(state.query).not.toHaveBeenCalled();
});
test("choosing another membership cannot retrieve another customer’s packet", async () => {
  const response = await GET(
    new NextRequest(
      "https://www.assurevantage.com/api/documents?type=packet&productId=other-plan",
    ),
  );
  expect(response.status).toBe(404);
  expect(state.query).toHaveBeenCalledWith(
    "card",
    expect.objectContaining({ customerId: "member-one" }),
  );
});
