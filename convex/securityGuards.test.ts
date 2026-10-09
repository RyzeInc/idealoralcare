/**
 * SECURITY GUARDS — functions our servers call (webhooks, Stripe routes) must
 * refuse anyone without the service secret; member lookups must refuse other
 * members; and the browser must not be able to steer server-only state.
 * Convex functions are reachable by anyone holding the deployment URL, which
 * ships in the browser bundle — these pin the boundary.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const SECRET = process.env.CONVEX_SERVICE_SECRET!;
const member = (id: string) => ({ tokenIdentifier: `https://clerk.test|${id}`, subject: id });

async function seedBundle(t: ReturnType<typeof convexTest>, customerId: string) {
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("subscriptionBundles", {
      customerId, cadence: "monthly", paymentMethod: "card", stripeCustomerId: `cus_${customerId}`,
      stripeSubscriptionId: `sub_${customerId}`, status: "active", currentPeriodStart: now, currentPeriodEnd: now + 1,
      pricingSnapshot: { cadence: "monthly", paymentMethod: "card", totalCents: 1499, planCount: 1, capturedAt: now },
      createdAt: now, updatedAt: now,
    });
  });
}

describe("server-only functions require the service secret", () => {
  test("granting plan access", async () => {
    const t = convexTest(schema);
    const bundleId = await seedBundle(t, "user_a");
    const productId = await t.run((ctx) => ctx.db.insert("catalogProducts", {
      slug: "p", name: "p", category: "dental", description: "", inclusions: [], exclusions: [],
      eligibilityRules: { requiresVerification: false, disclosureText: "" }, activationBehavior: "immediate",
      pricing: { monthlyCardCents: 1, monthlyACHCents: 1, annualCardCents: 1, annualACHCents: 1 },
      isVisible: true, isFeatured: false, order: 0, createdAt: 1, updatedAt: 1,
    }));
    const args = { customerId: "attacker", bundleId, productId, periodStart: 1, periodEnd: 2, endCondition: "renew" as const };
    await expect(t.mutation(api.subscriptions.mutations.webhookActivateEntitlement, args as never)).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.subscriptions.mutations.webhookActivateEntitlement, { ...args, serviceSecret: "wrong-but-long-enough-to-look-real-xxxxx" } as never),
    ).rejects.toThrow(/Unauthorized/);
  });

  test("cancelling someone's plan", async () => {
    const t = convexTest(schema);
    const bundleId = await seedBundle(t, "user_a");
    await expect(
      t.mutation(api.subscriptions.webhookActions.cancelBundleFromWebhook, { bundleId, reason: "x", stripeEventId: "evt" } as never),
    ).rejects.toThrow(/Unauthorized/);
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle?.status).toBe("active");
  });

  test("looking up a pending admin invite token by email", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.admin.adminUsers.getPendingInviteByEmail, { email: "new.admin@ideal.test" })).rejects.toThrow(/Unauthorized/);
    expect(await t.query(api.admin.adminUsers.getPendingInviteByEmail, { email: "new.admin@ideal.test", serviceSecret: SECRET })).toBeNull();
  });

  test("recording a commission", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.subscriptions.commissions.recordCommissionForCheckout, { brokerValue: "rep", totalCents: 1 }),
    ).rejects.toThrow(/Unauthorized/);
  });
});

describe("member billing lookups", () => {
  test("anonymous callers and other members are refused; the member and our server are not", async () => {
    const t = convexTest(schema);
    await seedBundle(t, "user_a");
    const q = api.subscriptions.queries.getCustomerBundleWithStripeIds;
    await expect(t.query(q, { customerId: "user_a" })).rejects.toThrow();
    await expect(t.withIdentity(member("user_b")).query(q, { customerId: "user_a" })).rejects.toThrow();
    expect(await t.withIdentity(member("user_a")).query(q, { customerId: "user_a" })).toMatchObject({ customerId: "user_a" });
    expect(await t.query(q, { customerId: "user_a", serviceSecret: SECRET })).toMatchObject({ customerId: "user_a" });
  });
});

describe("browser-callable mutations", () => {
  test("a member can only sign their own agreement", async () => {
    const t = convexTest(schema);
    const args = {
      userId: "user_victim", memberName: "X", email: "x@t.dev", planName: "Oral",
      memberSignature: "data:image/png;base64,AA", signatureTimestamp: 1,
    };
    await expect(t.mutation(api.legal.membershipAgreements.createOralCareAgreement, args)).rejects.toThrow(/Unauthorized/);
    await expect(t.withIdentity(member("user_attacker")).mutation(api.legal.membershipAgreements.createOralCareAgreement, args)).rejects.toThrow(/Unauthorized/);
  });

  test("an enrollment session can't be pointed at a member from the browser", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.enrollment.sessions.updateEnrollmentSession, { sessionId: "s", memberId: "x" } as never),
    ).rejects.toThrow(/memberId|extra field|Validator/);
    await expect(
      t.mutation(api.enrollment.sessions.updateEnrollmentSession, { sessionId: "s", status: "completed" } as never),
    ).rejects.toThrow(/Validator|completed/);
  });
});
