import { describe, expect, it } from "vitest";
import { calculateStripeFees, type FeeInputs } from "./stripe-fee-calculator";

const base: FeeInputs = {
  amountsCents: [1499], paymentMethod: "card", separateCharges: false,
  cardPercent: 2.9, cardFixedCents: 30, achPercent: 0.8,
  achCapCents: 500, billingPercent: 0.7, payoutPercent: 0,
  payoutFixedCents: 0,
};

describe("Stripe fee forecast", () => {
  it("reconstructs the observed $14.99 payment, Billing fee and standard payout", () => {
    expect(calculateStripeFees(base)).toEqual({
      grossCents: 1499, chargeCount: 1, processingCents: 73,
      billingCents: 10, availableCents: 1416, payoutFeeCents: 0,
      takeHomeCents: 1416,
    });
  });

  it("applies one card fixed fee for a combined charge, two for separate charges", () => {
    const combined = calculateStripeFees({ ...base, amountsCents: [1000, 1000] });
    const separate = calculateStripeFees({ ...base, amountsCents: [1000, 1000], separateCharges: true });
    expect(combined.chargeCount).toBe(1);
    expect(separate.chargeCount).toBe(2);
    expect(separate.processingCents - combined.processingCents).toBe(30);
  });

  it("caps ACH per charge and computes configured payout fees on available funds", () => {
    const result = calculateStripeFees({ ...base, amountsCents: [100000], paymentMethod: "ach", billingPercent: 0, payoutPercent: 1, payoutFixedCents: 25 });
    expect(result.processingCents).toBe(500);
    expect(result.payoutFeeCents).toBe(1020);
    expect(result.takeHomeCents).toBe(98480);
  });

  it("calculates inbound card and Billing fees before a custom outbound bank payout fee", () => {
    const result = calculateStripeFees({ ...base, payoutPercent: 1, payoutFixedCents: 25 });
    expect(result.processingCents).toBe(73);
    expect(result.billingCents).toBe(10);
    expect(result.availableCents).toBe(1416);
    expect(result.payoutFeeCents).toBe(39);
    expect(result.takeHomeCents).toBe(1377);
  });
});
