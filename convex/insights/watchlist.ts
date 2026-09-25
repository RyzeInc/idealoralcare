/**
 * WATCHLIST — the things a broker should do something about today.
 *
 * Deliberately not charts. Every row is a person or an account with a reason
 * and a next action; a dashboard that only tells you the churn rate went up
 * has told you nothing you can act on.
 *
 * Every item is scoped and projected exactly like the roster — the same PII
 * rules apply here, since this is the surface most likely to be worked from
 * directly.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { resolveViewerScope, scopeLabel, isAdminScope } from "./scope";
import { isOnBook, TIER_LABEL } from "../lib/memberBilling";
import { loadScopedMembers, buildProjectionContext } from "./book";
import { loadBillingContext, billingFor } from "./revenue";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WatchlistKind =
  | "payment_failed"
  | "past_due"
  | "list_bill_termed"
  | "unclaimed_dependent"
  | "email_bounced"
  | "employer_invoice_lapsed"
  | "group_terminating"
  | "group_at_capacity"
  | "invoice_overdue";

export interface WatchlistItem {
  kind: WatchlistKind;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  memberId?: string;
  memberProfileId?: string;
  groupId?: string;
  groupName?: string;
  email?: string;
  phone?: string;
  occurredAt?: number;
}

/**
 * Everything needing attention in the caller's book.
 *
 * Ordered by severity then recency, so the top of the list is the thing to do
 * first rather than merely the newest thing.
 */
export const getWatchlist = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const limit = Math.min(args.limit ?? 200, 500);
    const now = Date.now();

    const { members, truncated } = await loadScopedMembers(ctx, scope);
    const pctx = await buildProjectionContext(ctx, members);
    const bctx = await loadBillingContext(ctx, members);

    // Employer invoices that have gone overdue — the list-bill analogue of a
    // declined card. Previously an employer-billed member could never be
    // flagged at risk at all, however far behind their employer was.
    const overdueByGroup = new Map<string, { invoiceNumber: string; period: string }>();
    for (const inv of await ctx.db
      .query("listBillInvoices")
      .withIndex("by_status", (q) => q.eq("status", "overdue"))
      .collect()) {
      overdueByGroup.set(String(inv.groupId), {
        invoiceNumber: inv.invoiceNumberDisplay,
        period: inv.coveragePeriod,
      });
    }

    const items: WatchlistItem[] = [];
    const groupIdsInScope = new Set(members.map((m) => String(m.groupId)));

    for (const m of members) {
      const groupName = pctx.groupNames.get(String(m.groupId));
      const base = {
        memberId: m.memberId,
        memberProfileId: String(m._id),
        groupId: String(m.groupId),
        groupName,
        email: m.email,
        phone: m.phone,
      };

      // Money has stopped or is about to. Which signal applies depends on who
      // actually pays for this member.
      const facts = billingFor(m, bctx);
      if (facts.source === "list_bill") {
        const overdue = overdueByGroup.get(String(m.groupId));
        if (overdue && isOnBook(m)) {
          items.push({
            ...base,
            kind: "employer_invoice_lapsed",
            severity: "high",
            title: `${m.firstName} ${m.lastName} — employer invoice overdue`,
            detail: `${groupName ?? "Their employer"} has not paid invoice ${overdue.invoiceNumber} for ${overdue.period}. Coverage is at risk.`,
          });
        }
      }

      const bundle = m.customerId ? bctx.bundlesByCustomer.get(m.customerId) : undefined;
      if (!facts.employerPays && bundle?.status === "payment_failed") {
        items.push({
          ...base,
          kind: "payment_failed",
          severity: "high",
          title: `${m.firstName} ${m.lastName} — payment failed`,
          detail: "Card or bank payment was declined. Coverage is at risk.",
          occurredAt: bundle.pastDueAt ?? bundle.updatedAt,
        });
      } else if (!facts.employerPays && bundle?.status === "past_due") {
        items.push({
          ...base,
          kind: "past_due",
          severity: "high",
          title: `${m.firstName} ${m.lastName} — past due`,
          detail: "Payment is overdue but the subscription is still live.",
          occurredAt: bundle.pastDueAt ?? bundle.updatedAt,
        });
      }

      // Left payroll deduction — usually a conversion opportunity, not a loss.
      if (m.listBillStatus === "termed") {
        items.push({
          ...base,
          kind: "list_bill_termed",
          severity: "medium",
          title: `${m.firstName} ${m.lastName} — off payroll deduction`,
          detail: "Eligible to convert to direct pay. A re-enrollment link can be sent.",
          occurredAt: m.listBillTermedAt,
        });
      }

      // A dependent who never claimed their invite has no ID card and cannot
      // use the plan — invisible unless someone looks.
      if (m.memberRole === "dependent" && m.inviteStatus === "pending") {
        items.push({
          ...base,
          kind: "unclaimed_dependent",
          severity: "low",
          title: `${m.firstName} ${m.lastName} — dependent invite unclaimed`,
          detail: "Invited but never activated; cannot access benefits yet.",
          occurredAt: m.createdAt,
        });
      }
    }

    // Email deliverability: a bounced welcome means the member never got their
    // card, which surfaces later as a support call.
    const memberIds = new Set(members.map((m) => String(m._id)));
    const bounced = await ctx.db
      .query("memberActivities")
      .withIndex("by_activity_type", (q) => q.eq("activityType", "email_bounced"))
      .order("desc")
      .take(300);
    for (const a of bounced) {
      if (!memberIds.has(String(a.memberProfileId))) continue;
      const m = members.find((x) => String(x._id) === String(a.memberProfileId));
      if (!m) continue;
      items.push({
        kind: "email_bounced",
        severity: "medium",
        title: `${m.firstName} ${m.lastName} — email bounced`,
        detail: a.description ?? "Email could not be delivered; contact details may be wrong.",
        memberId: m.memberId,
        memberProfileId: String(m._id),
        groupId: String(m.groupId),
        groupName: pctx.groupNames.get(String(m.groupId)),
        email: m.email,
        phone: m.phone,
        occurredAt: a.createdAt,
      });
    }

    // Group-level risk.
    const groups = await ctx.db.query("groups").collect();
    for (const g of groups) {
      if (!isAdminScope(scope) && !groupIdsInScope.has(String(g._id))) continue;

      if (g.terminationDate && g.terminationDate > now && g.terminationDate < now + 60 * DAY_MS) {
        items.push({
          kind: "group_terminating",
          severity: "high",
          title: `${g.name} — contract ends soon`,
          detail: `Termination date is ${new Date(g.terminationDate).toISOString().slice(0, 10)}.`,
          groupId: String(g._id),
          groupName: g.name,
          occurredAt: g.terminationDate,
        });
      }

      if (g.maxMembers) {
        const count = members.filter((m) => String(m.groupId) === String(g._id)).length;
        if (count >= g.maxMembers * 0.9) {
          items.push({
            kind: "group_at_capacity",
            severity: "low",
            title: `${g.name} — near member cap`,
            detail: `${count} of ${g.maxMembers} seats used.`,
            groupId: String(g._id),
            groupName: g.name,
          });
        }
      }
    }

    // Employer receivables.
    const overdue = await ctx.db
      .query("listBillInvoices")
      .withIndex("by_status", (q) => q.eq("status", "overdue"))
      .collect();
    for (const inv of overdue) {
      if (!isAdminScope(scope) && !groupIdsInScope.has(String(inv.groupId))) continue;
      items.push({
        kind: "invoice_overdue",
        severity: "high",
        title: `Invoice ${inv.invoiceNumber} overdue`,
        detail: `${((inv.totalCents ?? 0) / 100).toFixed(2)} outstanding for ${inv.coveragePeriod}.`,
        groupId: String(inv.groupId),
        occurredAt: inv.updatedAt,
      });
    }

    const severityRank = { high: 0, medium: 1, low: 2 } as const;
    items.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        (b.occurredAt ?? 0) - (a.occurredAt ?? 0),
    );

    const counts = items.reduce<Record<string, number>>((acc, i) => {
      acc[i.kind] = (acc[i.kind] ?? 0) + 1;
      return acc;
    }, {});

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      items: items.slice(0, limit),
      total: items.length,
      counts,
      bySeverity: {
        high: items.filter((i) => i.severity === "high").length,
        medium: items.filter((i) => i.severity === "medium").length,
        low: items.filter((i) => i.severity === "low").length,
      },
      truncated,
    };
  },
});

/**
 * Employer book: participation, tier mix, invoice state, file freshness.
 *
 * Participation rate is enrolled ÷ eligible, where "eligible" comes from the
 * last eligibility file's record count. A group with no file has no
 * denominator, so participation is null rather than 0% or 100% — both of which
 * would be a fabrication.
 */
export const getGroupBook = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveViewerScope(ctx);
    const { members } = await loadScopedMembers(ctx, scope);
    const bctx = await loadBillingContext(ctx, members);

    const groupIds = new Set(members.map((m) => String(m.groupId)));
    const [groups, accounts] = await Promise.all([
      ctx.db.query("groups").collect(),
      ctx.db.query("accounts").collect(),
    ]);
    const accountNames = new Map(accounts.map((a) => [String(a._id), a.name]));

    const rows = [];
    for (const g of groups) {
      if (!isAdminScope(scope) && !groupIds.has(String(g._id))) continue;

      const groupMembers = members.filter((m) => String(m.groupId) === String(g._id));
      if (groupMembers.length === 0 && !isAdminScope(scope)) continue;

      const primaries = groupMembers.filter((m) => m.memberRole !== "dependent");
      // Covered, per the invoice generator's definition. Filtering to "active"
      // showed a hard 0% participation for employer groups whose members sit
      // in "eligible" — worse than the null the docstring guards against.
      const active = primaries.filter((m) => isOnBook(m));

      const files = await ctx.db
        .query("eligibilityFiles")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .order("desc")
        .take(1);
      const latestFile = files[0];
      const eligible = latestFile?.totalRecords ?? null;

      const invoices = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .order("desc")
        .take(1);

      // Priced through the shared resolver. This row previously rendered $0
      // while displaying a "list bill" badge beside it — the code knew the
      // group was employer-billed and priced it as if it were not.
      let mrrCents = 0;
      const tierMix: Record<string, number> = { MO: 0, MS: 0, MF: 0 };
      for (const m of active) {
        const facts = billingFor(m, bctx);
        mrrCents += facts.mrrCents;
        if (facts.tier) tierMix[facts.tier] += 1;
      }

      rows.push({
        groupId: String(g._id),
        groupName: g.name,
        groupCode: g.groupCode,
        accountName: accountNames.get(String(g.accountId)) ?? null,
        status: g.status,
        isListBill: g.listBill?.enabled === true,
        totalMembers: groupMembers.length,
        primaryMembers: primaries.length,
        activeMembers: active.length,
        dependents: groupMembers.length - primaries.length,
        eligibleCount: eligible,
        participationRate: eligible && eligible > 0 ? active.length / eligible : null,
        mrrCents,
        // Coverage tier mix, derived from household composition at billing
        // time. Employees do not elect a tier; this is the closest the data
        // model comes to one.
        tierMix,
        tierLabels: TIER_LABEL,
        latestEligibilityFileAt: latestFile?.uploadedAt ?? null,
        eligibilityFileStaleDays: latestFile
          ? Math.floor((Date.now() - latestFile.uploadedAt) / DAY_MS)
          : null,
        latestInvoiceStatus: invoices[0]?.status ?? null,
        latestInvoicePeriod: invoices[0]?.coveragePeriod ?? null,
        effectiveDate: g.effectiveDate ?? null,
        terminationDate: g.terminationDate ?? null,
      });
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      rows: rows.sort((a, b) => b.activeMembers - a.activeMembers),
      totals: {
        groups: rows.length,
        activeMembers: rows.reduce((s, r) => s + r.activeMembers, 0),
        mrrCents: rows.reduce((s, r) => s + r.mrrCents, 0),
      },
    };
  },
});
