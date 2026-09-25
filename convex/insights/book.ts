/**
 * THE BOOK — a viewer's members, read by index and projected safely.
 *
 * Two jobs, both load-bearing:
 *
 *  1. READ BY INDEX. Attribution is denormalized onto memberProfiles
 *     (see the DENORMALIZED REP ATTRIBUTION block in schema.ts), so a rep's
 *     members are an index range read rather than a scan of every member plus
 *     every enrollment session.
 *
 *  2. PROJECT SERVER-SIDE. Brokers see contact detail for the members they are
 *     credited for, but never `ssn`, never a dependent's date of birth, never
 *     a home address. That is enforced HERE, in the handler, by an allow-list —
 *     not by a client that chooses not to render a field. A query that returns
 *     raw member documents to a partner scope has leaked them, regardless of
 *     what the UI does next.
 */

import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import { ViewerScope, isAdminScope } from "./scope";
import { loadBillingContext, billingFor, type BillingContext } from "./revenue";
import { TIER_LABEL, type BillingSource, type InvoiceTier } from "../lib/memberBilling";

/**
 * Ceiling on a single scoped read. A book larger than this is paged through
 * rather than materialized; the flag tells the caller the totals they are
 * looking at are partial rather than letting them quietly under-report.
 */
export const MAX_SCOPED_MEMBERS = 5000;

export interface ScopedMembers {
  members: Doc<"memberProfiles">[];
  /** True when MAX_SCOPED_MEMBERS was hit and rows were left unread. */
  truncated: boolean;
}

/**
 * Every member attributable to this scope.
 *
 * Agency-level attribution is the primary lookup: the stamp always rolls a
 * member's rep up to that rep's agency, so one index read per agency covers
 * both Scenario A (rep sold direct) and Scenario B (rep owns the employer
 * deal). Rep scopes read their own index instead.
 */
export async function loadScopedMembers(
  ctx: QueryCtx,
  scope: ViewerScope,
): Promise<ScopedMembers> {
  if (isAdminScope(scope)) {
    const members = await ctx.db
      .query("memberProfiles")
      .take(MAX_SCOPED_MEMBERS + 1);
    return {
      members: members.slice(0, MAX_SCOPED_MEMBERS),
      truncated: members.length > MAX_SCOPED_MEMBERS,
    };
  }

  const seen = new Set<string>();
  const members: Doc<"memberProfiles">[] = [];
  let truncated = false;

  const push = (rows: Doc<"memberProfiles">[]) => {
    for (const row of rows) {
      const key = String(row._id);
      if (seen.has(key)) continue;
      if (members.length >= MAX_SCOPED_MEMBERS) {
        truncated = true;
        return;
      }
      seen.add(key);
      members.push(row);
    }
  };

  if (scope.kind === "rep") {
    push(
      await ctx.db
        .query("memberProfiles")
        .withIndex("by_attributed_rep", (q) =>
          q.eq("attributedRepId", String(scope.leaderId)),
        )
        .take(MAX_SCOPED_MEMBERS + 1),
    );
    return { members, truncated };
  }

  for (const agencyId of scope.allPartnerIds) {
    if (members.length >= MAX_SCOPED_MEMBERS) {
      truncated = true;
      break;
    }
    push(
      await ctx.db
        .query("memberProfiles")
        .withIndex("by_attributed_agency", (q) =>
          q.eq("attributedAgencyId", String(agencyId)),
        )
        .take(MAX_SCOPED_MEMBERS + 1),
    );
  }

  return { members, truncated };
}

/* ------------------------------------------------------------------ */
/* Projection                                                         */
/* ------------------------------------------------------------------ */

/**
 * What a broker is allowed to see about a member.
 *
 * Brokers own the client relationship, so they get enough to pick up the phone
 * — name, email, phone, plan, status, dates. They do not get identifiers that
 * exist for payroll and vendor reporting.
 */
export interface BrokerMemberView {
  _id: Id<"memberProfiles">;
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;

  memberType: string;
  status: string;
  memberRole?: string;
  listBillStatus?: string;
  employeeType?: string;

  effectiveDate?: string;
  enrolledAt?: number;
  terminatedAt?: number;
  createdAt: number;
  lastActivityAt?: number;

  groupId: Id<"groups">;
  groupName?: string;
  siteId: Id<"sites">;
  siteName?: string;

  /** Count only — a dependent's own details are not the broker's to see. */
  dependentCount: number;

  planName?: string;
  bundleStatus?: string;
  cadence?: string;
  /** Monthly revenue from whichever mechanism bills this member. */
  mrrCents: number;
  /** How they are billed — so a `$0` is distinguishable from "not applicable". */
  billingSource: BillingSource;
  employerPays: boolean;
  /** List-bill only; derived from household, never elected. */
  tier?: InvoiceTier;
  tierLabel?: string;

  attributedRepId?: string;
  attributedRepName?: string;
  attributedAgencyId?: string;
  attributedAgencyName?: string;
  attributionSource?: string;

  leadType?: string;
  signupSource?: string;
}

export interface ProjectionContext {
  groupNames: Map<string, string>;
  siteNames: Map<string, string>;
  repNames: Map<string, string>;
  agencyNames: Map<string, string>;
  billing: BillingContext;
  planNames: Map<string, string>;
  /** Group id -> the list-bill product label, e.g. "Financial Shield". */
  listBillLabels: Map<string, string>;
}

/**
 * Project one member for a broker audience.
 *
 * Fields are listed explicitly rather than spread-and-delete: a spread would
 * silently leak any column added to memberProfiles later, which is exactly the
 * kind of quiet regression this projector exists to prevent.
 */
export function toBrokerMemberView(
  member: Doc<"memberProfiles">,
  pctx: ProjectionContext,
): BrokerMemberView {
  const bundle = member.customerId
    ? pctx.billing.bundlesByCustomer.get(member.customerId)
    : undefined;
  const facts = billingFor(member, pctx.billing);

  return {
    _id: member._id,
    memberId: member.memberId,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,

    memberType: member.memberType,
    status: member.status,
    memberRole: member.memberRole,
    listBillStatus: member.listBillStatus,
    employeeType: member.employeeType,

    effectiveDate: member.effectiveDate,
    enrolledAt: member.enrolledAt,
    terminatedAt: member.terminatedAt,
    createdAt: member.createdAt,
    lastActivityAt: member.lastActivityAt,

    groupId: member.groupId,
    groupName: pctx.groupNames.get(String(member.groupId)),
    siteId: member.siteId,
    siteName: pctx.siteNames.get(String(member.siteId)),

    dependentCount: member.dependents?.length ?? 0,

    // An employer-billed member has a product label from their group's
    // contracted rate, not a Stripe plan name.
    planName: facts.employerPays
      ? pctx.listBillLabels.get(String(member.groupId))
      : bundle
        ? pctx.planNames.get(String(bundle._id))
        : undefined,
    bundleStatus: facts.employerPays ? undefined : bundle?.status,
    cadence: facts.employerPays ? "monthly" : bundle?.cadence,
    mrrCents: facts.mrrCents,
    billingSource: facts.source,
    employerPays: facts.employerPays,
    tier: facts.tier ?? undefined,
    tierLabel: facts.tier ? TIER_LABEL[facts.tier] : undefined,

    attributedRepId: member.attributedRepId,
    attributedRepName: member.attributedRepId
      ? pctx.repNames.get(member.attributedRepId)
      : undefined,
    attributedAgencyId: member.attributedAgencyId,
    attributedAgencyName: member.attributedAgencyId
      ? pctx.agencyNames.get(member.attributedAgencyId)
      : undefined,
    attributionSource: member.attributionSource,

    leadType: member.leadType,
    signupSource: member.signupSource,
  };
}

/**
 * Build the lookup maps a projection needs, in a bounded number of reads.
 */
export async function buildProjectionContext(
  ctx: QueryCtx,
  members: Doc<"memberProfiles">[],
): Promise<ProjectionContext> {
  const groupIds = new Set(members.map((m) => String(m.groupId)));
  const siteIds = new Set(members.map((m) => String(m.siteId)));

  const [groups, sites, leaders, agencies] = await Promise.all([
    ctx.db.query("groups").collect(),
    ctx.db.query("sites").collect(),
    ctx.db.query("partnerLeaders").collect(),
    ctx.db.query("distributionPartners").collect(),
  ]);

  const billing = await loadBillingContext(ctx, members);

  // Plan name comes from the bundle's entitlements; resolve the catalog once.
  const products = await ctx.db.query("catalogProducts").collect();
  const productNameById = new Map(products.map((p) => [String(p._id), p.name]));
  const planNames = new Map<string, string>();
  for (const bundle of billing.bundlesByCustomer.values()) {
    const ents = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", bundle._id))
      .collect();
    const name = ents
      .map((e) => productNameById.get(String(e.productId)))
      .find((n): n is string => !!n);
    if (name) planNames.set(String(bundle._id), name);
  }

  // Employer-billed members are described by their group's contracted rate
  // label (e.g. "Financial Shield (List Bill)"), which already exists and was
  // simply never read.
  const listBillLabels = new Map<string, string>();
  for (const g of groups) {
    const label = (g.listBill as { rates?: { rateLabel?: string } } | undefined)?.rates?.rateLabel;
    if (label) listBillLabels.set(String(g._id), label);
  }

  return {
    groupNames: new Map(
      groups.filter((g) => groupIds.has(String(g._id))).map((g) => [String(g._id), g.name]),
    ),
    siteNames: new Map(
      sites.filter((s) => siteIds.has(String(s._id))).map((s) => [String(s._id), s.name]),
    ),
    repNames: new Map(leaders.map((l) => [String(l._id), l.name])),
    agencyNames: new Map(agencies.map((a) => [String(a._id), a.name])),
    billing,
    planNames,
    listBillLabels,
  };
}

/**
 * Project a whole page of members for the caller's audience.
 *
 * Admins get the raw document — they already have unrestricted access through
 * `/admin`, and the member detail page depends on fields the broker view
 * deliberately drops.
 */
export function projectForScope(
  scope: ViewerScope,
  members: Doc<"memberProfiles">[],
  pctx: ProjectionContext,
): BrokerMemberView[] | Doc<"memberProfiles">[] {
  if (isAdminScope(scope)) return members;
  return members.map((m) => toBrokerMemberView(m, pctx));
}
