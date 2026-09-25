/**
 * REP LINK VISITS — the top of the production funnel.
 *
 * Before this, a rep code produced exactly one signal: a completed enrollment.
 * `brokerTrackingCodes.usageCount` existed but was never incremented, so every
 * usage figure in the admin UI read zero and there was no way to distinguish a
 * code nobody clicked from one that converted badly. Those are opposite
 * problems with opposite fixes.
 *
 * Like the shop-click beacon, this is a write an unauthenticated visitor can
 * trigger, so it is deliberately narrow: the code must resolve to a real
 * `brokerTrackingCodes` row, and everything stored is either derived from that
 * row or a bounded string. A forged request can inflate a counter; it cannot
 * write arbitrary data or attribute a visit to a code that does not exist.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { resolveViewerScope, scopeLabel } from "./scope";

const MAX_STR = 512;
const clip = (s: string | undefined) => (s ? s.slice(0, MAX_STR) : undefined);

/**
 * Bot classification, applied at write time as a HINT and stored rather than
 * enforced. Reads filter on it, so the rule can be tightened later without
 * having discarded the underlying rows.
 */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|preview|curl|wget|python-requests|axios|postman/i;

export function looksLikeBot(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // no UA at all is far more often a script than a person
  return BOT_PATTERN.test(userAgent);
}

/**
 * Record a visit to a rep link.
 *
 * Fire-and-forget. Returns null in every case, including unknown codes — the
 * caller is a redirect or a beacon and has nothing to do with an error.
 */
export const recordRepLinkVisit = mutation({
  args: {
    code: v.string(),
    slug: v.optional(v.string()),
    siteSlug: v.optional(v.string()),
    path: v.optional(v.string()),
    referrer: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    source: v.union(v.literal("vanity_url"), v.literal("ref_param")),
  },
  handler: async (ctx, args) => {
    const raw = args.code?.trim();
    if (!raw) return null;

    // Resolve against a real code so we never accumulate rows for codes that
    // do not exist. Codes are issued uppercase-insensitively in URLs.
    let codeRow = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", raw))
      .first();
    if (!codeRow && raw !== raw.toUpperCase()) {
      codeRow = await ctx.db
        .query("brokerTrackingCodes")
        .withIndex("by_code", (q) => q.eq("code", raw.toUpperCase()))
        .first();
    }
    if (!codeRow || codeRow.status === "revoked") return null;

    const now = Date.now();
    const isBot = looksLikeBot(args.userAgent);

    await ctx.db.insert("repLinkVisits", {
      code: codeRow.code,
      slug: clip(args.slug ?? codeRow.slug ?? undefined),
      siteSlug: clip(args.siteSlug),
      path: clip(args.path) ?? "/",
      referrer: clip(args.referrer),
      sessionId: clip(args.sessionId),
      source: args.source,
      isBot,
      createdAt: now,
    });

    // Only human traffic moves the counter the admin UI shows. Bot rows are
    // still stored so a later reclassification can recount them.
    if (!isBot) {
      await ctx.db.patch(codeRow._id, {
        usageCount: (codeRow.usageCount ?? 0) + 1,
        lastUsedAt: now,
      });
    }

    return null;
  },
});

/** Visit counts per code for the caller's scope, over a window. */
export const getVisitsByCode = query({
  args: { days: v.optional(v.number()), includeBots: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 30, 1), 365);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Admin sees every code; a partner or rep sees only their own.
    const codes =
      scope.kind === "admin"
        ? (await ctx.db.query("brokerTrackingCodes").collect()).map((c) => c.code)
        : scope.codes;

    const rows: Array<{ code: string; visits: number; uniqueSessions: number; lastVisitAt: number | null }> = [];
    for (const code of codes) {
      const visits = await ctx.db
        .query("repLinkVisits")
        .withIndex("by_code_created", (q) => q.eq("code", code).gte("createdAt", since))
        .collect();
      const counted = args.includeBots ? visits : visits.filter((v2) => !v2.isBot);
      const sessions = new Set(counted.map((v2) => v2.sessionId).filter(Boolean));
      rows.push({
        code,
        visits: counted.length,
        uniqueSessions: sessions.size,
        lastVisitAt: counted.length ? Math.max(...counted.map((v2) => v2.createdAt)) : null,
      });
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      windowDays: days,
      rows: rows.sort((a, b) => b.visits - a.visits),
      totalVisits: rows.reduce((s, r) => s + r.visits, 0),
    };
  },
});
