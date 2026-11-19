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
 * Splits follow the program control sheet (November 2026):
 *
 *                Toothlens  Advisor  Override  Broker   Ryze
 *   Individual     $0.50     $0.50    $2.00    $5.99   $6.00   (= $14.99)
 *   Family         $0.50     $0.50    $4.00   $11.99   $8.00   (= $24.99)
 *
 * The control sheet's $1.00 Toothlens line is shared evenly between
 * Toothlens and our advisor. The override goes to the program manager (Ideal Health / AssureVantage).
 * The broker share is tracked separately even though, through 2026, Ideal
 * Health receives it and pays the brokers — including the share on groups
 * sold direct. Ryze's share covers the network (Careington / DialCare) and
 * payment processing, so those buckets are zero; they remain only so
 * periods closed under the earlier table still read correctly.
 *
 * Periods closed before the control sheet carried no broker or advisor bucket
 * ($1 Toothlens, $6 / $11 Partner Vendor, $2 Careington, $1 / $2 Processing).
 * Readers treat a missing `brokerCents` or `advisorCents` as zero, and `repriceClosedPeriod` restates those
 * months under this table.
 *
 * `ryzeKeepCents` is computed as the residual so that gross == sum(splits)
 * for every primary, every time.
 */

export type PlanTier = "individual" | "family" | "none";

export interface DispersalSplit {
  /** Gross monthly revenue per primary, in cents. */
  grossCents: number;
  /** Pass-through fee paid to Toothlens (AI detection) per primary. */
  toothlensCents: number;
  /** Advisor's share of the control sheet's Toothlens line, per primary. */
  advisorCents: number;
  /** Pass-through fee paid to Careington (network) per primary. */
  careingtonCents: number;
  /** Payment processing fee (Stripe / Ryze) per primary. */
  processingCents: number;
  /** Program manager override (Ideal Health / AssureVantage) per primary. */
  partnerVendorCents: number;
  /** Broker commission per primary. Paid through Ideal Health in 2026. */
  brokerCents: number;
  /** Carrier (Ryze) net keep per primary — computed as the residual. */
  ryzeKeepCents: number;
}

const INDIVIDUAL_GROSS_CENTS = 1499;
const FAMILY_GROSS_CENTS = 2499;

export const DISPERSAL: Record<Exclude<PlanTier, "none">, DispersalSplit> = {
  individual: {
    grossCents: INDIVIDUAL_GROSS_CENTS,
    toothlensCents: 50,
    advisorCents: 50,
    careingtonCents: 0,
    processingCents: 0,
    partnerVendorCents: 200,
    brokerCents: 599,
    ryzeKeepCents: INDIVIDUAL_GROSS_CENTS - 50 - 50 - 200 - 599, // $6.00
  },
  family: {
    grossCents: FAMILY_GROSS_CENTS,
    toothlensCents: 50,
    advisorCents: 50,
    careingtonCents: 0,
    processingCents: 0,
    partnerVendorCents: 400,
    brokerCents: 1199,
    ryzeKeepCents: FAMILY_GROSS_CENTS - 50 - 50 - 400 - 1199, // $8.00
  },
};

export const ZERO_SPLIT: DispersalSplit = {
  grossCents: 0,
  toothlensCents: 0,
  advisorCents: 0,
  careingtonCents: 0,
  processingCents: 0,
  partnerVendorCents: 0,
  brokerCents: 0,
  ryzeKeepCents: 0,
};

// Fail-fast at module load: dispersal table must satisfy INV-01.
// If this throws, the calculator deployment is broken and must not ship.
(function verifyDispersalTable() {
  const sum = (s: DispersalSplit) =>
    s.toothlensCents + s.advisorCents + s.careingtonCents + s.processingCents +
    s.partnerVendorCents + s.brokerCents + s.ryzeKeepCents;
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
    advisorCents: a.advisorCents + b.advisorCents,
    careingtonCents: a.careingtonCents + b.careingtonCents,
    processingCents: a.processingCents + b.processingCents,
    partnerVendorCents: a.partnerVendorCents + b.partnerVendorCents,
    brokerCents: a.brokerCents + b.brokerCents,
    ryzeKeepCents: a.ryzeKeepCents + b.ryzeKeepCents,
  };
}

/** Multiply a split by a member count (for per-tier aggregates). */
export function scaleSplit(split: DispersalSplit, count: number): DispersalSplit {
  return {
    grossCents: split.grossCents * count,
    toothlensCents: split.toothlensCents * count,
    advisorCents: split.advisorCents * count,
    careingtonCents: split.careingtonCents * count,
    processingCents: split.processingCents * count,
    partnerVendorCents: split.partnerVendorCents * count,
    brokerCents: split.brokerCents * count,
    ryzeKeepCents: split.ryzeKeepCents * count,
  };
}

/** Bucket name used by adjustments + vendor reports. */
export type DispersalBucket =
  | "gross"
  | "toothlens"
  | "advisor"
  | "careington"
  | "processing"
  | "partnerVendor"
  | "broker"
  | "ryzeKeep";

export const DISPERSAL_BUCKETS: DispersalBucket[] = [
  "gross",
  "toothlens",
  "advisor",
  "careington",
  "processing",
  "partnerVendor",
  "broker",
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
  advisorCents: s.advisorCents,
  careingtonCents: s.careingtonCents,
  processingCents: s.processingCents,
  partnerVendorCents: s.partnerVendorCents,
  brokerCents: s.brokerCents,
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
    s.advisorCents +
    s.careingtonCents +
    s.processingCents +
    s.partnerVendorCents +
    s.brokerCents +
    s.ryzeKeepCents;
  if (sum !== s.grossCents) {
    throw new Error(
      `INV-01 violated for ${label}: gross=${s.grossCents} but splits sum to ${sum}`,
    );
  }
}

/**
 * The split stored on a closed period or one of its member lines. Rows
 * closed before the broker and advisor buckets existed carry no `brokerCents`
 * or `advisorCents`; that money sat inside `partnerVendorCents` and
 * `toothlensCents`, so it reads as zero here.
 */
export function storedSplit(row: {
  grossCents: number;
  toothlensCents: number;
  advisorCents?: number;
  careingtonCents: number;
  processingCents: number;
  partnerVendorCents: number;
  brokerCents?: number;
  ryzeKeepCents: number;
}): DispersalSplit {
  return {
    grossCents: row.grossCents,
    toothlensCents: row.toothlensCents,
    advisorCents: row.advisorCents ?? 0,
    careingtonCents: row.careingtonCents,
    processingCents: row.processingCents,
    partnerVendorCents: row.partnerVendorCents,
    brokerCents: row.brokerCents ?? 0,
    ryzeKeepCents: row.ryzeKeepCents,
  };
}

/** True when two splits agree on every bucket. */
export function splitsEqual(a: DispersalSplit, b: DispersalSplit): boolean {
  return (
    a.grossCents === b.grossCents &&
    a.toothlensCents === b.toothlensCents &&
    a.advisorCents === b.advisorCents &&
    a.careingtonCents === b.careingtonCents &&
    a.processingCents === b.processingCents &&
    a.partnerVendorCents === b.partnerVendorCents &&
    a.brokerCents === b.brokerCents &&
    a.ryzeKeepCents === b.ryzeKeepCents
  );
}
