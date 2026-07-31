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
 *   2. RECIPIENTS SEE ONLY THEIR OWN ECONOMICS. `VENDOR_POLICY` below is the
 *      single gate. Fields a recipient may not see are never assembled into
 *      the payload at all — not hidden downstream, not annotated as withheld.
 *      A document cannot leak a field the server never sent.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";
import { DispersalSplit, PlanTier } from "../lib/dispersal";
import { parsePeriodKey } from "../lib/periods";

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

interface VendorPolicy {
  name: string;
  /** Which frozen dispersal bucket this recipient is paid from. */
  amountField: keyof DispersalSplit;
  /** Which `invoiceAdjustments.bucket` corrections land on this statement. */
  adjustmentBucket: "toothlens" | "careington" | "partnerVendor" | "ryzeKeep";
  /** Internal carrier view — sees the full revenue split. */
  internal: boolean;
  /**
   * Whether employer group / organization identity appears anywhere on the
   * statement (summary table, member lines, exports). External recipients are
   * paid per covered primary; which employer sponsors a given member is not
   * part of what they are owed.
   */
  showGroups: boolean;
  /**
   * Whether the Individual/Family rate class appears. Only meaningful where
   * the recipient's own remittance actually varies by tier — a flat-fee
   * recipient's amount is identical either way, so the tier would disclose
   * household composition while explaining nothing.
   */
  showTier: boolean;
  /** Short line describing what the recipient is being paid for. */
  basis: string;
}

export const VENDOR_POLICY: Record<VendorId, VendorPolicy> = {
  toothlens: {
    name: "Toothlens",
    amountField: "toothlensCents",
    adjustmentBucket: "toothlens",
    internal: false,
    showGroups: false,
    showTier: false,
    basis: "Flat service fee per covered primary",
  },
  careington: {
    name: "Careington",
    amountField: "careingtonCents",
    adjustmentBucket: "careington",
    internal: false,
    showGroups: false,
    showTier: false,
    basis: "Flat service fee per covered primary",
  },
  ideal: {
    name: "Ideal Health",
    amountField: "partnerVendorCents",
    adjustmentBucket: "partnerVendor",
    internal: false,
    showGroups: false,
    showTier: true,
    basis: "Remittance rate per covered primary by rate class",
  },
  ryze: {
    name: "Ryze",
    amountField: "ryzeKeepCents",
    adjustmentBucket: "ryzeKeep",
    internal: true,
    showGroups: true,
    showTier: true,
    basis: "Carrier residual after vendor and processing dispersal",
  },
};

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface StatementMemberLine {
  memberId: string;
  firstName: string;
  lastName: string;
  amountCents: number;
  /** Present only when policy.showGroups. */
  groupCode?: string;
  groupName?: string;
  /** Present only when policy.showTier. */
  rateClass?: string;
  /** Present only for the internal carrier statement. */
  grossCents?: number;
  toothlensCents?: number;
  careingtonCents?: number;
  processingCents?: number;
  partnerVendorCents?: number;
  ryzeKeepCents?: number;
}

export interface StatementGroupRow {
  groupCode: string;
  groupName: string;
  primaryCount: number;
  amountCents: number;
}

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
  showGroups: boolean;
  showTier: boolean;
  internal: boolean;
  primaryCount: number;
  memberLines: StatementMemberLine[];
  /** Empty unless policy.showGroups. */
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

function shapeMemberLine(
  line: NonNullable<Doc<"invoicePeriods">["memberLines"]>[number],
  snapshot: Doc<"invoicePeriods">,
  policy: VendorPolicy,
): StatementMemberLine {
  return {
    memberId: line.memberId,
    firstName: line.firstName,
    lastName: line.lastName,
    amountCents: line[policy.amountField],
    ...(policy.showGroups
      ? { groupCode: line.groupCode, groupName: snapshot.groupName }
      : {}),
    ...(policy.showTier ? { rateClass: rateClassLabel(line.tier) } : {}),
    ...(policy.internal
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
  const policy = VENDOR_POLICY[vendor];
  const snapshots = await loadClosedSnapshots(ctx, period);
  const { coverageStart, coverageEnd } = coverageWindow(period);

  const memberLines: StatementMemberLine[] = [];
  let primaryCount = 0;
  for (const snapshot of snapshots) {
    for (const line of snapshot.memberLines ?? []) {
      if (line.tier === "none") continue;
      primaryCount++;
      if (line[policy.amountField] <= 0) continue;
      memberLines.push(shapeMemberLine(line, snapshot, policy));
    }
  }

  const groups: StatementGroupRow[] = policy.showGroups
    ? snapshots
        .map((snapshot) => ({
          groupCode: snapshot.groupCode,
          groupName: snapshot.groupName,
          primaryCount:
            snapshot.individualPrimaryCount + snapshot.familyPrimaryCount,
          amountCents: snapshot[policy.amountField],
        }))
        .filter((row) => row.amountCents > 0)
        .sort((a, b) => a.groupName.localeCompare(b.groupName))
    : [];

  // Subtotal always comes from the frozen group totals, not from the member
  // lines — legacy closes have authoritative totals but no member detail.
  const subtotalCents = snapshots.reduce(
    (sum, snapshot) => sum + snapshot[policy.amountField],
    0,
  );
  const memberDetailAvailable = snapshots.every(
    (snapshot) => snapshot.memberLines !== undefined,
  );
  if (!memberDetailAvailable) {
    // Aggregate-only statement: totals stand, detail is simply absent.
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
    showGroups: policy.showGroups,
    showTier: policy.showTier,
    internal: policy.internal,
    primaryCount,
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

    const policy = VENDOR_POLICY[row.vendor as VendorId];
    const frozen = new Set(row.adjustmentIds.map((id) => String(id)));

    const memberLines: StatementMemberLine[] = [];
    if (row.memberDetailAvailable) {
      for (const periodId of row.sourcePeriodIds) {
        const snapshot = await ctx.db.get(periodId);
        if (!snapshot) continue;
        for (const line of snapshot.memberLines ?? []) {
          if (line.tier === "none") continue;
          if (line[policy.amountField] <= 0) continue;
          memberLines.push(shapeMemberLine(line, snapshot, policy));
        }
      }
    }

    const groups: StatementGroupRow[] = [];
    if (policy.showGroups) {
      for (const periodId of row.sourcePeriodIds) {
        const snapshot = await ctx.db.get(periodId);
        if (!snapshot) continue;
        const amountCents = snapshot[policy.amountField];
        if (amountCents <= 0) continue;
        groups.push({
          groupCode: snapshot.groupCode,
          groupName: snapshot.groupName,
          primaryCount:
            snapshot.individualPrimaryCount + snapshot.familyPrimaryCount,
          amountCents,
        });
      }
      groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
    }

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
      showGroups: policy.showGroups,
      showTier: policy.showTier,
      internal: policy.internal,
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
