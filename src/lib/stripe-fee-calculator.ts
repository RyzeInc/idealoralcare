/** USD forecast only. Stripe's balance transactions are the final source of truth. */
export type PaymentMethod = "card" | "ach";

export interface FeeInputs {
  amountsCents: number[];
  paymentMethod: PaymentMethod;
  separateCharges: boolean;
  cardPercent: number;
  cardFixedCents: number;
  achPercent: number;
  achCapCents: number;
  billingPercent: number;
  transferCents: number;
  transferPercent: number;
  transferFixedCents: number;
  payoutPercent: number;
  payoutFixedCents: number;
}

export interface FeeResult {
  grossCents: number;
  chargeCount: number;
  processingCents: number;
  billingCents: number;
  availableCents: number;
  transferCents: number;
  transferFeeCents: number;
  payoutFeeCents: number;
  takeHomeCents: number;
}

export function calculateStripeFees(input: FeeInputs): FeeResult {
  const amounts = input.amountsCents.filter((amount) => Number.isSafeInteger(amount) && amount > 0);
  const grossCents = amounts.reduce((sum, amount) => sum + amount, 0);
  const charges = input.separateCharges ? amounts : grossCents > 0 ? [grossCents] : [];
  const processingCents = charges.reduce((sum, amount) => sum + (
    input.paymentMethod === "card"
      ? Math.round(amount * input.cardPercent / 100 + input.cardFixedCents)
      : Math.min(input.achCapCents, Math.round(amount * input.achPercent / 100))
  ), 0);
  // Billing usage fees can post separately. This models the published rate on
  // each invoice, which is how the observed $14.99 -> $0.10 example rounds.
  const billingCents = charges.reduce((sum, amount) => sum + Math.round(amount * input.billingPercent / 100), 0);
  const availableCents = grossCents - processingCents - billingCents;
  const transferCents = Math.min(Math.max(0, input.transferCents), Math.max(0, availableCents));
  const transferFeeCents = transferCents > 0
    ? Math.round(transferCents * input.transferPercent / 100 + input.transferFixedCents)
    : 0;
  const bankAmountCents = Math.max(0, availableCents - transferCents - transferFeeCents);
  const payoutFeeCents = bankAmountCents > 0
    ? Math.round(bankAmountCents * input.payoutPercent / 100 + input.payoutFixedCents)
    : 0;
  return {
    grossCents,
    chargeCount: charges.length,
    processingCents,
    billingCents,
    availableCents,
    transferCents,
    transferFeeCents,
    payoutFeeCents,
    takeHomeCents: bankAmountCents - payoutFeeCents,
  };
}
