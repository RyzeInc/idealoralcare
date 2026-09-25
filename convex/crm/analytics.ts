/**
 * CRM ANALYTICS — every query here takes an explicit {from, to} window and
 * is capped. No unbounded .collect() — this is the one module where a
 * missed bound turns into "slowest query in the system within a year."
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { requireCrmUser } from "./guards";

const DEFAULT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const HARD_CAP = 5000;

/**
 * LAST-RESORT fallback only. The real source of a stage's default win
 * probability is the crmPipelineStages row (`probability`), which sales ops
 * can edit — this map exists for canonical values that have no stage row yet
 * (a deployment where the pipeline has not been seeded).
 *
 * Reading this map FIRST was a real bug: a custom stage is not a key here, so
 * `?? 0` weighted it at 0% and silently understated pipeline value in a
 * revenue report, with no error anywhere. Resolution order is now
 * deal/company override → stage row → this map.
 */
const STAGE_DEFAULT_PROBABILITY: Record<string, number> = {
  unqualified: 5, prospect: 10, contacted: 20, engaged: 35, proposal: 55,
  verbal: 80, won: 100, lost: 0, dormant: 5,
};

function resolveWindow(from?: number, to?: number): { from: number; to: number } {
  const resolvedTo = to ?? Date.now();
  const resolvedFrom = from ?? resolvedTo - DEFAULT_WINDOW_MS;
  return { from: resolvedFrom, to: resolvedTo };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function stats(values: number[]): { mean: number; median: number; p90: number; n: number } {
  if (values.length === 0) return { mean: 0, median: 0, p90: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, median: percentile(sorted, 0.5), p90: percentile(sorted, 0.9), n: values.length };
}

/**
 * Company-level pipeline rollup, keyed by CANONICAL stage. Companies mirror
 * their primary deal, so this stays the right shape for the existing funnel
 * view; dealPipelineSummary below is the per-stage-row version the board uses.
 */
export const pipelineSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    const companies = await ctx.db.query("crmCompanies").filter((q) => q.eq(q.field("isArchived"), false)).take(HARD_CAP);

    // Configurable stage rows are the authority on default probability. Build
    // a canonical → probability map from them, so a renamed or newly inserted
    // stage weights correctly instead of falling through to 0%.
    const stages = await ctx.db.query("crmPipelineStages").collect();
    const probabilityByCanonical = new Map<string, number>();
    for (const stage of stages) {
      if (stage.isArchived) continue;
      if (!probabilityByCanonical.has(stage.canonicalStage)) {
        probabilityByCanonical.set(stage.canonicalStage, stage.probability);
      }
    }

    const byStage = new Map<string, { count: number; grossMrrCents: number; weightedMrrCents: number; lives: number }>();
    for (const c of companies) {
      const bucket = byStage.get(c.stage) ?? { count: 0, grossMrrCents: 0, weightedMrrCents: 0, lives: 0 };
      const mrr = c.estimatedMrrCents ?? 0;
      const probability =
        c.winProbability ?? probabilityByCanonical.get(c.stage) ?? STAGE_DEFAULT_PROBABILITY[c.stage] ?? 0;
      bucket.count++;
      bucket.grossMrrCents += mrr;
      bucket.weightedMrrCents += Math.round((mrr * probability) / 100);
      bucket.lives += c.estimatedLives ?? 0;
      byStage.set(c.stage, bucket);
    }

    return Array.from(byStage.entries()).map(([stage, bucket]) => ({ stage, ...bucket }));
  },
});

/**
 * Deal-level rollup per CONFIGURED stage — what the pipeline board's column
 * headers and the forecast read. Weighted value always uses the deal's own
 * override first, then the stage row's probability.
 */
export const dealPipelineSummary = query({
  args: { pipelineId: v.optional(v.id("crmPipelines")) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);

    let pipelineId = args.pipelineId;
    if (!pipelineId) {
      const def = await ctx.db.query("crmPipelines").withIndex("by_default", (q) => q.eq("isDefault", true)).first();
      if (!def) return { stages: [], totals: { count: 0, grossCents: 0, weightedCents: 0, lives: 0 } };
      pipelineId = def._id;
    }

    const stages = (
      await ctx.db.query("crmPipelineStages").withIndex("by_pipeline_order", (q) => q.eq("pipelineId", pipelineId!)).collect()
    )
      .filter((s) => !s.isArchived)
      .sort((a, b) => a.order - b.order);

    const totals = { count: 0, grossCents: 0, weightedCents: 0, lives: 0 };
    const rows = await Promise.all(
      stages.map(async (stage) => {
        const deals = (
          await ctx.db.query("crmDeals").withIndex("by_stage_position", (q) => q.eq("stageId", stage._id)).take(HARD_CAP)
        ).filter((d) => !d.isArchived);

        let grossCents = 0;
        let weightedCents = 0;
        let lives = 0;
        for (const deal of deals) {
          const amount = deal.mrrCents ?? deal.amountCents ?? 0;
          const probability = deal.winProbability ?? stage.probability;
          grossCents += amount;
          weightedCents += Math.round((amount * probability) / 100);
          lives += deal.estimatedLives ?? 0;
        }

        totals.count += deals.length;
        totals.grossCents += grossCents;
        totals.weightedCents += weightedCents;
        totals.lives += lives;

        return {
          stageId: stage._id,
          name: stage.name,
          canonicalStage: stage.canonicalStage,
          color: stage.color,
          probability: stage.probability,
          isWon: stage.isWon,
          isLost: stage.isLost,
          count: deals.length,
          grossCents,
          weightedCents,
          lives,
        };
      })
    );

    return { stages: rows, totals };
  },
});

/** Pure indexed read over crmContacts.by_converted — the numbers are computed once, at conversion time, by contacts.ts:markConverted. */
export const touchesToConvert = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const contacts = await ctx.db
      .query("crmContacts")
      .withIndex("by_converted", (q) => q.gte("convertedAt", from).lte("convertedAt", to))
      .take(HARD_CAP);

    const withMetrics = contacts.filter((c) => c.convertTouchCount !== undefined);
    return {
      emails: stats(withMetrics.map((c) => c.convertEmailCount ?? 0)),
      calls: stats(withMetrics.map((c) => c.convertCallCount ?? 0)),
      touches: stats(withMetrics.map((c) => c.convertTouchCount ?? 0)),
      daysToClose: stats(withMetrics.map((c) => c.convertDaysToClose ?? 0)),
    };
  },
});

/** Relies on stage_changed being logged as an activity (companies.ts:setStage) — without that history this always returns zeros, which is why logging it isn't optional. */
export const funnelByStage = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const events = await ctx.db
      .query("crmActivities")
      .withIndex("by_type_occurred", (q) => q.eq("activityType", "stage_changed").gte("occurredAt", from).lte("occurredAt", to))
      .take(HARD_CAP);

    const entered = new Map<string, number>();
    for (const e of events) {
      const to_ = (e.metadata as { to?: string } | undefined)?.to;
      if (to_) entered.set(to_, (entered.get(to_) ?? 0) + 1);
    }
    return Array.from(entered.entries()).map(([stage, count]) => ({ stage, count }));
  },
});

/** Median days a company spends in each stage before its NEXT stage_changed event — a better "where do deals rot" number than the funnel counts alone. */
export const stageVelocity = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const events = await ctx.db
      .query("crmActivities")
      .withIndex("by_type_occurred", (q) => q.eq("activityType", "stage_changed").gte("occurredAt", from).lte("occurredAt", to))
      .take(HARD_CAP);

    const byCompany = new Map<string, Doc<"crmActivities">[]>();
    for (const e of events) {
      if (!e.companyId) continue;
      const list = byCompany.get(e.companyId) ?? [];
      list.push(e);
      byCompany.set(e.companyId, list);
    }

    const durationsByStage = new Map<string, number[]>();
    for (const events_ of byCompany.values()) {
      const sorted = events_.sort((a, b) => a.occurredAt - b.occurredAt);
      for (let i = 0; i < sorted.length - 1; i++) {
        const from_ = (sorted[i].metadata as { to?: string } | undefined)?.to;
        if (!from_) continue;
        const days = (sorted[i + 1].occurredAt - sorted[i].occurredAt) / (24 * 60 * 60 * 1000);
        const list = durationsByStage.get(from_) ?? [];
        list.push(days);
        durationsByStage.set(from_, list);
      }
    }

    return Array.from(durationsByStage.entries()).map(([stage, durations]) => ({
      stage, medianDays: Math.round(percentile([...durations].sort((a, b) => a - b), 0.5)), n: durations.length,
    }));
  },
});

export const activityLeaderboard = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const activities = await ctx.db
      .query("crmActivities")
      .withIndex("by_touch_occurred", (q) => q.eq("isTouch", true).gte("occurredAt", from).lte("occurredAt", to))
      .take(HARD_CAP);

    const byActor = new Map<string, { actorName: string; calls: number; emails: number; notes: number; total: number }>();
    for (const a of activities) {
      const key = a.actorClerkUserId ?? a.actorName ?? "unknown";
      const bucket = byActor.get(key) ?? { actorName: a.actorName ?? "Unknown", calls: 0, emails: 0, notes: 0, total: 0 };
      if (a.activityType === "call") bucket.calls++;
      else if (a.activityType === "email_outbound") bucket.emails++;
      else if (a.activityType === "note") bucket.notes++;
      bucket.total++;
      byActor.set(key, bucket);
    }
    return Array.from(byActor.values()).sort((a, b) => b.total - a.total);
  },
});

export const callOutcomeBreakdown = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const calls = await ctx.db
      .query("crmActivities")
      .withIndex("by_type_occurred", (q) => q.eq("activityType", "call").gte("occurredAt", from).lte("occurredAt", to))
      .take(HARD_CAP);

    const byOutcome = new Map<string, number>();
    for (const c of calls) {
      if (!c.callOutcome) continue;
      byOutcome.set(c.callOutcome, (byOutcome.get(c.callOutcome) ?? 0) + 1);
    }
    const total = calls.length;
    const connected = byOutcome.get("connected") ?? 0;
    return {
      byOutcome: Array.from(byOutcome.entries()).map(([outcome, count]) => ({ outcome, count })),
      total,
      connectRate: total > 0 ? Math.round((connected / total) * 100) : 0,
    };
  },
});

export const campaignPerformance = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    const campaigns = await ctx.db.query("crmCampaigns").withIndex("by_created").order("desc").take(50);
    return campaigns.map((c) => {
      const sent = c.sentCount || 1; // avoid div-by-zero in rate display; sentCount 0 just yields 0% everywhere
      return {
        campaignId: c._id, name: c.name, status: c.status,
        sentCount: c.sentCount, deliveredCount: c.deliveredCount, openedCount: c.openedCount,
        clickedCount: c.clickedCount, bouncedCount: c.bouncedCount, unsubscribedCount: c.unsubscribedCount,
        deliveredRate: Math.round((c.deliveredCount / sent) * 100),
        openRate: Math.round((c.openedCount / sent) * 100),
        clickRate: Math.round((c.clickedCount / sent) * 100),
      };
    });
  },
});

export const activityOverTime = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { from, to } = resolveWindow(args.from, args.to);
    const activities = await ctx.db
      .query("crmActivities")
      .withIndex("by_touch_occurred", (q) => q.eq("isTouch", true).gte("occurredAt", from).lte("occurredAt", to))
      .take(HARD_CAP);

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const byWeek = new Map<number, { calls: number; emails: number }>();
    for (const a of activities) {
      const weekStart = Math.floor(a.occurredAt / weekMs) * weekMs;
      const bucket = byWeek.get(weekStart) ?? { calls: 0, emails: 0 };
      if (a.activityType === "call") bucket.calls++;
      else if (a.activityType === "email_outbound") bucket.emails++;
      byWeek.set(weekStart, bucket);
    }
    return Array.from(byWeek.entries()).sort(([a], [b]) => a - b).map(([weekStart, counts]) => ({ weekStart, ...counts }));
  },
});
