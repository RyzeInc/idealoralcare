/**
 * VENDOR REMITTANCE STATEMENTS — server functions
 *
 * Implements docs/internal/VENDOR_STATEMENT_RULES.md.
 *
 * A vendor statement is a numbered, issued document telling one recipient
 * what they earned for one completed UTC calendar month. It is the vendor-side
 * mirror of the employer-side list-bill invoice: same lifecycle (draft →
 * issued → partial/paid, with void + replacement), same numbering discipline,
 * same audit trail.
 *
 * Two rules drive the whole module:
 *
 *   1. HISTORY IS FROZEN. Statement content comes only from `invoicePeriods`
 *      close rows. There is no live-roster fallback: a May statement printed
 *      in July is still a May statement. Member detail is hydrated from the
 *      close rows themselves (never duplicated into the statement row), so
 *      what prints can never drift from what was closed.
 *
 *   2. RECIPIENTS SEE ONLY THEIR OWN ECONOMICS. The resolved disclosure —
 *      `VENDOR_IDENTITY` (fixed facts) plus the recipient's configurable
 *      profile — is the single gate. Fields a recipient may not see are never
 *      assembled into the payload at all: not hidden downstream, not annotated
 *      as withheld. A document cannot leak a field the server never sent.
 *
 *      Profiles are editable per recipient and resolve LIVE: change a
 *      recipient's settings and every document for them — including reprints
 *      — reflects it immediately. That is safe because disclosure governs
 *      presentation only. Amounts, the member set, and adjustments stay
 *      pinned to the close and the frozen adjustment ids, so no setting can
 *      move a figure. The profile a statement was cut under is still recorded,
 *      and drift from it is surfaced rather than hidden.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";
import { DispersalSplit, PlanTier } from "../lib/dispersal";
import { parsePeriodKey } from "../lib/periods";
import { RepAttribution, RepAttributionResolver } from "../lib/repAttribution";

// ---------------------------------------------------------------------------
// Recipient disclosure policy — the single source of truth
// ---------------------------------------------------------------------------

export type VendorId = "toothlens" | "careington" | "ideal" | "ryze";

export const VENDOR_IDS: VendorId[] = [
  "toothlens",
  "careington",
  "ideal",
  "ryze",
];

export const vendorValidator = v.union(
  v.literal("toothlens"),
  v.literal("careington"),
  v.literal("ideal"),
  v.literal("ryze"),
);

/**
 * The parts of a recipient's identity that are NOT negotiable: which bucket
 * pays them, which corrections land on their statement, and what to call them.
 * These are facts about the revenue model, not preferences.
 */
interface VendorIdentity {
  name: string;
  /** Which frozen dispersal bucket this recipient is paid from. */
  amountField: keyof DispersalSplit;
  /** Which `invoiceAdjustments.bucket` corrections land on this statement. */
  adjustmentBucket: "toothlens" | "careington" | "partnerVendor" | "ryzeKeep";
  /** Short line describing what the recipient is being paid for. */
  basis: string;
}

export const VENDOR_IDENTITY: Record<VendorId, VendorIdentity> = {
  toothlens: {
    name: "Toothlens",
    amountField: "toothlensCents",
    adjustmentBucket: "toothlens",
    basis: "Flat service fee per covered primary",
  },
  careington: {
    name: "Careington",
    amountField: "careingtonCents",
    adjustmentBucket: "careington",
    basis: "Flat service fee per covered primary",
  },
  ideal: {
    name: "Ideal Health",
    amountField: "partnerVendorCents",
    adjustmentBucket: "partnerVendor",
    basis: "Remittance rate per covered primary by rate class",
  },
  ryze: {
    name: "Ryze",
    amountField: "ryzeKeepCents",
    adjustmentBucket: "ryzeKeep",
    basis: "Carrier residual after vendor and processing dispersal",
  },
};

// ---------------------------------------------------------------------------
// Disclosure profiles — what each recipient is shown
// ---------------------------------------------------------------------------

export type GroupVisibility = "none" | "listBillOnly" | "all";

/**
 * The configurable half of the policy. Every one of these is editable per
 * recipient in the admin settings; the values below are only the starting
 * point a recipient gets before anyone touches them.
 */
export interface StatementDisclosure {
  /** Per-primary lines at all, vs. a totals-only statement. */
  memberDetail: boolean;
  /** Which employer groups are named. */
  groupVisibility: GroupVisibility;
  /** Individual vs. Family rate class. */
  rateClass: boolean;
  /** Rep/broker credited with each member. */
  repAttribution: boolean;
  /** Every vendor's bucket, not just this recipient's. Internal only. */
  fullSplit: boolean;
  /** Itemized adjustment lines vs. a single net figure. */
  adjustmentDetail: boolean;
}

export const DISCLOSURE_FIELDS: Array<{
  key: keyof StatementDisclosure;
  label: string;
  help: string;
  /** Turning this on for an external recipient deserves a second look. */
  sensitive: boolean;
}> = [
  {
    key: "memberDetail",
    label: "Covered primary detail",
    help: "One line per covered primary. Turn off for a totals-only statement.",
    sensitive: false,
  },
  {
    key: "groupVisibility",
    label: "Employer group",
    help: "Names the employer behind each member. \"List-bill only\" names employer groups and shows everyone else as a direct enrollment.",
    sensitive: true,
  },
  {
    key: "rateClass",
    label: "Individual / Family rate class",
    help: "Discloses household composition. Only meaningful where the recipient's own rate actually varies by tier.",
    sensitive: true,
  },
  {
    key: "repAttribution",
    label: "Rep / broker attribution",
    help: "Names the rep and agency credited with each member. Needed by a recipient who pays reps out of this remittance.",
    sensitive: true,
  },
  {
    key: "fullSplit",
    label: "Full revenue split",
    help: "Every vendor's share and the retail gross. Internal use only — this exposes what other partners are paid.",
    sensitive: true,
  },
  {
    key: "adjustmentDetail",
    label: "Itemized adjustments",
    help: "Shows each correction with its reason and notes. When off, only the net adjustment appears in the totals.",
    sensitive: false,
  },
];

/**
 * Starting defaults. Toothlens and Careington are paid a flat amount per
 * covered primary, so tier, employer, and rep would all disclose something
 * without explaining anything about what they are owed. Ideal Health pays its
 * downstream reps out of its own remittance and needs to know which employer
 * a list-bill member came from to do it. Ryze is the internal carrier view.
 */
export const DEFAULT_DISCLOSURE: Record<VendorId, StatementDisclosure> = {
  toothlens: {
    memberDetail: true,
    groupVisibility: "none",
    rateClass: false,
    repAttribution: false,
    fullSplit: false,
    adjustmentDetail: true,
  },
  careington: {
    memberDetail: true,
    groupVisibility: "none",
    rateClass: false,
    repAttribution: false,
    fullSplit: false,
    adjustmentDetail: true,
  },
  ideal: {
    memberDetail: true,
    groupVisibility: "listBillOnly",
    rateClass: true,
    repAttribution: true,
    fullSplit: false,
    adjustmentDetail: true,
  },
  ryze: {
    memberDetail: true,
    groupVisibility: "all",
    rateClass: true,
    repAttribution: true,
    fullSplit: true,
    adjustmentDetail: true,
  },
};

export const disclosureValidator = v.object({
  memberDetail: v.boolean(),
  groupVisibility: v.union(
    v.literal("none"),
    v.literal("listBillOnly"),
    v.literal("all"),
  ),
  rateClass: v.boolean(),
  repAttribution: v.boolean(),
  fullSplit: v.boolean(),
  adjustmentDetail: v.boolean(),
});

/** The saved profile for a recipient, or the code default if none is saved. */
async function resolveDisclosure(
  ctx: QueryCtx | MutationCtx,
  vendor: VendorId,
): Promise<StatementDisclosure> {
  const saved = await ctx.db
    .query("vendorStatementDisclosureProfiles")
    .withIndex("by_vendor", (q) => q.eq("vendor", vendor))
    .first();
  if (!saved) return DEFAULT_DISCLOSURE[vendor];
  return {
    memberDetail: saved.memberDetail,
    groupVisibility: saved.groupVisibility,
    rateClass: saved.rateClass,
    repAttribution: saved.repAttribution,
    fullSplit: saved.fullSplit,
    adjustmentDetail: saved.adjustmentDetail,
  };
}

/**
 * Identity + the disclosure actually in force. Everything downstream reads
 * this, so there is still exactly one gate — it just takes its answers from
 * configuration now instead of from a constant.
 */
interface ResolvedPolicy extends VendorIdentity {
  disclosure: StatementDisclosure;
}

async function resolvePolicy(
  ctx: QueryCtx | MutationCtx,
  vendor: VendorId,
): Promise<ResolvedPolicy> {
  return {
    ...VENDOR_IDENTITY[vendor],
    disclosure: await resolveDisclosure(ctx, vendor),
  };
}

/**
 * Human-readable differences between the settings a statement was cut under
 * and the settings in force now. Used to warn that a reprint will not look
 * like the copy the recipient already holds.
 */
function disclosureDifferences(
  frozen: StatementDisclosure | undefined,
  current: StatementDisclosure,
): string[] {
  if (!frozen) return [];
  return DISCLOSURE_FIELDS.filter(
    (field) => frozen[field.key] !== current[field.key],
  ).map(
    (field) =>
      `${field.label}: ${String(frozen[field.key])} → ${String(current[field.key])}`,
  );
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface StatementMemberLine {
  memberId: string;
  firstName: string;
  lastName: string;
  amountCents: number;
  /** Present only when disclosure.groupVisibility names this member's group. */
  groupCode?: string;
  groupName?: string;
  organizationCode?: string;
  /** Present only when disclosure.rateClass. */
  rateClass?: string;
  /** Present only when disclosure.repAttribution — who to pay for this member. */
  repName?: string;
  repCode?: string;
  repEmail?: string;
  agencyName?: string;
  /** Present only when disclosure.fullSplit. */
  grossCents?: number;
  toothlensCents?: number;
  careingtonCents?: number;
  processingCents?: number;
  partnerVendorCents?: number;
  ryzeKeepCents?: number;
}

export interface StatementGroupRow {
  /** Provider code (e.g. "IDEALDO"). Shared across organizations. */
  groupCode: string;
  /** The organization. One row per organization, not per provider code. */
  groupName: string;
  organizationCode: string | null;
  primaryCount: number;
  /** Split of that count, so a reader can see the mix without member lines. */
  individualCount: number;
  familyCount: number;
  /** Rep who owns this organization's deal. Only when disclosure allows. */
  repName?: string;
  repCode?: string;
  agencyName?: string;
  amountCents: number;
}

export type AttributionBasis = "frozen" | "current" | "mixed" | "none";

export interface StatementAdjustment {
  id: Id<"invoiceAdjustments">;
  reason: string;
  notes: string;
  deltaCents: number;
  createdAt: number;
}

/** Everything needed to render a statement in any format. */
export interface StatementPayload {
  vendor: VendorId;
  vendorName: string;
  basis: string;
  period: string;
  coverageStart: number;
  coverageEnd: number;
  sourceClosedAt: number;
  sourcePeriodIds: Id<"invoicePeriods">[];
  sourcePayloadHashes: string[];
  memberDetailAvailable: boolean;
  /** The disclosure this payload was built under. */
  disclosure: StatementDisclosure;
  // Resolved flags, so renderers never re-interpret the profile themselves.
  showMemberDetail: boolean;
  showGroups: boolean;
  showTier: boolean;
  showBroker: boolean;
  showFullSplit: boolean;
  showAdjustmentDetail: boolean;
  /**
   * Where the rep names came from. "frozen" — recorded at close, reproducible
   * forever. "current" — the close predates frozen attribution, so today's
   * attribution was resolved instead. "mixed" — some of each. Reported rather
   * than hidden so a payout run knows which rows are historically exact.
   */
  attributionBasis: AttributionBasis;
  primaryCount: number;
  /** Mix of the covered primaries. Available even with no member detail. */
  individualCount: number;
  familyCount: number;
  /**
   * False when every organization sits under the same provider code, which is
   * the norm — printing "IDEALDO" on every row then costs a column and tells
   * the reader nothing.
   */
  groupCodeVaries: boolean;
  memberLines: StatementMemberLine[];
  /** Empty unless the disclosure names groups. */
  groups: StatementGroupRow[];
  adjustments: StatementAdjustment[];
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
}

// ---------------------------------------------------------------------------
// Coverage window
// ---------------------------------------------------------------------------

/**
 * Inclusive coverage window for display and documents.
 *
 * `parsePeriodKey` returns a half-open window (`endMs` is the first instant of
 * the following month), which is the correct arithmetic for gating but reads
 * as an off-by-one-day on a printed statement. `coverageEnd` is therefore the
 * last representable instant of the month: a plan purchased at 9:00 PM on
 * May 31 is inside May's window and is paid on May's statement.
 */
export function coverageWindow(period: string): {
  coverageStart: number;
  coverageEnd: number;
} {
  const w = parsePeriodKey(period);
  return { coverageStart: w.startMs, coverageEnd: w.endMs - 1 };
}

// ---------------------------------------------------------------------------
// Payload assembly (shared by preview, generate, and read)
// ---------------------------------------------------------------------------

type FrozenLine = NonNullable<Doc<"invoicePeriods">["memberLines"]>[number];

/**
 * Whether this member's employer is named, given the recipient's setting.
 *
 * "listBillOnly" is the case a partner paying out on employer business needs:
 * the employer is named for list-bill members, while direct enrollments are
 * labelled as such rather than being tied to whatever internal group holds
 * self-pay members.
 */
function groupLabelFor(
  snapshot: Doc<"invoicePeriods">,
  visibility: GroupVisibility,
): {
  /** Provider code (Careington/DialCare). Shared by many organizations. */
  groupCode: string;
  /** The organization itself — this is the row a reader cares about. */
  groupName: string;
  organizationCode: string | null;
  /**
   * Rollup key. One row per ORGANIZATION, never per provider code: several
   * organizations share a code like "IDEALDO", and keying on the code would
   * silently merge them into one line. Direct enrollments are the deliberate
   * exception — they collapse into a single row by design.
   */
  key: string;
} | null {
  if (visibility === "none") return null;
  const named = {
    groupCode: snapshot.groupCode,
    groupName: snapshot.groupName,
    organizationCode: snapshot.organizationCode ?? null,
    key: String(snapshot.groupId),
  };
  if (visibility === "all") return named;
  return snapshot.isListBill
    ? named
    : {
        groupCode: "DIRECT",
        groupName: "Direct enrollment",
        organizationCode: null,
        key: "DIRECT",
      };
}

/**
 * Group rollup honouring the recipient's visibility setting. Under
 * "listBillOnly" every non-list-bill group collapses into one "Direct
 * enrollment" row, so the recipient sees the employer business they are paying
 * out on without the internal shape of the self-pay book.
 */
async function buildGroupRows(
  ctx: QueryCtx | MutationCtx,
  snapshots: Doc<"invoicePeriods">[],
  policy: ResolvedPolicy,
): Promise<StatementGroupRow[]> {
  const visibility = policy.disclosure.groupVisibility;
  if (visibility === "none") return [];

  const rows = new Map<string, StatementGroupRow>();
  for (const snapshot of snapshots) {
    const amountCents = snapshot[policy.amountField];
    if (amountCents <= 0) continue;
    const label = groupLabelFor(snapshot, visibility);
    if (!label) continue;
    const primaryCount =
      snapshot.individualPrimaryCount + snapshot.familyPrimaryCount;
    const existing = rows.get(label.key);
    if (existing) {
      existing.primaryCount += primaryCount;
      existing.individualCount += snapshot.individualPrimaryCount;
      existing.familyCount += snapshot.familyPrimaryCount;
      existing.amountCents += amountCents;
    } else {
      // The rep who owns this organization's deal — the person a partner pays
      // for the whole account, distinct from whoever sold each member.
      let rep: { repName?: string; repCode?: string; agencyName?: string } = {};
      if (policy.disclosure.repAttribution && label.key !== "DIRECT") {
        const group = await ctx.db.get(snapshot.groupId);
        if (group?.brokerId || group?.brokerTrackingCode) {
          const leader = group.brokerId
            ? await ctx.db.get(group.brokerId as Id<"partnerLeaders">)
            : null;
          const agency = leader
            ? await ctx.db.get(leader.partnerId)
            : null;
          rep = {
            ...(leader?.name ? { repName: leader.name } : {}),
            ...(group.brokerTrackingCode
              ? { repCode: group.brokerTrackingCode }
              : {}),
            ...(agency?.name ? { agencyName: agency.name } : {}),
          };
        }
      }
      rows.set(label.key, {
        groupCode: label.groupCode,
        groupName: label.groupName,
        organizationCode: label.organizationCode,
        primaryCount,
        individualCount: snapshot.individualPrimaryCount,
        familyCount: snapshot.familyPrimaryCount,
        ...rep,
        amountCents,
      });
    }
  }
  // Direct enrollments sort last; organizations read alphabetically above it.
  return Array.from(rows.values()).sort((a, b) => {
    if ((a.groupCode === "DIRECT") !== (b.groupCode === "DIRECT")) {
      return a.groupCode === "DIRECT" ? 1 : -1;
    }
    return a.groupName.localeCompare(b.groupName);
  });
}

/** True only when more than one real provider code appears on the statement. */
function providerCodeVaries(rows: StatementGroupRow[]): boolean {
  const codes = new Set(
    rows.filter((r) => r.groupCode !== "DIRECT").map((r) => r.groupCode),
  );
  return codes.size > 1;
}

function shapeMemberLine(
  line: FrozenLine,
  snapshot: Doc<"invoicePeriods">,
  policy: ResolvedPolicy,
  /** Live attribution, used only where the close has none frozen. */
  fallbackRep?: RepAttribution,
): StatementMemberLine {
  const rep = line.repSource
    ? {
        repName: line.repName,
        repCode: line.repCode,
        repEmail: line.repEmail,
        agencyName: line.agencyName,
      }
    : {
        repName: fallbackRep?.repName ?? undefined,
        repCode: fallbackRep?.repCode ?? undefined,
        repEmail: fallbackRep?.repEmail ?? undefined,
        agencyName: fallbackRep?.agencyName ?? undefined,
      };
  const group = groupLabelFor(snapshot, policy.disclosure.groupVisibility);
  return {
    memberId: line.memberId,
    firstName: line.firstName,
    lastName: line.lastName,
    amountCents: line[policy.amountField],
    ...(group
      ? {
          groupCode: group.groupCode,
          groupName: group.groupName,
          ...(group.organizationCode
            ? { organizationCode: group.organizationCode }
            : {}),
        }
      : {}),
    ...(policy.disclosure.rateClass ? { rateClass: rateClassLabel(line.tier) } : {}),
    ...(policy.disclosure.repAttribution ? rep : {}),
    ...(policy.disclosure.fullSplit
      ? {
          grossCents: line.grossCents,
          toothlensCents: line.toothlensCents,
          careingtonCents: line.careingtonCents,
          processingCents: line.processingCents,
          partnerVendorCents: line.partnerVendorCents,
          ryzeKeepCents: line.ryzeKeepCents,
        }
      : {}),
  };
}

/**
 * Resolve attribution for lines whose close predates the frozen rep fields.
 *
 * Rep identity is reference data for routing a payout, not an input to the
 * statement's arithmetic, so filling it from today's records for a legacy
 * close is safe in a way that recomputing money never would be. The basis is
 * returned alongside so the gap is always visible rather than implied.
 */
async function hydrateAttribution(
  ctx: QueryCtx | MutationCtx,
  snapshots: Doc<"invoicePeriods">[],
  policy: ResolvedPolicy,
): Promise<{
  basis: AttributionBasis;
  fallbackByMember: Map<string, RepAttribution>;
}> {
  const fallbackByMember = new Map<string, RepAttribution>();
  if (!policy.disclosure.repAttribution) return { basis: "none", fallbackByMember };

  const allLines = snapshots.flatMap((s) => s.memberLines ?? []);
  if (allLines.length === 0) return { basis: "none", fallbackByMember };

  const stale = allLines.filter((line) => !line.repSource);
  if (stale.length === 0) return { basis: "frozen", fallbackByMember };

  const resolver = await RepAttributionResolver.create(ctx);
  const groupCache = new Map<string, Doc<"groups"> | null>();
  for (const snapshot of snapshots) {
    const key = String(snapshot.groupId);
    if (!groupCache.has(key)) groupCache.set(key, await ctx.db.get(snapshot.groupId));
  }
  for (const snapshot of snapshots) {
    const group = groupCache.get(String(snapshot.groupId)) ?? null;
    for (const line of snapshot.memberLines ?? []) {
      if (line.repSource) continue;
      fallbackByMember.set(
        String(line.memberProfileId),
        resolver.resolve(line.memberProfileId, group),
      );
    }
  }

  return {
    basis: stale.length === allLines.length ? "current" : "mixed",
    fallbackByMember,
  };
}

function rateClassLabel(tier: PlanTier): string {
  return tier === "individual" ? "Individual" : tier === "family" ? "Family" : "—";
}

function sortMemberLines(lines: StatementMemberLine[]): StatementMemberLine[] {
  return lines.sort(
    (a, b) =>
      (a.groupCode ?? "").localeCompare(b.groupCode ?? "") ||
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.memberId.localeCompare(b.memberId),
  );
}

async function loadClosedSnapshots(
  ctx: QueryCtx | MutationCtx,
  period: string,
): Promise<Doc<"invoicePeriods">[]> {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`Invalid coverage month: ${period}`);
  }
  const window = parsePeriodKey(period);
  if (window.endMs > Date.now()) {
    throw new Error(
      `Coverage month ${period} has not finished yet. Statements cover completed months only.`,
    );
  }
  const snapshots = await ctx.db
    .query("invoicePeriods")
    .withIndex("by_period", (q) => q.eq("period", period))
    .collect();
  if (snapshots.length === 0) {
    throw new Error(
      `Coverage month ${period} has not been closed. Close it in the Invoice Calculator before generating statements.`,
    );
  }
  return snapshots;
}

/**
 * Build the full statement payload for a recipient from the immutable close.
 *
 * @param adjustmentFilter Restricts which corrections are folded in. Preview
 *   and generation take everything currently on the books; reading an already
 *   issued statement takes only the ids frozen onto it.
 */
async function buildPayload(
  ctx: QueryCtx | MutationCtx,
  period: string,
  vendor: VendorId,
  adjustmentFilter?: (id: Id<"invoiceAdjustments">) => boolean,
): Promise<StatementPayload> {
  const policy = await resolvePolicy(ctx, vendor);
  const snapshots = await loadClosedSnapshots(ctx, period);
  const { coverageStart, coverageEnd } = coverageWindow(period);

  const { basis: attributionBasis, fallbackByMember } = await hydrateAttribution(
    ctx,
    snapshots,
    policy,
  );

  const memberLines: StatementMemberLine[] = [];
  let primaryCount = 0;
  for (const snapshot of snapshots) {
    for (const line of snapshot.memberLines ?? []) {
      if (line.tier === "none") continue;
      primaryCount++;
      if (line[policy.amountField] <= 0) continue;
      memberLines.push(
        shapeMemberLine(
          line,
          snapshot,
          policy,
          fallbackByMember.get(String(line.memberProfileId)),
        ),
      );
    }
  }

  const groups = await buildGroupRows(ctx, snapshots, policy);

  // Subtotal always comes from the frozen group totals, not from the member
  // lines — legacy closes have authoritative totals but no member detail.
  const subtotalCents = snapshots.reduce(
    (sum, snapshot) => sum + snapshot[policy.amountField],
    0,
  );
  const memberDetailAvailable = snapshots.every(
    (snapshot) => snapshot.memberLines !== undefined,
  );
  if (!memberDetailAvailable || !policy.disclosure.memberDetail) {
    // Either the close has no member lines, or this recipient is configured
    // for a totals-only statement. Totals stand either way.
    memberLines.length = 0;
    primaryCount = snapshots.reduce(
      (sum, s) => sum + s.individualPrimaryCount + s.familyPrimaryCount,
      0,
    );
  }

  const allAdjustments = await ctx.db
    .query("invoiceAdjustments")
    .withIndex("by_period", (q) => q.eq("period", period))
    .collect();
  const adjustments: StatementAdjustment[] = allAdjustments
    .filter((a) => a.bucket === policy.adjustmentBucket)
    .filter((a) => (adjustmentFilter ? adjustmentFilter(a._id) : true))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => ({
      id: a._id,
      reason: a.reason,
      notes: a.notes,
      deltaCents: a.deltaCents,
      createdAt: a.createdAt,
    }));
  const adjustmentCents = adjustments.reduce((sum, a) => sum + a.deltaCents, 0);

  return {
    vendor,
    vendorName: policy.name,
    basis: policy.basis,
    period,
    coverageStart,
    coverageEnd,
    sourceClosedAt: Math.max(...snapshots.map((s) => s.closedAt)),
    sourcePeriodIds: snapshots.map((s) => s._id),
    sourcePayloadHashes: snapshots.map((s) => s.payloadHash).sort(),
    memberDetailAvailable,
    disclosure: policy.disclosure,
    showMemberDetail: policy.disclosure.memberDetail,
    showGroups: policy.disclosure.groupVisibility !== "none",
    showTier: policy.disclosure.rateClass,
    showBroker: policy.disclosure.repAttribution,
    showFullSplit: policy.disclosure.fullSplit,
    showAdjustmentDetail: policy.disclosure.adjustmentDetail,
    attributionBasis,
    primaryCount,
    individualCount: snapshots.reduce((n, x) => n + x.individualPrimaryCount, 0),
    familyCount: snapshots.reduce((n, x) => n + x.familyPrimaryCount, 0),
    groupCodeVaries: providerCodeVaries(groups),
    memberLines: sortMemberLines(memberLines),
    groups,
    adjustments,
    subtotalCents,
    adjustmentCents,
    totalCents: subtotalCents + adjustmentCents,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * What a statement WOULD say if generated right now. Nothing is persisted and
 * no number is burned — used by the generate modal so an admin can see the
 * document before committing to it.
 */
export const previewStatement = query({
  args: { period: v.string(), vendor: vendorValidator },
  handler: async (ctx, { period, vendor }): Promise<StatementPayload> => {
    await requireAdmin(ctx);
    return buildPayload(ctx, period, vendor as VendorId);
  },
});

/**
 * Coverage months that can be statemented, each annotated with how many of
 * the four recipients already have a live (non-voided) statement. Drives the
 * "generate the whole month" affordance.
 */
export const listStatementPeriods = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const closes = await ctx.db.query("invoicePeriods").collect();
    const byPeriod = new Map<
      string,
      { closedAt: number; groupCount: number; grossCents: number }
    >();
    for (const row of closes) {
      const cur = byPeriod.get(row.period);
      if (!cur) {
        byPeriod.set(row.period, {
          closedAt: row.closedAt,
          groupCount: 1,
          grossCents: row.grossCents,
        });
      } else {
        cur.groupCount += 1;
        cur.grossCents += row.grossCents;
        cur.closedAt = Math.max(cur.closedAt, row.closedAt);
      }
    }

    const statements = await ctx.db.query("vendorStatements").collect();
    const live = statements.filter((s) => s.status !== "voided");

    return Array.from(byPeriod.entries())
      .map(([period, info]) => {
        const forPeriod = live.filter((s) => s.period === period);
        return {
          period,
          closedAt: info.closedAt,
          groupCount: info.groupCount,
          grossCents: info.grossCents,
          statementCount: forPeriod.length,
          missingVendors: VENDOR_IDS.filter(
            (id) => !forPeriod.some((s) => s.vendor === id),
          ),
        };
      })
      .sort((a, b) => (a.period < b.period ? 1 : -1));
  },
});

export const listStatements = query({
  args: {
    period: v.optional(v.string()),
    vendor: v.optional(vendorValidator),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { period, vendor, status, limit }) => {
    await requireAdmin(ctx);
    let rows: Doc<"vendorStatements">[];
    if (vendor && period) {
      rows = await ctx.db
        .query("vendorStatements")
        .withIndex("by_vendor_period", (q) =>
          q.eq("vendor", vendor as VendorId).eq("period", period),
        )
        .collect();
    } else if (vendor) {
      rows = await ctx.db
        .query("vendorStatements")
        .withIndex("by_vendor", (q) => q.eq("vendor", vendor as VendorId))
        .collect();
    } else if (period) {
      rows = await ctx.db
        .query("vendorStatements")
        .withIndex("by_period", (q) => q.eq("period", period))
        .collect();
    } else {
      rows = await ctx.db.query("vendorStatements").order("desc").collect();
    }
    if (status) rows = rows.filter((r) => r.status === status);
    return rows
      .sort((a, b) => b.statementNumber - a.statementNumber)
      .slice(0, limit ?? 500)
      .map((r) => ({ ...r, overdue: isOverdue(r) }));
  },
});

/** A statement is past due when money is still owed after the due date. */
function isOverdue(row: Doc<"vendorStatements">, now = Date.now()): boolean {
  return (
    row.status !== "voided" &&
    row.status !== "paid" &&
    row.status !== "draft" &&
    row.balanceCents > 0 &&
    row.paymentDueDate < now
  );
}

/**
 * A single statement with its member detail hydrated from the frozen close,
 * plus any corrections recorded AFTER it was generated (which are reported,
 * never silently folded in — an issued document does not change).
 */
export const getStatement = query({
  args: { statementId: v.id("vendorStatements") },
  handler: async (ctx, { statementId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) return null;

    // Disclosure resolves LIVE, so a document reflects the recipient's current
    // settings the moment you change them — no reissue needed to fix a column.
    //
    // This is safe because disclosure governs presentation only: which columns
    // appear. Every figure — the member set, the amounts, the adjustments —
    // stays pinned to `sourcePeriodIds` and `adjustmentIds` and cannot move.
    // The settings the statement was originally cut under are still recorded
    // on the row, and any drift from them is reported below rather than hidden.
    const policy = await resolvePolicy(ctx, row.vendor as VendorId);
    const disclosureDrift = disclosureDifferences(row.disclosure, policy.disclosure);
    const frozen = new Set(row.adjustmentIds.map((id) => String(id)));

    // Read the frozen closes once and serve every section from them.
    const snapshots: Doc<"invoicePeriods">[] = [];
    for (const periodId of row.sourcePeriodIds) {
      const snapshot = await ctx.db.get(periodId);
      if (snapshot) snapshots.push(snapshot);
    }

    const { basis: attributionBasis, fallbackByMember } =
      await hydrateAttribution(ctx, snapshots, policy);

    // Derived from the closes as they stand NOW, not from the flag frozen at
    // generation. Backfilling member detail into a close must make an existing
    // statement start showing it without being regenerated.
    const memberDetailAvailable =
      snapshots.length > 0 &&
      snapshots.every((snapshot) => snapshot.memberLines !== undefined);

    const memberLines: StatementMemberLine[] = [];
    if (memberDetailAvailable && policy.disclosure.memberDetail) {
      for (const snapshot of snapshots) {
        for (const line of snapshot.memberLines ?? []) {
          if (line.tier === "none") continue;
          if (line[policy.amountField] <= 0) continue;
          memberLines.push(
            shapeMemberLine(
              line,
              snapshot,
              policy,
              fallbackByMember.get(String(line.memberProfileId)),
            ),
          );
        }
      }
    }

    const groups = await buildGroupRows(ctx, snapshots, policy);

    const periodAdjustments = await ctx.db
      .query("invoiceAdjustments")
      .withIndex("by_period", (q) => q.eq("period", row.period))
      .collect();
    const mine = periodAdjustments.filter(
      (a) => a.bucket === policy.adjustmentBucket,
    );
    const toRow = (a: Doc<"invoiceAdjustments">): StatementAdjustment => ({
      id: a._id,
      reason: a.reason,
      notes: a.notes,
      deltaCents: a.deltaCents,
      createdAt: a.createdAt,
    });

    const supersededBy = row.supersededById
      ? await ctx.db.get(row.supersededById)
      : null;
    const replaces = row.replacesId ? await ctx.db.get(row.replacesId) : null;

    return {
      ...row,
      overdue: isOverdue(row),
      basis: policy.basis,
      memberDetailAvailable,
      // Counts are derived from the closes rather than read off the frozen
      // row, so they cannot drift from the group rollup after a backfill.
      primaryCount: snapshots.reduce(
        (n, x) => n + x.individualPrimaryCount + x.familyPrimaryCount,
        0,
      ),
      individualCount: snapshots.reduce(
        (n, x) => n + x.individualPrimaryCount,
        0,
      ),
      familyCount: snapshots.reduce((n, x) => n + x.familyPrimaryCount, 0),
      groupCodeVaries: providerCodeVaries(groups),
      disclosure: policy.disclosure,
      showMemberDetail: policy.disclosure.memberDetail,
      showGroups: policy.disclosure.groupVisibility !== "none",
      showTier: policy.disclosure.rateClass,
      showBroker: policy.disclosure.repAttribution,
      showFullSplit: policy.disclosure.fullSplit,
      showAdjustmentDetail: policy.disclosure.adjustmentDetail,
      attributionBasis,
      memberLines: sortMemberLines(memberLines),
      groups,
      adjustments: mine
        .filter((a) => frozen.has(String(a._id)))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(toRow),
      // Corrections recorded after this statement was cut. Surfaced so finance
      // can decide to void + reissue rather than having the numbers move
      // underneath an already-sent document.
      unappliedAdjustments: mine
        .filter((a) => !frozen.has(String(a._id)))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(toRow),
      supersededByNumber: supersededBy?.statementNumberDisplay ?? null,
      replacesNumber: replaces?.statementNumberDisplay ?? null,
      // What this statement was originally generated under, and how today's
      // settings differ. Empty unless someone changed the profile since.
      generatedUnderDisclosure: row.disclosure ?? null,
      disclosureDrift,
    };
  },
});

// ---------------------------------------------------------------------------
// Disclosure profile management
// ---------------------------------------------------------------------------

/**
 * Every recipient's current profile, plus the default it started from and
 * whether it has been customised. Drives the settings screen.
 */
export const listDisclosureProfiles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const saved = await ctx.db.query("vendorStatementDisclosureProfiles").collect();
    const byVendor = new Map(saved.map((row) => [row.vendor, row]));

    return VENDOR_IDS.map((vendor) => {
      const row = byVendor.get(vendor);
      const current = row
        ? {
            memberDetail: row.memberDetail,
            groupVisibility: row.groupVisibility,
            rateClass: row.rateClass,
            repAttribution: row.repAttribution,
            fullSplit: row.fullSplit,
            adjustmentDetail: row.adjustmentDetail,
          }
        : DEFAULT_DISCLOSURE[vendor];
      const defaults = DEFAULT_DISCLOSURE[vendor];
      return {
        vendor,
        vendorName: VENDOR_IDENTITY[vendor].name,
        basis: VENDOR_IDENTITY[vendor].basis,
        internalRecipient: vendor === "ryze",
        current,
        defaults,
        customised: JSON.stringify(current) !== JSON.stringify(defaults),
        note: row?.note ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    });
  },
});

/**
 * How many already-issued statements a recipient has. The settings screen
 * uses this to say plainly that editing does not touch them.
 */
export const countStatementsForVendor = query({
  args: { vendor: vendorValidator },
  handler: async (ctx, { vendor }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("vendorStatements")
      .withIndex("by_vendor", (q) => q.eq("vendor", vendor as VendorId))
      .collect();
    return {
      total: rows.length,
      live: rows.filter((r) => r.status !== "voided").length,
      issued: rows.filter((r) => r.status !== "draft" && r.status !== "voided")
        .length,
    };
  },
});

export const updateDisclosureProfile = mutation({
  args: {
    vendor: vendorValidator,
    disclosure: disclosureValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, { vendor, disclosure, note }) => {
    const actor = await requireAdmin(ctx);
    const vendorId = vendor as VendorId;

    // The full split names what every other partner is paid. Allowing it on an
    // external recipient would leak the other vendors' economics, which is the
    // one thing no amount of configuration should be able to do.
    if (disclosure.fullSplit && vendorId !== "ryze") {
      throw new Error(
        `The full revenue split cannot be enabled for ${VENDOR_IDENTITY[vendorId].name} — it would disclose what other partners are paid.`,
      );
    }

    const existing = await ctx.db
      .query("vendorStatementDisclosureProfiles")
      .withIndex("by_vendor", (q) => q.eq("vendor", vendorId))
      .first();
    const before = existing
      ? {
          memberDetail: existing.memberDetail,
          groupVisibility: existing.groupVisibility,
          rateClass: existing.rateClass,
          repAttribution: existing.repAttribution,
          fullSplit: existing.fullSplit,
          adjustmentDetail: existing.adjustmentDetail,
        }
      : DEFAULT_DISCLOSURE[vendorId];

    const changes = DISCLOSURE_FIELDS.filter(
      (field) => before[field.key] !== disclosure[field.key],
    ).map(
      (field) =>
        `${field.label}: ${String(before[field.key])} → ${String(disclosure[field.key])}`,
    );

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...disclosure,
        note: note?.trim() || undefined,
        updatedBy: actor.clerkUserId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("vendorStatementDisclosureProfiles", {
        vendor: vendorId,
        ...disclosure,
        note: note?.trim() || undefined,
        updatedBy: actor.clerkUserId,
        updatedAt: now,
      });
    }

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.disclosure_update",
      targetType: "vendorStatementDisclosureProfiles",
      targetId: vendorId,
      summary:
        changes.length > 0
          ? `Updated what ${VENDOR_IDENTITY[vendorId].name} is shown — ${changes.join("; ")}`
          : `Saved ${VENDOR_IDENTITY[vendorId].name} disclosure settings with no changes`,
      metadata: { vendor: vendorId, changes, disclosure, note },
    });

    return { changes };
  },
});

/** Drop the saved profile so the recipient falls back to the code default. */
export const resetDisclosureProfile = mutation({
  args: { vendor: vendorValidator },
  handler: async (ctx, { vendor }) => {
    const actor = await requireAdmin(ctx);
    const vendorId = vendor as VendorId;
    const existing = await ctx.db
      .query("vendorStatementDisclosureProfiles")
      .withIndex("by_vendor", (q) => q.eq("vendor", vendorId))
      .first();
    if (!existing) return { reset: false };

    await ctx.db.delete(existing._id);
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.disclosure_reset",
      targetType: "vendorStatementDisclosureProfiles",
      targetId: vendorId,
      summary: `Reset ${VENDOR_IDENTITY[vendorId].name} disclosure settings to the default`,
      metadata: { vendor: vendorId },
    });
    return { reset: true };
  },
});

// ---------------------------------------------------------------------------
// Activity trail
// ---------------------------------------------------------------------------

/**
 * Every audited action that can change what a partner is paid or shown. Kept
 * as an explicit list rather than a prefix match so a new action has to be
 * consciously added here — a silent omission would be a hole in the trail.
 */
const STATEMENT_ACTIONS: Array<{ action: string; label: string; kind: string }> = [
  // What recipients are shown
  { action: "vendor_statement.disclosure_update", label: "Contents changed", kind: "contents" },
  { action: "vendor_statement.disclosure_reset", label: "Contents reset to default", kind: "contents" },
  // Statement lifecycle
  { action: "vendor_statement.generate", label: "Statement generated", kind: "lifecycle" },
  { action: "vendor_statement.generate_period", label: "Month generated", kind: "lifecycle" },
  { action: "vendor_statement.issue", label: "Statement issued", kind: "lifecycle" },
  { action: "vendor_statement.issue_period", label: "Month issued", kind: "lifecycle" },
  { action: "vendor_statement.reissue", label: "Statement reissued", kind: "lifecycle" },
  { action: "vendor_statement.void", label: "Statement voided", kind: "lifecycle" },
  { action: "vendor_statement.unvoid", label: "Statement un-voided", kind: "lifecycle" },
  { action: "vendor_statement.edit", label: "Statement details edited", kind: "lifecycle" },
  { action: "vendor_statement.remittance", label: "Remittance recorded", kind: "money" },
  // Upstream events that move the figures a statement reports
  { action: "invoice.recordAdjustment", label: "Adjustment recorded", kind: "money" },
  { action: "invoice.backfillMemberLines", label: "Member detail backfilled", kind: "data" },
  { action: "invoice.closePeriod", label: "Coverage month closed", kind: "data" },
];

const ACTION_META = new Map(
  STATEMENT_ACTIONS.map((a) => [a.action, { label: a.label, kind: a.kind }]),
);

/**
 * The vendor statement system's history in one feed: settings changes,
 * statement lifecycle, remittances, adjustments, and closes.
 */
export const listStatementActivity = query({
  args: {
    /** Restrict to one recipient's trail. */
    vendor: v.optional(vendorValidator),
    /** Restrict to one kind: "contents", "lifecycle", "money", "data". */
    kind: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { vendor, kind, limit }) => {
    await requireAdmin(ctx);
    const cap = Math.min(limit ?? 100, 300);

    const wanted = STATEMENT_ACTIONS.filter(
      (a) => !kind || a.kind === kind,
    ).map((a) => a.action);

    // One indexed read per action, merged and re-sorted. Cheaper than scanning
    // the whole audit table, which holds every admin action in the system.
    const batches = await Promise.all(
      wanted.map((action) =>
        ctx.db
          .query("adminAuditLog")
          .withIndex("by_action", (q) => q.eq("action", action))
          .order("desc")
          .take(cap),
      ),
    );

    // Statement-scoped rows carry a statement id, so resolve those to a
    // recipient once and reuse it for both display and filtering.
    const statementCache = new Map<string, Doc<"vendorStatements"> | null>();
    const resolveStatement = async (targetId: string | undefined) => {
      if (!targetId) return null;
      if (statementCache.has(targetId)) return statementCache.get(targetId)!;
      let row: Doc<"vendorStatements"> | null = null;
      try {
        row = await ctx.db.get(targetId as Id<"vendorStatements">);
      } catch {
        row = null; // targetId is a period key or a vendor id, not a statement
      }
      statementCache.set(targetId, row);
      return row;
    };

    const entries = [];
    for (const row of batches.flat()) {
      const meta = ACTION_META.get(row.action)!;
      let entryVendor: string | null = null;
      let statementNumber: string | null = null;
      let statementId: Id<"vendorStatements"> | null = null;

      if (row.targetType === "vendorStatementDisclosureProfiles") {
        entryVendor = row.targetId ?? null;
      } else if (row.targetType === "vendorStatements") {
        const statement = await resolveStatement(row.targetId);
        if (statement) {
          entryVendor = statement.vendor;
          statementNumber = statement.statementNumberDisplay;
          statementId = statement._id;
        } else {
          // Period-scoped bulk action; metadata carries what we need.
          entryVendor = (row.metadata as any)?.vendor ?? null;
        }
      }

      if (vendor && entryVendor !== vendor) continue;

      entries.push({
        id: row._id,
        action: row.action,
        label: meta.label,
        kind: meta.kind,
        summary: row.summary,
        vendor: entryVendor,
        vendorName: entryVendor
          ? (VENDOR_IDENTITY[entryVendor as VendorId]?.name ?? entryVendor)
          : null,
        statementId,
        statementNumber,
        period: (row.metadata as any)?.period ?? null,
        changes: Array.isArray((row.metadata as any)?.changes)
          ? ((row.metadata as any).changes as string[])
          : [],
        actorName: row.actorName ?? row.actorClerkUserId,
        actorRole: row.actorRole ?? null,
        createdAt: row.createdAt,
      });
    }

    return entries
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, cap);
  },
});

// ---------------------------------------------------------------------------
// Internal verification
// ---------------------------------------------------------------------------

export interface VerificationLine {
  memberId: string;
  memberName: string;
  groupCode: string;
  rateClass: string;
  grossCents: number;
  toothlensCents: number;
  careingtonCents: number;
  processingCents: number;
  partnerVendorCents: number;
  ryzeKeepCents: number;
  /** The bucket this statement actually pays out. */
  statementCents: number;
  /** Whole-dollar check: does the split add back up to gross for this member? */
  splitBalances: boolean;
  repName: string | null;
  repCode: string | null;
  agencyName: string | null;
  repSource: string;
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

/**
 * The full payable picture behind a statement, for admin eyes only.
 *
 * This is the answer to "are these numbers right?" — every member's complete
 * dispersal, the recipient's own column called out, and the arithmetic checked
 * three ways. It is deliberately NOT part of `getStatement`: the vendor-facing
 * documents are built from that query, so nothing here can reach a recipient
 * no matter how the export routes are called.
 */
export const getStatementVerification = query({
  args: { statementId: v.id("vendorStatements") },
  handler: async (ctx, { statementId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) return null;

    // Identity only: the verification view deliberately ignores disclosure —
    // an admin checking the books sees every bucket regardless of what the
    // recipient's document shows.
    const policy = VENDOR_IDENTITY[row.vendor as VendorId];
    const snapshots: Doc<"invoicePeriods">[] = [];
    for (const periodId of row.sourcePeriodIds) {
      const snapshot = await ctx.db.get(periodId);
      if (snapshot) snapshots.push(snapshot);
    }

    // Live, for the same reason as getStatement: a backfill must show up here
    // without regenerating the statement.
    const memberDetailAvailable =
      snapshots.length > 0 &&
      snapshots.every((snapshot) => snapshot.memberLines !== undefined);

    const resolver = snapshots.some((s) =>
      (s.memberLines ?? []).some((line) => !line.repSource),
    )
      ? await RepAttributionResolver.create(ctx)
      : null;

    const lines: VerificationLine[] = [];
    const totals = {
      grossCents: 0,
      toothlensCents: 0,
      careingtonCents: 0,
      processingCents: 0,
      partnerVendorCents: 0,
      ryzeKeepCents: 0,
    };

    for (const snapshot of snapshots) {
      const group = resolver ? await ctx.db.get(snapshot.groupId) : null;
      for (const line of snapshot.memberLines ?? []) {
        if (line.tier === "none") continue;
        const bucketSum =
          line.toothlensCents +
          line.careingtonCents +
          line.processingCents +
          line.partnerVendorCents +
          line.ryzeKeepCents;
        const fallback =
          !line.repSource && resolver
            ? resolver.resolve(line.memberProfileId, group)
            : null;
        lines.push({
          memberId: line.memberId,
          memberName: `${line.lastName}, ${line.firstName}`,
          groupCode: line.groupCode,
          rateClass: rateClassLabel(line.tier),
          grossCents: line.grossCents,
          toothlensCents: line.toothlensCents,
          careingtonCents: line.careingtonCents,
          processingCents: line.processingCents,
          partnerVendorCents: line.partnerVendorCents,
          ryzeKeepCents: line.ryzeKeepCents,
          statementCents: line[policy.amountField],
          splitBalances: bucketSum === line.grossCents,
          repName: line.repName ?? fallback?.repName ?? null,
          repCode: line.repCode ?? fallback?.repCode ?? null,
          agencyName: line.agencyName ?? fallback?.agencyName ?? null,
          repSource: line.repSource ?? (fallback ? `${fallback.source} (current)` : "none"),
        });
        totals.grossCents += line.grossCents;
        totals.toothlensCents += line.toothlensCents;
        totals.careingtonCents += line.careingtonCents;
        totals.processingCents += line.processingCents;
        totals.partnerVendorCents += line.partnerVendorCents;
        totals.ryzeKeepCents += line.ryzeKeepCents;
      }
    }

    // Frozen group-level totals — the figures the statement was actually cut
    // from. Member lines must add back up to these.
    const snapshotTotals = {
      grossCents: snapshots.reduce((s, x) => s + x.grossCents, 0),
      toothlensCents: snapshots.reduce((s, x) => s + x.toothlensCents, 0),
      careingtonCents: snapshots.reduce((s, x) => s + x.careingtonCents, 0),
      processingCents: snapshots.reduce((s, x) => s + x.processingCents, 0),
      partnerVendorCents: snapshots.reduce((s, x) => s + x.partnerVendorCents, 0),
      ryzeKeepCents: snapshots.reduce((s, x) => s + x.ryzeKeepCents, 0),
    };
    const lineSumForVendor = lines.reduce((s, l) => s + l.statementCents, 0);
    const bucketTotal = snapshotTotals[policy.amountField];
    const unbalancedLines = lines.filter((l) => !l.splitBalances);
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const checks: VerificationCheck[] = [
      {
        label: "Statement subtotal matches the closed books",
        passed: row.subtotalCents === bucketTotal,
        detail:
          row.subtotalCents === bucketTotal
            ? `${money(row.subtotalCents)} on both sides`
            : `Statement says ${money(row.subtotalCents)}; the close says ${money(bucketTotal)}`,
      },
      {
        label: "Member lines add up to the subtotal",
        passed: !memberDetailAvailable || lineSumForVendor === bucketTotal,
        detail: !memberDetailAvailable
          ? "Aggregate-only close — no member lines to sum"
          : lineSumForVendor === bucketTotal
            ? `${lines.length} lines totalling ${money(lineSumForVendor)}`
            : `Lines total ${money(lineSumForVendor)} against a subtotal of ${money(bucketTotal)}`,
      },
      {
        label: "Every member's split adds back to their gross (INV-01)",
        passed: unbalancedLines.length === 0,
        detail:
          unbalancedLines.length === 0
            ? `${lines.length} of ${lines.length} lines balance`
            : `${unbalancedLines.length} line(s) do not balance: ${unbalancedLines
                .slice(0, 5)
                .map((l) => l.memberId)
                .join(", ")}`,
      },
      {
        label: "Total equals subtotal plus adjustments",
        passed: row.totalCents === row.subtotalCents + row.adjustmentCents,
        detail: `${money(row.subtotalCents)} + ${money(row.adjustmentCents)} = ${money(row.totalCents)}`,
      },
      {
        label: "Balance equals total less remittances",
        passed: row.balanceCents === row.totalCents - row.amountPaidCents,
        detail: `${money(row.totalCents)} - ${money(row.amountPaidCents)} = ${money(row.balanceCents)}`,
      },
    ];

    return {
      statementNumberDisplay: row.statementNumberDisplay,
      vendor: row.vendor,
      vendorName: row.vendorName,
      period: row.period,
      status: row.status,
      amountField: policy.amountField,
      memberDetailAvailable,
      lines: lines.sort(
        (a, b) =>
          a.groupCode.localeCompare(b.groupCode) ||
          a.memberName.localeCompare(b.memberName),
      ),
      totals,
      snapshotTotals,
      statementSubtotalCents: row.subtotalCents,
      statementAdjustmentCents: row.adjustmentCents,
      statementTotalCents: row.totalCents,
      checks,
      allChecksPassed: checks.every((c) => c.passed),
    };
  },
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function allocateStatementNumber(ctx: MutationCtx): Promise<{
  statementNumber: number;
  statementNumberDisplay: string;
}> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "vendorStatementSeq"))
    .first();
  let next: number;
  if (!counter) {
    await ctx.db.insert("counters", { name: "vendorStatementSeq", value: 10001 });
    next = 10001;
  } else {
    next = counter.value + 1;
    await ctx.db.patch(counter._id, { value: next });
  }
  return { statementNumber: next, statementNumberDisplay: `VS-${next}` };
}

const NET_30_MS = 30 * 86_400_000;

async function createStatement(
  ctx: MutationCtx,
  args: {
    period: string;
    vendor: VendorId;
    actor: string;
    paymentDueDate?: number;
    replacesId?: Id<"vendorStatements">;
  },
): Promise<{ statementId: Id<"vendorStatements">; created: boolean }> {
  // Idempotent per (vendor, period): a live statement already covers this.
  const existing = await ctx.db
    .query("vendorStatements")
    .withIndex("by_vendor_period", (q) =>
      q.eq("vendor", args.vendor).eq("period", args.period),
    )
    .collect();
  const live = existing.find((s) => s.status !== "voided");
  if (live && !args.replacesId) {
    return { statementId: live._id, created: false };
  }

  const payload = await buildPayload(ctx, args.period, args.vendor);
  const now = Date.now();
  const { statementNumber, statementNumberDisplay } =
    await allocateStatementNumber(ctx);

  const statementId = await ctx.db.insert("vendorStatements", {
    statementNumber,
    statementNumberDisplay,
    vendor: args.vendor,
    vendorName: payload.vendorName,
    period: args.period,
    coverageStart: payload.coverageStart,
    coverageEnd: payload.coverageEnd,
    statementDate: now,
    paymentDueDate: args.paymentDueDate ?? now + NET_30_MS,
    primaryCount: payload.primaryCount,
    subtotalCents: payload.subtotalCents,
    adjustmentCents: payload.adjustmentCents,
    totalCents: payload.totalCents,
    status: "draft",
    amountPaidCents: 0,
    balanceCents: payload.totalCents,
    sourcePeriodIds: payload.sourcePeriodIds,
    sourcePayloadHashes: payload.sourcePayloadHashes,
    sourceClosedAt: payload.sourceClosedAt,
    adjustmentIds: payload.adjustments.map((a) => a.id),
    memberDetailAvailable: payload.memberDetailAvailable,
    // Freeze the profile in force right now. A later settings change shapes
    // future statements, never this one.
    disclosure: payload.disclosure,
    generatedBy: args.actor,
    sourceGitSha:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? undefined,
    ...(args.replacesId ? { replacesId: args.replacesId } : {}),
    createdAt: now,
    updatedAt: now,
  });

  await ctx.runMutation(internal.admin.adminAudit.record, {
    actorClerkUserId: args.actor,
    action: "vendor_statement.generate",
    targetType: "vendorStatements",
    targetId: statementId,
    summary: `Generated ${statementNumberDisplay} — ${payload.vendorName} ${args.period} (${payload.primaryCount} primaries, ${payload.totalCents}¢)`,
    metadata: {
      vendor: args.vendor,
      period: args.period,
      totalCents: payload.totalCents,
      primaryCount: payload.primaryCount,
      sourcePayloadHashes: payload.sourcePayloadHashes,
    },
  });

  return { statementId, created: true };
}

export const generateStatement = mutation({
  args: {
    period: v.string(),
    vendor: vendorValidator,
    paymentDueDate: v.optional(v.number()),
  },
  handler: async (ctx, { period, vendor, paymentDueDate }) => {
    const actor = await requireAdmin(ctx);
    return createStatement(ctx, {
      period,
      vendor: vendor as VendorId,
      actor: actor.clerkUserId,
      paymentDueDate,
    });
  },
});

/**
 * Cut every recipient's statement for one coverage month in a single pass.
 * Recipients that already have a live statement are skipped, so this is safe
 * to re-run after adding a recipient or voiding one bad document.
 */
export const generateStatementsForPeriod = mutation({
  args: { period: v.string(), paymentDueDate: v.optional(v.number()) },
  handler: async (ctx, { period, paymentDueDate }) => {
    const actor = await requireAdmin(ctx);
    // Validate/close-check once up front so a bad month fails before it has
    // burned any statement numbers.
    await loadClosedSnapshots(ctx, period);

    let generated = 0;
    let skipped = 0;
    const statementIds: Id<"vendorStatements">[] = [];
    for (const vendor of VENDOR_IDS) {
      const result = await createStatement(ctx, {
        period,
        vendor,
        actor: actor.clerkUserId,
        paymentDueDate,
      });
      statementIds.push(result.statementId);
      if (result.created) generated++;
      else skipped++;
    }

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.generate_period",
      targetType: "vendorStatements",
      targetId: period,
      summary: `Generated ${generated} statement(s) for ${period} (${skipped} already existed)`,
      metadata: { period, generated, skipped },
    });

    return { period, generated, skipped, statementIds };
  },
});

/**
 * Void and re-cut in one step, picking up corrections recorded since the
 * original was issued. The old statement keeps its number and points forward
 * to the replacement.
 */
export const generateReplacementStatement = mutation({
  args: { statementId: v.id("vendorStatements"), reason: v.string() },
  handler: async (ctx, { statementId, reason }) => {
    const actor = await requireAdmin(ctx);
    if (!reason.trim()) throw new Error("A reason is required to reissue");
    const original = await ctx.db.get(statementId);
    if (!original) throw new Error("Statement not found");
    if (original.supersededById) {
      throw new Error("This statement has already been replaced");
    }
    // Guard the case where the original was voided earlier and a fresh
    // statement was cut by hand — reissuing here would leave two live
    // statements for the same recipient and month.
    const siblings = await ctx.db
      .query("vendorStatements")
      .withIndex("by_vendor_period", (q) =>
        q.eq("vendor", original.vendor).eq("period", original.period),
      )
      .collect();
    const otherLive = siblings.find(
      (s) => s._id !== statementId && s.status !== "voided",
    );
    if (otherLive) {
      throw new Error(
        `${otherLive.statementNumberDisplay} is already the live statement for ${original.vendorName} ${original.period}. Void it first if it should be replaced.`,
      );
    }

    const now = Date.now();
    if (original.status !== "voided") {
      await ctx.db.patch(statementId, {
        status: "voided",
        previousStatus: original.status as
          | "draft"
          | "issued"
          | "partial"
          | "paid",
        voidedAt: now,
        voidedBy: actor.clerkUserId,
        voidReason: reason.trim(),
        updatedAt: now,
      });
    }

    const { statementId: replacementId } = await createStatement(ctx, {
      period: original.period,
      vendor: original.vendor as VendorId,
      actor: actor.clerkUserId,
      paymentDueDate: original.paymentDueDate,
      replacesId: statementId,
    });
    await ctx.db.patch(statementId, {
      supersededById: replacementId,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.reissue",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Reissued ${original.statementNumberDisplay}: ${reason.trim()}`,
      metadata: { replacementId, reason: reason.trim() },
    });

    return { replacementId };
  },
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const issueStatement = mutation({
  args: { statementId: v.id("vendorStatements") },
  handler: async (ctx, { statementId }) => {
    const actor = await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status !== "draft") {
      throw new Error(`Cannot issue a statement in status: ${row.status}`);
    }
    const now = Date.now();
    await ctx.db.patch(statementId, {
      status: "issued",
      issuedAt: now,
      updatedAt: now,
    });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.issue",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Issued ${row.statementNumberDisplay} to ${row.vendorName}`,
    });
  },
});

/** Issue every draft statement for a coverage month at once. */
export const issueStatementsForPeriod = mutation({
  args: { period: v.string() },
  handler: async (ctx, { period }) => {
    const actor = await requireAdmin(ctx);
    const rows = await ctx.db
      .query("vendorStatements")
      .withIndex("by_period", (q) => q.eq("period", period))
      .collect();
    const drafts = rows.filter((r) => r.status === "draft");
    const now = Date.now();
    for (const row of drafts) {
      await ctx.db.patch(row._id, {
        status: "issued",
        issuedAt: now,
        updatedAt: now,
      });
    }
    if (drafts.length > 0) {
      await ctx.runMutation(internal.admin.adminAudit.record, {
        actorClerkUserId: actor.clerkUserId,
        action: "vendor_statement.issue_period",
        targetType: "vendorStatements",
        targetId: period,
        summary: `Issued ${drafts.length} statement(s) for ${period}`,
        metadata: { period, issued: drafts.map((d) => d.statementNumberDisplay) },
      });
    }
    return { issued: drafts.length };
  },
});

export const recordRemittance = mutation({
  args: {
    statementId: v.id("vendorStatements"),
    amountCents: v.number(),
    paymentMethod: v.union(v.literal("check"), v.literal("ach"), v.literal("wire")),
    paymentReference: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { statementId, amountCents, paymentMethod, paymentReference, paidAt },
  ) => {
    const actor = await requireAdmin(ctx);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error("Remittance amount must be a positive whole number of cents");
    }
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status === "voided") {
      throw new Error("Cannot record remittance against a voided statement");
    }
    if (row.status === "draft") {
      throw new Error("Issue the statement before recording remittance");
    }
    if (row.status === "paid") throw new Error("This statement is already settled");

    const newPaid = row.amountPaidCents + amountCents;
    if (newPaid > row.totalCents) {
      throw new Error(
        `Remittance of ${amountCents}¢ would exceed the statement total of ${row.totalCents}¢`,
      );
    }
    const newBalance = row.totalCents - newPaid;
    const now = Date.now();
    const newStatus = newBalance <= 0 ? "paid" : "partial";

    await ctx.db.patch(statementId, {
      amountPaidCents: newPaid,
      balanceCents: newBalance,
      status: newStatus,
      paymentMethod,
      ...(paymentReference ? { paymentReference } : {}),
      ...(newStatus === "paid" ? { paidAt: paidAt ?? now } : {}),
      updatedAt: now,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.remittance",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Recorded ${newStatus === "paid" ? "full" : "partial"} remittance of $${(amountCents / 100).toFixed(2)} on ${row.statementNumberDisplay}`,
      metadata: { amountCents, newBalance, paymentMethod, paymentReference },
    });
  },
});

export const voidStatement = mutation({
  args: { statementId: v.id("vendorStatements"), reason: v.string() },
  handler: async (ctx, { statementId, reason }) => {
    const actor = await requireAdmin(ctx);
    if (!reason.trim()) throw new Error("A void reason is required");
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status === "voided") throw new Error("Statement is already voided");
    const now = Date.now();
    await ctx.db.patch(statementId, {
      status: "voided",
      previousStatus: row.status as "draft" | "issued" | "partial" | "paid",
      voidedAt: now,
      voidedBy: actor.clerkUserId,
      voidReason: reason.trim(),
      updatedAt: now,
    });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.void",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Voided ${row.statementNumberDisplay}: ${reason.trim()}`,
    });
  },
});

export const unvoidStatement = mutation({
  args: { statementId: v.id("vendorStatements") },
  handler: async (ctx, { statementId }) => {
    const actor = await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status !== "voided") throw new Error("Statement is not voided");
    if (row.supersededById) {
      const replacement = await ctx.db.get(row.supersededById);
      throw new Error(
        `Cannot un-void: superseded by ${replacement?.statementNumberDisplay ?? row.supersededById}. Void the replacement first.`,
      );
    }
    const now = Date.now();
    let restored = row.previousStatus ?? "issued";
    if (row.balanceCents <= 0 && restored !== "draft") restored = "paid";
    await ctx.db.patch(statementId, {
      status: restored,
      previousStatus: undefined,
      unvoidedAt: now,
      unvoidedBy: actor.clerkUserId,
      updatedAt: now,
    });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.unvoid",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Un-voided ${row.statementNumberDisplay} (restored to "${restored}")`,
    });
  },
});

/**
 * Edit non-financial metadata. Statement amounts are never editable here —
 * corrections flow through `invoiceAdjustments` + reissue.
 */
export const patchStatementMeta = mutation({
  args: {
    statementId: v.id("vendorStatements"),
    statementDate: v.optional(v.number()),
    paymentDueDate: v.optional(v.number()),
    internalMemo: v.optional(v.string()),
  },
  handler: async (ctx, { statementId, ...updates }) => {
    const actor = await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status === "voided") throw new Error("Cannot edit a voided statement");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (updates.statementDate != null && updates.statementDate !== row.statementDate) {
      patch.statementDate = updates.statementDate;
      changes.push(
        `Statement date → ${new Date(updates.statementDate).toISOString().slice(0, 10)}`,
      );
    }
    if (updates.paymentDueDate != null && updates.paymentDueDate !== row.paymentDueDate) {
      patch.paymentDueDate = updates.paymentDueDate;
      changes.push(
        `Due date → ${new Date(updates.paymentDueDate).toISOString().slice(0, 10)}`,
      );
    }
    if (updates.internalMemo !== undefined && updates.internalMemo !== row.internalMemo) {
      patch.internalMemo = updates.internalMemo || undefined;
      changes.push("Internal memo updated");
    }
    if (changes.length === 0) return;

    await ctx.db.patch(statementId, patch as any);
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.edit",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Edited ${row.statementNumberDisplay}: ${changes.join("; ")}`,
      metadata: { changes },
    });
  },
});
