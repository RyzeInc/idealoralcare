/**
 * MEMBER BILLING — the pricing rules the dashboard and the invoice generator
 * now share.
 *
 * The cases that matter are the ones that were silently wrong before: a
 * list-bill member with no Stripe record, and a list-bill member carrying the
 * decoy $0 bundle that portal provisioning creates.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import {
  isOnBook,
  isListBillMember,
  classifyListBillTier,
  resolveListBillRates,
  resolveListBillRateCents,
  memberBilling,
  BILLABLE_MEMBER_TYPES,
} from "./memberBilling";

const dep = (relationship?: string, memberType = "active") =>
  ({ memberType, memberRole: "dependent", relationship } as any);

const member = (over: Record<string, unknown> = {}) =>
  ({ memberType: "active", memberRole: "primary", ...over } as any);

const listBillGroup = (rates?: Record<string, unknown>) =>
  ({ listBill: { enabled: true, ...(rates ? { rates } : {}) } } as any);

describe("isOnBook", () => {
  test("eligible counts as covered, not just active", () => {
    // The whole point: an eligibility-file member with no email can never be
    // portal-provisioned, but the employer is billed for them regardless.
    expect(isOnBook({ memberType: "eligible" })).toBe(true);
    expect(isOnBook({ memberType: "enrolling" })).toBe(true);
    expect(isOnBook({ memberType: "active" })).toBe(true);
  });

  test("exited states are not on the book", () => {
    expect(isOnBook({ memberType: "terminated" })).toBe(false);
    expect(isOnBook({ memberType: "inactive" })).toBe(false);
    expect(isOnBook({ memberType: "declined" })).toBe(false);
    expect(isOnBook({})).toBe(false);
  });

  test("matches the invoice generator's billable set exactly", () => {
    expect([...BILLABLE_MEMBER_TYPES].sort()).toEqual(
      ["active", "eligible", "enrolling"],
    );
  });
});

describe("isListBillMember", () => {
  test("keys off the group, never employeeType", () => {
    // employeeType is never set by the eligibility pipeline; a predicate that
    // required it missed every file-loaded member.
    expect(isListBillMember(member({ employeeType: undefined }), listBillGroup())).toBe(true);
  });

  test("undefined listBillStatus is billable", () => {
    expect(isListBillMember(member(), listBillGroup())).toBe(true);
    expect(isListBillMember(member({ listBillStatus: "active" }), listBillGroup())).toBe(true);
  });

  test("termed and converted are not", () => {
    expect(isListBillMember(member({ listBillStatus: "termed" }), listBillGroup())).toBe(false);
    expect(isListBillMember(member({ listBillStatus: "converted" }), listBillGroup())).toBe(false);
  });

  test("a non-list-bill group is never list-bill", () => {
    expect(isListBillMember(member(), { listBill: { enabled: false } } as any)).toBe(false);
    expect(isListBillMember(member(), null)).toBe(false);
  });
});

describe("classifyListBillTier", () => {
  test("no dependents is MO", () => {
    expect(classifyListBillTier([])).toEqual({ tier: "MO", dependentCount: 0 });
  });

  test("two or more dependents is MF", () => {
    expect(classifyListBillTier([dep("spouse"), dep("child")])).toEqual({
      tier: "MF", dependentCount: 2,
    });
  });

  test("one spouse is MS; one child is MF", () => {
    expect(classifyListBillTier([dep("spouse")]).tier).toBe("MS");
    expect(classifyListBillTier([dep("domestic_partner")]).tier).toBe("MS");
    expect(classifyListBillTier([dep("child")]).tier).toBe("MF");
  });

  test("one dependent with NO relationship is MO, not MS", () => {
    // Deliberately conservative — guessing a relationship would over-bill.
    // dependentCount > 0 therefore does not imply a non-MO tier.
    const result = classifyListBillTier([dep(undefined)]);
    expect(result.tier).toBe("MO");
    expect(result.dependentCount).toBe(1);
  });

  test("terminated dependents don't count toward the tier", () => {
    expect(classifyListBillTier([dep("spouse", "terminated")])).toEqual({
      tier: "MO", dependentCount: 0,
    });
  });
});

describe("rate resolution", () => {
  test("group rates win", () => {
    const rates = resolveListBillRates(
      listBillGroup({ moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "Financial Shield" }),
      null,
    );
    expect(rates).toEqual({
      moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "Financial Shield",
    });
  });

  test("falls back to account custom pricing, flat across tiers", () => {
    const rates = resolveListBillRates(listBillGroup(), {
      customPricing: [{ monthlyCardCents: 2000 }],
    } as any);
    expect(rates.moCents).toBe(2000);
    expect(rates.mfCents).toBe(2000);
  });

  test("last resort is the dispersal gross", () => {
    const rates = resolveListBillRates(listBillGroup(), null);
    expect(rates.moCents).toBe(1499);
    expect(rates.mfCents).toBe(2499);
  });

  test("per-member premium overrides the tier rate", () => {
    const rates = { moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "x" };
    // Soar-style: the file's "Approved EE Cost" is authoritative.
    expect(resolveListBillRateCents({ monthlyPremiumCents: 4250 }, "MF", rates)).toBe(4250);
    expect(resolveListBillRateCents({}, "MF", rates)).toBe(12100);
  });

  test("an explicit zero premium is honoured, not treated as missing", () => {
    const rates = { moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "x" };
    expect(resolveListBillRateCents({ monthlyPremiumCents: 0 }, "MO", rates)).toBe(0);
  });
});

describe("memberBilling", () => {
  const rates = { moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "Financial Shield" };
  const group = listBillGroup(rates);

  test("list-bill member with NO Stripe record is priced, not zeroed", () => {
    const facts = memberBilling(member(), group, null, [], null);
    expect(facts.source).toBe("list_bill");
    expect(facts.mrrCents).toBe(5795);
    expect(facts.employerPays).toBe(true);
    expect(facts.onBook).toBe(true);
  });

  test("the decoy $0 employer bundle does NOT zero the member", () => {
    // Portal provisioning creates a $0 bundle with a sentinel stripeCustomerId
    // purely to grant portal access. Reading it as a price is the subtle bug:
    // this member is worth the group rate, not zero.
    const decoy = {
      status: "active",
      cadence: "monthly",
      stripeCustomerId: "employer_listbill_abc123",
      pricingSnapshot: { totalCents: 0 },
    } as any;
    const facts = memberBilling(member({ customerId: "user_1" }), group, null, [], decoy);
    expect(facts.source).toBe("list_bill");
    expect(facts.mrrCents).toBe(5795);
  });

  test("an eligible list-bill member is billed like an active one", () => {
    const facts = memberBilling(member({ memberType: "eligible" }), group, null, [], null);
    expect(facts.source).toBe("list_bill");
    expect(facts.mrrCents).toBe(5795);
  });

  test("tier follows the household", () => {
    const facts = memberBilling(member(), group, null, [dep("spouse"), dep("child")], null);
    expect(facts.tier).toBe("MF");
    expect(facts.mrrCents).toBe(12100);
  });

  test("a termed list-bill member falls out of list-bill pricing", () => {
    const facts = memberBilling(member({ listBillStatus: "termed" }), group, null, [], null);
    expect(facts.source).toBe("none");
    expect(facts.mrrCents).toBe(0);
  });

  test("direct Stripe member prices from the bundle", () => {
    const bundle = { status: "active", cadence: "monthly", pricingSnapshot: { totalCents: 1499 } } as any;
    const facts = memberBilling(member(), null, null, [], bundle);
    expect(facts.source).toBe("direct");
    expect(facts.mrrCents).toBe(1499);
    expect(facts.employerPays).toBe(false);
  });

  test("annual normalizes to monthly", () => {
    const bundle = { status: "active", cadence: "annual", pricingSnapshot: { totalCents: 16499 } } as any;
    expect(memberBilling(member(), null, null, [], bundle).mrrCents).toBe(1375);
  });

  test("a genuinely comped member is 'comp', distinct from list-bill", () => {
    const bundle = { status: "active", cadence: "monthly", pricingSnapshot: { totalCents: 0 } } as any;
    const facts = memberBilling(member(), null, null, [], bundle);
    expect(facts.source).toBe("comp");
    expect(facts.mrrCents).toBe(0);
  });

  test("dependents are worth $0 and never double-counted", () => {
    const facts = memberBilling(member({ memberRole: "dependent" }), group, null, [], null);
    expect(facts.source).toBe("none");
    expect(facts.mrrCents).toBe(0);
  });
});
