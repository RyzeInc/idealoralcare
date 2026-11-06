// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { UnifiedCheckout } from "./UnifiedCheckout";
import type { CartItem } from "@/lib/health-plans/types";
const state = vi.hoisted(() => ({
  signedIn: false,
  userId: "user_1",
  cadence: "monthly",
  payment: "card",
  items: [] as CartItem[],
  save: vi.fn(),
  fetch: vi.fn(),
  subtotal: 7394,
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: state.signedIn,
    user: state.signedIn
      ? {
          id: state.userId,
          fullName: "Sample Member",
          primaryEmailAddress: { emailAddress: "sample@example.com" },
        }
      : null,
  }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("convex/react", () => ({
  useMutation: () => state.save,
  useConvexAuth: () => ({ isAuthenticated: state.signedIn }),
}));
vi.mock("@/lib/health-plans", () => ({
  useCart: () => ({
    cart: {
      items: state.items,
      cadence: state.cadence,
      paymentMethod: state.payment,
      referralCode: "100001",
      referralCodeSource: "url",
    },
    monthlyOnly: state.items.some(
      (i) =>
        i.product.slug.startsWith("essentials") ||
        i.product.slug.startsWith("bfl-"),
    ),
    subtotalCents: state.subtotal,
    setCadence: vi.fn(),
    setPaymentMethod: vi.fn(),
    removeItem: vi.fn(),
    setReferralCode: vi.fn(),
  }),
}));
vi.mock("@/components/checkout/CheckoutIntake", () => ({
  CheckoutIntake: ({
    onComplete,
  }: {
    onComplete: (profile: unknown) => void;
  }) => (
    <button
      onClick={() =>
        onComplete({
          firstName: "Sample",
          lastName: "Member",
          dateOfBirth: "1990-01-15",
          address: {
            line1: "123 Main St",
            city: "Columbus",
            state: "OH",
            postalCode: "43215",
            country: "US",
          },
        })
      }
    >
      Confirm intake
    </button>
  ),
}));
vi.mock("@/app/newideal/checkout/page.client", () => ({
  InlineAuth: () => <p>Inline account wizard</p>,
}));
vi.mock("@/components/health/AgentRepCodeSelector", () => ({
  AgentRepCodeSelector: () => <p>Rep selector</p>,
}));
vi.mock("./AssureLink", () => ({
  AssureLink: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/components/legal", () => ({
  MembershipAgreementModal: ({
    onAccept,
  }: {
    onAccept: (s: string) => void;
  }) => (
    <button onClick={() => onAccept("data:image/png;base64,signed-oral")}>
      Sign oral document
    </button>
  ),
  EssentialsMembershipModal: ({
    onAccept,
  }: {
    onAccept: (s: string) => void;
  }) => (
    <button onClick={() => onAccept("data:image/png;base64,signed-program")}>
      Sign program document
    </button>
  ),
  TermsAndConditionsModal: ({
    isOpen,
    onAccept,
  }: {
    isOpen: boolean;
    onAccept: () => void;
  }) =>
    isOpen ? <button onClick={onAccept}>Accept document terms</button> : null,
}));
function item(id: string, slug: string, category: string): CartItem {
  return {
    productId: id,
    addedAt: 0,
    product: {
      _id: id,
      slug,
      name: slug,
      category,
      pricing: {
        monthlyCardCents: slug.startsWith("essentials") ? 5895 : 1499,
        monthlyACHCents: slug.startsWith("essentials") ? 5895 : 1399,
        annualCardCents: 16499,
        annualACHCents: 15499,
      },
    } as CartItem["product"],
  };
}
beforeEach(() => {
  state.signedIn = false;
  state.userId = "user_1";
  state.cadence = "monthly";
  state.payment = "card";
  state.items = [
    item("ess_id", "essentials-employee", "telehealth"),
    item("oral_id", "oral-individual", "dental"),
  ];
  state.save
    .mockReset()
    .mockResolvedValue({ success: true, agreementId: "saved-agreement" });
  state.fetch.mockReset().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Payment unavailable for this test" }),
  });
  vi.stubGlobal("fetch", state.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function signAll() {
  fireEvent.click(screen.getByRole("button", { name: "Confirm intake" }));
  for (const button of screen.getAllByRole("button", {
    name: "Review & sign agreement",
  })) {
    fireEvent.click(button);
    fireEvent.click(
      screen.getByRole("button", { name: /Sign (program|oral) document/ }),
    );
  }
  fireEvent.click(
    screen.getByRole("button", {
      name: "Review & accept terms and non-insurance disclosure",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Accept document terms" }),
  );
}
test("all five checkout sections and prices remain visible before sign-in", () => {
  render(<UnifiedCheckout />);
  for (const title of [
    "Review Your Order",
    "Payment Method",
    "Account",
    "Agent / Rep Selection",
    "Confirm & Pay",
  ])
    expect(
      screen.getByRole("heading", { name: new RegExp(title) }),
    ).toBeTruthy();
  expect(screen.getByText("Inline account wizard")).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Proceed to Payment",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(state.fetch).not.toHaveBeenCalled();
});
test("every selected product's signature must save before creating the Stripe session", async () => {
  state.signedIn = true;
  render(<UnifiedCheckout />);
  await signAll();
  fireEvent.click(screen.getByRole("button", { name: "Proceed to Payment" }));
  await waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
  expect(state.save).toHaveBeenCalledTimes(2);
  expect(state.save.mock.calls.map((call) => call[0].memberSignature)).toEqual([
    "data:image/png;base64,signed-program",
    "data:image/png;base64,signed-oral",
  ]);
  const body = JSON.parse(state.fetch.mock.calls[0][1].body);
  expect(body).toMatchObject({
    planId: "ess_id",
    additionalPlanIds: ["oral_id"],
    cadence: "monthly",
    referralCode: "100001",
    siteSlug: "assurevantage",
  });
  expect(state.save.mock.invocationCallOrder[1]).toBeLessThan(
    state.fetch.mock.invocationCallOrder[0],
  );
});
test("agreement storage failures block payment and offer a retry", async () => {
  state.signedIn = true;
  state.save.mockRejectedValue(new Error("Could not save signature"));
  render(<UnifiedCheckout />);
  await signAll();
  fireEvent.click(screen.getByRole("button", { name: "Proceed to Payment" }));
  await screen.findByRole("alert");
  expect(state.fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain(
    "We couldn’t save all signed agreements",
  );
});
test("oral annual billing and ACH amounts survive through agreement storage and Stripe", async () => {
  state.signedIn = true;
  state.items = [item("oral_id", "oral-individual", "dental")];
  state.cadence = "annual";
  state.payment = "ach";
  state.subtotal = 15499;
  render(<UnifiedCheckout />);
  await signAll();
  fireEvent.click(screen.getByRole("button", { name: "Proceed to Payment" }));
  await waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
  expect(state.save).toHaveBeenCalledWith(
    expect.objectContaining({
      periodicCharge: "$154.99",
      term: "Annual",
      paymentMode: "Bank Transfer (ACH)",
    }),
  );
  expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toMatchObject({
    cadence: "annual",
    paymentMethod: "ach",
  });
});
test("switching the customer or changing order pricing invalidates prior signatures", async () => {
  state.signedIn = true;
  const view = render(<UnifiedCheckout />);
  await signAll();
  expect(
    (
      screen.getByRole("button", {
        name: "Proceed to Payment",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  state.userId = "another_user";
  view.rerender(<UnifiedCheckout />);
  expect(
    (
      screen.getByRole("button", {
        name: "Proceed to Payment",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  state.userId = "user_1";
  state.payment = "ach";
  view.rerender(<UnifiedCheckout />);
  expect(
    (
      screen.getByRole("button", {
        name: "Proceed to Payment",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test.each(["essentials-employee", "bfl-individual"])(
  "hides annual billing when %s is selected",
  (slug) => {
    state.items = [item("program_id", slug, "newideal")];
    render(<UnifiedCheckout />);
    expect(
      screen.queryByRole("button", { name: "Annual", exact: true }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Monthly", exact: true }),
    ).toBeTruthy();
  },
);
