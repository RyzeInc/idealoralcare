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
 *     unvoidInvoice               — restore a voided invoice to its pre-void status
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
  internalQuery,
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

const DEFAULT_RATE_LABEL = "Ideal Oral Health";

// Member lifecycle states that should be billed on a list-bill invoice.
// Includes "eligible" (not just "active"/"enrolling") because members loaded
// from an employer eligibility file who lack an email address can never be
// portal-provisioned (see convex/admin/eligibilityProvisioning.ts, which
// requires an email to create the Clerk account and flip memberType to
// "active"/"enrolling"). Employer coverage — and the obligation to bill for
// it — starts at eligibility-file ingest, not at portal signup, so those
// members must stay billable indefinitely in "eligible" status.
const BILLABLE_MEMBER_TYPES = new Set(["active", "enrolling", "eligible"]);

/**
 * True if a member's coverage effective date (if any) has begun on or before
 * the end of the invoice's coverage period. Members added mid-cycle with a
 * future effective date (e.g. effective 2026-08-01 while billing the
 * 2026-07 period) must NOT be charged for a period before their coverage
 * starts — even though they're otherwise a billable memberType (e.g.
 * "eligible" members provisioned retroactively, see BILLABLE_MEMBER_TYPES).
 * A missing or unparseable effectiveDate does not exclude the member
 * (fail-open: many historical/legacy records have no effectiveDate set).
 */
function isEffectiveForPeriod(effectiveDate: string | undefined, coverageEnd: number): boolean {
  if (!effectiveDate) return true;
  const ms = Date.parse(effectiveDate);
  if (Number.isNaN(ms)) return true;
  return ms <= coverageEnd;
}

/**
 * True if this memberProfile record already existed in our system by the end
 * of the invoice's coverage period. This guards against regenerating or
 * refreshing a PAST period's invoice today and having it "see" members who
 * were only added to Ideal via a later eligibility file — even when their
 * `effectiveDate` reflects an earlier real-world hire/coverage date at the
 * employer. Without this, re-running/refreshing e.g. the May invoice in July
 * would pull in everyone added since (via June/July census files), making a
 * "May" invoice look identical to "July". `createdAt` is set once at insert
 * and never changed by later re-uploads/updates, so it's a stable proxy for
 * "when did Ideal first know this person existed."
 */
function existedByPeriodEnd(createdAt: number, coverageEnd: number): boolean {
  return createdAt <= coverageEnd;
}

// Tier display suffixes
const TIER_SUFFIX: Record<"MO" | "MS" | "MF", string> = {
  MO: "Member Only",
  MS: "Member + Spouse",
  MF: "Member + Family",
};

// ---------------------------------------------------------------------------
// Invoice column configuration
// ---------------------------------------------------------------------------

export interface InvoiceColumn {
  key: string;
  label: string;
  enabled: boolean;
  sensitive?: boolean;
}

/**
 * Master registry of every parameter that can appear on a list-bill invoice
 * (printed table + CSV export). This is the source of truth for which keys are
 * valid; the per-group `listBill.invoiceColumns` config selects/labels/reorders
 * a subset. `defaultEnabled` defines the out-of-the-box column set for groups
 * that have not customized their invoice.
 */
export const INVOICE_COLUMN_REGISTRY: Array<{
  key: string;
  label: string;
  defaultEnabled: boolean;
  sensitive?: boolean;
}> = [
  { key: "memberId", label: "Member ID", defaultEnabled: true },
  { key: "groupMemberId", label: "Employee #", defaultEnabled: false },
  { key: "lastName", label: "Last Name", defaultEnabled: true },
  { key: "firstName", label: "First Name", defaultEnabled: true },
  { key: "employeeName", label: "Employee Name (Last, First)", defaultEnabled: false },
  { key: "ssn", label: "Employee SSN", defaultEnabled: false, sensitive: true },
  { key: "companyName", label: "Company Name", defaultEnabled: false },
  { key: "invoiceNumber", label: "Invoice #", defaultEnabled: false },
  { key: "coveragePeriod", label: "Coverage Period", defaultEnabled: false },
  { key: "location", label: "Location", defaultEnabled: false },
  { key: "department", label: "Department", defaultEnabled: false },
  { key: "tier", label: "Tier", defaultEnabled: true },
  { key: "tierCode", label: "Plan / Tier Code", defaultEnabled: false },
  { key: "dependentCount", label: "Dependents", defaultEnabled: true },
  { key: "effectiveDate", label: "Effective Date", defaultEnabled: false },
  { key: "rate", label: "Monthly Premium", defaultEnabled: true },
];

/** Build the default column config from the registry. */
export function defaultInvoiceColumns(): InvoiceColumn[] {
  return INVOICE_COLUMN_REGISTRY.map((c) => ({
    key: c.key,
    label: c.label,
    enabled: c.defaultEnabled,
    sensitive: c.sensitive,
  }));
}

/**
 * Resolve the effective invoice column config for a group: the stored
 * per-group config when present, otherwise the registry defaults. Stored
 * columns are validated against the registry (unknown keys dropped) and any
 * new registry columns are appended as disabled so configs stay forward-compatible.
 */
export function resolveInvoiceColumns(
  stored: InvoiceColumn[] | undefined | null,
): InvoiceColumn[] {
  if (!stored || stored.length === 0) return defaultInvoiceColumns();
  const known = new Set(INVOICE_COLUMN_REGISTRY.map((c) => c.key));
  const result = stored.filter((c) => known.has(c.key));
  const present = new Set(result.map((c) => c.key));
  for (const c of INVOICE_COLUMN_REGISTRY) {
    if (!present.has(c.key)) {
      result.push({ key: c.key, label: c.label, enabled: false, sensitive: c.sensitive });
    }
  }
  return result;
}


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
  // Enriched audit fields (populated from memberProfile at generation time)
  ssn?: string;
  location?: string;
  department?: string;
  effectiveDate?: string;
  groupMemberId?: string;
  monthlyPremiumCents?: number;
  tierCode?: string;
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
      BILLABLE_MEMBER_TYPES.has(d.memberType) &&
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
  coverageEnd: number,
): Promise<InvoiceLine[]> {
  const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);

  // All active/enrolling member profiles in the group
  const allMembers = await ctx.db
    .query("memberProfiles")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  const primaries = allMembers.filter(
    (m) =>
      BILLABLE_MEMBER_TYPES.has(m.memberType) &&
      // Exclude members who have converted to self-pay or were termed from payroll deduction.
      // `undefined` means eligibility-loaded and still employer-covered.
      (!m.listBillStatus || m.listBillStatus === "active") &&
      (m.memberRole === "primary" || m.memberRole === undefined || m.memberRole === null) &&
      // Don't bill for coverage that hasn't started yet (e.g. member added
      // mid-cycle with a next-month effective date).
      isEffectiveForPeriod(m.effectiveDate, coverageEnd) &&
      // Don't bill a past period for someone Ideal didn't even know about yet
      // (added to our system via a later eligibility file).
      existedByPeriodEnd(m.createdAt, coverageEnd),
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
    const deps = (dependentsByPrimary.get(primary._id) ?? []).filter(
      (d) => isEffectiveForPeriod(d.effectiveDate, coverageEnd) && existedByPeriodEnd(d.createdAt, coverageEnd),
    );
    const { tier, dependentCount } = classifyTier(deps);
    // Per-member premium captured from the eligibility file (e.g. Soar "Approved
    // EE Cost") is authoritative when present; otherwise fall back to the
    // tier-resolved contracted rate.
    const memberPremium = (primary as any).monthlyPremiumCents;
    const tierRate = tier === "MO" ? moCents : tier === "MS" ? msCents : mfCents;
    const rateCents = typeof memberPremium === "number" && memberPremium >= 0 ? memberPremium : tierRate;
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
      ssn: (primary as any).ssn ?? undefined,
      location: (primary as any).location ?? undefined,
      department: (primary as any).department ?? undefined,
      effectiveDate: primary.effectiveDate ?? undefined,
      groupMemberId: primary.groupMemberId ?? undefined,
      monthlyPremiumCents: typeof memberPremium === "number" ? memberPremium : undefined,
      tierCode: (primary as any).tierCode ?? undefined,
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
    const { coverageEnd } = periodWindow(coveragePeriod);
    const lines = await buildInvoiceLines(ctx, groupId, group, account, coverageEnd);
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
  args: { groupId: v.id("groups"), asOfDate: v.optional(v.number()) },
  handler: async (
    ctx,
    { groupId, asOfDate },
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
    const now = asOfDate ?? Date.now();
    const summary = {
      current: 0,
      upTo30Days: 0,
      days31To60: 0,
      days61To90: 0,
      days91Plus: 0,
      totalDue: 0,
    };
    for (const r of rows) {
      // A statement generated "as of" a given date (e.g. embedded in a
      // specific invoice's PDF) must never show invoices that didn't exist
      // yet at that point — otherwise reprinting an old invoice later would
      // leak in later periods' balances (e.g. a May invoice regenerated in
      // July showing July's invoice too). Live/dashboard callers omit
      // asOfDate and see everything up to now, as before.
      if (asOfDate !== undefined && r.billingDate > asOfDate) continue;
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
// Invoice column config — admin
// ---------------------------------------------------------------------------

export const getInvoiceColumns = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }): Promise<InvoiceColumn[]> => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(groupId);
    const stored = (group?.listBill as any)?.invoiceColumns as InvoiceColumn[] | undefined;
    return resolveInvoiceColumns(stored);
  },
});

export const updateInvoiceColumns = mutation({
  args: {
    groupId: v.id("groups"),
    columns: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        enabled: v.boolean(),
        sensitive: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { groupId, columns }) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    // Validate against the registry — drop unknown keys, enforce known sensitivity.
    const registry = new Map(INVOICE_COLUMN_REGISTRY.map((c) => [c.key, c]));
    const cleaned = columns
      .filter((c) => registry.has(c.key))
      .map((c) => ({
        key: c.key,
        label: c.label.trim() || registry.get(c.key)!.label,
        enabled: c.enabled,
        sensitive: registry.get(c.key)!.sensitive,
      }));
    if (cleaned.length === 0) throw new Error("At least one valid column is required");

    const existingListBill = (group.listBill as any) ?? {
      enabled: false,
      paymentMethod: "check" as const,
    };
    await ctx.db.patch(groupId, {
      listBill: { ...existingListBill, invoiceColumns: cleaned },
      updatedAt: Date.now(),
    });
    return resolveInvoiceColumns(cleaned);
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
    paymentDueDate: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, coveragePeriod, billingDate, paymentDueDate: paymentDueDateOverride }) => {
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
    const { coverageStart, coverageEnd } = periodWindow(coveragePeriod);
    const lines = await buildInvoiceLines(ctx, groupId, group, account, coverageEnd);
    const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);

    // LBI-01: verify
    const sumCheck = lines.reduce((s, l) => s + l.rateCents, 0);
    if (sumCheck !== subtotalCents) throw new Error("LBI-01 violated");

    const now = Date.now();
    const billing = billingDate ?? now;

    // Payment due date priority: (1) explicit override from wizard, (2) group's configured
    // day-of-month, (3) Net 30 from billing date.
    let paymentDueDate: number;
    if (paymentDueDateOverride != null) {
      paymentDueDate = paymentDueDateOverride;
    } else {
      const dueDayOfMonth = group.listBill?.paymentDueDayOfMonth;
      if (dueDayOfMonth) {
        const d = new Date(billing);
        paymentDueDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dueDayOfMonth);
        if (paymentDueDate < billing) {
          paymentDueDate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, dueDayOfMonth);
        }
      } else {
        // Default: Net 30
        paymentDueDate = billing + 30 * 86_400_000;
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

/**
 * Patch non-financial metadata on an invoice.
 * Editable: billingDate, paymentDueDate, billingContactName,
 *           billingContactEmail, internalMemo.
 * Each change is recorded to the admin audit log.
 */
export const patchInvoiceMeta = mutation({
  args: {
    invoiceId: v.id("listBillInvoices"),
    billingDate: v.optional(v.number()),
    paymentDueDate: v.optional(v.number()),
    billingContactName: v.optional(v.string()),
    billingContactEmail: v.optional(v.string()),
    internalMemo: v.optional(v.string()),
  },
  handler: async (ctx, { invoiceId, ...updates }) => {
    const actor = await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "voided") throw new Error("Cannot edit a voided invoice");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];

    if (updates.billingDate != null && updates.billingDate !== inv.billingDate) {
      patch.billingDate = updates.billingDate;
      changes.push(`Billing date → ${new Date(updates.billingDate).toISOString().slice(0, 10)}`);
    }
    if (updates.paymentDueDate != null && updates.paymentDueDate !== inv.paymentDueDate) {
      patch.paymentDueDate = updates.paymentDueDate;
      changes.push(`Due date → ${new Date(updates.paymentDueDate).toISOString().slice(0, 10)}`);
    }
    if (updates.billingContactName !== undefined && updates.billingContactName !== inv.billingContactName) {
      patch.billingContactName = updates.billingContactName || undefined;
      changes.push(`Contact name → "${updates.billingContactName}"`);
    }
    if (updates.billingContactEmail !== undefined && updates.billingContactEmail !== inv.billingContactEmail) {
      patch.billingContactEmail = updates.billingContactEmail || undefined;
      changes.push(`Contact email → "${updates.billingContactEmail}"`);
    }
    if (updates.internalMemo !== undefined && updates.internalMemo !== (inv as any).internalMemo) {
      patch.internalMemo = updates.internalMemo || undefined;
      changes.push(`Internal memo updated`);
    }

    if (changes.length === 0) return; // no-op

    await ctx.db.patch(invoiceId, patch as any);

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.edit",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Edited invoice #${inv.invoiceNumberDisplay}: ${changes.join("; ")}`,
      metadata: { changes, invoiceId },
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
    // LBI-05: once voided, immutable (until explicitly un-voided)
    const now = Date.now();
    await ctx.db.patch(invoiceId, {
      status: "voided",
      previousStatus: inv.status,
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

export const unvoidInvoice = mutation({
  args: {
    invoiceId: v.id("listBillInvoices"),
  },
  handler: async (ctx, { invoiceId }) => {
    const actor = await requireAdmin(ctx);
    const inv = await ctx.db.get(invoiceId);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status !== "voided") throw new Error("Invoice is not voided");
    // Refuse to resurrect an invoice that has already been replaced — the
    // replacement invoice is the active record for this group × period, and
    // un-voiding this one would create a duplicate bill.
    if (inv.supersededById) {
      const replacement = await ctx.db.get(inv.supersededById);
      throw new Error(
        `Cannot un-void: this invoice was superseded by replacement invoice ` +
        `#${replacement?.invoiceNumberDisplay ?? inv.supersededById}. Void the replacement first if needed.`,
      );
    }

    const now = Date.now();
    // Re-derive the restored status rather than blindly trusting the stored
    // previousStatus, in case the due date has since passed (issued/partial → overdue).
    let restoredStatus: Doc<"listBillInvoices">["status"] = inv.previousStatus ?? "issued";
    if ((restoredStatus === "issued" || restoredStatus === "partial") && inv.paymentDueDate < now) {
      restoredStatus = "overdue";
    }
    if (inv.balanceCents <= 0 && restoredStatus !== "draft") {
      restoredStatus = "paid";
    }

    await ctx.db.patch(invoiceId, {
      status: restoredStatus,
      previousStatus: undefined,
      unvoidedAt: now,
      unvoidedBy: actor.clerkUserId,
      updatedAt: now,
    });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: actor.clerkUserId,
      action: "list_bill_invoice.unvoid",
      targetType: "listBillInvoices",
      targetId: invoiceId,
      summary: `Un-voided invoice #${inv.invoiceNumberDisplay} (restored to "${restoredStatus}")`,
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
    const { coverageStart, coverageEnd } = periodWindow(period);
    const lines = await buildInvoiceLines(ctx, voided.groupId, group, account, coverageEnd);
    const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
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
    const { coverageStart: periodCoverageStart, coverageEnd: periodCoverageEnd } = periodWindow(period);
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
      const lines = await buildInvoiceLines(ctx, group._id, group, account, periodCoverageEnd);
      const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
      const coverageStart = periodCoverageStart;
      const coverageEnd = periodCoverageEnd;
      const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
      const now = Date.now();

      const invoiceId = await ctx.db.insert("listBillInvoices", {
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

      // Auto-issue if the group has autoIssue enabled.
      if (group.listBill?.autoIssue === true) {
        await ctx.db.patch(invoiceId, { status: "issued", issuedAt: now, updatedAt: now });
      }

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
    const { coverageStart: periodCoverageStart, coverageEnd: periodCoverageEnd } = periodWindow(period);
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
      const lines = await buildInvoiceLines(ctx, group._id, group, account, periodCoverageEnd);
      const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);
      const coverageStart = periodCoverageStart;
      const coverageEnd = periodCoverageEnd;
      const { invoiceNumber, invoiceNumberDisplay } = await allocateInvoiceNumber(ctx);
      const now = Date.now();

      const invoiceId2 = await ctx.db.insert("listBillInvoices", {
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

      // Auto-issue if the group has autoIssue enabled.
      if (group.listBill?.autoIssue === true) {
        await ctx.db.patch(invoiceId2, { status: "issued", issuedAt: now, updatedAt: now });
      }

      generated++;
    }
    return { generated, skipped };
  },
});

// ---------------------------------------------------------------------------
// refreshInvoiceLines — rebuild lines on an open invoice to reflect current
//   membership (useful when new members join, or a data-fix like the
//   no-email eligibility duplicate-match bug retroactively makes someone
//   billable, after the invoice was already created).
//   Allowed on draft/issued/overdue invoices with no payment recorded yet.
//   Refused once any payment has posted (partial/paid) or the invoice is
//   voided/disputed — those require applyAdjustment or a void/replacement
//   instead, to avoid silently changing a total after money has moved.
// ---------------------------------------------------------------------------
const REFRESHABLE_STATUSES = new Set(["draft", "issued", "overdue"]);

async function performRefreshInvoiceLines(
  ctx: MutationCtx,
  invoiceId: Id<"listBillInvoices">,
  actorClerkUserId: string,
): Promise<void> {
  const inv = await ctx.db.get(invoiceId);
  if (!inv) throw new Error("Invoice not found.");
  if (!REFRESHABLE_STATUSES.has(inv.status)) {
    throw new Error(
      `Cannot refresh lines on a ${inv.status} invoice. Only draft, issued, or overdue invoices can be refreshed.`,
    );
  }
  if (inv.amountPaidCents > 0) {
    throw new Error(
      "Cannot refresh lines on an invoice with a recorded payment. Use an adjustment instead.",
    );
  }

  const group = await ctx.db.get(inv.groupId);
  if (!group) throw new Error("Group not found.");
  const account = await ctx.db.get(group.accountId);
  if (!account) throw new Error("Account not found.");

  const { moCents, msCents, mfCents, rateLabel } = resolveRates(group, account);
  const lines = await buildInvoiceLines(ctx, inv.groupId, group, account, inv.coverageEnd);
  const { moCount, msCount, mfCount, subtotalCents } = computeCounts(lines);

  await ctx.db.patch(invoiceId, {
    lines,
    memberCount: lines.length,
    moCount,
    msCount,
    mfCount,
    subtotalCents,
    adjustmentCents: inv.adjustmentCents,
    totalCents: subtotalCents + (inv.adjustmentCents ?? 0),
    balanceCents: subtotalCents + (inv.adjustmentCents ?? 0) - inv.amountPaidCents,
    moCents,
    msCents,
    mfCents,
    rateLabel,
    memberProfileIdsSnapshot: lines.map((l) => l.memberProfileId),
    updatedAt: Date.now(),
  });

  const wasNonDraft = inv.status !== "draft";
  await ctx.runMutation(internal.admin.adminAudit.record, {
    actorClerkUserId,
    action: "list_bill_invoice.refresh_lines",
    targetType: "listBillInvoice",
    targetId: invoiceId,
    summary: wasNonDraft
      ? `Refreshed lines on ${inv.status} invoice #${inv.invoiceNumberDisplay} (retroactive correction): ${inv.memberCount} → ${lines.length} members, subtotal ${inv.subtotalCents}¢ → ${subtotalCents}¢`
      : `Refreshed lines on invoice #${inv.invoiceNumberDisplay}: ${inv.memberCount} → ${lines.length} members`,
    metadata: {
      invoiceNumber: inv.invoiceNumberDisplay,
      previousStatus: inv.status,
      previousMemberCount: inv.memberCount,
      newMemberCount: lines.length,
      previousSubtotalCents: inv.subtotalCents,
      newSubtotalCents: subtotalCents,
    },
  });
}

export const refreshInvoiceLines = mutation({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }): Promise<void> => {
    const actor = await requireAdmin(ctx);
    await performRefreshInvoiceLines(ctx, invoiceId, actor.clerkUserId);
  },
});

// ---------------------------------------------------------------------------
// _migrationRefreshInvoiceLines — internal-only variant of refreshInvoiceLines
//   for one-off data-remediation scripts run via `npx convex run --prod`
//   (no client-reachable auth context to satisfy requireAdmin). Uses the
//   exact same guarded logic/audit trail as the public mutation above, just
//   with a fixed "system:data-migration" actor for a transparent audit trail.
// ---------------------------------------------------------------------------
export const _migrationRefreshInvoiceLines = internalMutation({
  args: { invoiceId: v.id("listBillInvoices") },
  handler: async (ctx, { invoiceId }): Promise<void> => {
    await performRefreshInvoiceLines(ctx, invoiceId, "system:data-migration");
  },
});

// ---------------------------------------------------------------------------
// _migrationRefreshAllEligibleInvoices — one-off bulk pass (2026-07-01) to
//   retroactively apply the newly-added §2.3 system-entry gating (and any
//   other membership changes since generation) to every already-existing
//   invoice across all groups. Only touches invoices that are safely
//   refreshable — draft/issued/overdue with no payment recorded — the exact
//   same guard as the public refreshInvoiceLines mutation. Never touches
//   paid/partial/voided/disputed invoices.
// ---------------------------------------------------------------------------
export const _migrationRefreshAllEligibleInvoices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("listBillInvoices").collect();
    const eligible = all.filter(
      (inv) => REFRESHABLE_STATUSES.has(inv.status) && inv.amountPaidCents === 0,
    );

    const results: Array<{
      invoiceId: string;
      groupName: string;
      coveragePeriod: string;
      invoiceNumberDisplay: string;
      status: string;
      previousMemberCount: number;
      newMemberCount: number;
      previousSubtotalCents: number;
      newSubtotalCents: number;
      ok: boolean;
      error?: string;
    }> = [];

    for (const inv of eligible) {
      try {
        await performRefreshInvoiceLines(ctx, inv._id, "system:data-migration");
        const after = await ctx.db.get(inv._id);
        results.push({
          invoiceId: inv._id,
          groupName: inv.groupName,
          coveragePeriod: inv.coveragePeriod,
          invoiceNumberDisplay: inv.invoiceNumberDisplay,
          status: inv.status,
          previousMemberCount: inv.memberCount,
          newMemberCount: after?.memberCount ?? inv.memberCount,
          previousSubtotalCents: inv.subtotalCents,
          newSubtotalCents: after?.subtotalCents ?? inv.subtotalCents,
          ok: true,
        });
      } catch (e: any) {
        results.push({
          invoiceId: inv._id,
          groupName: inv.groupName,
          coveragePeriod: inv.coveragePeriod,
          invoiceNumberDisplay: inv.invoiceNumberDisplay,
          status: inv.status,
          previousMemberCount: inv.memberCount,
          newMemberCount: inv.memberCount,
          previousSubtotalCents: inv.subtotalCents,
          newSubtotalCents: inv.subtotalCents,
          ok: false,
          error: e?.message ?? String(e),
        });
      }
    }

    const changed = results.filter(
      (r) => r.ok && (r.previousMemberCount !== r.newMemberCount || r.previousSubtotalCents !== r.newSubtotalCents),
    );

    return {
      totalInvoices: all.length,
      totalEligible: eligible.length,
      totalChanged: changed.length,
      results,
    };
  },
});

/**
 * DIAGNOSTIC (read-only): compare every invoice's stored subtotal/memberCount
 * to what buildInvoiceLines would compute *right now* for that invoice's own
 * groupId + coveragePeriod — regardless of status. Unlike
 * _migrationRefreshAllEligibleInvoices (which only touches draft/issued/
 * overdue invoices with zero payment, by design), this reports drift on
 * EVERY invoice, including partial/paid/voided ones that are intentionally
 * never auto-refreshed once money has moved. Used to find invoices whose
 * stale, pre-existedByPeriodEnd-gate line items are still baked into a
 * balance that feeds the group's aging table / Invoice History PDF section.
 */
export const _debugCompareAllInvoicesToLivePreview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("listBillInvoices").collect();
    const results: Array<{
      invoiceId: string;
      groupName: string;
      coveragePeriod: string;
      invoiceNumberDisplay: string;
      status: string;
      amountPaidCents: number;
      balanceCents: number;
      storedMemberCount: number;
      liveMemberCount: number;
      storedSubtotalCents: number;
      liveSubtotalCents: number;
      drifted: boolean;
    }> = [];

    for (const inv of all) {
      const group = await ctx.db.get(inv.groupId);
      if (!group) continue;
      const account = await ctx.db.get(inv.accountId);
      if (!account) continue;
      const { coverageEnd } = periodWindow(inv.coveragePeriod);
      const lines = await buildInvoiceLines(ctx, inv.groupId, group, account, coverageEnd);
      const { subtotalCents: liveSubtotalCents } = computeCounts(lines);
      const liveMemberCount = lines.length;
      const drifted = liveMemberCount !== inv.memberCount || liveSubtotalCents !== inv.subtotalCents;

      results.push({
        invoiceId: inv._id,
        groupName: inv.groupName,
        coveragePeriod: inv.coveragePeriod,
        invoiceNumberDisplay: inv.invoiceNumberDisplay,
        status: inv.status,
        amountPaidCents: inv.amountPaidCents,
        balanceCents: inv.balanceCents,
        storedMemberCount: inv.memberCount,
        liveMemberCount,
        storedSubtotalCents: inv.subtotalCents,
        liveSubtotalCents,
        drifted,
      });
    }

    const drifted = results.filter((r) => r.drifted);
    return { totalInvoices: results.length, totalDrifted: drifted.length, results };
  },
});

/**
 * DIAGNOSTIC (read-only): for every invoice, compute the "Invoice History"
 * aging Total Due the OLD way (live, aged against now, all non-voided group
 * invoices) vs the NEW way (as of that invoice's own billingDate, excluding
 * invoices billed later). Proves the PDF fix actually separates periods on
 * real data — if oldTotalDue > newTotalDue for a past-period invoice, that's
 * exactly the "May PDF showing July" leak, now closed.
 */
export const _debugCompareAgingAsOf = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("listBillInvoices").collect();

    const sumAging = (
      rows: Doc<"listBillInvoices">[],
      asOfDate: number | undefined,
      now: number,
    ) => {
      let totalDue = 0;
      const includedPeriods: string[] = [];
      for (const r of rows) {
        if (asOfDate !== undefined && r.billingDate > asOfDate) continue;
        if (r.balanceCents <= 0 || r.status === "voided") continue;
        const bucket = computeAgingBucket(r.balanceCents, r.paymentDueDate, asOfDate ?? now);
        if (bucket === "paid") continue;
        totalDue += r.balanceCents;
        includedPeriods.push(r.coveragePeriod);
      }
      return { totalDue, includedPeriods };
    };

    const now = Date.now();
    const results = [];
    for (const inv of all) {
      const groupRows = all.filter((r) => r.groupId === inv.groupId);
      const live = sumAging(groupRows, undefined, now);
      const asOf = sumAging(groupRows, inv.billingDate, now);
      results.push({
        invoiceNumberDisplay: inv.invoiceNumberDisplay,
        groupName: inv.groupName,
        coveragePeriod: inv.coveragePeriod,
        status: inv.status,
        billingDate: new Date(inv.billingDate).toISOString().slice(0, 10),
        oldTotalDue: live.totalDue,
        oldPeriods: live.includedPeriods.sort().join(","),
        newTotalDue: asOf.totalDue,
        newPeriods: asOf.includedPeriods.sort().join(","),
        leakClosed: live.totalDue !== asOf.totalDue,
      });
    }
    return results;
  },
});
