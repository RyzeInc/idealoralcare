/**
 * ROSTER — the member-tracking surface.
 *
 * Filtering and sorting happen on the SERVER. The obvious alternative — ship
 * the book to the browser and filter there, as /admin/members does today with
 * `filteredMembers.slice(page * 25, ...)` — would hand a broker every member
 * they can technically see plus everything the projector strips, and would
 * grow linearly in the browser's memory. Neither is acceptable in a portal
 * where the whole point is that people see different things.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { resolveViewerScope, scopeLabel, isAdminScope, attributionInScope } from "./scope";
import {
  loadScopedMembers,
  buildProjectionContext,
  toBrokerMemberView,
  BrokerMemberView,
} from "./book";
import { hasExited } from "../lib/memberLifecycle";
import { billingFor } from "./revenue";
import { TIER_LABEL } from "../lib/memberBilling";

export const ROSTER_PAGE_SIZE = 25;
export const MAX_ROSTER_PAGE_SIZE = 200;

const SORT_FIELDS = [
  "lastName",
  "enrolledAt",
  "effectiveDate",
  "memberType",
  "groupName",
  "mrrCents",
  "billingSource",
  "tier",
  "createdAt",
] as const;
export type RosterSortField = (typeof SORT_FIELDS)[number];

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  // Missing values sort last regardless of direction — a blank effective date
  // is not "earliest", it is unknown.
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * Search, filter, sort and page the caller's book.
 *
 * Returns the projected view for partners and reps; admins get the same shape
 * so one table component serves both portals.
 */
export const getRoster = query({
  args: {
    search: v.optional(v.string()),
    memberType: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    siteId: v.optional(v.id("sites")),
    listBillStatus: v.optional(v.string()),
    billingSource: v.optional(v.string()),
    /** Inclusive ISO date bounds on `effectiveDate`. */
    effectiveFrom: v.optional(v.string()),
    effectiveTo: v.optional(v.string()),
    includeDependents: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    sortDir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const { members, truncated } = await loadScopedMembers(ctx, scope);
    const pctx = await buildProjectionContext(ctx, members);

    // Project first, then filter — so filters operate on exactly the fields the
    // caller is allowed to see, and cannot be used to probe a hidden one.
    let rows: BrokerMemberView[] = members.map((m) => toBrokerMemberView(m, pctx));

    if (!args.includeDependents) {
      rows = rows.filter((r) => r.memberRole !== "dependent");
    }
    if (args.memberType) {
      rows = rows.filter((r) => r.memberType === args.memberType);
    }
    if (args.groupId) {
      rows = rows.filter((r) => String(r.groupId) === String(args.groupId));
    }
    if (args.siteId) {
      rows = rows.filter((r) => String(r.siteId) === String(args.siteId));
    }
    if (args.listBillStatus) {
      rows = rows.filter((r) => r.listBillStatus === args.listBillStatus);
    }
    if (args.billingSource) {
      rows = rows.filter((r) => r.billingSource === args.billingSource);
    }
    if (args.effectiveFrom) {
      rows = rows.filter((r) => !!r.effectiveDate && r.effectiveDate >= args.effectiveFrom!);
    }
    if (args.effectiveTo) {
      rows = rows.filter((r) => !!r.effectiveDate && r.effectiveDate <= args.effectiveTo!);
    }
    if (args.search && args.search.trim()) {
      const needle = args.search.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.firstName, r.lastName, r.email, r.memberId, r.groupName, r.attributedRepName]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle)),
      );
    }

    const sortBy = (SORT_FIELDS as readonly string[]).includes(args.sortBy ?? "")
      ? (args.sortBy as RosterSortField)
      : "lastName";
    const dir = args.sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => dir * compare(a[sortBy], b[sortBy]));

    const pageSize = Math.min(args.pageSize ?? ROSTER_PAGE_SIZE, MAX_ROSTER_PAGE_SIZE);
    const page = Math.max(args.page ?? 0, 0);
    const total = rows.length;
    const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      rows: pageRows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      truncated,
    };
  },
});

/** Distinct filter values present in the caller's own book. */
export const getRosterFilters = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveViewerScope(ctx);
    const { members } = await loadScopedMembers(ctx, scope);
    const pctx = await buildProjectionContext(ctx, members);

    const groups = new Map<string, string>();
    const sites = new Map<string, string>();
    const memberTypes = new Set<string>();
    const billingSources = new Map<string, number>();

    for (const m of members) {
      if (m.memberRole !== "dependent") {
        const source = billingFor(m, pctx.billing).source;
        billingSources.set(source, (billingSources.get(source) ?? 0) + 1);
      }
      const gName = pctx.groupNames.get(String(m.groupId));
      if (gName) groups.set(String(m.groupId), gName);
      const sName = pctx.siteNames.get(String(m.siteId));
      if (sName) sites.set(String(m.siteId), sName);
      memberTypes.add(m.memberType);
    }

    return {
      groups: [...groups].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      sites: [...sites].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      memberTypes: [...memberTypes].sort(),
      billingSources: [...billingSources]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

/**
 * One member, with their timeline.
 *
 * The scope check is explicit rather than implied by the read: fetching by id
 * bypasses the attribution index, so without this a broker could enumerate
 * member ids and read anyone's record.
 */
export const getMemberDetail = query({
  args: { memberId: v.id("memberProfiles") },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) return null;

    const inScope = attributionInScope(scope, {
      repId: member.attributedRepId ?? null,
      agencyId: member.attributedAgencyId ?? null,
    });
    if (!inScope) {
      // Indistinguishable from "does not exist", deliberately — a different
      // error here would confirm the id belongs to somebody.
      return null;
    }

    const pctx = await buildProjectionContext(ctx, [member]);
    const view = toBrokerMemberView(member, pctx);

    const activities = await ctx.db
      .query("memberActivities")
      .withIndex("by_member", (q) => q.eq("memberProfileId", args.memberId))
      .order("desc")
      .take(100);

    const bundle = member.customerId
      ? pctx.billing.bundlesByCustomer.get(member.customerId)
      : undefined;
    const facts = billingFor(member, pctx.billing);

    // An employer-billed member has no Stripe subscription, so the drawer used
    // to render nothing at all for them — implying no coverage. Their billing
    // story lives on the employer's invoice instead.
    let listBill = null;
    if (facts.source === "list_bill") {
      const group = pctx.billing.groupsById.get(String(member.groupId));
      const invoices = await ctx.db
        .query("listBillInvoices")
        .withIndex("by_group", (q) => q.eq("groupId", member.groupId))
        .order("desc")
        .take(1);
      const latest = invoices[0];
      listBill = {
        rateCents: facts.mrrCents,
        tier: facts.tier,
        tierLabel: facts.tier ? TIER_LABEL[facts.tier] : null,
        dependentCount: facts.dependentCount,
        rateLabel: facts.rateLabel ?? null,
        // check | ach — the employer's remittance method, never a card.
        employerPaymentMethod: group?.listBill?.paymentMethod ?? null,
        coveragePeriod: latest?.coveragePeriod ?? null,
        invoiceStatus: latest?.status ?? null,
        invoiceNumber: latest?.invoiceNumber ?? null,
        listBillStatus: member.listBillStatus ?? "active",
      };
    }

    return {
      billingSource: facts.source,
      employerPays: facts.employerPays,
      listBill,
      member: view,
      /** Admins additionally get the raw record for the internal detail page. */
      raw: isAdminScope(scope) ? (member as Doc<"memberProfiles">) : null,
      hasExited: hasExited(member.memberType),
      timeline: activities.map((a) => ({
        _id: a._id,
        activityType: a.activityType,
        title: a.title,
        description: a.description,
        actorType: a.actorType,
        actorName: a.actorName,
        emailEvent: a.emailEvent,
        createdAt: a.createdAt,
      })),
      subscription: bundle
        ? {
            status: bundle.status,
            cadence: bundle.cadence,
            paymentMethod: bundle.paymentMethod,
            totalCents: bundle.pricingSnapshot?.totalCents ?? 0,
            currentPeriodStart: bundle.currentPeriodStart,
            currentPeriodEnd: bundle.currentPeriodEnd,
            cancelledAt: bundle.cancelledAt,
            cancellationReason: bundle.cancellationReason,
            pastDueAt: bundle.pastDueAt,
          }
        : null,
    };
  },
});

/**
 * The whole filtered book for export.
 *
 * Capped, and returns the same projected shape as the table so an exported CSV
 * can never contain a column the portal refuses to render on screen.
 */
export const getRosterForExport = query({
  args: { memberType: v.optional(v.string()), includeDependents: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const { members, truncated } = await loadScopedMembers(ctx, scope);
    const pctx = await buildProjectionContext(ctx, members);

    let rows = members.map((m) => toBrokerMemberView(m, pctx));
    if (!args.includeDependents) rows = rows.filter((r) => r.memberRole !== "dependent");
    if (args.memberType) rows = rows.filter((r) => r.memberType === args.memberType);

    return { rows, truncated, exportedAt: Date.now() };
  },
});
