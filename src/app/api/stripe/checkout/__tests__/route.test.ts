// @vitest-environment node
/**
 * Stripe Checkout Route — Tests
 *
 * Tests the POST /api/stripe/checkout handler with mocked external deps.
 * Covers: auth checks, field validation, dependent line items, pricing maps,
 * and metadata encoding.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE imports that trigger module-level side
// effects (such as the stripe `throw` if no STRIPE_SECRET_KEY env var)
// ---------------------------------------------------------------------------
// Note: STRIPE_SECRET_KEY, NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_APP_URL are
// injected via vitest.config.ts `test.env` before any module is loaded.

// vi.hoisted() runs during the hoisting phase so these are available inside vi.mock()
const mockSessionCreate = vi.hoisted(() => vi.fn());
const mockCustomerList = vi.hoisted(() => vi.fn());
const mockCustomerCreate = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => {
  // Use a regular function (not arrow) so it can be called with `new`
  return {
    default: vi.fn(function MockStripe() {
      return {
        customers: {
          list: mockCustomerList,
          create: mockCustomerCreate,
        },
        checkout: {
          sessions: {
            create: mockSessionCreate,
          },
        },
      };
    }),
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

const mockConvexQuery = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function MockConvexHttpClient() {
    return { query: mockConvexQuery };
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    catalog: {
      queries: {
        getById: "catalog.queries.getById",
      },
    },
  },
}));

// Import after mocks are registered
import { POST } from "../route";
import { auth, currentUser } from "@clerk/nextjs/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  planId: "prod_test123",
  cadence: "monthly",
  paymentMethod: "card",
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: authenticated user
  vi.mocked(auth).mockResolvedValue({ userId: "user_test123" } as any);
  vi.mocked(currentUser).mockResolvedValue({
    emailAddresses: [{ emailAddress: "user@test.com" }],
  } as any);

  // Default: no existing Stripe customer
  mockCustomerList.mockResolvedValue({ data: [] });
  mockCustomerCreate.mockResolvedValue({ id: "cus_test123" });
  mockSessionCreate.mockResolvedValue({
    url: "https://checkout.stripe.com/test-session",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/checkout", () => {
  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    test("returns 401 when user is not authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any);

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toMatch(/Unauthorized/i);
    });

    test("returns 400 when user has no email address", async () => {
      vi.mocked(currentUser).mockResolvedValueOnce({
        emailAddresses: [],
      } as any);

      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    test("returns 400 when planId is missing", async () => {
      const res = await POST(makeRequest({ cadence: "monthly", paymentMethod: "card" }));
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toMatch(/planId/i);
    });

    test("returns 400 when cadence is missing", async () => {
      const res = await POST(makeRequest({ planId: "prod_test", paymentMethod: "card" }));
      expect(res.status).toBe(400);
    });

    test("returns 400 for an invalid cadence value", async () => {
      const res = await POST(
        makeRequest({ planId: "prod_test", cadence: "weekly", paymentMethod: "card" })
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toMatch(/cadence/i);
    });

    test("returns 400 for an invalid paymentMethod value", async () => {
      const res = await POST(
        makeRequest({ planId: "prod_test", cadence: "monthly", paymentMethod: "crypto" })
      );
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Dependent line items
  // -------------------------------------------------------------------------

  describe("dependent line items", () => {
    test("creates exactly 1 line item when no dependents are supplied", async () => {
      await POST(makeRequest(VALID_BODY));

      expect(mockSessionCreate).toHaveBeenCalledOnce();
      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.line_items).toHaveLength(1);
    });

    test("creates 2 line items when 1 dependent is added", async () => {
      const res = await POST(
        makeRequest({
          ...VALID_BODY,
          dependents: [
            {
              firstName: "Kid",
              lastName: "Doe",
              email: "kid@test.com",
              relationship: "child",
            },
          ],
        })
      );

      expect(res.status).toBe(200);
      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.line_items).toHaveLength(2);
    });

    test("sets the correct quantity on the dependent line item", async () => {
      await POST(
        makeRequest({
          ...VALID_BODY,
          dependents: [
            { firstName: "A", lastName: "B", email: "a@test.com", relationship: "child" },
            { firstName: "C", lastName: "D", email: "c@test.com", relationship: "spouse" },
          ],
        })
      );

      const callArg = mockSessionCreate.mock.calls[0][0];
      const dependentItem = callArg.line_items[1];
      expect(dependentItem.quantity).toBe(2);
    });

    test("dependent item product name includes 'Dependent'", async () => {
      await POST(
        makeRequest({
          ...VALID_BODY,
          dependents: [
            { firstName: "Kid", lastName: "Doe", email: "kid@test.com", relationship: "child" },
          ],
        })
      );

      const callArg = mockSessionCreate.mock.calls[0][0];
      const dependentItem = callArg.line_items[1];
      expect(dependentItem.price_data.product_data.name).toMatch(/Dependent/i);
    });
  });

  // -------------------------------------------------------------------------
  // Pricing maps (unit_amount verification)
  // -------------------------------------------------------------------------

  describe("pricing", () => {
    const PRIMARY_PRICES: Record<string, number> = {
      monthly_card: 1499,
      monthly_ach: 1299,
      annual_card: 14999,
      annual_ach: 12999,
    };

    const DEP_PRICES: Record<string, number> = {
      monthly_card: 999,
      monthly_ach: 899,
      annual_card: 9999,
      annual_ach: 8999,
    };

    for (const [key, expectedPrimary] of Object.entries(PRIMARY_PRICES)) {
      const [cadence, paymentMethod] = key.split("_") as [string, string];

      test(`primary unit_amount is ${expectedPrimary} for ${cadence}/${paymentMethod}`, async () => {
        await POST(makeRequest({ planId: "prod_test", cadence, paymentMethod }));

        const callArg = mockSessionCreate.mock.calls[0][0];
        expect(callArg.line_items[0].price_data.unit_amount).toBe(expectedPrimary);
      });

      test(`dependent unit_amount is ${DEP_PRICES[key]} for ${cadence}/${paymentMethod}`, async () => {
        await POST(
          makeRequest({
            planId: "prod_test",
            cadence,
            paymentMethod,
            dependents: [{ firstName: "K", lastName: "D", email: "k@d.com", relationship: "child" }],
          })
        );

        const callArg = mockSessionCreate.mock.calls[0][0];
        expect(callArg.line_items[1].price_data.unit_amount).toBe(DEP_PRICES[key]);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Session metadata
  // -------------------------------------------------------------------------

  describe("session metadata", () => {
    test("metadata.dependentCount is '0' when no dependents supplied", async () => {
      await POST(makeRequest(VALID_BODY));

      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.metadata.dependentCount).toBe("0");
    });

    test("metadata.dependentCount reflects the actual dependent count", async () => {
      await POST(
        makeRequest({
          ...VALID_BODY,
          dependents: [
            { firstName: "A", lastName: "B", email: "a@t.com", relationship: "child" },
            { firstName: "C", lastName: "D", email: "c@t.com", relationship: "spouse" },
          ],
        })
      );

      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.metadata.dependentCount).toBe("2");
    });

    test("metadata.dependents is encoded JSON of the dependent list", async () => {
      const dependents = [
        { firstName: "Kid", lastName: "Doe", email: "kid@t.com", relationship: "child" },
      ];

      await POST(makeRequest({ ...VALID_BODY, dependents }));

      const callArg = mockSessionCreate.mock.calls[0][0];
      const parsed = JSON.parse(callArg.metadata.dependents);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].firstName).toBe("Kid");
    });

    test("metadata.dependents is truncated to 500 characters maximum (Stripe limit)", async () => {
      // Create 20 dependents to generate a long JSON string
      const dependents = Array.from({ length: 20 }, (_, i) => ({
        firstName: "VeryLongFirstName".padEnd(20, String(i)),
        lastName: "VeryLongLastName".padEnd(20, String(i)),
        email: `dependent${i}@verylongemail.example.com`,
        relationship: "child",
      }));

      await POST(makeRequest({ ...VALID_BODY, dependents }));

      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.metadata.dependents.length).toBeLessThanOrEqual(500);
    });

    test("metadata includes clerkUserId of the authenticated user", async () => {
      await POST(makeRequest(VALID_BODY));

      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.metadata.clerkUserId).toBe("user_test123");
    });
  });

  // -------------------------------------------------------------------------
  // Stripe customer creation
  // -------------------------------------------------------------------------

  describe("Stripe customer handling", () => {
    test("reuses an existing Stripe customer when one exists for the email", async () => {
      mockCustomerList.mockResolvedValueOnce({
        data: [{ id: "cus_existing_123" }],
      });

      await POST(makeRequest(VALID_BODY));

      // Should NOT create a new customer
      expect(mockCustomerCreate).not.toHaveBeenCalled();

      const callArg = mockSessionCreate.mock.calls[0][0];
      expect(callArg.customer).toBe("cus_existing_123");
    });

    test("creates a new Stripe customer when none exists", async () => {
      mockCustomerList.mockResolvedValueOnce({ data: [] });

      await POST(makeRequest(VALID_BODY));

      expect(mockCustomerCreate).toHaveBeenCalledOnce();
      expect(mockCustomerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@test.com",
          metadata: { clerkUserId: "user_test123" },
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Successful response
  // -------------------------------------------------------------------------

  describe("success response", () => {
    test("returns 200 with the Stripe checkout URL", async () => {
      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe("https://checkout.stripe.com/test-session");
    });
  });
});
