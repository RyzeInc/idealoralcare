/**
 * REP ATTRIBUTION BACKFILL — Clerk-free re-key
 *
 * PURPOSE:
 *   Historically, rep/agency/broker attribution was stored inconsistently:
 *     - enrollmentSessions.brokerId / groups.brokerId held Clerk user IDs
 *     - commissionPayables.brokerId held the rep TRACKING CODE string (e.g. "100001")
 *     - commissionRates.brokerId held Clerk user IDs
 *
 *   The canonical, Clerk-free model is:
 *     - brokerId  → partnerLeaders._id  (the rep)
 *     - agencyId  → distributionPartners._id (the agency)
 *     - brokerTrackingCode → the rep code STRING
 *
 *   This module retroactively re-keys every existing attribution value to Convex IDs.
 *   It resolves legacy values by lookup (never by format-guessing):
 *     1. value is already a partnerLeaders._id  → leave as-is
 *     2. value matches a brokerTrackingCodes.code → re-key to that code's leader/agency
 *     3. value matches a partnerLeaders.clerkUserId → re-key to that leader
 *     4. otherwise → reported as unresolved (left untouched)
 *
 * NOTE: partnerLeaders.clerkUserId / distributionPartners.clerkUserId are intentionally
 *   preserved — they link a rep to their OWN user/member account and are never used as
 *   an attribution join key.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

type Resolution = { leaderId: string; agencyId: string | null } | null;

/**
 * Build the lookup maps used to resolve any legacy broker value to Convex IDs.
 */
async function buildResolvers(ctx: any) {
  const [leaders, codes] = await Promise.all([
    ctx.db.query("partnerLeaders").collect(),
    ctx.db.query("brokerTrackingCodes").collect(),
  ]);

  const leaderIdSet = new Set<string>(leaders.map((l: any) => l._id as string));
  const leaderById = new Map<string, any>(leaders.map((l: any) => [l._id as string, l]));
  const clerkToLeader = new Map<string, any>();
  for (const l of leaders) {
    if (l.clerkUserId) clerkToLeader.set(l.clerkUserId as string, l);
  }

  // code string (raw + UPPER) → { leaderId, agencyId }
  const codeToResolution = new Map<string, Resolution>();
  for (const c of codes) {
    const leader = leaderById.get(c.brokerId);
    const agencyId: string | null = c.agencyId ?? leader?.partnerId ?? null;
    const res: Resolution = { leaderId: c.brokerId, agencyId };
    codeToResolution.set(c.code, res);
    codeToResolution.set(String(c.code).toUpperCase(), res);
  }

  const agencyForLeader = (leaderId: string): string | null =>
    leaderById.get(leaderId)?.partnerId ?? null;

  /** Resolve any legacy broker value to { leaderId, agencyId } or null. */
  const resolve = (value: string | undefined | null): Resolution => {
    if (!value) return null;
    if (leaderIdSet.has(value)) return { leaderId: value, agencyId: agencyForLeader(value) };
    if (codeToResolution.has(value)) return codeToResolution.get(value)!;
    if (codeToResolution.has(value.toUpperCase())) return codeToResolution.get(value.toUpperCase())!;
    const leader = clerkToLeader.get(value);
    if (leader) return { leaderId: leader._id as string, agencyId: leader.partnerId ?? null };
    return null;
  };

  return { resolve, leaderIdSet };
}

/**
 * Dry-run report: how many attribution rows are already Clerk-free, re-keyable, or stuck.
 */
export const getRepAttributionHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const { resolve, leaderIdSet } = await buildResolvers(ctx);

    const [sessions, payables, rates, groups] = await Promise.all([
      ctx.db.query("enrollmentSessions").collect(),
      ctx.db.query("commissionPayables").collect(),
      ctx.db.query("commissionRates").collect(),
      ctx.db.query("groups").collect(),
    ]);

    const tally = (rows: any[], hasCode = false) => {
      let clean = 0, rekeyable = 0, unresolved = 0, empty = 0;
      for (const r of rows) {
        const candidate = r.brokerId || (hasCode ? r.brokerTrackingCode : undefined);
        if (!candidate) { empty++; continue; }
        if (r.brokerId && leaderIdSet.has(r.brokerId)) { clean++; continue; }
        if (resolve(candidate)) rekeyable++; else unresolved++;
      }
      return { total: rows.length, clean, rekeyable, unresolved, empty };
    };

    return {
      enrollmentSessions: tally(sessions, true),
      commissionPayables: tally(payables),
      commissionRates: tally(rates),
      groups: tally(groups, true),
    };
  },
});

/**
 * Retroactively re-key all rep/agency attribution to Convex IDs.
 * Pass { dryRun: true } to preview without writing.
 */
export const backfillRepAttribution = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = args.dryRun === true;
    const { resolve, leaderIdSet } = await buildResolvers(ctx);
    const now = Date.now();

    const summary = {
      dryRun,
      enrollmentSessions: { updated: 0, unresolved: 0 },
      commissionPayables: { updated: 0, unresolved: 0 },
      commissionRates: { updated: 0, unresolved: 0 },
      groups: { updated: 0, unresolved: 0 },
    };

    // 1. enrollmentSessions — prefer brokerTrackingCode (code string) as the source token.
    const sessions = await ctx.db.query("enrollmentSessions").collect();
    for (const s of sessions) {
      const alreadyClean = s.brokerId && leaderIdSet.has(s.brokerId) && (s.agencyId || true);
      const candidate = s.brokerTrackingCode || s.brokerId;
      if (!candidate) continue;
      const res = resolve(candidate);
      if (!res) {
        if (s.brokerId && !leaderIdSet.has(s.brokerId)) summary.enrollmentSessions.unresolved++;
        continue;
      }
      const needsUpdate =
        s.brokerId !== res.leaderId || (res.agencyId && s.agencyId !== res.agencyId);
      if (!needsUpdate && alreadyClean) continue;
      if (needsUpdate) {
        summary.enrollmentSessions.updated++;
        if (!dryRun) {
          await ctx.db.patch(s._id, {
            brokerId: res.leaderId,
            agencyId: res.agencyId ?? s.agencyId,
            updatedAt: now,
          });
        }
      }
    }

    // 2. commissionPayables — brokerId historically held the rep CODE string.
    const payables = await ctx.db.query("commissionPayables").collect();
    for (const p of payables) {
      if (p.brokerId && leaderIdSet.has(p.brokerId) && p.agencyId) continue;
      const res = resolve(p.brokerId);
      if (!res) { if (p.brokerId) summary.commissionPayables.unresolved++; continue; }
      if (p.brokerId === res.leaderId && p.agencyId === res.agencyId) continue;
      summary.commissionPayables.updated++;
      if (!dryRun) {
        await ctx.db.patch(p._id, {
          brokerId: res.leaderId,
          agencyId: res.agencyId ?? p.agencyId,
          updatedAt: now,
        });
      }
    }

    // 3. commissionRates — brokerId historically held a Clerk user ID.
    const rates = await ctx.db.query("commissionRates").collect();
    for (const r of rates) {
      if (r.brokerId && leaderIdSet.has(r.brokerId) && r.agencyId) continue;
      const res = resolve(r.brokerId);
      if (!res) { if (r.brokerId) summary.commissionRates.unresolved++; continue; }
      if (r.brokerId === res.leaderId && r.agencyId === res.agencyId) continue;
      summary.commissionRates.updated++;
      if (!dryRun) {
        await ctx.db.patch(r._id, {
          brokerId: res.leaderId,
          agencyId: res.agencyId ?? r.agencyId,
          updatedAt: now,
        });
      }
    }

    // 4. groups — brokerId historically held a Clerk user ID; brokerTrackingCode may help.
    const groups = await ctx.db.query("groups").collect();
    for (const g of groups) {
      const candidate = g.brokerId || g.brokerTrackingCode;
      if (g.brokerId && leaderIdSet.has(g.brokerId)) continue;
      if (!candidate) continue;
      const res = resolve(candidate);
      if (!res) { summary.groups.unresolved++; continue; }
      if (g.brokerId === res.leaderId) continue;
      summary.groups.updated++;
      if (!dryRun) {
        await ctx.db.patch(g._id, { brokerId: res.leaderId, updatedAt: now });
      }
    }

    return summary;
  },
});
