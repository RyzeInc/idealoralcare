/**
 * MEMBER BILLING — one answer to "is this member on the book, and what are
 * they worth per month?"
 *
 * The insights layer originally assumed every member was a direct-to-consumer
 * Stripe subscriber. A large part of the book is not: employees loaded from an
 * employer's eligibility file are covered from day one, invoiced to the
 * employer monthly, and carry no Stripe subscription. They were being reported
 * as $0, and frequently as not on the book at all.
 *
 * The correct pricing logic already existed in admin/listBillInvoices.ts — it
 * has been billing real employers all along. This module is where it now lives
 * so the invoice generator and the dashboard can never drift apart: the
 * invoice generator imports these same primitives back.
 *
 * TWO RATE SYSTEMS EXIST, BY DESIGN. Do not reconcile them:
 *
 *   Billed      what the employer is invoiced — monthlyPremiumCents, else the
 *               group's contracted MO/MS/MF rate. THIS module. Used for
 *               revenue reporting.
 *   Dispersal   the fixed $14.99 / $24.99 split that feeds vendor fees and
 *               partner earnings (lib/dispersal.ts). Frozen monthly into
 *               invoicePeriods. Untouched by this module.
 *
 * A group contracted at $57.95/member is billed $57.95 and disperses $14.99.
 * Both numbers are correct for their own purpose.
 */

import { Doc } from "../_generated/dataModel";
import { DISPERSAL } from "./dispersal";

/* ------------------------------------------------------------------ */
/* On the book                                                        */
/* ------------------------------------------------------------------ */

/**
 * Member lifecycle states that count as covered — and therefore billable.
 *
 * "eligible" is included deliberately. Members loaded from an employer
 * eligibility file who have no email address can never be portal-provisioned
 * (eligibilityProvisioning.ts needs an email to create the Clerk account that
 * flips them to "active"), yet employer coverage — and the obligation to bill
 * for it — begins at file ingest, not at portal signup. Excluding them is what
 * made a fully-invoiced employer group report zero members.
 *
 * This is the definition the invoice generator bills on. Insights now matches
 * it, so dashboard counts tie out to invoices.
 */
export const BILLABLE_MEMBER_TYPES: ReadonlySet<string> = new Set([
  "active",
  "enrolling",
  "eligible",
]);

/** True when a member is covered — the single "on the book" predicate. */
export function isOnBook(member: { memberType?: string }): boolean {
  return !!member.memberType && BILLABLE_MEMBER_TYPES.has(member.memberType);
}

/**
 * True when this member is covered under an employer's list-bill arrangement.
 *
 * Keyed off the GROUP, never off `employeeType`. The eligibility pipeline
 * never sets `employeeType`, so any query filtering on it silently misses
 * every member loaded from a file — the bug behind /admin/list-bill's counts.
 *
 * `listBillStatus` being undefined means billable: it is only ever written
 * when a member is explicitly termed or converted off payroll deduction.
 */
export function isListBillMember(
  member: { listBillStatus?: string; memberType?: string },
  group: { listBill?: { enabled?: boolean } } | null | undefined,
): boolean {
  if (group?.listBill?.enabled !== true) return false;
  if (member.listBillStatus && member.listBillStatus !== "active") return false;
  return isOnBook(member);
}

/* ------------------------------------------------------------------ */
/* Tier                                                               */
/* ------------------------------------------------------------------ */

export type InvoiceTier = "MO" | "MS" | "MF";

export const TIER_LABEL: Record<InvoiceTier, string> = {
  MO: "Member Only",
  MS: "Member + Spouse",
  MF: "Member + Family",
};

/**
 * Classify a household into an invoice tier from its dependents.
 *
 * Note the last branch: a single dependent with no `relationship` recorded
 * yields MO, not MS. `dependentCount > 0` therefore does NOT imply a non-MO
 * tier — the classifier is deliberately conservative rather than guessing a
 * relationship and over-billing.
 *
 * Coverage tier is DERIVED here, at billing time. Employees do not elect it;
 * there is no election, waiver, or open-enrollment concept in this system.
 */
export function classifyListBillTier(
  deps: Doc<"memberProfiles">[],
): { tier: InvoiceTier; dependentCount: number } {
  const active = deps.filter(
    (d) => isOnBook(d) && d.memberRole === "dependent",
  );
  const count = active.length;
  if (count === 0) return { tier: "MO", dependentCount: 0 };
  if (count >= 2) return { tier: "MF", dependentCount: count };
  const rel = active[0].relationship;
  if (rel === "child") return { tier: "MF", dependentCount: 1 };
  if (rel === "spouse" || rel === "domestic_partner") {
    return { tier: "MS", dependentCount: 1 };
  }
  return { tier: "MO", dependentCount: 1 };
}

/* ------------------------------------------------------------------ */
/* Rates                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_RATE_LABEL = "Ideal Oral Health";

export interface ResolvedRates {
  moCents: number;
  msCents: number;
  mfCents: number;
  rateLabel: string;
}

/**
 * The group's contracted tier rates.
 *
 * Priority: group list-bill rates → account custom pricing (flat across all
 * tiers) → dispersal gross as a last resort.
 *
 * KNOWN GAP: `listBill.rates.effectiveFrom` is declared in the schema but not
 * read here or by the invoice generator, so a rate change applies
 * retroactively to any regenerated invoice. Tracked separately; preserving the
 * existing behaviour rather than silently changing billing.
 */
export function resolveListBillRates(
  group: { listBill?: { rates?: Record<string, unknown> } } | null | undefined,
  account: { customPricing?: Array<{ monthlyCardCents?: number }> } | null | undefined,
): ResolvedRates {
  const gr = group?.listBill?.rates as
    | { moCents?: number; msCents?: number; mfCents?: number; rateLabel?: string }
    | undefined;
  if (gr?.moCents !== undefined) {
    return {
      moCents: gr.moCents,
      msCents: gr.msCents ?? gr.moCents,
      mfCents: gr.mfCents ?? gr.moCents,
      rateLabel: gr.rateLabel ?? DEFAULT_RATE_LABEL,
    };
  }

  const cp = account?.customPricing?.[0];
  if (cp?.monthlyCardCents !== undefined) {
    return {
      moCents: cp.monthlyCardCents,
      msCents: cp.monthlyCardCents,
      mfCents: cp.monthlyCardCents,
      rateLabel: DEFAULT_RATE_LABEL,
    };
  }

  return {
    moCents: DISPERSAL.individual.grossCents,
    msCents: DISPERSAL.family.grossCents,
    mfCents: DISPERSAL.family.grossCents,
    rateLabel: DEFAULT_RATE_LABEL,
  };
}

/** Pick the tier's rate, honouring a per-member premium override. */
export function resolveListBillRateCents(
  member: { monthlyPremiumCents?: number },
  tier: InvoiceTier,
  rates: ResolvedRates,
): number {
  // The per-member premium captured from the eligibility file (e.g. Soar's
  // "Approved EE Cost") is authoritative when present — for those groups the
  // tier is effectively cosmetic and the real charge is per person.
  const premium = member.monthlyPremiumCents;
  if (typeof premium === "number" && premium >= 0) return premium;
  return tier === "MO" ? rates.moCents : tier === "MS" ? rates.msCents : rates.mfCents;
}

/* ------------------------------------------------------------------ */
/* The unified answer                                                 */
/* ------------------------------------------------------------------ */

/** Matches the vocabulary already used by admin/members.ts `billingSource`. */
export type BillingSource = "direct" | "list_bill" | "comp" | "none";

export interface BillingFacts {
  source: BillingSource;
  onBook: boolean;
  /** Normalized monthly cents, whatever the billing mechanism. */
  mrrCents: number;
  /** List-bill only; derived from household, never elected. */
  tier: InvoiceTier | null;
  dependentCount: number;
  rateLabel?: string;
  employerPays: boolean;
}

/** Annual charges divide by 12 so a mixed book sums to a comparable number. */
export function normalizeToMonthlyCents(
  totalCents: number | undefined | null,
  cadence: "monthly" | "annual" | undefined,
): number {
  if (!totalCents || totalCents <= 0) return 0;
  return cadence === "annual" ? Math.round(totalCents / 12) : totalCents;
}

/** Stripe states that represent a live, paying relationship. */
export const LIVE_BUNDLE_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "cancel_at_period_end", // still paying through period end
  "past_due",             // at risk, not gone
]);

/**
 * Everything the dashboard needs to know about how one member is billed.
 *
 * ORDER MATTERS. List-bill is tested FIRST, before any bundle logic, because a
 * portal-provisioned list-bill member carries a real-looking Stripe bundle
 * with `totalCents: 0` and a sentinel `stripeCustomerId` of
 * "employer_listbill_…" (see eligibilityProvisioning.ts). That bundle is a
 * portal-access artifact, not a price. Checking the bundle first would price
 * every provisioned employer member at zero — which is precisely the bug this
 * module exists to fix, and the reason a naive "drop the customerId check"
 * repair would not have worked.
 */
export function memberBilling(
  member: Doc<"memberProfiles">,
  group: Doc<"groups"> | null | undefined,
  account: Doc<"accounts"> | null | undefined,
  dependents: Doc<"memberProfiles">[],
  bundle: Doc<"subscriptionBundles"> | null | undefined,
): BillingFacts {
  const onBook = isOnBook(member);

  // Dependents ride on the primary's coverage and are worth $0 by design;
  // counting them would inflate every figure.
  if (member.memberRole === "dependent") {
    return {
      source: "none",
      onBook,
      mrrCents: 0,
      tier: null,
      dependentCount: 0,
      employerPays: false,
    };
  }

  // 1. Employer-billed.
  if (isListBillMember(member, group)) {
    const { tier, dependentCount } = classifyListBillTier(dependents);
    const rates = resolveListBillRates(group, account);
    return {
      source: "list_bill",
      onBook: true,
      mrrCents: resolveListBillRateCents(member, tier, rates),
      tier,
      dependentCount,
      rateLabel: rates.rateLabel,
      employerPays: true,
    };
  }

  // 2 & 3. Self-pay, via Stripe.
  if (bundle && LIVE_BUNDLE_STATUSES.has(bundle.status)) {
    const mrrCents = normalizeToMonthlyCents(
      bundle.pricingSnapshot?.totalCents,
      bundle.cadence,
    );
    return {
      source: mrrCents > 0 ? "direct" : "comp",
      onBook,
      mrrCents,
      tier: null,
      dependentCount: dependents.filter((d) => isOnBook(d)).length,
      employerPays: false,
    };
  }

  return {
    source: "none",
    onBook,
    mrrCents: 0,
    tier: null,
    dependentCount: dependents.filter((d) => isOnBook(d)).length,
    employerPays: false,
  };
}
