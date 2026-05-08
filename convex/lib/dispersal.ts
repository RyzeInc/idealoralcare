/**
 * Revenue dispersal model for Oral Care subscriptions.
 *
 * Per the operating agreement, every PRIMARY member produces invoiceable
 * revenue based on their plan tier. Dependents always count as $0 because
 * they ride on the primary's subscription.
 *
 *   Individual primary  → $14.99 / month
 *   Family primary      → $24.99 / month
 *   Dependent           →  $0.00
 *
 * Each dollar of gross revenue is split between fixed pass-through line
 * items (Toothlens fee, Careington network fee, payment processing) and
 * the Partner Vendor share (Ideal Health). Ryze (the carrier) keeps the
 * residual.
 *
 * Stated splits (per the calculator spec):
 *   Individual ($14.99): $1 Toothlens + $2 Careington + $1 Processing
 *                        + $6 Partner Vendor + $5 Ryze (= $15.00)
 *   Family     ($24.99): $1 Toothlens + $2 Careington + $2 Processing
 *                        + $11 Partner Vendor + $9 Ryze (= $25.00)
 *
 * Because the gross is $14.99 / $24.99 (not a round dollar), Ryze's net
 * absorbs the $0.01 rounding. We compute `ryzeKeepCents` as the residual
 * so that gross == sum(splits) for every primary, every time.
 */

export type PlanTier = "individual" | "family" | "none";

export interface DispersalSplit {
  /** Gross monthly revenue per primary, in cents. */
  grossCents: number;
  /** Pass-through fee paid to Toothlens (AI detection) per primary. */
  toothlensCents: number;
  /** Pass-through fee paid to Careington (network) per primary. */
  careingtonCents: number;
  /** Payment processing fee (Stripe / Ryze) per primary. */
  processingCents: number;
  /** Partner Vendor (Ideal Health) share per primary. */
  partnerVendorCents: number;
  /** Carrier (Ryze) net keep per primary — computed as the residual. */
  ryzeKeepCents: number;
}

const INDIVIDUAL_GROSS_CENTS = 1499;
const FAMILY_GROSS_CENTS = 2499;

export const DISPERSAL: Record<Exclude<PlanTier, "none">, DispersalSplit> = {
  individual: {
    grossCents: INDIVIDUAL_GROSS_CENTS,
    toothlensCents: 100,
    careingtonCents: 200,
    processingCents: 100,
    partnerVendorCents: 600,
    // Stated as $5; computed residual is $4.99 (penny absorbed by Ryze).
    ryzeKeepCents: INDIVIDUAL_GROSS_CENTS - 100 - 200 - 100 - 600,
  },
  family: {
    grossCents: FAMILY_GROSS_CENTS,
    toothlensCents: 100,
    careingtonCents: 200,
    processingCents: 200,
    partnerVendorCents: 1100,
    // Stated as $9; computed residual is $8.99 (penny absorbed by Ryze).
    ryzeKeepCents: FAMILY_GROSS_CENTS - 100 - 200 - 200 - 1100,
  },
};

export const ZERO_SPLIT: DispersalSplit = {
  grossCents: 0,
  toothlensCents: 0,
  careingtonCents: 0,
  processingCents: 0,
  partnerVendorCents: 0,
  ryzeKeepCents: 0,
};

// Fail-fast at module load: dispersal table must satisfy INV-01.
// If this throws, the calculator deployment is broken and must not ship.
(function verifyDispersalTable() {
  const sum = (s: DispersalSplit) =>
    s.toothlensCents + s.careingtonCents + s.processingCents +
    s.partnerVendorCents + s.ryzeKeepCents;
  for (const tier of ["individual", "family"] as const) {
    const split = DISPERSAL[tier];
    if (sum(split) !== split.grossCents) {
      throw new Error(
        `Dispersal table violates INV-01 for ${tier}: ` +
        `gross=${split.grossCents} but splits sum to ${sum(split)}`,
      );
    }
  }
})();

/** Look up the per-primary split for a given plan tier. */
export function getSplitForTier(tier: PlanTier): DispersalSplit {
  if (tier === "individual") return DISPERSAL.individual;
  if (tier === "family") return DISPERSAL.family;
  return ZERO_SPLIT;
}

/**
 * Classify a paid subscription bundle's `pricingSnapshot.totalCents` into
 * a plan tier. Anything else (including $0 employer-comped bundles or
 * missing bundles) is "none" and produces no revenue.
 */
export function classifyTier(totalCents: number | undefined | null): PlanTier {
  if (totalCents === INDIVIDUAL_GROSS_CENTS) return "individual";
  if (totalCents === FAMILY_GROSS_CENTS) return "family";
  return "none";
}

/** Sum two splits — handy for aggregating across many primaries. */
export function addSplits(a: DispersalSplit, b: DispersalSplit): DispersalSplit {
  return {
    grossCents: a.grossCents + b.grossCents,
    toothlensCents: a.toothlensCents + b.toothlensCents,
    careingtonCents: a.careingtonCents + b.careingtonCents,
    processingCents: a.processingCents + b.processingCents,
    partnerVendorCents: a.partnerVendorCents + b.partnerVendorCents,
    ryzeKeepCents: a.ryzeKeepCents + b.ryzeKeepCents,
  };
}

/** Multiply a split by a member count (for per-tier aggregates). */
export function scaleSplit(split: DispersalSplit, count: number): DispersalSplit {
  return {
    grossCents: split.grossCents * count,
    toothlensCents: split.toothlensCents * count,
    careingtonCents: split.careingtonCents * count,
    processingCents: split.processingCents * count,
    partnerVendorCents: split.partnerVendorCents * count,
    ryzeKeepCents: split.ryzeKeepCents * count,
  };
}

/** Bucket name used by adjustments + vendor reports. */
export type DispersalBucket =
  | "gross"
  | "toothlens"
  | "careington"
  | "processing"
  | "partnerVendor"
  | "ryzeKeep";

export const DISPERSAL_BUCKETS: DispersalBucket[] = [
  "gross",
  "toothlens",
  "careington",
  "processing",
  "partnerVendor",
  "ryzeKeep",
];

/**
 * Serializable snapshot of the current pricing/dispersal table.
 * Persisted with each `invoicePeriods` row so historical periods can be
 * reproduced even if rates change later (spec §10 #6).
 */
export interface PricingSnapshot {
  individualGrossCents: number;
  familyGrossCents: number;
  individualSplits: Omit<DispersalSplit, "grossCents">;
  familySplits: Omit<DispersalSplit, "grossCents">;
}

const stripGross = (s: DispersalSplit): Omit<DispersalSplit, "grossCents"> => ({
  toothlensCents: s.toothlensCents,
  careingtonCents: s.careingtonCents,
  processingCents: s.processingCents,
  partnerVendorCents: s.partnerVendorCents,
  ryzeKeepCents: s.ryzeKeepCents,
});

/** The current pricing snapshot — stamped into every closed period. */
export function currentPricingSnapshot(): PricingSnapshot {
  return {
    individualGrossCents: DISPERSAL.individual.grossCents,
    familyGrossCents: DISPERSAL.family.grossCents,
    individualSplits: stripGross(DISPERSAL.individual),
    familySplits: stripGross(DISPERSAL.family),
  };
}

/** Validate INV-01 for a split. Throws on penny mismatch. */
export function assertSplitInvariant(s: DispersalSplit, label = "split"): void {
  const sum =
    s.toothlensCents +
    s.careingtonCents +
    s.processingCents +
    s.partnerVendorCents +
    s.ryzeKeepCents;
  if (sum !== s.grossCents) {
    throw new Error(
      `INV-01 violated for ${label}: gross=${s.grossCents} but splits sum to ${sum}`,
    );
  }
}
