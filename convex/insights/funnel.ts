/**
 * PRODUCTION FUNNEL — visit → enrollment → paid.
 *
 * A caveat that shapes this whole module: `cartSessions` carries no broker
 * attribution. A cart knows what is in it and whether it converted, but not
 * who sent the shopper. `enrollmentSessions` DOES carry attribution, so that
 * is the spine, and carts are joined in through it.
 *
 * The consequence is honest but worth stating plainly in the UI: a cart
 * abandoned by a brand-new prospect who never reached the enrollment step
 * cannot be attributed to anyone. Those appear in the admin view and are
 * reported to a broker as an unattributed count rather than being silently
 * dropped or, worse, spread across everyone.
 *
 * Since the DTC backstop landed (see enrollment/sessions.ts), completed direct
 * checkouts DO get a session, so the funnel is complete from that point
 * forward for everything except pre-enrollment abandonment.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { resolveViewerScope, scopeLabel, ViewerScope, isAdminScope } from "./scope";
import { QueryCtx } from "../_generated/server";
import { loadScopedMembers } from "./book";
import { loadBillingContext, billingFor } from "./revenue";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Enrollment sessions belonging to a scope, within a window. */
async function loadScopedSessions(
  ctx: QueryCtx,
  scope: ViewerScope,
  since: number,
): Promise<Doc<"enrollmentSessions">[]> {
  if (isAdminScope(scope)) {
    return await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .collect();
  }

  const seen = new Set<string>();
  const out: Doc<"enrollmentSessions">[] = [];
  const repIds = scope.kind === "rep" ? [String(scope.leaderId)] : scope.leaderIds.map(String);

  for (const repId of repIds) {
    const rows = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_broker", (q) => q.eq("brokerId", repId))
      .collect();
    for (const row of rows) {
      if (row.createdAt < since) continue;
      const key = String(row._id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

/**
 * The funnel, stage by stage.
 *
 * Stages are counted from different tables, so they are NOT guaranteed to be
 * monotonically decreasing — a member enrolled before visit tracking existed
 * has an enrollment but no visit. The UI shows each stage's own basis rather
 * than implying a single cohort walked all the way down.
 */
export const getFunnel = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 30, 1), 365);
    const since = Date.now() - days * DAY_MS;

    // Stage 1 — visits on the scope's rep codes (humans only).
    const codes =
      scope.kind === "admin"
        ? (await ctx.db.query("brokerTrackingCodes").collect()).map((c) => c.code)
        : scope.codes;

    let visits = 0;
    const visitSessions = new Set<string>();
    for (const code of codes) {
      const rows = await ctx.db
        .query("repLinkVisits")
        .withIndex("by_code_created", (q) => q.eq("code", code).gte("createdAt", since))
        .collect();
      for (const row of rows) {
        if (row.isBot) continue;
        visits++;
        if (row.sessionId) visitSessions.add(row.sessionId);
      }
    }

    // Stages 2-3 — enrollment sessions.
    const sessions = await loadScopedSessions(ctx, scope, since);
    const started = sessions.length;
    const completed = sessions.filter((s) => s.status === "completed").length;
    const abandoned = sessions.filter(
      (s) => s.status === "abandoned" || s.status === "expired" || s.status === "failed",
    ).length;
    const pendingPayment = sessions.filter((s) => s.status === "pending_payment").length;

    // Stage 4 — members who actually pay.
    const { members } = await loadScopedMembers(ctx, scope);
    const recent = members.filter((m) => (m.enrolledAt ?? m.createdAt) >= since);
    const bctx = await loadBillingContext(ctx, members);

    // Counts anyone generating revenue, however they are billed. Restricting
    // this to Stripe bundles made a fully-invoiced employer group render
    // "Paying members: 0" — a 0% conversion rate on a group that converted.
    let paying = 0;
    for (const m of recent) {
      if (m.memberRole === "dependent") continue;
      if (billingFor(m, bctx).mrrCents > 0) paying++;
    }

    // Wizard step drop-off. Only meaningful for sessions that actually ran the
    // wizard — a DTC backstop row jumps straight to "confirmation" and would
    // otherwise look like a perfect conversion at the last step.
    const wizardSessions = sessions.filter((s) => (s.completedSteps?.length ?? 0) > 0);
    const byStep: Record<string, number> = {};
    for (const s of wizardSessions) {
      if (s.status === "completed") continue;
      byStep[s.currentStep] = (byStep[s.currentStep] ?? 0) + 1;
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      windowDays: days,
      stages: [
        { key: "visits", label: "Link visits", value: visits, basis: "repLinkVisits" },
        { key: "started", label: "Enrollments started", value: started, basis: "enrollmentSessions" },
        { key: "completed", label: "Enrollments completed", value: completed, basis: "enrollmentSessions" },
        { key: "paying", label: "Revenue-generating members", value: paying, basis: "direct + employer-billed" },
      ],
      uniqueVisitSessions: visitSessions.size,
      abandoned,
      pendingPayment,
      /** Non-completed wizard sessions by the step they stalled on. */
      wizardDropOff: Object.entries(byStep)
        .map(([step, count]) => ({ step, count }))
        .sort((a, b) => b.count - a.count),
      /**
       * Visit tracking only began when rep-link tracking shipped, so a visit
       * count of zero against a positive enrollment count means "no data yet",
       * not "no traffic".
       */
      visitTrackingActive: visits > 0,
    };
  },
});

/**
 * The follow-up queue: people who started and did not finish.
 *
 * This is the screen that turns the dashboard into a call list, so it carries
 * contact detail where we have it — subject to the same projection rules as
 * the roster.
 */
export const getAbandonedQueue = query({
  args: { days: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 30, 1), 180);
    const limit = Math.min(args.limit ?? 100, 500);
    const since = Date.now() - days * DAY_MS;

    const sessions = await loadScopedSessions(ctx, scope, since);
    const stalled = sessions.filter(
      (s) =>
        s.status === "abandoned" ||
        s.status === "pending_payment" ||
        s.status === "expired" ||
        s.status === "failed",
    );

    const rows = [];
    for (const s of stalled.slice(0, limit)) {
      const member = s.memberId ? await ctx.db.get(s.memberId) : null;
      const group = await ctx.db.get(s.groupId);

      // Fall back to the wizard's captured personal info when no member row
      // was ever created — that is the whole point of this queue.
      // stepData is v.any() in schema.ts — the wizard state shape is not
      // validated server-side, so this is an inherently untyped read.
      const stepInfo = (s.stepData as { personalInfo?: Record<string, unknown> } | undefined)
        ?.personalInfo ?? {};

      rows.push({
        sessionId: s.sessionId,
        enrollmentSessionId: s._id,
        status: s.status,
        currentStep: s.currentStep,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        ageDays: Math.floor((Date.now() - s.createdAt) / DAY_MS),
        firstName: member?.firstName ?? stepInfo.firstName ?? null,
        lastName: member?.lastName ?? stepInfo.lastName ?? null,
        email: member?.email ?? stepInfo.email ?? null,
        phone: member?.phone ?? stepInfo.phone ?? null,
        groupName: group?.name ?? null,
        brokerTrackingCode: s.brokerTrackingCode ?? null,
        memberId: member?._id ?? null,
      });
    }

    // Unattributed abandonment is real volume nobody can act on. Counted for
    // admins so the gap is visible rather than looking like zero.
    let unattributedCarts = 0;
    if (isAdminScope(scope)) {
      const carts = await ctx.db
        .query("cartSessions")
        .withIndex("by_status", (q) => q.eq("status", "abandoned"))
        .collect();
      unattributedCarts = carts.filter((c) => c.createdAt >= since).length;
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      rows: rows.sort((a, b) => b.updatedAt - a.updatedAt),
      total: stalled.length,
      unattributedCarts,
      windowDays: days,
    };
  },
});

/** Where the scope's members came from — code, site, group, lead type. */
export const getAttributionBreakdown = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 90, 1), 365);
    const since = Date.now() - days * DAY_MS;

    const { members } = await loadScopedMembers(ctx, scope);
    const recent = members.filter(
      (m) => m.memberRole !== "dependent" && (m.enrolledAt ?? m.createdAt) >= since,
    );

    const [groups, sites] = await Promise.all([
      ctx.db.query("groups").collect(),
      ctx.db.query("sites").collect(),
    ]);
    const groupNames = new Map(groups.map((g) => [String(g._id), g.name]));
    const siteNames = new Map(sites.map((s) => [String(s._id), s.name]));

    const tally = (rows: string[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r, (m.get(r) ?? 0) + 1);
      return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      windowDays: days,
      byCode: tally(recent.map((m) => m.attributedCode ?? "(no code)")),
      bySite: tally(recent.map((m) => siteNames.get(String(m.siteId)) ?? "(unknown)")),
      byGroup: tally(recent.map((m) => groupNames.get(String(m.groupId)) ?? "(unknown)")),
      byLeadType: tally(recent.map((m) => m.leadType ?? "(unset)")),
      byAttributionSource: tally(recent.map((m) => m.attributionSource ?? "(unstamped)")),
      /**
       * signupSource is free text and in practice only ever "referral:{code}"
       * or "stripe:{id}". There is no UTM or campaign tracking anywhere in the
       * app, so this is not channel attribution and must not be labelled as
       * such.
       */
      signupSourceNote:
        "No UTM/campaign tracking exists. signupSource is free text; treat as diagnostic only.",
      totalMembers: recent.length,
    };
  },
});
