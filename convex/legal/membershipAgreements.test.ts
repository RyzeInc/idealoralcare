import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
async function setup() {
  const t = convexTest(schema);
  const owner = t.withIdentity({
    subject: "user_owner",
    tokenIdentifier: "clerk|user_owner",
  });
  const productId = await t.run((ctx) =>
    ctx.db.insert("catalogProducts", {
      slug: "oral-individual",
      name: "Oral Individual",
      category: "dental",
      description: "",
      inclusions: [],
      exclusions: [],
      eligibilityRules: { requiresVerification: false, disclosureText: "" },
      activationBehavior: "immediate",
      pricing: {
        monthlyCardCents: 1499,
        monthlyACHCents: 1399,
        annualCardCents: 16499,
        annualACHCents: 15499,
      },
      isVisible: true,
      isFeatured: false,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    }),
  );
  const saved = await owner.mutation(
    api.legal.membershipAgreements.createMembershipAgreement,
    {
      productId,
      userId: "user_owner",
      memberId: "user_owner",
      memberName: "Pat Member",
      memberAddress: "123 Main, Columbus, OH, 43215",
      email: "pat@example.test",
      planName: "AssureVantage Oral Care — Individual",
      groupCode: "existing",
      term: "Monthly",
      paymentMode: "Credit/Debit Card",
      periodicCharge: "$14.99",
      membershipTermsAgreed: true,
      termsAndConditionsAgreed: true,
      memberSignature: "data:image/png;base64,signature",
      signatureTimestamp: Date.now(),
    },
  );
  const args = {
    agreementIds: [saved.agreementId],
    plans: [{ productId, periodicCharge: "$14.99" }],
    term: "Monthly",
    paymentMode: "Credit Card",
    memberAddress: "123 Main, Columbus, OH, 43215",
  };
  return { t, owner, args };
}
test("the purchaser's signed product, amount, billing method and intake must match before Stripe", async () => {
  const { owner, args } = await setup();
  expect(
    await owner.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      args,
    ),
  ).toEqual({ valid: true });
  expect(
    await owner.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      { ...args, term: "Annual" },
    ),
  ).toEqual({ valid: false });
  expect(
    await owner.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      { ...args, paymentMode: "Bank Draft" },
    ),
  ).toEqual({ valid: false });
  expect(
    await owner.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      { ...args, memberAddress: "Different address" },
    ),
  ).toEqual({ valid: false });
  expect(
    await owner.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      { ...args, plans: [{ ...args.plans[0], periodicCharge: "$164.99" }] },
    ),
  ).toEqual({ valid: false });
});
test("another account or an unsigned request cannot reuse a customer's documents", async () => {
  const { t, args } = await setup();
  expect(
    await t.query(
      api.legal.membershipAgreements.validateCheckoutAgreements,
      args,
    ),
  ).toEqual({ valid: false });
  expect(
    await t
      .withIdentity({
        subject: "user_other",
        tokenIdentifier: "clerk|user_other",
      })
      .query(api.legal.membershipAgreements.validateCheckoutAgreements, args),
  ).toEqual({ valid: false });
});
