/**
 * DOWNLINE — the upline tree, its production, and override earnings.
 *
 * What an upline sees, per the product decision: each downline node's
 * production, and the override dollars THEY earn from it. Not the downline's
 * own commission rate, and not the downline's payout. An FMO can see that
 * Coastal Agency wrote 168 members and that it earned $840 of override on
 * them; it cannot see what Coastal's own reps are paid.
 *
 * Where the money figure comes from matters. `commissionPayables` is not
 * readable — its historical rows hold a tracking-code string in `brokerId` and
 * a hardcoded 15% rate (see the keySpace note in schema.ts). So override is
 * derived from the frozen dispersal in `invoicePeriods.memberLines[]`, which
 * is immutable, hashed, and already carries per-member attribution.
 *
 * That makes these ESTIMATES from the revenue model, not payout statements.
 * Every response says so in a field the UI is expected to render.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  resolveViewerScope,
  scopeLabel,
  isAdminScope,
  collectDescendantPartnerIds,
  ViewerScope,
} from "./scope";
import { currentPeriod, periodKey } from "../lib/periods";
import { isOnBook } from "../lib/memberBilling";

export const EARNINGS_BASIS =
  "Estimated from closed dispersal periods (invoicePeriods). Not a payout statement.";

interface NodeTotals {
  members: number;
  activeMembers: number;
  newMembers: number;
  grossCents: number;
  partnerVendorCents: number;
}

const emptyTotals = (): NodeTotals => ({
  members: 0,
  activeMembers: 0,
  newMembers: 0,
  grossCents: 0,
  partnerVendorCents: 0,
});

/** The partner ids a viewer is allowed to see as nodes in their tree. */
function visiblePartnerIds(scope: ViewerScope): Set<string> | null {
  if (isAdminScope(scope)) return null; // everything
  if (scope.kind === "partner") return new Set(scope.allPartnerIds.map(String));
  return new Set([String(scope.partnerId)]);
}

/**
 * The viewer's downline as a tree, each node carrying production and the
 * viewer's own override on it.
 */
export const getDownline = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const months = Math.min(Math.max(args.months ?? 3, 1), 24);

    const [partners, leaders, members] = await Promise.all([
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("memberProfiles").collect(),
    ]);

    const visible = visiblePartnerIds(scope);
    const partnerById = new Map(partners.map((p) => [String(p._id), p]));
    const agencyForRep = new Map(leaders.map((l) => [String(l._id), String(l.partnerId)]));

    // Production per agency, from the member stamp.
    const now = Date.now();
    const windowStart = now - months * 30 * 24 * 60 * 60 * 1000;
    const totals = new Map<string, NodeTotals>();

    for (const m of members) {
      if (m.memberRole === "dependent") continue;
      const agencyId =
        m.attributedAgencyId ??
        (m.attributedRepId ? agencyForRep.get(m.attributedRepId) : undefined);
      if (!agencyId) continue;
      if (visible && !visible.has(agencyId)) continue;

      const t = totals.get(agencyId) ?? emptyTotals();
      t.members += 1;
      if (isOnBook(m)) t.activeMembers += 1;
      if ((m.enrolledAt ?? m.createdAt) >= windowStart) t.newMembers += 1;
      totals.set(agencyId, t);
    }

    // Frozen dispersal for the same window, per agency.
    const cur = currentPeriod();
    const periods: string[] = [];
    let y = cur.year;
    let mo = cur.month;
    for (let i = 0; i < months; i++) {
      periods.push(periodKey(y, mo));
      mo--;
      if (mo < 1) { mo = 12; y--; }
    }

    for (const period of periods) {
      const rows = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .collect();
      for (const row of rows) {
        for (const line of row.memberLines ?? []) {
          const agencyId =
            line.agencyId ?? (line.repId ? agencyForRep.get(line.repId) : undefined);
          if (!agencyId) continue;
          if (visible && !visible.has(agencyId)) continue;
          const t = totals.get(agencyId) ?? emptyTotals();
          t.grossCents += line.grossCents ?? 0;
          t.partnerVendorCents += line.partnerVendorCents ?? 0;
          totals.set(agencyId, t);
        }
      }
    }

    // The viewer's override rate. `distributionPartners.overrideRate` is stored
    // as a PERCENT (5 means 5%), unlike commissionRates.ratePercentage which is
    // a decimal. Mixing the two would be off by 100x.
    const viewerOverridePercent =
      scope.kind === "partner" ? scope.overrideRate ?? 0 : 0;

    const rootId =
      scope.kind === "partner"
        ? String(scope.partnerId)
        : scope.kind === "rep"
        ? String(scope.partnerId)
        : null;

    const nodeIds = visible ? [...visible] : partners.map((p) => String(p._id));

    const nodes = nodeIds
      .map((id) => {
        const partner = partnerById.get(id);
        if (!partner) return null;
        const t = totals.get(id) ?? emptyTotals();
        const isSelf = id === rootId;

        return {
          partnerId: id,
          name: partner.name,
          type: partner.type,
          parentId: partner.parentId ? String(partner.parentId) : null,
          status: partner.status,
          agencyCode: partner.agencyCode ?? null,
          isSelf,
          repCount: leaders.filter((l) => String(l.partnerId) === id).length,
          ...t,
          /**
           * The viewer's override on this node. Zero on their own row — you do
           * not earn an override on yourself — and zero for admins, who are not
           * in the pay chain at all.
           */
          yourOverrideCents:
            isSelf || viewerOverridePercent <= 0
              ? 0
              : Math.round((t.partnerVendorCents * viewerOverridePercent) / 100),
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .sort((a, b) => b.activeMembers - a.activeMembers);

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      rootPartnerId: rootId,
      months,
      nodes,
      yourOverridePercent: viewerOverridePercent,
      totalOverrideCents: nodes.reduce((s, n) => s + n.yourOverrideCents, 0),
      isEstimate: true,
      basis: EARNINGS_BASIS,
    };
  },
});

/**
 * Rep leaderboard for the viewer's scope, with rank movement.
 *
 * Ranked on net growth by default rather than raw new members — a rep who
 * wrote 20 and lost 18 did not outperform one who wrote 12 and kept them.
 */
export const getLeaderboard = query({
  args: {
    days: v.optional(v.number()),
    metric: v.optional(
      v.union(v.literal("netGrowth"), v.literal("newMembers"), v.literal("activeMembers")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 30, 1), 365);
    const metric = args.metric ?? "netGrowth";
    const limit = Math.min(args.limit ?? 25, 100);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const windowStart = now - days * dayMs;
    const prevStart = windowStart - days * dayMs;

    const [leaders, partners, members] = await Promise.all([
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("memberProfiles").collect(),
    ]);

    const allowedRepIds =
      scope.kind === "admin"
        ? null
        : new Set(
            scope.kind === "partner"
              ? scope.leaderIds.map(String)
              : [String(scope.leaderId)],
          );

    const partnerById = new Map(partners.map((p) => [String(p._id), p]));
    type Row = {
      repId: string;
      name: string;
      agencyName: string | null;
      activeMembers: number;
      newMembers: number;
      churnedMembers: number;
      netGrowth: number;
      prevNetGrowth: number;
      prevNewMembers: number;
      prevActiveMembers: number;
    };
    const rows = new Map<string, Row>();

    for (const leader of leaders) {
      const id = String(leader._id);
      if (allowedRepIds && !allowedRepIds.has(id)) continue;
      rows.set(id, {
        repId: id,
        name: leader.name,
        agencyName: partnerById.get(String(leader.partnerId))?.name ?? null,
        activeMembers: 0,
        newMembers: 0,
        churnedMembers: 0,
        netGrowth: 0,
        prevNetGrowth: 0,
        prevNewMembers: 0,
        prevActiveMembers: 0,
      });
    }

    for (const m of members) {
      if (m.memberRole === "dependent") continue;
      const repId = m.attributedRepId;
      if (!repId) continue;
      const row = rows.get(repId);
      if (!row) continue;

      if (isOnBook(m)) row.activeMembers++;

      const joined = m.enrolledAt ?? m.createdAt;
      if (joined >= windowStart) row.newMembers++;
      else if (joined >= prevStart) row.prevNewMembers++;

      if (typeof m.terminatedAt === "number") {
        if (m.terminatedAt >= windowStart) row.churnedMembers++;
        else if (m.terminatedAt >= prevStart) row.prevNetGrowth--;
      }
      // Opening active level, for the previous-period comparison.
      if (joined < windowStart && (!m.terminatedAt || m.terminatedAt >= windowStart)) {
        row.prevActiveMembers++;
      }
    }

    const scored = [...rows.values()].map((r) => ({
      ...r,
      netGrowth: r.newMembers - r.churnedMembers,
      prevNetGrowth: r.prevNewMembers + r.prevNetGrowth,
    }));

    const pick = (r: (typeof scored)[number]) =>
      metric === "activeMembers" ? r.activeMembers
      : metric === "newMembers" ? r.newMembers
      : r.netGrowth;
    const pickPrev = (r: (typeof scored)[number]) =>
      metric === "activeMembers" ? r.prevActiveMembers
      : metric === "newMembers" ? r.prevNewMembers
      : r.prevNetGrowth;

    const current = [...scored].sort((a, b) => pick(b) - pick(a));
    const previous = [...scored].sort((a, b) => pickPrev(b) - pickPrev(a));
    const prevRank = new Map(previous.map((r, i) => [r.repId, i + 1]));

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      metric,
      windowDays: days,
      rows: current.slice(0, limit).map((r, i) => ({
        rank: i + 1,
        previousRank: prevRank.get(r.repId) ?? null,
        // Positive means climbed.
        rankChange: (prevRank.get(r.repId) ?? i + 1) - (i + 1),
        repId: r.repId,
        name: r.name,
        agencyName: r.agencyName,
        activeMembers: r.activeMembers,
        newMembers: r.newMembers,
        churnedMembers: r.churnedMembers,
        netGrowth: r.netGrowth,
      })),
      totalReps: scored.length,
    };
  },
});

/**
 * Re-scope the dashboard to a node inside the viewer's own downline.
 *
 * The requested id is intersected with the viewer's scope server-side, so a
 * crafted request for an unrelated agency returns null rather than that
 * agency's book.
 */
export const getScopedNode = query({
  args: { partnerId: v.string() },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);

    if (!isAdminScope(scope)) {
      const allowed =
        scope.kind === "partner"
          ? scope.allPartnerIds.map(String)
          : [String(scope.partnerId)];
      if (!allowed.includes(args.partnerId)) return null;
    }

    let partner;
    try {
      partner = await ctx.db.get(args.partnerId as Id<"distributionPartners">);
    } catch {
      return null;
    }
    if (!partner) return null;

    const descendants = await collectDescendantPartnerIds(ctx, partner._id);
    return {
      partnerId: String(partner._id),
      name: partner.name,
      type: partner.type,
      agencyCode: partner.agencyCode ?? null,
      descendantCount: descendants.length,
    };
  },
});
