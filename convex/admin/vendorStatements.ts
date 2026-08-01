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
import { fillMemberLines } from "./invoiceCalculator";

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
  /** Itemized adjustment lines vs. a single net figure. */
  adjustmentDetail: boolean;
  /** Which data points appear in the Covered Primary Detail table. */
  columns: StatementColumn[];
}

// ---------------------------------------------------------------------------
// Column registry — what can appear in the Covered Primary Detail table
// ---------------------------------------------------------------------------

export interface StatementColumn {
  key: string;
  enabled: boolean;
}

/**
 * Every data point a statement's member table can carry.
 *
 * `fixed` columns are always present — a member row with no member and no
 * amount is not a statement line. `internalOnly` columns expose what OTHER
 * partners are paid and are refused for external recipients server-side, not
 * merely hidden in the picker.
 */
export const STATEMENT_COLUMN_REGISTRY: Array<{
  key: string;
  label: string;
  group: "Member" | "Address" | "Organization" | "Attribution" | "Systems" | "Money";
  fixed?: boolean;
  /** Read from the member record at print time rather than from the close. */
  live?: boolean;
  internalOnly?: boolean;
  sensitive?: boolean;
  /** Recipients that start with this column on. */
  defaultFor: VendorId[];
}> = [
  { key: "memberId", label: "Member ID", group: "Member", defaultFor: VENDOR_IDS },
  { key: "memberName", label: "Member Name", group: "Member", defaultFor: VENDOR_IDS },
  { key: "rateClass", label: "Rate Class (Individual / Family)", group: "Member", sensitive: true, defaultFor: ["ideal", "ryze"] },
  { key: "organization", label: "Organization", group: "Organization", sensitive: true, defaultFor: ["ideal", "ryze"] },
  { key: "orgCode", label: "Org Code", group: "Organization", sensitive: true, defaultFor: ["ryze"] },
  { key: "groupCode", label: "Group Code", group: "Organization", defaultFor: [] },
  { key: "repName", label: "Rep / Broker", group: "Attribution", sensitive: true, defaultFor: ["ideal", "ryze"] },
  { key: "repCode", label: "Rep Code", group: "Attribution", sensitive: true, defaultFor: ["ideal", "ryze"] },
  { key: "repEmail", label: "Rep Email", group: "Attribution", sensitive: true, defaultFor: [] },
  { key: "agencyName", label: "Agency", group: "Attribution", sensitive: true, defaultFor: ["ideal", "ryze"] },
  // --- Live member attributes -------------------------------------------
  // Everything the User Audit can show. These are read from the member record
  // at print time rather than from the frozen close: they are descriptive
  // fields, not figures, so they are always current. Anything financial stays
  // frozen and appears under Money below.
  { key: "firstName", label: "First Name", group: "Member", live: true, defaultFor: [] },
  { key: "lastName", label: "Last Name", group: "Member", live: true, defaultFor: [] },
  { key: "memberEmail", label: "Member Email", group: "Member", live: true, sensitive: true, defaultFor: [] },
  { key: "phone", label: "Phone", group: "Member", live: true, sensitive: true, defaultFor: [] },
  { key: "dob", label: "DOB", group: "Member", live: true, sensitive: true, defaultFor: [] },
  { key: "ssn", label: "SSN", group: "Member", live: true, sensitive: true, defaultFor: [] },
  { key: "gender", label: "Gender", group: "Member", live: true, sensitive: true, defaultFor: [] },
  { key: "memberRole", label: "Role", group: "Member", live: true, defaultFor: [] },
  { key: "relationship", label: "Relationship", group: "Member", live: true, defaultFor: [] },
  { key: "primaryMember", label: "Primary Member", group: "Member", live: true, defaultFor: [] },
  { key: "dependentCount", label: "Dependents", group: "Member", live: true, defaultFor: [] },
  { key: "memberType", label: "Status", group: "Member", live: true, defaultFor: [] },
  { key: "effectiveDate", label: "Effective Date", group: "Member", live: true, defaultFor: [] },
  { key: "createdAt", label: "Created", group: "Member", live: true, defaultFor: [] },
  { key: "censusMissing", label: "Missing Census Fields", group: "Member", live: true, defaultFor: [] },

  { key: "addressLine1", label: "Address Line 1", group: "Address", live: true, sensitive: true, defaultFor: [] },
  { key: "city", label: "City", group: "Address", live: true, sensitive: true, defaultFor: [] },
  { key: "state", label: "State", group: "Address", live: true, sensitive: true, defaultFor: [] },
  { key: "postalCode", label: "Zip", group: "Address", live: true, sensitive: true, defaultFor: [] },

  { key: "employeeType", label: "Employee Type", group: "Organization", live: true, defaultFor: [] },
  { key: "location", label: "Location", group: "Organization", live: true, defaultFor: [] },
  { key: "department", label: "Department", group: "Organization", live: true, defaultFor: [] },
  { key: "groupMemberId", label: "Employee #", group: "Organization", live: true, defaultFor: [] },
  { key: "listBillStatus", label: "List Bill Status", group: "Organization", live: true, defaultFor: [] },

  { key: "careingtonId", label: "Careington ID", group: "Systems", live: true, defaultFor: [] },
  { key: "careingtonSeq", label: "Seq #", group: "Systems", live: true, defaultFor: [] },
  { key: "toothlensId", label: "Toothlens ID", group: "Systems", live: true, defaultFor: [] },
  { key: "clerkId", label: "Clerk ID", group: "Systems", live: true, sensitive: true, defaultFor: [] },
  { key: "systemPresence", label: "System Presence", group: "Systems", live: true, defaultFor: [] },
  { key: "subscriptionStatus", label: "Subscription", group: "Systems", live: true, defaultFor: [] },
  { key: "entitlementCount", label: "Entitlements", group: "Systems", live: true, defaultFor: [] },
  { key: "barcode", label: "Barcode", group: "Systems", live: true, defaultFor: [] },
  { key: "subscriberId", label: "Subscriber ID", group: "Systems", live: true, defaultFor: [] },

  { key: "amount", label: "Amount", group: "Money", fixed: true, defaultFor: VENDOR_IDS },
  { key: "grossCents", label: "Retail Gross", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
  { key: "toothlensCents", label: "Toothlens Share", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
  { key: "careingtonCents", label: "Careington Share", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
  { key: "processingCents", label: "Processing", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
  { key: "partnerVendorCents", label: "Ideal Health Share", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
  { key: "ryzeKeepCents", label: "Ryze Keep", group: "Money", internalOnly: true, sensitive: true, defaultFor: ["ryze"] },
];

const COLUMN_BY_KEY = new Map(
  STATEMENT_COLUMN_REGISTRY.map((c) => [c.key, c]),
);

export function defaultStatementColumns(vendor: VendorId): StatementColumn[] {
  return STATEMENT_COLUMN_REGISTRY.map((c) => ({
    key: c.key,
    enabled: Boolean(c.fixed) || c.defaultFor.includes(vendor),
  }));
}

/**
 * Effective columns for a recipient: the stored selection when present,
 * otherwise the registry defaults. Unknown keys are dropped and new registry
 * columns are appended disabled, so a saved profile survives the registry
 * growing. Fixed columns are forced on and internal-only columns are forced
 * off for external recipients no matter what was stored.
 */
export function resolveStatementColumns(
  vendor: VendorId,
  stored: StatementColumn[] | undefined | null,
): StatementColumn[] {
  const base =
    !stored || stored.length === 0
      ? defaultStatementColumns(vendor)
      : (() => {
          const known = new Map(stored.map((c) => [c.key, c.enabled]));
          return STATEMENT_COLUMN_REGISTRY.map((c) => ({
            key: c.key,
            enabled: known.get(c.key) ?? false,
          }));
        })();

  return base.map((column) => {
    const meta = COLUMN_BY_KEY.get(column.key)!;
    if (meta.fixed) return { ...column, enabled: true };
    if (meta.internalOnly && vendor !== "ryze") return { ...column, enabled: false };
    return column;
  });
}

export function columnEnabled(columns: StatementColumn[], key: string): boolean {
  return columns.some((c) => c.key === key && c.enabled);
}

export const columnsValidator = v.array(
  v.object({ key: v.string(), enabled: v.boolean() }),
);

export const DISCLOSURE_FIELDS: Array<{
  key: "memberDetail" | "groupVisibility" | "adjustmentDetail";
  label: string;
}> = [
  { key: "memberDetail", label: "Covered primary detail" },
  { key: "groupVisibility", label: "Employer group" },
  { key: "adjustmentDetail", label: "Itemized adjustments" },
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
    adjustmentDetail: true,
    columns: defaultStatementColumns("toothlens"),
  },
  careington: {
    memberDetail: true,
    groupVisibility: "none",
    adjustmentDetail: true,
    columns: defaultStatementColumns("careington"),
  },
  ideal: {
    memberDetail: true,
    groupVisibility: "listBillOnly",
    adjustmentDetail: true,
    columns: defaultStatementColumns("ideal"),
  },
  ryze: {
    memberDetail: true,
    groupVisibility: "all",
    adjustmentDetail: true,
    columns: defaultStatementColumns("ryze"),
  },
};

export const disclosureValidator = v.object({
  memberDetail: v.boolean(),
  groupVisibility: v.union(
    v.literal("none"),
    v.literal("listBillOnly"),
    v.literal("all"),
  ),
  adjustmentDetail: v.boolean(),
  columns: columnsValidator,
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
    adjustmentDetail: saved.adjustmentDetail,
    columns: resolveStatementColumns(vendor, saved.columns),
  };
}

/**
 * Identity + the disclosure actually in force. Everything downstream reads
 * this, so there is still exactly one gate — it just takes its answers from
 * configuration now instead of from a constant.
 */
interface ResolvedPolicy extends VendorIdentity {
  disclosure: StatementDisclosure;
  /** Derived once from the column selection so nothing downstream re-reads it. */
  show: {
    rateClass: boolean;
    rep: boolean;
    fullSplit: boolean;
  };
}

function derive(disclosure: StatementDisclosure): ResolvedPolicy["show"] {
  const on = (key: string) => columnEnabled(disclosure.columns, key);
  return {
    rateClass: on("rateClass"),
    rep: on("repName") || on("repCode") || on("repEmail") || on("agencyName"),
    fullSplit:
      on("grossCents") ||
      on("toothlensCents") ||
      on("careingtonCents") ||
      on("processingCents") ||
      on("partnerVendorCents") ||
      on("ryzeKeepCents"),
  };
}

async function resolvePolicy(
  ctx: QueryCtx | MutationCtx,
  vendor: VendorId,
): Promise<ResolvedPolicy> {
  const disclosure = await resolveDisclosure(ctx, vendor);
  return { ...VENDOR_IDENTITY[vendor], disclosure, show: derive(disclosure) };
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
  const changes = DISCLOSURE_FIELDS.filter(
    (field) => frozen[field.key] !== current[field.key],
  ).map(
    (field) =>
      `${field.label}: ${String(frozen[field.key])} → ${String(current[field.key])}`,
  );
  const was = new Map((frozen.columns ?? []).map((c) => [c.key, c.enabled]));
  for (const column of current.columns ?? []) {
    const before = was.get(column.key);
    if (before === undefined || before === column.enabled) continue;
    const meta = STATEMENT_COLUMN_REGISTRY.find((c) => c.key === column.key);
    changes.push(
      `${meta?.label ?? column.key}: ${column.enabled ? "added" : "removed"}`,
    );
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface StatementMemberLine {
  /** Only used server-side to attach live fields; harmless to a renderer. */
  memberProfileId?: string;
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
  /** Live member attributes, keyed by column. Only the enabled ones. */
  extra?: Record<string, string | number>;
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
  /** True when at least one organization has per-member rows to show. */
  memberDetailAvailable: boolean;
  /** True only when EVERY organization does. */
  memberDetailComplete: boolean;
  /**
   * Organizations whose close has no per-member rows. Reported so a partial
   * list is never mistaken for a complete one — showing 13 of 16 names
   * silently would be worse than showing none.
   */
  missingDetailGroups: Array<{ groupName: string; primaryCount: number }>;
  /** Sum of the lines actually itemized. Below subtotal when partial. */
  itemizedCents: number;
  /** What the month originally closed at, before any rebuild or exclusion. */
  closedSubtotalCents: number;
  /** The disclosure this payload was built under. */
  disclosure: StatementDisclosure;
  // Resolved flags, so renderers never re-interpret the profile themselves.
  showMemberDetail: boolean;
  showGroups: boolean;
  showTier: boolean;
  showBroker: boolean;
  showFullSplit: boolean;
  showAdjustmentDetail: boolean;
  /** Enabled columns, in registry order, for the member detail table. */
  columns: Array<{ key: string; label: string }>;
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
  /** Primaries left off the statement — must come out of the rollup too. */
  excluded: Set<string> = new Set(),
): Promise<StatementGroupRow[]> {
  const visibility = policy.disclosure.groupVisibility;
  if (visibility === "none") return [];

  const rows = new Map<string, StatementGroupRow>();
  for (const snapshot of snapshots) {
    if (snapshot[policy.amountField] <= 0) continue;
    const label = groupLabelFor(snapshot, visibility);
    if (!label) continue;

    const { amountCents, individualCount, familyCount, primaryCount } =
      snapshotFigures(snapshot, policy, excluded);
    const existing = rows.get(label.key);
    if (existing) {
      existing.primaryCount += primaryCount;
      existing.individualCount += individualCount;
      existing.familyCount += familyCount;
      existing.amountCents += amountCents;
    } else {
      // The rep who owns this organization's deal — the person a partner pays
      // for the whole account, distinct from whoever sold each member.
      let rep: { repName?: string; repCode?: string; agencyName?: string } = {};
      if (policy.show.rep && label.key !== "DIRECT") {
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
        individualCount,
        familyCount,
        ...rep,
        amountCents,
      });
    }
  }
  // Direct enrollments sort last; organizations read alphabetically above it.
  return Array.from(rows.values())
    .filter((row) => row.primaryCount > 0 || row.amountCents !== 0)
    .sort((a, b) => {
      if ((a.groupCode === "DIRECT") !== (b.groupCode === "DIRECT")) {
        return a.groupCode === "DIRECT" ? 1 : -1;
      }
      return a.groupName.localeCompare(b.groupName);
    });
}

/**
 * Gather per-member lines from every close that has them, per organization
 * rather than all-or-nothing. One organization whose detail cannot be rebuilt
 * must not suppress the names of every other organization on the statement.
 */
function collectMemberLines(
  snapshots: Doc<"invoicePeriods">[],
  policy: ResolvedPolicy,
  fallbackByMember: Map<string, RepAttribution>,
  excluded: Set<string>,
): {
  lines: StatementMemberLine[];
  memberProfileIds: Id<"memberProfiles">[];
  available: boolean;
  complete: boolean;
  missing: Array<{ groupName: string; primaryCount: number }>;
} {
  const lines: StatementMemberLine[] = [];
  const memberProfileIds: Id<"memberProfiles">[] = [];
  const missing: Array<{ groupName: string; primaryCount: number }> = [];
  let withDetail = 0;

  for (const snapshot of snapshots) {
    const snapshotPrimaries =
      snapshot.individualPrimaryCount + snapshot.familyPrimaryCount;
    if (snapshot.memberLines === undefined) {
      if (snapshotPrimaries > 0) {
        missing.push({
          groupName: snapshot.groupName,
          primaryCount: snapshotPrimaries,
        });
      }
      continue;
    }
    withDetail++;
    for (const line of snapshot.memberLines) {
      if (line.tier === "none") continue;
      if (line[policy.amountField] <= 0) continue;
      if (excluded.has(line.memberId)) continue;
      memberProfileIds.push(line.memberProfileId);
      lines.push(
        shapeMemberLine(
          line,
          snapshot,
          policy,
          fallbackByMember.get(String(line.memberProfileId)),
        ),
      );
    }
  }

  return {
    lines,
    memberProfileIds,
    available: withDetail > 0,
    complete: missing.length === 0,
    missing: missing.sort((a, b) => a.groupName.localeCompare(b.groupName)),
  };
}

/** Census fields a complete member record is expected to carry. */
const CENSUS_FIELDS: Array<[string, (m: Doc<"memberProfiles">) => unknown]> = [
  ["Email", (m) => m.email],
  ["DOB", (m) => m.dateOfBirth],
  ["Effective Date", (m) => m.effectiveDate],
  ["Address", (m) => m.address],
];

/**
 * Read the live member attributes for the enabled columns.
 *
 * These are descriptive — a name, an address, a Careington id — not figures.
 * They are read from the member record at print time rather than frozen at
 * close, so they are always current. Nothing here can move an amount: every
 * financial field on a statement still comes from the close.
 *
 * Only runs when a live column is actually switched on, and only touches the
 * tables those columns need.
 */
async function hydrateLiveFields(
  ctx: QueryCtx | MutationCtx,
  memberProfileIds: Id<"memberProfiles">[],
  enabled: Set<string>,
): Promise<Map<string, Record<string, string | number>>> {
  const out = new Map<string, Record<string, string | number>>();
  if (enabled.size === 0 || memberProfileIds.length === 0) return out;

  const wants = (key: string) => enabled.has(key);
  const needsGroup = wants("listBillStatus") || wants("employeeType");
  const needsBilling = wants("subscriptionStatus") || wants("entitlementCount");
  const needsDependents = wants("dependentCount") || wants("primaryMember");

  const groupCache = new Map<string, Doc<"groups"> | null>();
  const iso = (ms?: number) =>
    ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10);

  for (const memberProfileId of memberProfileIds) {
    const member = await ctx.db.get(memberProfileId);
    if (!member) continue;
    const row: Record<string, string | number> = {};

    if (wants("firstName")) row.firstName = member.firstName ?? "";
    if (wants("lastName")) row.lastName = member.lastName ?? "";
    if (wants("memberEmail")) row.memberEmail = member.email ?? "";
    if (wants("phone")) row.phone = member.phone ?? "";
    if (wants("dob")) row.dob = member.dateOfBirth ?? "";
    if (wants("ssn")) row.ssn = member.ssn ?? "";
    if (wants("gender")) row.gender = member.gender ?? "";
    if (wants("memberRole")) {
      row.memberRole = member.memberRole === "dependent" ? "Dependent" : "Primary";
    }
    if (wants("relationship")) row.relationship = member.relationship ?? "";
    if (wants("memberType")) row.memberType = member.memberType ?? "";
    if (wants("effectiveDate")) row.effectiveDate = member.effectiveDate ?? "";
    if (wants("createdAt")) row.createdAt = iso(member.createdAt);
    if (wants("groupMemberId")) row.groupMemberId = member.groupMemberId ?? "";
    if (wants("location")) row.location = member.location ?? "";
    if (wants("department")) row.department = member.department ?? "";
    if (wants("listBillStatus")) row.listBillStatus = member.listBillStatus ?? "";
    if (wants("employeeType")) row.employeeType = member.employeeType ?? "";
    if (wants("careingtonId")) row.careingtonId = member.careingtonUniqueId ?? "";
    if (wants("careingtonSeq")) row.careingtonSeq = member.careingtonSeqNum ?? "";
    if (wants("toothlensId")) row.toothlensId = member.toothlensMemberId ?? "";
    if (wants("clerkId")) row.clerkId = member.customerId ?? "";
    if (wants("barcode")) row.barcode = member.barcode ?? "";
    if (wants("subscriberId")) row.subscriberId = member.subscriberId ?? "";
    if (wants("systemPresence")) {
      row.systemPresence = member.customerId ? "Linked" : "Convex only";
    }
    if (wants("addressLine1")) row.addressLine1 = member.address?.line1 ?? "";
    if (wants("city")) row.city = member.address?.city ?? "";
    if (wants("state")) row.state = member.address?.state ?? "";
    if (wants("postalCode")) row.postalCode = member.address?.postalCode ?? "";
    if (wants("censusMissing")) {
      row.censusMissing = CENSUS_FIELDS.filter(([, get]) => !get(member))
        .map(([label]) => label)
        .join("; ");
    }

    if (needsGroup && !groupCache.has(String(member.groupId))) {
      groupCache.set(String(member.groupId), await ctx.db.get(member.groupId));
    }

    if (needsBilling && member.customerId) {
      if (wants("subscriptionStatus")) {
        const bundle = await ctx.db
          .query("subscriptionBundles")
          .withIndex("by_customer", (q) => q.eq("customerId", member.customerId!))
          .first();
        row.subscriptionStatus = bundle?.status ?? "";
      }
      if (wants("entitlementCount")) {
        const entitlements = await ctx.db
          .query("entitlements")
          .withIndex("by_customer", (q) => q.eq("customerId", member.customerId!))
          .collect();
        row.entitlementCount = entitlements.length;
      }
    }

    if (needsDependents) {
      if (member.memberRole === "dependent") {
        if (wants("dependentCount")) row.dependentCount = "";
        if (wants("primaryMember") && member.primaryMemberId) {
          const primary = await ctx.db.get(member.primaryMemberId);
          row.primaryMember = primary
            ? `${primary.lastName}, ${primary.firstName}`
            : "";
        }
      } else {
        if (wants("dependentCount")) {
          const deps = await ctx.db
            .query("memberProfiles")
            .withIndex("by_primary_member", (q) =>
              q.eq("primaryMemberId", memberProfileId),
            )
            .collect();
          row.dependentCount = deps.length;
        }
        if (wants("primaryMember")) row.primaryMember = "";
      }
    }

    out.set(String(memberProfileId), row);
  }
  return out;
}

/**
 * What one closed organization contributes to this statement.
 *
 * When the close carries member lines, the figures are derived FROM those
 * lines. For a close written by `closePeriod` the lines and the frozen
 * aggregates agree to the cent by construction, so this changes nothing. For a
 * close whose detail was rebuilt later — where the roster has moved since —
 * it is the difference between a statement that foots and one that shows a
 * Group Summary of 13 above a member list of 14.
 *
 * Falls back to the frozen aggregates only where there are no lines to work
 * from. `closedAmountCents` always reports what the month originally closed
 * at, so the delta stays visible in verification.
 */
function snapshotFigures(
  snapshot: Doc<"invoicePeriods">,
  policy: ResolvedPolicy,
  excluded: Set<string>,
): {
  amountCents: number;
  closedAmountCents: number;
  individualCount: number;
  familyCount: number;
  primaryCount: number;
  fromLines: boolean;
} {
  const closedAmountCents = snapshot[policy.amountField];
  if (snapshot.memberLines === undefined) {
    return {
      amountCents: closedAmountCents,
      closedAmountCents,
      individualCount: snapshot.individualPrimaryCount,
      familyCount: snapshot.familyPrimaryCount,
      primaryCount:
        snapshot.individualPrimaryCount + snapshot.familyPrimaryCount,
      fromLines: false,
    };
  }

  let amountCents = 0;
  let individualCount = 0;
  let familyCount = 0;
  for (const line of snapshot.memberLines) {
    if (line.tier === "none") continue;
    if (excluded.has(line.memberId)) continue;
    amountCents += line[policy.amountField];
    if (line.tier === "individual") individualCount++;
    else familyCount++;
  }
  return {
    amountCents,
    closedAmountCents,
    individualCount,
    familyCount,
    primaryCount: individualCount + familyCount,
    fromLines: true,
  };
}

/** Fill each line's `extra` with the live columns this recipient shows. */
async function attachLiveFields(
  ctx: QueryCtx | MutationCtx,
  lines: StatementMemberLine[],
  policy: ResolvedPolicy,
  memberProfileIds: Id<"memberProfiles">[],
): Promise<void> {
  const keys = enabledLiveKeys(policy);
  if (keys.size === 0 || lines.length === 0) return;
  const byMember = await hydrateLiveFields(ctx, memberProfileIds, keys);
  for (const line of lines) {
    if (!line.memberProfileId) continue;
    line.extra = byMember.get(line.memberProfileId) ?? {};
  }
}

/** Enabled live-column keys — empty when nothing needs the member record. */
function enabledLiveKeys(policy: ResolvedPolicy): Set<string> {
  return new Set(
    STATEMENT_COLUMN_REGISTRY.filter(
      (meta) => meta.live && columnEnabled(policy.disclosure.columns, meta.key),
    ).map((meta) => meta.key),
  );
}

/** The enabled columns for a recipient, in registry order, with labels. */
function visibleColumns(policy: ResolvedPolicy): Array<{ key: string; label: string }> {
  const orgHidden = policy.disclosure.groupVisibility === "none";
  return STATEMENT_COLUMN_REGISTRY.filter((meta) => {
    if (!columnEnabled(policy.disclosure.columns, meta.key)) return false;
    // An organization column with nothing disclosable behind it is dropped
    // rather than printed empty.
    if (orgHidden && meta.group === "Organization") return false;
    return true;
  }).map((meta) => ({ key: meta.key, label: meta.label }));
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
    memberProfileId: String(line.memberProfileId),
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
    ...(policy.show.rateClass ? { rateClass: rateClassLabel(line.tier) } : {}),
    ...(policy.show.rep ? rep : {}),
    ...(policy.show.fullSplit
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
  if (!policy.show.rep) return { basis: "none", fallbackByMember };

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

  const collected = collectMemberLines(
    snapshots,
    policy,
    fallbackByMember,
    new Set<string>(),
  );
  const memberLines = policy.disclosure.memberDetail ? collected.lines : [];
  await attachLiveFields(ctx, memberLines, policy, collected.memberProfileIds);

  const groups = await buildGroupRows(ctx, snapshots, policy);

  // Every figure comes from `snapshotFigures`, the same source the Group
  // Summary uses, so the rollup and the member list can never disagree.
  const figures = snapshots.map((snapshot) =>
    snapshotFigures(snapshot, policy, new Set<string>()),
  );
  const subtotalCents = figures.reduce((sum, f) => sum + f.amountCents, 0);
  const closedSubtotalCents = figures.reduce(
    (sum, f) => sum + f.closedAmountCents,
    0,
  );
  const primaryCount = figures.reduce((sum, f) => sum + f.primaryCount, 0);
  const itemizedCents = memberLines.reduce((sum, l) => sum + l.amountCents, 0);

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
    memberDetailAvailable: policy.disclosure.memberDetail && collected.available,
    memberDetailComplete: collected.complete,
    missingDetailGroups: policy.disclosure.memberDetail ? collected.missing : [],
    itemizedCents,
    disclosure: policy.disclosure,
    showMemberDetail: policy.disclosure.memberDetail,
    showGroups: policy.disclosure.groupVisibility !== "none",
    showTier: policy.show.rateClass,
    showBroker: policy.show.rep,
    showFullSplit: policy.show.fullSplit,
    showAdjustmentDetail: policy.disclosure.adjustmentDetail,
    columns: visibleColumns(policy),
    attributionBasis,
    primaryCount,
    individualCount: figures.reduce((n, f) => n + f.individualCount, 0),
    familyCount: figures.reduce((n, f) => n + f.familyCount, 0),
    closedSubtotalCents,
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
    const frozenDisclosure: StatementDisclosure | undefined = row.disclosure
      ? {
          memberDetail: row.disclosure.memberDetail,
          groupVisibility: row.disclosure.groupVisibility,
          adjustmentDetail: row.disclosure.adjustmentDetail,
          columns: resolveStatementColumns(
            row.vendor as VendorId,
            row.disclosure.columns,
          ),
        }
      : undefined;
    const disclosureDrift = disclosureDifferences(
      frozenDisclosure,
      policy.disclosure,
    );
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
    // generation, and per organization rather than all-or-nothing: a close
    // whose detail could not be rebuilt must not hide the names of every
    // other organization on the statement.
    const excluded = new Set((row.excludedMembers ?? []).map((e) => e.memberId));
    const collected = collectMemberLines(
      snapshots,
      policy,
      fallbackByMember,
      excluded,
    );
    const memberLines = policy.disclosure.memberDetail ? collected.lines : [];
    await attachLiveFields(ctx, memberLines, policy, collected.memberProfileIds);
    const itemizedCents = memberLines.reduce((sum, l) => sum + l.amountCents, 0);

    const groups = await buildGroupRows(ctx, snapshots, policy, excluded);

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

    // Same single source as the Group Summary. Exclusions are already applied
    // inside `snapshotFigures`, so nothing is subtracted twice.
    const excludedList = row.excludedMembers ?? [];
    const excludedCents = excludedList.reduce((n, e) => n + e.amountCents, 0);
    const figures = snapshots.map((snapshot) =>
      snapshotFigures(snapshot, policy, excluded),
    );
    const subtotalCents = figures.reduce((n, f) => n + f.amountCents, 0);
    const closedSubtotalCents = figures.reduce(
      (n, f) => n + f.closedAmountCents,
      0,
    );
    const totalCents = subtotalCents + row.adjustmentCents;

    return {
      ...row,
      overdue: isOverdue(row),
      basis: policy.basis,
      memberDetailAvailable: policy.disclosure.memberDetail && collected.available,
      memberDetailComplete: collected.complete,
      missingDetailGroups: policy.disclosure.memberDetail ? collected.missing : [],
      itemizedCents,
      excludedMembers: excludedList,
      excludedCents,
      subtotalCents,
      totalCents,
      balanceCents: totalCents - row.amountPaidCents,
      primaryCount: figures.reduce((n, f) => n + f.primaryCount, 0),
      individualCount: figures.reduce((n, f) => n + f.individualCount, 0),
      familyCount: figures.reduce((n, f) => n + f.familyCount, 0),
      closedSubtotalCents,
      groupCodeVaries: providerCodeVaries(groups),
      disclosure: policy.disclosure,
      showMemberDetail: policy.disclosure.memberDetail,
      showGroups: policy.disclosure.groupVisibility !== "none",
      showTier: policy.show.rateClass,
      showBroker: policy.show.rep,
      showFullSplit: policy.show.fullSplit,
      showAdjustmentDetail: policy.disclosure.adjustmentDetail,
      columns: visibleColumns(policy),
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

    // The registry travels with the profiles so the settings screen renders
    // from the same source the server enforces. A second copy on the client
    // is exactly how "Member ID (always)" survived being made optional.
    const registry = STATEMENT_COLUMN_REGISTRY.map((meta) => ({
      key: meta.key,
      label: meta.label,
      group: meta.group,
      fixed: meta.fixed ?? false,
      internalOnly: meta.internalOnly ?? false,
      sensitive: meta.sensitive ?? false,
    }));

    const profiles = VENDOR_IDS.map((vendor) => {
      const row = byVendor.get(vendor);
      const current = row
        ? {
            memberDetail: row.memberDetail,
            groupVisibility: row.groupVisibility,
            adjustmentDetail: row.adjustmentDetail,
            columns: resolveStatementColumns(vendor, row.columns),
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

    return { registry, profiles };
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
    const internalAsked = disclosure.columns.filter((column) => {
      const meta = STATEMENT_COLUMN_REGISTRY.find((c) => c.key === column.key);
      return column.enabled && meta?.internalOnly;
    });
    if (!disclosure.columns.some((c) => c.enabled)) {
      throw new Error(
        "A statement needs at least one column. Amount is always kept; pick something to identify the member by.",
      );
    }
    if (internalAsked.length > 0 && vendorId !== "ryze") {
      const names = internalAsked
        .map(
          (c) =>
            STATEMENT_COLUMN_REGISTRY.find((r) => r.key === c.key)?.label ?? c.key,
        )
        .join(", ");
      throw new Error(
        `${names} cannot be shown to ${VENDOR_IDENTITY[vendorId].name} — those columns disclose what other partners are paid.`,
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
          adjustmentDetail: existing.adjustmentDetail,
          columns: resolveStatementColumns(vendorId, existing.columns),
        }
      : DEFAULT_DISCLOSURE[vendorId];

    const now = Date.now();
    const normalised = {
      ...disclosure,
      columns: resolveStatementColumns(vendorId, disclosure.columns),
    };
    // One diff function for both the audit entry and the drift warning shown
    // on a statement, so they can never describe the same change differently.
    const changes = disclosureDifferences(before, normalised);
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...normalised,
        note: note?.trim() || undefined,
        updatedBy: actor.clerkUserId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("vendorStatementDisclosureProfiles", {
        vendor: vendorId,
        ...normalised,
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
      metadata: { vendor: vendorId, changes, disclosure: normalised, note },
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
// Per-primary exclusions
// ---------------------------------------------------------------------------

/**
 * Leave a specific primary off a statement — a duplicate, someone billed in
 * error, a term that landed after the close. The line disappears and its
 * amount comes off the subtotal so the document still foots.
 *
 * Allowed at any status except voided. On an already-issued statement this
 * changes a total the recipient has already been sent, so the change is
 * written to the activity trail and flagged on the statement — but it is not
 * blocked. Reissuing afterwards is the clean way to get them a matching copy.
 */
export const excludeMemberFromStatement = mutation({
  args: {
    statementId: v.id("vendorStatements"),
    memberId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { statementId, memberId, reason }) => {
    const actor = await requireAdmin(ctx);
    if (!reason.trim()) {
      throw new Error("A reason is required to leave a primary off a statement");
    }
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status === "voided") {
      throw new Error(
        `${row.statementNumberDisplay} is voided. Un-void it first if it should change.`,
      );
    }
    const already = row.excludedMembers ?? [];
    if (already.some((e) => e.memberId === memberId)) {
      throw new Error(`${memberId} is already excluded from this statement`);
    }

    // Find the frozen line so the amount removed is the one that was closed,
    // never a recomputed figure.
    const policy = VENDOR_IDENTITY[row.vendor as VendorId];
    let found: { amountCents: number; name: string; tier: "individual" | "family" } | null =
      null;
    for (const periodId of row.sourcePeriodIds) {
      const snapshot = await ctx.db.get(periodId);
      for (const line of snapshot?.memberLines ?? []) {
        if (line.memberId !== memberId || line.tier === "none") continue;
        found = {
          amountCents: line[policy.amountField],
          name: `${line.lastName}, ${line.firstName}`,
          tier: line.tier,
        };
        break;
      }
      if (found) break;
    }
    if (!found) {
      throw new Error(
        `${memberId} is not a covered primary on this statement, so it cannot be excluded`,
      );
    }

    const now = Date.now();
    const excludedMembers = [
      ...already,
      {
        memberId,
        memberName: found.name,
        amountCents: found.amountCents,
        tier: found.tier,
        reason: reason.trim(),
        excludedBy: actor.clerkUserId,
        excludedAt: now,
      },
    ];
    // Stored totals stay as generated; the effective figures are derived in
    // `getStatement` from the exclusion list, so a restore is lossless.
    await ctx.db.patch(statementId, { excludedMembers, updatedAt: now });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.exclude_member",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Excluded ${found.name} (${memberId}) from ${row.statementNumberDisplay}: ${reason.trim()}`,
      metadata: {
        memberId,
        amountCents: found.amountCents,
        reason: reason.trim(),
      },
    });

    return { excluded: excludedMembers.length };
  },
});

/** Put a previously excluded primary back on the statement. */
export const restoreMemberToStatement = mutation({
  args: { statementId: v.id("vendorStatements"), memberId: v.string() },
  handler: async (ctx, { statementId, memberId }) => {
    const actor = await requireAdmin(ctx);
    const row = await ctx.db.get(statementId);
    if (!row) throw new Error("Statement not found");
    if (row.status === "voided") {
      throw new Error(
        `${row.statementNumberDisplay} is voided. Un-void it first if it should change.`,
      );
    }
    const already = row.excludedMembers ?? [];
    const entry = already.find((e) => e.memberId === memberId);
    if (!entry) throw new Error(`${memberId} is not excluded from this statement`);

    await ctx.db.patch(statementId, {
      excludedMembers: already.filter((e) => e.memberId !== memberId),
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.restore_member",
      targetType: "vendorStatements",
      targetId: statementId,
      summary: `Restored ${entry.memberName} (${memberId}) to ${row.statementNumberDisplay}`,
      metadata: { memberId, amountCents: entry.amountCents },
    });
  },
});

// ---------------------------------------------------------------------------
// Deleting statements
// ---------------------------------------------------------------------------

/**
 * Permanently remove statements. Nothing else in the system depends on them —
 * the closed months they were drawn from are untouched, so anything deleted
 * here can be generated again from the same figures.
 *
 * Statement numbers are not reused: the counter keeps climbing so a number
 * that was once sent to a partner never points at a different document later.
 */
export const deleteStatements = mutation({
  args: {
    /** Delete these specific statements. */
    statementIds: v.optional(v.array(v.id("vendorStatements"))),
    /** Or everything matching a scope. */
    period: v.optional(v.string()),
    vendor: v.optional(vendorValidator),
    status: v.optional(v.string()),
    /** Required when deleting by scope rather than by explicit id. */
    confirmAll: v.optional(v.boolean()),
  },
  handler: async (ctx, { statementIds, period, vendor, status, confirmAll }) => {
    const actor = await requireAdmin(ctx);

    let targets: Doc<"vendorStatements">[] = [];
    if (statementIds && statementIds.length > 0) {
      for (const id of statementIds) {
        const row = await ctx.db.get(id);
        if (row) targets.push(row);
      }
    } else {
      if (!confirmAll) {
        throw new Error(
          "Deleting by scope needs confirmAll — pass explicit statementIds to delete individually.",
        );
      }
      targets = await ctx.db.query("vendorStatements").collect();
      if (period) targets = targets.filter((r) => r.period === period);
      if (vendor) targets = targets.filter((r) => r.vendor === vendor);
      if (status) targets = targets.filter((r) => r.status === status);
    }

    if (targets.length === 0) return { deleted: 0, numbers: [] };

    // Clear forward/back pointers first so no survivor is left pointing at a
    // statement that no longer exists.
    const doomed = new Set(targets.map((t) => String(t._id)));
    for (const row of targets) {
      if (row.supersededById && !doomed.has(String(row.supersededById))) {
        await ctx.db.patch(row.supersededById, { replacesId: undefined });
      }
      if (row.replacesId && !doomed.has(String(row.replacesId))) {
        await ctx.db.patch(row.replacesId, { supersededById: undefined });
      }
    }

    const numbers = targets.map((t) => t.statementNumberDisplay);
    for (const row of targets) await ctx.db.delete(row._id);

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "vendor_statement.delete",
      targetType: "vendorStatements",
      targetId: period ?? "bulk",
      summary: `Deleted ${targets.length} statement(s): ${numbers.join(", ")}`,
      metadata: { numbers, period, vendor, status },
    });

    return { deleted: targets.length, numbers };
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
  { action: "vendor_statement.exclude_member", label: "Primary excluded", kind: "lifecycle" },
  { action: "vendor_statement.restore_member", label: "Primary restored", kind: "lifecycle" },
  { action: "vendor_statement.delete", label: "Statements deleted", kind: "lifecycle" },
  { action: "vendor_statement.remittance", label: "Remittance recorded", kind: "money" },
  // Upstream events that move the figures a statement reports
  { action: "invoice.recordAdjustment", label: "Adjustment recorded", kind: "money" },
  { action: "invoice.backfillMemberLines", label: "Member detail backfilled", kind: "data" },
  { action: "invoice.syncClosedTotals", label: "Closed totals synced to the member list", kind: "money" },
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
    const bucketTotal = snapshotTotals[policy.amountField];
    const unbalancedLines = lines.filter((l) => !l.splitBalances);
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    // What the statement actually bills: the member lines where they exist,
    // less anything excluded.
    const excludedIds = new Set(
      (row.excludedMembers ?? []).map((e) => e.memberId),
    );
    const excludedCents = (row.excludedMembers ?? []).reduce(
      (n, e) => n + e.amountCents,
      0,
    );
    const billedCents = lines
      .filter((l) => !excludedIds.has(l.memberId))
      .reduce((n, l) => n + l.statementCents, 0);
    const effectiveCents = memberDetailAvailable ? billedCents : bucketTotal;

    const checks: VerificationCheck[] = [
      {
        // Catches the roster moving between generating a statement and reading
        // it — the figures on the document would no longer be the ones cut.
        label: "Statement is unchanged since it was generated",
        passed:
          !memberDetailAvailable ||
          billedCents === row.subtotalCents - excludedCents,
        detail: !memberDetailAvailable
          ? "Aggregate-only close — no member lines to compare"
          : billedCents === row.subtotalCents - excludedCents
            ? `${lines.length - excludedIds.size} billed lines totalling ${money(billedCents)}`
            : `Now ${money(billedCents)}; generated at ${money(row.subtotalCents - excludedCents)}. Reissue to cut a fresh document.`,
      },
      {
        label: "Statement matches what the month closed at",
        passed: effectiveCents === bucketTotal,
        detail:
          effectiveCents === bucketTotal
            ? `${money(bucketTotal)} on both sides`
            : `The roster has moved since this month closed: ${money(effectiveCents)} of members on file now vs ${money(bucketTotal)} at close. The statement bills what is on file.`,
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

  // Name everyone we can before cutting the document. Whether the rebuilt
  // roster still adds up to the closed total affects how the row is stamped,
  // not whether the members are shown — totals are never rewritten either way.
  await fillMemberLines(ctx, args.period);

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
