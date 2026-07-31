/**
 * INVOICE CALCULATOR — server functions
 *
 * Implements the spec at docs/internal/INVOICE_CALCULATOR_SPEC.md.
 *
 * Public surface:
 *   • getInvoiceBreakdown               — live snapshot of the entire book
 *   • getInvoiceBreakdownForPeriod      — period-aware (closed → snapshot, current → live)
 *   • getGroupInvoice                   — single-group drill-down (member-level)
 *   • listClosedPeriods                 — index of available closed periods
 *   • getAdjustmentsForPeriod           — append-only correction log
 *   • getVendorPayables                 — per-vendor payable batches for a period
 *   • recordAdjustment                  — append-only correction (admin)
 *   • closePeriod                       — internal cron + manual override
 *
 * Revenue model (see convex/lib/dispersal.ts):
 *   • Primary Individual user → $14.99 / month gross
 *   • Primary Family user     → $24.99 / month gross
 *   • Dependent               → $0
 *
 * Each primary's gross is split into Toothlens, Careington, Processing,
 * Partner Vendor (Ideal Health), and Ryze Keep (carrier residual).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import {
  addSplits,
  assertSplitInvariant,
  classifyTier,
  currentPricingSnapshot,
  DISPERSAL_BUCKETS,
  DispersalBucket,
  DispersalSplit,
  getSplitForTier,
  PlanTier,
  PricingSnapshot,
  ZERO_SPLIT,
} from "../lib/dispersal";
import { sha256OfCanonicalJson } from "../lib/hash";
import {
  AttributionSource,
  RepAttributionResolver,
} from "../lib/repAttribution";
import {
  currentPeriod,
  parsePeriodKey,
  PeriodWindow,
  periodKey,
  periodWindow,
} from "../lib/periods";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupBreakdown {
  groupId: Id<"groups">;
  groupCode: string;
  organizationCode: string | null;
  groupName: string;
  accountId: Id<"accounts">;
  accountName: string | null;
  isListBill: boolean;
  activeMemberCount: number;
  individualPrimaryCount: number;
  familyPrimaryCount: number;
  dependentCount: number;
  unbilledPrimaryCount: number;
  totals: DispersalSplit;
  /** Source provenance (only populated by closePeriod / drill-down). */
  memberProfileIds?: Id<"memberProfiles">[];
  bundleIds?: Id<"subscriptionBundles">[];
  memberLines?: FrozenMemberLine[];
  /** Closed-snapshot row id (populated only when source === "closed"). */
  periodId?: Id<"invoicePeriods">;
}

interface FrozenMemberLine {
  memberProfileId: Id<"memberProfiles">;
  memberId: string;
  firstName: string;
  lastName: string;
  groupCode: string;
  tier: PlanTier;
  grossCents: number;
  toothlensCents: number;
  careingtonCents: number;
  processingCents: number;
  partnerVendorCents: number;
  ryzeKeepCents: number;
  /**
   * Rep/broker credited with this member, frozen at close so a reprint names
   * whoever earned the sale rather than whoever owns the account today.
   * Only populated on the close path (see `computeLiveBreakdown`).
   */
  repId?: string;
  repName?: string;
  repCode?: string;
  repEmail?: string;
  agencyId?: string;
  agencyName?: string;
  repSource?: AttributionSource;
}

export interface InvoiceBreakdown {
  /** "live" for snapshot mode, "YYYY-MM" otherwise. */
  period: string;
  /** "live" — live tables, "closed" — read from invoicePeriods. */
  source: "live" | "closed";
  groups: GroupBreakdown[];
  grand: {
    activeMemberCount: number;
    individualPrimaryCount: number;
    familyPrimaryCount: number;
    dependentCount: number;
    unbilledPrimaryCount: number;
    totals: DispersalSplit;
  };
  employerPaid: {
    groupCount: number;
    individualPrimaryCount: number;
    familyPrimaryCount: number;
    unbilledPrimaryCount: number;
    totals: DispersalSplit;
  };
  selfPay: {
    groupCount: number;
    individualPrimaryCount: number;
    familyPrimaryCount: number;
    unbilledPrimaryCount: number;
    totals: DispersalSplit;
  };
}

// ---------------------------------------------------------------------------
// Core computation — used by live mode AND by closePeriod
// ---------------------------------------------------------------------------

/**
 * Classify a list-bill primary's dispersal tier from their household
 * structure. List-bill members do NOT carry a Stripe bundle — the employer
 * is invoiced via the list-bill invoice — so the only way to determine
 * their tier is from their active dependents:
 *   • 0 active dependents       → "individual" (MO)
 *   • ≥1 active dependent       → "family"     (MS / MF)
 *
 * The dispersal model only has individual/family buckets, so MS and MF
 * both map to "family" for revenue distribution purposes.
 */
function classifyListBillTierFromHousehold(
  activeDepCount: number,
): PlanTier {
  return activeDepCount === 0 ? "individual" : "family";
}

/**
 * True if a member's coverage effective date (if any) has begun on or before
 * `asOfMs`. Mirrors `isEffectiveForPeriod` in listBillInvoices.ts. A missing
 * or unparseable effectiveDate does not exclude the member (fail-open — many
 * historical/legacy records have no effectiveDate set).
 */
function isEffectiveAsOf(effectiveDate: string | undefined, asOfMs: number): boolean {
  if (!effectiveDate) return true;
  const ms = Date.parse(effectiveDate);
  if (Number.isNaN(ms)) return true;
  // Exclusive: callers pass the period's `endMs`, which is the FIRST instant
  // of the following month. Coverage effective 2026-06-01 belongs to June, not
  // to May — an inclusive compare here would bill it in both months.
  return ms < asOfMs;
}

/**
 * True if this memberProfile record already existed in our system by
 * `asOfMs`. Guards against closing/reconstructing a PAST period and having
 * it "see" members who were only added later (e.g. via a subsequent
 * eligibility file, or a self-pay signup that completed after the period
 * actually ended but before the closing cron ran). Mirrors
 * `existedByPeriodEnd` in listBillInvoices.ts. `createdAt` is set once at
 * insert and never changed by later updates, so it's a stable proxy for
 * "when did Ideal first know this person existed."
 */
function existedAsOf(createdAt: number, asOfMs: number): boolean {
  // Exclusive for the same reason as `isEffectiveAsOf`: `asOfMs` is the first
  // instant of the next month, so the whole month up to 23:59:59.999 UTC on
  // its last day counts (a 9:00 PM May 31 signup is May revenue) but midnight
  // on the 1st does not double-count into the month that just ended.
  return createdAt < asOfMs;
}

/**
 * Resolve what a bundle's tier-determining `totalCents` actually was at
 * `asOfMs`, instead of blindly trusting the bundle's CURRENT
 * `pricingSnapshot` (which only ever holds the latest tier). If the current
 * snapshot was already in effect by `asOfMs`, it's authoritative. Otherwise
 * the bundle's tier has changed since `asOfMs` (via `processTierChange` —
 * upgrade/downgrade) and we must look at `bundleTierHistory` for the
 * segment that actually covered `asOfMs`. Returns `null` if no segment
 * covers `asOfMs` (e.g. history wasn't recorded before this feature
 * shipped) — callers should treat that as "unresolvable" rather than guess.
 */
async function resolveBundleTierTotalCentsAsOf(
  ctx: QueryCtx,
  bundle: Doc<"subscriptionBundles">,
  asOfMs: number,
): Promise<number | null> {
  if (bundle.pricingSnapshot.capturedAt <= asOfMs) {
    return bundle.pricingSnapshot.totalCents;
  }
  const history = await ctx.db
    .query("bundleTierHistory")
    .withIndex("by_bundle", (q) => q.eq("bundleId", bundle._id))
    .collect();
  const covering = history.find(
    (h) => h.effectiveFrom <= asOfMs && asOfMs < h.effectiveTo,
  );
  return covering ? covering.totalCents : null;
}

/**
 * Compute a per-group breakdown from the LIVE tables.
 *
 * For closed periods (where bundles or members may have changed since
 * close), the snapshot read from `invoicePeriods` is authoritative — this
 * function should NOT be used to retroactively rebuild closed periods.
 *
 * @param asOfMs Optional point-in-time gate. When provided, member profiles
 *   that didn't exist yet (`createdAt > asOfMs`) or whose coverage hadn't
 *   started yet (`effectiveDate > asOfMs`) are excluded — used by
 *   `closePeriod`/`closePeriodManual` (passing the period's `endMs`) so a
 *   member added between period-end and the closing cron's execution can't
 *   get baked into the wrong month's frozen snapshot. When omitted, this is
 *   a true "right now" live view (dashboards) with no date gating — matches
 *   existing behavior.
 */
async function computeLiveBreakdown(
  ctx: QueryCtx,
  asOfMs?: number,
): Promise<InvoiceBreakdown> {
  // Use index-filtered queries so we only read relevant documents.
  // Without these filters the function reads every document in each table,
  // which can exceed Convex's per-query read limit once data grows.
  const [groups, accounts, allBundles, activeMembers, enrollingMembers, eligibleMembers] = await Promise.all([
    ctx.db.query("groups").collect(),
    ctx.db.query("accounts").collect(),
    // Only active bundles determine a member's billable tier.
    ctx.db.query("subscriptionBundles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect(),
    // Active members — on a paying plan or list-bill.
    ctx.db.query("memberProfiles")
      .withIndex("by_member_type", (q) => q.eq("memberType", "active"))
      .collect(),
    // Enrolling members — eligibility-loaded; show on invoice before activation.
    ctx.db.query("memberProfiles")
      .withIndex("by_member_type", (q) => q.eq("memberType", "enrolling"))
      .collect(),
    // Eligible members — eligibility-file-imported list-bill members who have
    // not yet been provisioned a Clerk/portal account. They're still billable
    // to the employer (same BILLABLE_MEMBER_TYPES rule as listBillInvoices.ts)
    // — omitting them here silently undercounts employer-paid revenue vs. the
    // roster the User Audit dashboard shows (which counts all memberProfiles).
    ctx.db.query("memberProfiles")
      .withIndex("by_member_type", (q) => q.eq("memberType", "eligible"))
      .collect(),
  ]);

  // Merge active + enrolling + eligible into one list (all contribute to billing).
  let allMembers = [...activeMembers, ...enrollingMembers, ...eligibleMembers];

  // Point-in-time gate (closePeriod path only — see doc comment above).
  if (asOfMs !== undefined) {
    allMembers = allMembers.filter(
      (m) => existedAsOf(m.createdAt, asOfMs) && isEffectiveAsOf(m.effectiveDate, asOfMs),
    );
  }

  // Rep attribution is frozen onto each member line so vendor statements can
  // report who to pay. Built only on the close path — live dashboards don't
  // read it, and it would add three whole-table reads to every load.
  const attribution =
    asOfMs !== undefined ? await RepAttributionResolver.create(ctx) : null;

  // customerId → tier of CURRENT active paying bundle. Family wins over
  // Individual if a customer somehow has multiple active bundles.
  const tierByCustomer = new Map<string, PlanTier>();
  const bundleIdByCustomer = new Map<string, Id<"subscriptionBundles">>();
  for (const bundle of allBundles) {
    // Same point-in-time gate applied to bundles: a bundle created after
    // asOfMs (e.g. a member subscribing in the gap between period-end and
    // the closing cron's execution) must not retroactively flip an
    // already-existing member from unbilled to individual/family for a
    // period that had already ended before they subscribed.
    if (asOfMs !== undefined && !existedAsOf(bundle.createdAt, asOfMs)) continue;

    // Resolve the tier-determining totalCents as of asOfMs (falls back to
    // the current snapshot for true live mode, or when nothing changed
    // since asOfMs — see resolveBundleTierTotalCentsAsOf doc comment).
    let totalCentsForTier: number | null | undefined = bundle.pricingSnapshot?.totalCents;
    if (asOfMs !== undefined) {
      totalCentsForTier = await resolveBundleTierTotalCentsAsOf(ctx, bundle, asOfMs);
      if (totalCentsForTier === null) continue; // unresolvable — treat as unbilled
    }

    const tier = classifyTier(totalCentsForTier);
    if (tier === "none") continue;
    if (tierByCustomer.get(bundle.customerId) === "family") continue;
    tierByCustomer.set(bundle.customerId, tier);
    bundleIdByCustomer.set(bundle.customerId, bundle._id);
  }


  const accountsById = new Map(accounts.map((a) => [a._id, a]));
  type ActiveMember = (typeof allMembers)[number];
  const membersByGroup = new Map<string, ActiveMember[]>();
  for (const m of allMembers) {
    // All members in allMembers are already active or enrolling (filtered above).
    const list = membersByGroup.get(m.groupId) ?? [];
    list.push(m);
    membersByGroup.set(m.groupId, list);
  }

  const groupRows: GroupBreakdown[] = [];
  for (const group of groups) {
    const members = membersByGroup.get(group._id) ?? [];
    const isListBill = group.listBill?.enabled === true;

    // For list-bill groups, count active dependents per primary so we can
    // classify each primary's tier from their household instead of looking
    // for a Stripe bundle (which list-bill members don't have).
    const depCountByPrimary = new Map<string, number>();
    if (isListBill) {
      for (const m of members) {
        if (m.memberRole !== "dependent" || !m.primaryMemberId) continue;
        const key = m.primaryMemberId;
        depCountByPrimary.set(key, (depCountByPrimary.get(key) ?? 0) + 1);
      }
    }

    let activeMemberCount = 0;
    let individualPrimaryCount = 0;
    let familyPrimaryCount = 0;
    let dependentCount = 0;
    let unbilledPrimaryCount = 0;
    let totals: DispersalSplit = ZERO_SPLIT;
    const memberProfileIds: Id<"memberProfiles">[] = [];
    const bundleIds = new Set<Id<"subscriptionBundles">>();
    const memberLines: FrozenMemberLine[] = [];

    for (const member of members) {
      activeMemberCount++;
      memberProfileIds.push(member._id);

      if (member.memberRole === "dependent") {
        dependentCount++;
        continue;
      }

      let tier: PlanTier;
      if (isListBill) {
        // Household-based classification. Employer is billed via list-bill
        // invoice, so this primary always contributes their dispersal split.
        tier = classifyListBillTierFromHousehold(
          depCountByPrimary.get(member._id) ?? 0,
        );
      } else {
        const customerId = member.customerId;
        tier = customerId ? tierByCustomer.get(customerId) ?? "none" : "none";
        if (tier !== "none") {
          const bid = customerId ? bundleIdByCustomer.get(customerId) : undefined;
          if (bid) bundleIds.add(bid);
        }
      }

      if (tier === "individual") {
        individualPrimaryCount++;
        totals = addSplits(totals, getSplitForTier("individual"));
      } else if (tier === "family") {
        familyPrimaryCount++;
        totals = addSplits(totals, getSplitForTier("family"));
      } else {
        unbilledPrimaryCount++;
      }
      const contribution =
        tier === "none" ? ZERO_SPLIT : getSplitForTier(tier);
      const rep = attribution?.resolve(member._id, group);
      memberLines.push({
        memberProfileId: member._id,
        memberId: member.memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        groupCode: group.groupCode,
        tier,
        ...contribution,
        ...(rep
          ? {
              repSource: rep.source,
              ...(rep.repId ? { repId: rep.repId } : {}),
              ...(rep.repName ? { repName: rep.repName } : {}),
              ...(rep.repCode ? { repCode: rep.repCode } : {}),
              ...(rep.repEmail ? { repEmail: rep.repEmail } : {}),
              ...(rep.agencyId ? { agencyId: rep.agencyId } : {}),
              ...(rep.agencyName ? { agencyName: rep.agencyName } : {}),
            }
          : {}),
      });
    }

    // INV-01 — fail loud rather than silently produce wrong invoices.
    assertSplitInvariant(totals, `live group ${group.groupCode}`);

    const account = accountsById.get(group.accountId);
    groupRows.push({
      groupId: group._id,
      groupCode: group.groupCode,
      organizationCode: group.organizationCode ?? null,
      groupName: group.name,
      accountId: group.accountId,
      accountName: (account as any)?.name ?? null,
      isListBill,
      activeMemberCount,
      individualPrimaryCount,
      familyPrimaryCount,
      dependentCount,
      unbilledPrimaryCount,
      totals,
      memberProfileIds,
      bundleIds: Array.from(bundleIds),
      memberLines,
    });
  }

  return assembleBreakdown("live", "live", groupRows);
}

/** Roll group rows into grand / employer-paid / self-pay aggregates. */
function assembleBreakdown(
  period: string,
  source: "live" | "closed",
  groups: GroupBreakdown[],
): InvoiceBreakdown {
  const grand = {
    activeMemberCount: 0,
    individualPrimaryCount: 0,
    familyPrimaryCount: 0,
    dependentCount: 0,
    unbilledPrimaryCount: 0,
    totals: ZERO_SPLIT as DispersalSplit,
  };
  const employerPaid = {
    groupCount: 0,
    individualPrimaryCount: 0,
    familyPrimaryCount: 0,
    unbilledPrimaryCount: 0,
    totals: ZERO_SPLIT as DispersalSplit,
  };
  const selfPay = {
    groupCount: 0,
    individualPrimaryCount: 0,
    familyPrimaryCount: 0,
    unbilledPrimaryCount: 0,
    totals: ZERO_SPLIT as DispersalSplit,
  };
  for (const row of groups) {
    grand.activeMemberCount += row.activeMemberCount;
    grand.individualPrimaryCount += row.individualPrimaryCount;
    grand.familyPrimaryCount += row.familyPrimaryCount;
    grand.dependentCount += row.dependentCount;
    grand.unbilledPrimaryCount += row.unbilledPrimaryCount;
    grand.totals = addSplits(grand.totals, row.totals);
    const bucket = row.isListBill ? employerPaid : selfPay;
    bucket.groupCount++;
    bucket.individualPrimaryCount += row.individualPrimaryCount;
    bucket.familyPrimaryCount += row.familyPrimaryCount;
    bucket.unbilledPrimaryCount += row.unbilledPrimaryCount;
    bucket.totals = addSplits(bucket.totals, row.totals);
  }
  return { period, source, groups, grand, employerPaid, selfPay };
}

// ---------------------------------------------------------------------------
// Live snapshot (current behavior)
// ---------------------------------------------------------------------------

export const getInvoiceBreakdown = query({
  args: {},
  handler: async (ctx): Promise<InvoiceBreakdown> => {
    await requireAdmin(ctx);
    return computeLiveBreakdown(ctx);
  },
});

// ---------------------------------------------------------------------------
// Period-aware: closed → snapshot, current/future → live
// ---------------------------------------------------------------------------

export const getInvoiceBreakdownForPeriod = query({
  args: { period: v.string() },
  handler: async (ctx, { period }): Promise<InvoiceBreakdown> => {
    await requireAdmin(ctx);
    const window = parsePeriodKey(period);
    const live = currentPeriod();

    // Future periods don't exist; treat as live (defensive).
    // Current period: live.
    if (window.period >= live.period) {
      const snap = await computeLiveBreakdown(ctx);
      return { ...snap, period };
    }

    // Past period: read snapshot if it exists.
    const rows = await ctx.db
      .query("invoicePeriods")
      .withIndex("by_period", (q) => q.eq("period", period))
      .collect();

    if (rows.length === 0) {
      // Closed snapshot missing — surface live data with a marker that
      // the data is not the historical close. Caller can decide whether
      // to display a warning. We mark `source: "live"` to be explicit.
      // Gate to the period's end so members/bundles created afterward
      // (i.e. after this past period truly ended) don't leak into the
      // reconstruction.
      const snap = await computeLiveBreakdown(ctx, window.endMs);
      return { ...snap, period };
    }

    const groups: GroupBreakdown[] = rows.map((r) => ({
      groupId: r.groupId,
      groupCode: r.groupCode,
      organizationCode: r.organizationCode ?? null,
      groupName: r.groupName,
      accountId: r.accountId,
      accountName: r.accountName ?? null,
      isListBill: r.isListBill,
      activeMemberCount: r.activeMemberCount,
      individualPrimaryCount: r.individualPrimaryCount,
      familyPrimaryCount: r.familyPrimaryCount,
      dependentCount: r.dependentCount,
      unbilledPrimaryCount: r.unbilledPrimaryCount,
      totals: {
        grossCents: r.grossCents,
        toothlensCents: r.toothlensCents,
        careingtonCents: r.careingtonCents,
        processingCents: r.processingCents,
        partnerVendorCents: r.partnerVendorCents,
        ryzeKeepCents: r.ryzeKeepCents,
      },
      memberProfileIds: r.memberProfileIds,
      bundleIds: r.bundleIds,
      memberLines: r.memberLines,
      periodId: r._id,
    }));

    return assembleBreakdown(period, "closed", groups);
  },
});

// ---------------------------------------------------------------------------
// Drill-down: single group, member-level lines
// ---------------------------------------------------------------------------

interface MemberLine {
  memberProfileId: Id<"memberProfiles">;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: "primary" | "dependent";
  tier: PlanTier;
  /** Per-primary split contribution. Always all-zero for dependents. */
  contribution: DispersalSplit;
  unbilled: boolean;
}

export const getGroupInvoice = query({
  args: { groupId: v.id("groups"), period: v.optional(v.string()) },
  handler: async (
    ctx,
    { groupId, period },
  ): Promise<{
    period: string;
    source: "live" | "closed";
    group: GroupBreakdown;
    members: MemberLine[];
  }> => {
    await requireAdmin(ctx);

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);
    const account = await ctx.db.get(group.accountId);

    const targetPeriod = period ?? "live";
    const live = currentPeriod();
    const isLive = targetPeriod === "live" || targetPeriod >= live.period;

    if (isLive) {
      // Live drill-down — compute from current tables for this group only.
      // Include active, enrolling, AND eligible members (eligible = list-bill
      // members imported via eligibility file, not yet Clerk-provisioned —
      // still billable to the employer, same as computeLiveBreakdown above).
      // Enrolling/eligible members without a paying bundle surface as
      // Unbilled (counted in unbilledPrimaryCount).
      // Use the by_group index and filter member type in JS to avoid full
      // table scans (Convex `.filter()` without `.withIndex()` reads every doc).
      const membersInGroup = await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();
      const members = membersInGroup.filter(
        (m) =>
          m.memberType === "active" ||
          m.memberType === "enrolling" ||
          m.memberType === "eligible",
      );

      const customerIds = members
        .map((m) => m.customerId)
        .filter((c): c is string => Boolean(c));
      const customerIdSet = new Set(customerIds);
      const bundles =
        customerIdSet.size === 0
          ? []
          : await ctx.db
              .query("subscriptionBundles")
              .withIndex("by_status", (q) => q.eq("status", "active"))
              .collect()
              .then((all) => all.filter((b) => customerIdSet.has(b.customerId)));

      const tierByCustomer = new Map<string, PlanTier>();
      for (const b of bundles) {
        const t = classifyTier(b.pricingSnapshot?.totalCents);
        if (t === "none") continue;
        if (tierByCustomer.get(b.customerId) === "family") continue;
        tierByCustomer.set(b.customerId, t);
      }

      const isListBill = group.listBill?.enabled === true;

      // For list-bill groups, count active dependents per primary so each
      // primary can be classified from their household. List-bill members
      // are not Stripe-billed, so bundle-based classification doesn't apply.
      const depCountByPrimary = new Map<string, number>();
      if (isListBill) {
        for (const m of members) {
          if (m.memberRole !== "dependent" || !m.primaryMemberId) continue;
          const key = m.primaryMemberId;
          depCountByPrimary.set(key, (depCountByPrimary.get(key) ?? 0) + 1);
        }
      }

      const lines: MemberLine[] = [];
      let totals: DispersalSplit = ZERO_SPLIT;
      let individualPrimaryCount = 0;
      let familyPrimaryCount = 0;
      let dependentCount = 0;
      let unbilledPrimaryCount = 0;

      for (const m of members) {
        const role: "primary" | "dependent" =
          m.memberRole === "dependent" ? "dependent" : "primary";
        if (role === "dependent") {
          dependentCount++;
          lines.push({
            memberProfileId: m._id,
            memberId: m.memberId,
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email ?? null,
            role,
            tier: "none",
            contribution: ZERO_SPLIT,
            unbilled: false,
          });
          continue;
        }
        const tier: PlanTier = isListBill
          ? classifyListBillTierFromHousehold(depCountByPrimary.get(m._id) ?? 0)
          : m.customerId
            ? tierByCustomer.get(m.customerId) ?? "none"
            : "none";
        const contribution =
          tier === "none" ? ZERO_SPLIT : getSplitForTier(tier);
        if (tier === "individual") individualPrimaryCount++;
        else if (tier === "family") familyPrimaryCount++;
        else unbilledPrimaryCount++;
        totals = addSplits(totals, contribution);
        lines.push({
          memberProfileId: m._id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email ?? null,
          role,
          tier,
          contribution,
          unbilled: tier === "none",
        });
      }

      return {
        period: targetPeriod === "live" ? "live" : targetPeriod,
        source: "live",
        group: {
          groupId: group._id,
          groupCode: group.groupCode,
          organizationCode: group.organizationCode ?? null,
          groupName: group.name,
          accountId: group.accountId,
          accountName: (account as any)?.name ?? null,
          isListBill: group.listBill?.enabled === true,
          activeMemberCount: members.length,
          individualPrimaryCount,
          familyPrimaryCount,
          dependentCount,
          unbilledPrimaryCount,
          totals,
        },
        members: lines,
      };
    }

    // Closed period — read snapshot.
    const snap = await ctx.db
      .query("invoicePeriods")
      .withIndex("by_period_group", (q) =>
        q.eq("period", targetPeriod).eq("groupId", groupId),
      )
      .first();
    if (!snap) {
      throw new Error(
        `No snapshot for group ${groupId} in period ${targetPeriod}`,
      );
    }
    // Hydrate member lines from frozen ids.
    const lines: MemberLine[] = [];
    for (const mid of snap.memberProfileIds) {
      const m = await ctx.db.get(mid);
      if (!m) continue; // member may have been deleted; skip but keep totals
      const role: "primary" | "dependent" =
        m.memberRole === "dependent" ? "dependent" : "primary";
      // We can't reconstruct the exact tier per member without re-querying
      // bundles as-of close time; show role-only granularity for closed
      // periods. Aggregate totals are still authoritative from the snapshot.
      lines.push({
        memberProfileId: m._id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email ?? null,
        role,
        tier: "none",
        contribution: ZERO_SPLIT,
        unbilled: false,
      });
    }
    return {
      period: targetPeriod,
      source: "closed",
      group: {
        groupId: snap.groupId,
        groupCode: snap.groupCode,
        organizationCode: snap.organizationCode ?? null,
        groupName: snap.groupName,
        accountId: snap.accountId,
        accountName: snap.accountName ?? null,
        isListBill: snap.isListBill,
        activeMemberCount: snap.activeMemberCount,
        individualPrimaryCount: snap.individualPrimaryCount,
        familyPrimaryCount: snap.familyPrimaryCount,
        dependentCount: snap.dependentCount,
        unbilledPrimaryCount: snap.unbilledPrimaryCount,
        totals: {
          grossCents: snap.grossCents,
          toothlensCents: snap.toothlensCents,
          careingtonCents: snap.careingtonCents,
          processingCents: snap.processingCents,
          partnerVendorCents: snap.partnerVendorCents,
          ryzeKeepCents: snap.ryzeKeepCents,
        },
      },
      members: lines,
    };
  },
});

// ---------------------------------------------------------------------------
// Index of closed periods
// ---------------------------------------------------------------------------

export const listClosedPeriods = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<{
    period: string;
    closedAt: number;
    groupCount: number;
    grossCents: number;
    payloadHash: string;
  }>> => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("invoicePeriods").collect();
    const byPeriod = new Map<
      string,
      { closedAt: number; groupCount: number; grossCents: number; payloadHash: string }
    >();
    for (const r of rows) {
      const cur = byPeriod.get(r.period);
      if (!cur) {
        byPeriod.set(r.period, {
          closedAt: r.closedAt,
          groupCount: 1,
          grossCents: r.grossCents,
          payloadHash: r.payloadHash,
        });
      } else {
        cur.groupCount += 1;
        cur.grossCents += r.grossCents;
        cur.closedAt = Math.max(cur.closedAt, r.closedAt);
        // For multi-group periods we hash the period-level rollup separately
        // when caller needs it; per-period payloadHash here is informational.
      }
    }
    return Array.from(byPeriod.entries())
      .map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => (a.period < b.period ? 1 : -1));
  },
});

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export const getAdjustmentsForPeriod = query({
  args: { period: v.string() },
  handler: async (ctx, { period }): Promise<Doc<"invoiceAdjustments">[]> => {
    await requireAdmin(ctx);
    return ctx.db
      .query("invoiceAdjustments")
      .withIndex("by_period", (q) => q.eq("period", period))
      .order("desc")
      .collect();
  },
});

export const recordAdjustment = mutation({
  args: {
    periodId: v.id("invoicePeriods"),
    reason: v.union(
      v.literal("refund"),
      v.literal("chargeback"),
      v.literal("retroactive_term"),
      v.literal("retroactive_enrollment"),
      v.literal("misclassification"),
      v.literal("other"),
    ),
    bucket: v.union(
      v.literal("gross"),
      v.literal("toothlens"),
      v.literal("careington"),
      v.literal("processing"),
      v.literal("partnerVendor"),
      v.literal("ryzeKeep"),
    ),
    deltaCents: v.number(),
    appliedToPeriod: v.optional(v.string()),
    notes: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"invoiceAdjustments">> => {
    const identity = await requireAdmin(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error(`Unknown periodId: ${args.periodId}`);
    if (!Number.isInteger(args.deltaCents)) {
      throw new Error("deltaCents must be an integer (cents)");
    }
    if (args.notes.trim().length < 3) {
      throw new Error("notes must explain the adjustment");
    }

    const adjustmentId = await ctx.db.insert("invoiceAdjustments", {
      periodId: args.periodId,
      period: period.period,
      groupId: period.groupId,
      reason: args.reason,
      bucket: args.bucket,
      deltaCents: args.deltaCents,
      appliedToPeriod: args.appliedToPeriod,
      notes: args.notes,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "invoice.recordAdjustment",
      targetType: "invoicePeriods",
      targetId: args.periodId,
      summary: `${args.reason} ${args.bucket} ${args.deltaCents}¢ on ${period.period} (${period.groupCode})`,
      metadata: {
        adjustmentId,
        period: period.period,
        groupId: period.groupId,
        bucket: args.bucket,
        deltaCents: args.deltaCents,
        appliedToPeriod: args.appliedToPeriod,
      },
    });

    return adjustmentId;
  },
});

// ---------------------------------------------------------------------------
// Vendor payable export
// ---------------------------------------------------------------------------

interface VendorRow {
  groupId: Id<"groups">;
  groupCode: string;
  organizationCode: string | null;
  groupName: string;
  individualPrimaryCount: number;
  familyPrimaryCount: number;
  payableCents: number;
}

export const getVendorPayables = query({
  args: {
    period: v.string(),
    vendor: v.union(
      v.literal("toothlens"),
      v.literal("careington"),
      v.literal("processing"),
      v.literal("partnerVendor"),
      v.literal("ryzeKeep"),
    ),
  },
  handler: async (
    ctx,
    { period, vendor },
  ): Promise<{
    period: string;
    vendor: string;
    rows: VendorRow[];
    totalCents: number;
  }> => {
    await requireAdmin(ctx);
    const breakdown = await (async () => {
      const live = currentPeriod();
      if (period === "live" || period >= live.period) {
        return computeLiveBreakdown(ctx);
      }
      const snapRows = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .collect();
      // Never answer a historical payable question with today's roster.
      // The statement workflow requires the period to be closed first.
      if (snapRows.length === 0) {
        throw new Error(
          `Period ${period} is not closed. Close the period before exporting vendor payables.`,
        );
      }
      const groups: GroupBreakdown[] = snapRows.map((r) => ({
        groupId: r.groupId,
        groupCode: r.groupCode,
        organizationCode: r.organizationCode ?? null,
        groupName: r.groupName,
        accountId: r.accountId,
        accountName: r.accountName ?? null,
        isListBill: r.isListBill,
        activeMemberCount: r.activeMemberCount,
        individualPrimaryCount: r.individualPrimaryCount,
        familyPrimaryCount: r.familyPrimaryCount,
        dependentCount: r.dependentCount,
        unbilledPrimaryCount: r.unbilledPrimaryCount,
        totals: {
          grossCents: r.grossCents,
          toothlensCents: r.toothlensCents,
          careingtonCents: r.careingtonCents,
          processingCents: r.processingCents,
          partnerVendorCents: r.partnerVendorCents,
          ryzeKeepCents: r.ryzeKeepCents,
        },
      }));
      return assembleBreakdown(period, "closed", groups);
    })();

    const bucketField: keyof DispersalSplit = (
      {
        toothlens: "toothlensCents",
        careington: "careingtonCents",
        processing: "processingCents",
        partnerVendor: "partnerVendorCents",
        ryzeKeep: "ryzeKeepCents",
      } as const
    )[vendor];

    let total = 0;
    const rows: VendorRow[] = breakdown.groups
      .map((g) => {
        const cents = g.totals[bucketField];
        total += cents;
        return {
          groupId: g.groupId,
          groupCode: g.groupCode,
          organizationCode: g.organizationCode,
          groupName: g.groupName,
          individualPrimaryCount: g.individualPrimaryCount,
          familyPrimaryCount: g.familyPrimaryCount,
          payableCents: cents,
        };
      })
      .filter((r) => r.payableCents > 0)
      .sort((a, b) => b.payableCents - a.payableCents);

    return { period, vendor, rows, totalCents: total };
  },
});

// ---------------------------------------------------------------------------
// closePeriod — idempotent monthly snapshot writer
// ---------------------------------------------------------------------------

/**
 * Internal-only: invoked by the cron at T+1 00:05 UTC. Also invokable
 * manually by admins via `closePeriodManual` (which audits the actor).
 *
 * Idempotent (INV-07): if a snapshot already exists for the period, this
 * returns `{ skipped: true }` and writes nothing.
 *
 * Snapshot is per-group; the period is "closed" iff at least one row
 * exists for it. We never partially close a period — all groups in a
 * single transaction.
 */
async function closePeriodInternal(
  ctx: any,
  args: { year: number; month: number; closedBy: string },
): Promise<{
  skipped: boolean;
  period: string;
  groupCount: number;
  rowsWritten: number;
}> {
  const window = periodWindow(args.year, args.month);

  const existing = await ctx.db
    .query("invoicePeriods")
    .withIndex("by_period", (q: any) => q.eq("period", window.period))
    .first();
  if (existing) {
    // Idempotent — no-op.
    return {
      skipped: true,
      period: window.period,
      groupCount: 0,
      rowsWritten: 0,
    };
  }

  // Compute the live breakdown — at close time, the live tables ARE the
  // historical truth for this period (we no longer mutate completed months).
  // Gated to `window.endMs` so a member/bundle created between period-end
  // and this cron/manual-close actually running doesn't get baked into the
  // wrong month's frozen snapshot (see existedAsOf/isEffectiveAsOf above).
  const breakdown = await computeLiveBreakdown(ctx, window.endMs);
  const pricing: PricingSnapshot = currentPricingSnapshot();
  const sourceGitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    undefined;

  const closedAt = Date.now();
  let written = 0;

  for (const g of breakdown.groups) {
    // Build the canonical, hashable payload (numeric fields only;
    // metadata + ids excluded so the hash is stable across reruns of
    // closePeriod with identical revenue but different timestamps).
    const payload = {
      period: window.period,
      groupId: g.groupId,
      activeMemberCount: g.activeMemberCount,
      individualPrimaryCount: g.individualPrimaryCount,
      familyPrimaryCount: g.familyPrimaryCount,
      dependentCount: g.dependentCount,
      unbilledPrimaryCount: g.unbilledPrimaryCount,
      grossCents: g.totals.grossCents,
      toothlensCents: g.totals.toothlensCents,
      careingtonCents: g.totals.careingtonCents,
      processingCents: g.totals.processingCents,
      partnerVendorCents: g.totals.partnerVendorCents,
      ryzeKeepCents: g.totals.ryzeKeepCents,
      pricing,
    };
    const payloadHash = await sha256OfCanonicalJson(payload);
    assertSplitInvariant(g.totals, `closePeriod ${window.period}/${g.groupCode}`);

    await ctx.db.insert("invoicePeriods", {
      period: window.period,
      year: window.year,
      month: window.month,
      periodStartMs: window.startMs,
      periodEndMs: window.endMs,
      groupId: g.groupId,
      accountId: g.accountId,
      isListBill: g.isListBill,
      groupCode: g.groupCode,
      organizationCode: g.organizationCode ?? undefined,
      groupName: g.groupName,
      accountName: g.accountName ?? undefined,
      activeMemberCount: g.activeMemberCount,
      individualPrimaryCount: g.individualPrimaryCount,
      familyPrimaryCount: g.familyPrimaryCount,
      dependentCount: g.dependentCount,
      unbilledPrimaryCount: g.unbilledPrimaryCount,
      grossCents: g.totals.grossCents,
      toothlensCents: g.totals.toothlensCents,
      careingtonCents: g.totals.careingtonCents,
      processingCents: g.totals.processingCents,
      partnerVendorCents: g.totals.partnerVendorCents,
      ryzeKeepCents: g.totals.ryzeKeepCents,
      memberProfileIds: g.memberProfileIds ?? [],
      bundleIds: g.bundleIds ?? [],
      memberLines: g.memberLines ?? [],
      pricing,
      closedAt,
      closedBy: args.closedBy,
      payloadHash,
      sourceGitSha,
    });
    written++;
  }

  await ctx.runMutation(internal.admin.adminAudit.record, {
    actorClerkUserId: args.closedBy,
    action: "invoice.closePeriod",
    targetType: "invoicePeriods",
    targetId: window.period,
    summary: `Closed period ${window.period}: ${written} group snapshots, gross ${breakdown.grand.totals.grossCents}¢`,
    metadata: {
      period: window.period,
      groupCount: written,
      grossCents: breakdown.grand.totals.grossCents,
      ryzeKeepCents: breakdown.grand.totals.ryzeKeepCents,
      partnerVendorCents: breakdown.grand.totals.partnerVendorCents,
      sourceGitSha,
    },
  });

  return {
    skipped: false,
    period: window.period,
    groupCount: written,
    rowsWritten: written,
  };
}

export const closePeriod = internalMutation({
  args: {
    year: v.number(),
    month: v.number(),
    closedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    closePeriodInternal(ctx, {
      year: args.year,
      month: args.month,
      closedBy: args.closedBy ?? "cron",
    }),
});

/**
 * Admin-callable manual close. Useful when the cron missed a month, or
 * when finance needs to re-trigger a close after data corrections (still
 * idempotent — won't overwrite an existing snapshot).
 */
export const closePeriodManual = mutation({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    return closePeriodInternal(ctx, {
      year: args.year,
      month: args.month,
      closedBy: identity.clerkUserId,
    });
  },
});

/**
 * Convenience for the monthly cron — closes the calendar month that
 * just ended (i.e. previous month relative to "now"). Idempotent.
 */
export const closePreviousMonth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    // Previous calendar month, UTC.
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth(); // 0..11; previous month = m, current = m+1
    const prevYear = m === 0 ? y - 1 : y;
    const prevMonth = m === 0 ? 12 : m;
    return closePeriodInternal(ctx, {
      year: prevYear,
      month: prevMonth,
      closedBy: "cron",
    });
  },
});

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { DISPERSAL_BUCKETS };
export type { DispersalBucket, DispersalSplit, PlanTier };
