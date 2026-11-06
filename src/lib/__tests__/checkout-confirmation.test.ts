// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), userId: "member-one" }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve: mocks.retrieve } };
  },
}));
import { checkoutConfirmation } from "../checkout-confirmation";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = "member-one";
  mocks.retrieve.mockResolvedValue({
    metadata: { clerkUserId: "member-one" },
    status: "complete",
    payment_status: "paid",
  });
});
test("a missing or malformed session never claims a confirmed enrollment", async () => {
  expect(await checkoutConfirmation(undefined)).toBe("unverified");
  expect(await checkoutConfirmation("not-a-session")).toBe("unverified");
  expect(mocks.retrieve).not.toHaveBeenCalled();
});
test("another customer’s checkout is never disclosed as confirmed", async () => {
  mocks.retrieve.mockResolvedValue({
    metadata: { clerkUserId: "member-two" },
    status: "complete",
    payment_status: "paid",
  });
  expect(await checkoutConfirmation("cs_test_example")).toBe("unverified");
});
test.each([
  ["paid", "received"],
  ["no_payment_required", "received"],
  ["unpaid", "processing"],
])("a completed checkout with %s is %s", async (payment, expected) => {
  mocks.retrieve.mockResolvedValue({
    metadata: { clerkUserId: "member-one" },
    status: "complete",
    payment_status: payment,
  });
  expect(await checkoutConfirmation("cs_test_example")).toBe(expected);
});
test("an incomplete session never implies payment success", async () => {
  mocks.retrieve.mockResolvedValue({
    metadata: { clerkUserId: "member-one" },
    status: "open",
    payment_status: "unpaid",
  });
  expect(await checkoutConfirmation("cs_test_example")).toBe("unverified");
});
test("a Stripe lookup failure yields a recoverable unverified state", async () => {
  mocks.retrieve.mockRejectedValue(new Error("unavailable"));
  expect(await checkoutConfirmation("cs_test_example")).toBe("unverified");
});
