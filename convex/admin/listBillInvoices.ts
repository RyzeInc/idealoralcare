/**
 * LIST-BILL INVOICE GENERATOR — server functions
 *
 * Implements docs/internal/LIST_BILL_INVOICE_SPEC.md.
 *
 * Public surface:
 *   Mutations (admin):
 *     generateInvoice            — create a draft invoice for a group × period (idempotent)
 *     issueInvoice               — draft → issued
 *     recordPayment              — record a full or partial payment
 *     applyAdjustment            — add a signed adjustment to an invoice
 *     voidInvoice                — mark voided (immutable after this)
 *     generateReplacementInvoice — create a new draft referencing a voided invoice
 *     disputeInvoice             — mark disputed
 *     resolveDispute             — disputed → issued
 *
 *   Internal mutations (cron):
 *     generateMonthlyInvoices    — draft all list-bill groups for next calendar month
 *     markOverdueInvoices        — flip past-due issued/partial invoices → overdue
 *
 *   Queries:
 *     getInvoice                 — single invoice with agingBucket
 *     listInvoices               — paginated L1/L2 view
 *     getGroupInvoiceHistory     — last N invoices for a group
 *     getGroupAgingSummary       — aging bucket totals
 *     previewInvoice             — live (non-persisted) breakdown
 *
 * Invariants enforced: LBI-01 through LBI-09 (see spec §16).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import { DISPERSAL } from "../lib/dispersal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RATE_LABEL = "Ideal Oral Health (List Bill)";

// Tier display suffixes
const TIER_SUFFIX: Record<"MO" | "MS" | "MF", string> = {
  MO: "Member Only",
  MS: "Member + Spouse",
  MF: "Member + Family",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceTier = "MO" | "MS" | "MF";

export interface InvoiceLine {
  memberProfileId: Id<"memberProfiles">;
  memberId: string;
  lastName: string;
  firstName: string;
  tier: InvoiceTier;
  dependentCount: number;
  rateCents: number;
  productLabel: string;
}

export interface InvoicePreview {
  source: "preview";
  groupId: Id<"groups">;
  coveragePeriod: string;
  groupName: string;
  groupCode: string;
  organizationCode: string | null;
  accountName: string;
  rateLabel: string;
  moCents: number;
  msCents: number;
  mfCents: number;
  lines: InvoiceLine[];
  memberCount: number;
  moCount: number;
  msCount: number;
  mfCount: number;
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
}

// ---------------------------------------------------------------------------
// Aging helpers
// ---------------------------------------------------------------------------

export type AgingBucket =
  | "current"
  | "1_to_30"
  | "31_to_60"
  | "61_to_90"
  | "91_plus"
  | "paid";

export function computeAgingBucket(
  balanceCents: number,
  paymentDueDateMs: number,
  nowMs = Date.now(),
): AgingBucket {
  if (balanceCents <= 0) return "paid";
  const daysOverdue = Math.floor((nowMs - paymentDueDateMs) / 86_400_000);
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1_to_30";
  if (daysOverdue <= 60) return "31_to_60";
  if (daysOverdue <= 90) return "61_to_90";
  return "91_plus";
}

// ---------------------------------------------------------------------------
// Core computation — tier classification + rate resolution
// ---------------------------------------------------------------------------

function classifyTier(
  deps: Doc<"memberProfiles">[],
): { tier: InvoiceTier; dependentCount: number } {
  const active = deps.filter(
    (d) =>
      (d.memberType === "active" || d.memberType === "enrolling") &&
      d.memberRole === "dependent",
  );
  const count = active.length;
  if (count === 0) return { tier: "MO", dependentCount: 0 };
  if (count >= 2) return { tier: "MF", dependentCount: count };
  const dep = active[0];
  const rel = dep.relationship;
  if (rel === "child") return { tier: "MF", dependentCount: 1 };
  if (rel === "spouse" || rel === "domestic_partner")
    return { tier: "MS", dependentCount: 1 };
  // no relationship set → conservative MO
  return { tier: "MO", dependentCount: 1 };
}

function resolveRates(
  group: Doc<"groups">,
  account: Doc<"accounts">,
): { moCents: number; msCents: number; mfCents: number; rateLabel: string } {
  // Priority 1: group-level custom rates
  const gr = (group.listBill as any)?.rates;
  if (gr?.moCents !== undefined) {
    return {
      moCents: gr.moCents,
      msCents: gr.msCents,
      mfCents: gr.mfCents,
      rateLabel: gr.rateLabel ?? DEFAULT_RATE_LABEL,
    };
  }
  // Priority 2: account custom pricing (first product, monthly card cents)
  const cp = (account as any).customPricing?.[0];
  if (cp?.monthlyCardCents !== undefined) {
    return {
      moCents: cp.monthlyCardCents,
      msCents: cp.monthlyCardCents,
      mfCents: cp.monthlyCardCents,
      rateLabel: DEFAULT_RATE_LABEL,
    };
  }
  // Priority 3: dispersal defaults
  return {
    moCents: DISPERSAL.individual.grossCents,
    msCents: DISPERSAL.family.grossCents,
    mfCents: DISPERSAL.family.grossCents,
    rateLabel: DEFAULT_RATE_LABEL,
  };
}

async function buildInvoiceLines(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  group: Doc<"groups">,
  account: Doc<"accounts">,
): Promise<InvoiceLine[]> {
  const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);

  // All active/enrolling member profiles in the group
  const allMembers = await ctx.db
    .query("memberProfiles")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  const primaries = allMembers.filter(
    (m) =>
      (m.memberType === "active" || m.memberType === "enrolling") &&
      (m.memberRole === "primary" || m.memberRole === undefined || m.memberRole === null),
  );

  const dependentsByPrimary = new Map<string, Doc<"memberProfiles">[]>();
  for (const m of allMembers) {
    if (m.memberRole !== "dependent" || !m.primaryMemberId) continue;
    const key = m.primaryMemberId;
    const list = dependentsByPrimary.get(key) ?? [];
    list.push(m);
    dependentsByPrimary.set(key, list);
  }

  const lines: InvoiceLine[] = [];
  for (const primary of primaries) {
    const deps = dependentsByPrimary.get(primary._id) ?? [];
    const { tier, dependentCount } = classifyTier(deps);
    const rateCents = tier === "MO" ? moCents : tier === "MS" ? msCents : mfCents;
    const productLabel = `${rateLabel} - ${TIER_SUFFIX[tier]}`;
    lines.push({
      memberProfileId: primary._id,
      memberId: primary.memberId,
      lastName: primary.lastName,
      firstName: primary.firstName,
      tier,
      dependentCount,
      rateCents,
      productLabel,
    });
  }

  // Sort: lastName asc, then firstName asc
  lines.sort((a, b) =>
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName),
  );

  return lines;
}

function computeCounts(lines: InvoiceLine[]) {
  let moCount = 0, msCount = 0, mfCount = 0, subtotalCents = 0;
  for (const l of lines) {
    if (l.tier === "MO") moCount++;
    else if (l.tier === "MS") msCount++;
    else mfCount++;
    subtotalCents += l.rateCents;
  }
  return { moCount, msCount, mfCount, subtotalCents };
}

function periodWindow(period: string): {
  coverageStart: number;
  coverageEnd: number;
} {
  const [yStr, mStr] = period.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1-based
  const start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const end = Date.UTC(year, month, 0, 23, 59, 59, 999); // last day of month
  return { coverageStart: start, coverageEnd: end };
}

function nextMonthPeriod(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  const m = d.getUTCMonth() === 11 ? 1 : d.getUTCMonth() + 2;
  return `${y}-${String(m).padStart(2, "0")}`;
}

async function allocateInvoiceNumber(ctx: MutationCtx): Promise<{
  invoiceNumber: number;
  invoiceNumberDisplay: string;
}> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "listBillInvoiceSeq"))
    .first();
  let next: number;
  if (!counter) {
    await ctx.db.insert("counters", { name: "listBillInvoiceSeq", value: 10001 });
    next = 10001;
  } else {
    next = counter.value + 1;
    await ctx.db.patch(counter._id, { value: next });
  }
  return {
    invoiceNumber: next,
    invoiceNumberDisplay: String(next).padStart(5, "0"),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const previewInvoice = query({
  args: { groupId: v.id("groups"), coveragePeriod: v.string() },
  handler: async (ctx, { groupId, coveragePeriod }): Promise<InvoicePreview | null> => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(groupId);
    if (!group) return null;
    const account = await ctx.db.get(group.accountId);
    if (!account) return null;
    const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
    const lines = await buildInvoiceLines(ctx, groupId, group, account);
    const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
    return {
      source: "preview",
      groupId,
      coveragePeriod,
      groupName: group.name,
      groupCode: group.groupCode,
      organizationCode: group.organizationCode ?? null,
      accountName: (account as any).name ?? "",
      rateLabel,
      moCents,
      msCents,
      mfCents,
      lines,
      memberCount: lines.length,
      moCount,
      msCount,
      mfCount,
      subtotalCents,
      adjustmentCents: 0,
      totalCents: subtotalCents,
    };
  },
});

export const getInvoice = query({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }) => {
    await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) return null;
    const aging = computeAgingBucket(inv.balanceCents, inv.paymentDueDate);
    return { ...inv, agingBucket: aging };
  },
});

export const listInvoices = query({
  args: {
    period: v.optional(v.string()),
    status: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    groupId: v.optional(v.id("groups")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { period, status, accountId, groupId, limit }) => {
    await requireAdmin(ctx);
    let rows: Doc<"listBillInvoices">[];
    if (groupId) {
      rows = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .order("desc")
        .collect();
    } else if (period) {
      rows = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_period", (q) => q.eq("coveragePeriod", period))
        .collect();
    } else {
      rows = await ctx.db.query("listBillInvoices").order("desc").collect();
    }

    if (accountId) rows = rows.filter((r) => r.accountId === accountId);
    if (status) rows = rows.filter((r) => r.status === status);
    const now = Date.now();
    const results = rows
      .slice(0, limit ?? 500)
      .map((r) => ({ ...r, agingBucket: computeAgingBucket(r.balanceCents, r.paymentDueDate, now) }));
    return results;
  },
});

export const getGroupInvoiceHistory = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("listBillInvoices")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .collect();
    const now = Date.now();
    return rows.slice(0, limit ?? 24).map((r) => ({
      ...r,
      agingBucket: computeAgingBucket(r.balanceCents, r.paymentDueDate, now),
    }));
  },
});

export const getGroupAgingSummary = query({
  args: { groupId: v.id("groups") },
  handler: async (
    ctx,
    { groupId },
  ): Promise<{
    current: number;
    upTo30Days: number;
    days31To60: number;
    days61To90: number;
    days91Plus: number;
    totalDue: number;
  }> => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("listBillInvoices")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const now = Date.now();
    const summary = {
      current: 0,
      upTo30Days: 0,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
      totalDue: 0,
    };
    for (const r of rows) {
      if (r.balanceCents <= 0 || r.status === "voided") continue;
      const bucket = computeAgingBucket(r.balanceCents, r.paymentDueDate, now);
      if (bucket === "paid") continue;
      summary.totalDue += r.balanceCents;
      if (bucket === "current") summary.current += r.balanceCents;
      else if (bucket === "1_to_30") summary.upTo30Days += r.balanceCents;
      else if (bucket === "31_to_60") summary.days31To60 += r.balanceCents;
      else if (bucket === "61_to_90") summary.days61To90 += r.balanceCents;
      else summary.days91Plus += r.balanceCents;
    }
    return summary;
  },
});

// ---------------------------------------------------------------------------
// Mutations — admin
// ---------------------------------------------------------------------------

export const generateInvoice = mutation({
  args: {
    groupId: v.id("groups"),
    coveragePeriod: v.string(),
    billingDate: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, coveragePeriod, billingDate }) => {
    const actor = await requireAdmin(ctx);

    // Idempotency: return existing draft if already created
    const existing = await ctx.db
      .query("listBillInvoices")
      .withIndex("by_group_period", (q) =>
        q.eq("groupId", groupId).eq("coveragePeriod", coveragePeriod),
      )
      .first();
    if (existing && existing.status !== "voided") {
      return { invoiceId: existing._id, created: false };
    }

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);
    if (!group.listBill?.enabled) throw new Error("Group is not a list-bill group");

    const account = await ctx.db.get(group.accountId);
    if (!account) throw new Error("Account not found");

    const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
    const lines = await buildInvoiceLines(ctx, groupId, group, account);
    const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);

    // LBI-01: verify
    const sumCheck = lines.reduce((s, l) => s + l.rateCents, 0);
    if (sumCheck !== subtotalCents) throw new Error("LBI-01 violated");

    const { coverageStart, coverageEnd } = periodWindow(coveragePeriod);
    const now = Date.now();
    const billing = billingDate ?? now;

    // Payment due date: use group's configured day-of-month, else same as billing
    const dueDayOfMonth = group.listBill?.paymentDueDayOfMonth;
    let paymentDueDate = billing;
    if (dueDayOfMonth) {
      const d = new Date(billing);
      paymentDueDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dueDayOfMonth);
      if (paymentDueDate < billing) {
        // Push to next month if the due day has already passed
        paymentDueDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, dueDayOfMonth);
      }
    }

    const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
    const totalCents = subtotalCents; // no adjustment yet
    const invoiceId = await ctx.db.insert("listBillInvoices", {
      invoiceNumber,
      invoiceNumberDisplay,
      groupId,
      accountId: group.accountId,
      siteId: group.siteId,
      coveragePeriod,
      coverageStart,
      coverageEnd,
      billingDate: billing,
      paymentDueDate,
      groupName: group.name,
      groupCode: group.groupCode,
      organizationCode: group.organizationCode,
      accountName: (account as any).name ?? "",
      billingContactEmail: group.listBill?.employerContactEmail,
      moCents,
      msCents,
      mfCents,
      rateLabel,
      lines,
      memberCount: lines.length,
      moCount,
      msCount,
      mfCount,
      subtotalCents,
      adjustmentCents: 0,
      totalCents,
      amountPaidCents: 0,
      balanceCents: totalCents,
      status: "draft",
      generatedBy: actor.clerkUserId,
      memberProfileIdsSnapshot: lines.map((l) => l.memberProfileId),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.generate",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Generated draft invoice #${invoiceNumberDisplay} for ${group.name} (${coveragePeriod})`,
      metadata: { invoiceNumber, coveragePeriod, memberCount: lines.length, totalCents },
    });

    return { invoiceId, created: true };
  },
});

export const issueInvoice = mutation({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }) => {
    const actor = await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status !== "draft") throw new Error(`Cannot issue invoice in status: ${inv.status}`);
    const now = Date.now();
    await ctx.db.patch(invoiceId, { status: "issued", issuedAt: now, updatedAt: now });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.issue",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Issued invoice #${inv.invoiceNumberDisplay} to ${inv.groupName}`,
    });
  },
});

export const recordPayment = mutation({
  args: {
    invoiceId: v.id("listBillInvoices"),
    amountCents: v.number(),
    paymentMethod: v.union(v.literal("check"), v.literal("ach"), v.literal("wire")),
    checkNumber: v.optional(v.string()),
    achConfirmationNumber: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, { invoiceId, amountCents, paymentMethod, checkNumber, achConfirmationNumber, paidAt }) => {
    const actor = await requireAdmin(ctx);
    if (!Number.isInteger(amountCents) || amountCents <= 0)
      throw new Error("amountCents must be a positive integer");

    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "voided") throw new Error("Cannot record payment on a voided invoice");
    if (inv.status === "paid") throw new Error("Invoice is already fully paid");
    if (inv.status === "draft") throw new Error("Issue the invoice before recording payment");

    const newPaid = inv.amountPaidCents + amountCents;
    if (newPaid > inv.totalCents)
      throw new Error(`Payment of ${amountCents} would exceed invoice total ${inv.totalCents}`);

    const newBalance = inv.totalCents - newPaid;
    const now = Date.now();
    const newStatus = newBalance <= 0 ? "paid" : "partial";

    await ctx.db.patch(invoiceId, {
      amountPaidCents: newPaid,
      balanceCents: newBalance,
      status: newStatus,
      paymentMethod,
      ...(checkNumber ? { checkNumber } : {}),
      ...(achConfirmationNumber ? { achConfirmationNumber } : {}),
      ...(newStatus === "paid" ? { paidAt: paidAt ?? now } : {}),
      updatedAt: now,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.payment",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Recorded ${newStatus === "paid" ? "full" : "partial"} payment of $${(amountCents / 100).toFixed(2)} on invoice #${inv.invoiceNumberDisplay}`,
      metadata: { amountCents, newBalance, paymentMethod },
    });
  },
});

export const applyAdjustment = mutation({
  args: {
    invoiceId: v.id("listBillInvoices"),
    adjustmentCents: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, { invoiceId, adjustmentCents, notes }) => {
    const actor = await requireAdmin(ctx);
    if (!Number.isInteger(adjustmentCents)) throw new Error("adjustmentCents must be an integer");
    if (!notes.trim()) throw new Error("Notes are required for adjustments");

    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "voided") throw new Error("Cannot adjust a voided invoice");
    if (inv.status === "paid") throw new Error("Cannot adjust a fully paid invoice");

    const newAdjustment = inv.adjustmentCents + adjustmentCents;
    const newTotal = inv.subtotalCents + newAdjustment;
    if (newTotal < 0) throw new Error("Adjustment would make invoice total negative");
    const newBalance = newTotal - inv.amountPaidCents;
    const now = Date.now();

    await ctx.db.patch(invoiceId, {
      adjustmentCents: newAdjustment,
      adjustmentNotes: notes.trim(),
      totalCents: newTotal,
      balanceCents: newBalance,
      // re-check status
      status: newBalance <= 0 ? "paid" : inv.status === "draft" ? "draft" : inv.status,
      updatedAt: now,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.adjustment",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Applied adjustment of ${adjustmentCents > 0 ? "+" : ""}$${(adjustmentCents / 100).toFixed(2)} to invoice #${inv.invoiceNumberDisplay}`,
      metadata: { adjustmentCents, newTotal, notes },
    });
  },
});

export const voidInvoice = mutation({
  args: {
    invoiceId: v.id("listBillInvoices"),
    reason: v.string(),
  },
  handler: async (ctx, { invoiceId, reason }) => {
    const actor = await requireAdmin(ctx);
    if (!reason.trim()) throw new Error("Void reason is required");
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "voided") throw new Error("Invoice is already voided");
    // LBI-05: once voided, immutable
    const now = Date.now();
    await ctx.db.patch(invoiceId, {
      status: "voided",
      voidedAt: now,
      voidedBy: actor.clerkUserId,
      voidReason: reason.trim(),
      updatedAt: now,
    });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.void",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Voided invoice #${inv.invoiceNumberDisplay}: ${reason}`,
    });
  },
});

export const generateReplacementInvoice = mutation({
  args: {
    voidedInvoiceId: v.id("listBillInvoices"),
    coveragePeriod: v.optional(v.string()),
  },
  handler: async (ctx, { voidedInvoiceId, coveragePeriod }) => {
    const actor = await requireAdmin(ctx);
    const voided = await ctx.db.get(voidedInvoiceId);
    if (!voided) throw new Error("Voided invoice not found");
    if (voided.status !== "voided") throw new Error("Source invoice is not voided");

    const period = coveragePeriod ?? voided.coveragePeriod;
    const group = await ctx.db.get(voided.groupId);
    if (!group) throw new Error("Group not found");
    const account = await ctx.db.get(group.accountId);
    if (!account) throw new Error("Account not found");

    const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
    const lines = await buildInvoiceLines(ctx, voided.groupId, group, account);
    const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
    const { coverageStart, coverageEnd } = periodWindow(period);
    const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
    const now = Date.now();

    const replacementId = await ctx.db.insert("listBillInvoices", {
      invoiceNumber,
      invoiceNumberDisplay,
      groupId: voided.groupId,
      accountId: voided.accountId,
      siteId: voided.siteId,
      coveragePeriod: period,
      coverageStart,
      coverageEnd,
      billingDate: now,
      paymentDueDate: voided.paymentDueDate,
      groupName: group.name,
      groupCode: group.groupCode,
      organizationCode: group.organizationCode,
      accountName: (account as any).name ?? "",
      billingContactEmail: group.listBill?.employerContactEmail,
      moCents,
      msCents,
      mfCents,
      rateLabel,
      lines,
      memberCount: lines.length,
      moCount,
      msCount,
      mfCount,
      subtotalCents,
      adjustmentCents: 0,
      totalCents: subtotalCents,
      amountPaidCents: 0,
      balanceCents: subtotalCents,
      status: "draft",
      generatedBy: actor.clerkUserId,
      memberProfileIdsSnapshot: lines.map((l) => l.memberProfileId),
      createdAt: now,
      updatedAt: now,
    });

    // Link the voided invoice to its replacement
    await ctx.db.patch(voidedInvoiceId, { supersededById: replacementId, updatedAt: now });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.replace",
      targetType: "listBillInvoices",
      targetId: replacementId,
      summary: `Created replacement invoice #${invoiceNumberDisplay} (replaces #${voided.invoiceNumberDisplay}) for ${group.name}`,
    });

    return { invoiceId: replacementId, created: true };
  },
});

export const disputeInvoice = mutation({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }) => {
    const actor = await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    const allowed: string[] = ["issued", "partial", "overdue"];
    if (!allowed.includes(inv.status))
      throw new Error(`Cannot dispute invoice in status: ${inv.status}`);
    await ctx.db.patch(invoiceId, { status: "disputed", updatedAt: Date.now() });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.dispute",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Marked invoice #${inv.invoiceNumberDisplay} as disputed`,
    });
  },
});

export const resolveDispute = mutation({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }) => {
    const actor = await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status !== "disputed") throw new Error("Invoice is not disputed");
    await ctx.db.patch(invoiceId, { status: "issued", updatedAt: Date.now() });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.resolve_dispute",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Resolved dispute on invoice #${inv.invoiceNumberDisplay}`,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations — cron
// ---------------------------------------------------------------------------

export const generateMonthlyInvoices = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ generated: number; skipped: number }> => {
    const period = nextMonthPeriod();
    const allGroups = await ctx.db.query("groups").collect();
    const listBillGroups = allGroups.filter((g) => g.listBill?.enabled === true && g.status === "active");

    let generated = 0, skipped = 0;
    for (const group of listBillGroups) {
      // idempotency: skip if a non-voided invoice already exists
      const exists = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_group_period", (q) =>
          q.eq("groupId", group._id).eq("coveragePeriod", period),
        )
        .first();
      if (exists && exists.status !== "voided") { skipped++; continue; }

      const account = await ctx.db.get(group.accountId);
      if (!account) { skipped++; continue; }

      const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
      const lines = await buildInvoiceLines(ctx, group._id, group, account);
      const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
      const { coverageStart, coverageEnd } = periodWindow(period);
      const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
      const now = Date.now();

      await ctx.db.insert("listBillInvoices", {
        invoiceNumber,
        invoiceNumberDisplay,
        groupId: group._id,
        accountId: group.accountId,
        siteId: group.siteId,
        coveragePeriod: period,
        coverageStart,
        coverageEnd,
        billingDate: now,
        paymentDueDate: coverageStart,
        groupName: group.name,
        groupCode: group.groupCode,
        organizationCode: group.organizationCode,
        accountName: (account as any).name ?? "",
        billingContactEmail: group.listBill?.employerContactEmail,
        moCents,
        msCents,
        mfCents,
        rateLabel,
        lines,
        memberCount: lines.length,
        moCount,
        msCount,
        mfCount,
        subtotalCents,
        adjustmentCents: 0,
        totalCents: subtotalCents,
        amountPaidCents: 0,
        balanceCents: subtotalCents,
        status: "draft",
        generatedBy: "cron",
        memberProfileIdsSnapshot: lines.map((l) => l.memberProfileId),
        createdAt: now,
        updatedAt: now,
      });
      generated++;
    }
    return { generated, skipped };
  },
});

export const markOverdueInvoices = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ marked: number }> => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("listBillInvoices")
      .withIndex("by_due_date", (q) => q.lt("paymentDueDate", now))
      .collect();
    let marked = 0;
    for (const inv of candidates) {
      if (inv.status === "issued" || inv.status === "partial") {
        await ctx.db.patch(inv._id, { status: "overdue", updatedAt: now });
        marked++;
      }
    }
    return { marked };
  },
});

// ---------------------------------------------------------------------------
// Admin-triggered bulk generation (public wrapper for the cron logic)
// ---------------------------------------------------------------------------

export const triggerMonthlyGeneration = mutation({
  args: {},
  handler: async (ctx): Promise<{ generated: number; skipped: number }> => {
    await requireAdmin(ctx);
    const period = nextMonthPeriod();
    const allGroups = await ctx.db.query("groups").collect();
    const listBillGroups = allGroups.filter((g) => g.listBill?.enabled === true && g.status === "active");

    let generated = 0, skipped = 0;
    for (const group of listBillGroups) {
      const exists = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_group_period", (q) =>
          q.eq("groupId", group._id).eq("coveragePeriod", period),
        )
        .first();
      if (exists && exists.status !== "voided") { skipped++; continue; }

      const account = await ctx.db.get(group.accountId);
      if (!account) { skipped++; continue; }

      const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
      const lines = await buildInvoiceLines(ctx, group._id, group, account);
      const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
      const { coverageStart, coverageEnd } = periodWindow(period);
      const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
      const now = Date.now();

      await ctx.db.insert("listBillInvoices", {
        invoiceNumber,
        invoiceNumberDisplay,
        groupId: group._id,
        accountId: group.accountId,
        siteId: group.siteId,
        coveragePeriod: period,
        coverageStart,
        coverageEnd,
        billingDate: now,
        paymentDueDate: coverageStart,
        groupName: group.name,
        groupCode: group.groupCode,
        organizationCode: group.organizationCode,
        accountName: (account as any).name ?? "",
        billingContactEmail: group.listBill?.employerContactEmail,
        moCents,
        msCents,
        mfCents,
        rateLabel,
        lines,
        memberCount: lines.length,
        moCount,
        msCount,
        mfCount,
        subtotalCents,
        adjustmentCents: 0,
        totalCents: subtotalCents,
        amountPaidCents: 0,
        balanceCents: subtotalCents,
        status: "draft",
        generatedBy: "admin",
        memberProfileIdsSnapshot: lines.map((l) => l.memberProfileId),
        createdAt: now,
        updatedAt: now,
      });
      generated++;
    }
    return { generated, skipped };
  },
});
