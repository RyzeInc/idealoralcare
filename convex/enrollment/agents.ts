/**
 * Public Agent Queries
 * Used by checkout page for agent/rep code selection.
 *
 * Design contract (no Clerk dependencies):
 *   brokerTrackingCodes.brokerId  → partnerLeaders._id
 *   brokerTrackingCodes.agencyId  → distributionPartners._id
 *
 * All resolution is done via direct Convex _id lookups.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Public-facing agent record structure
 * Used for the Agent dropdown selector on checkout
 */
export interface PublicAgent {
  id: string; // partnerLeader._id
  name: string;
  repCode: string;
  groupId: string | null; // distributionPartner._id if linked
  groupName: string | null;
  slug: string; // URL-friendly: firstnamelastname (lowercase, no spaces)
}

/**
 * Public-facing group record structure
 * Used for the Group dropdown selector on checkout
 */
export interface PublicGroup {
  id: string; // distributionPartner._id
  name: string;
  type: "program_manager" | "fmo" | "agency";
}

// ── Shared resolution helpers ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCodeToAgent(code: any, ctx: any): Promise<PublicAgent> {
  const brokerId: string = code.brokerId;

  // brokerId is always a partnerLeaders._id
  const leader = await ctx.db.get(brokerId as Id<"partnerLeaders">);
  const name: string = leader?.name ?? "Unknown Agent";

  let groupId: string | null = null;
  let groupName: string | null = null;

  // Prefer agencyId on the code row (direct distributionPartners._id)
  const agencyIdStr: string | undefined = code.agencyId;
  if (agencyIdStr) {
    const agency = await ctx.db.get(agencyIdStr as Id<"distributionPartners">);
    if (agency) { groupId = agency._id; groupName = agency.name; }
  }

  // Fallback: leader.partnerId
  if (!groupId && leader?.partnerId) {
    const partner = await ctx.db.get(leader.partnerId as Id<"distributionPartners">);
    if (partner) { groupId = partner._id; groupName = partner.name; }
  }

  const slug = (code.slug as string | undefined) ||
    name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  return { id: brokerId, name, repCode: code.code, groupId, groupName, slug };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichCodeRow(code: any, ctx: any): Promise<RepUrlResolution> {
  const brokerId: string = code.brokerId;

  // brokerId is always a partnerLeaders._id
  const leader = await ctx.db.get(brokerId as Id<"partnerLeaders">);
  const agentName: string | null = leader?.name ?? null;

  let groupId: string | null = null;

  const agencyIdStr: string | undefined = code.agencyId;
  if (agencyIdStr) {
    const agency = await ctx.db.get(agencyIdStr as Id<"distributionPartners">);
    if (agency) groupId = agency._id;
  }

  if (!groupId && leader?.partnerId) {
    const partner = await ctx.db.get(leader.partnerId as Id<"distributionPartners">);
    if (partner) groupId = partner._id;
  }

  const derivedSlug = agentName ? agentName.toLowerCase().replace(/[^a-z0-9]/g, "") : null;

  return {
    repCode: code.code,
    canonicalSlug: (code.slug as string | undefined) ?? derivedSlug,
    agentName,
    groupId,
    productHint: code.productHint ?? null,
  };
}

// ── Public queries ─────────────────────────────────────────────────────────

/**
 * List all active groups (distribution partners)
 */
export const listPublicGroups = query({
  args: {},
  handler: async (ctx): Promise<PublicGroup[]> => {
    const partners = await ctx.db
      .query("distributionPartners")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return partners.map((p) => ({
      id: p._id,
      name: p.name,
      type: p.type,
    }));
  },
});

/**
 * List all active agents with rep codes
 */
export const listPublicAgents = query({
  args: {},
  handler: async (ctx): Promise<PublicAgent[]> => {
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return [];

    // Cache all leaders and partners for batch resolution
    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerById = new Map(partners.map((p) => [p._id as string, p]));

    const agentMap = new Map<string, PublicAgent>();

    for (const code of codes) {
      const brokerId = code.brokerId;
      if (agentMap.has(brokerId)) continue;

      const leader = leaderById.get(brokerId);
      const name = leader?.name ?? "Unknown Agent";

      let groupId: string | null = null;
      let groupName: string | null = null;

      if (code.agencyId) {
        const agency = partnerById.get(code.agencyId as string);
        if (agency) { groupId = agency._id; groupName = agency.name; }
      }
      if (!groupId && leader?.partnerId) {
        const partner = partnerById.get(leader.partnerId as string);
        if (partner) { groupId = partner._id; groupName = partner.name; }
      }

      const slug = (code.slug as string | undefined) ||
        name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      agentMap.set(brokerId, { id: brokerId, name, repCode: code.code, groupId, groupName, slug });
    }

    return Array.from(agentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get agent by URL slug
 * Resolution: stored slug index → legacy name-slug scan
 */
export const getAgentBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<PublicAgent | null> => {
    const normalizedSlug = args.slug.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Stored slug index (fastest path)
    const bySlug = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
      .first();
    if (bySlug?.status === "active") return resolveCodeToAgent(bySlug, ctx);

    // 2. Legacy: scan and match computed name slug
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (codes.length === 0) return null;

    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    for (const code of codes) {
      const leader = leaderById.get(code.brokerId);
      if (!leader?.name) continue;
      const computedSlug = leader.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (computedSlug === normalizedSlug) return resolveCodeToAgent(code, ctx);
    }

    return null;
  },
});

/**
 * Get agent by rep code
 */
export const getAgentByRepCode = query({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<PublicAgent | null> => {
    const codeRow =
      await ctx.db
        .query("brokerTrackingCodes")
        .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
        .first() ??
      await ctx.db
        .query("brokerTrackingCodes")
        .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
        .first();

    if (!codeRow || codeRow.status !== "active") return null;
    return resolveCodeToAgent(codeRow, ctx);
  },
});

/**
 * List agents filtered by group
 */
export const listAgentsByGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, args): Promise<PublicAgent[]> => {
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return [];

    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerById = new Map(partners.map((p) => [p._id as string, p]));

    const results: PublicAgent[] = [];
    const seen = new Set<string>();

    for (const code of codes) {
      const brokerId = code.brokerId;
      if (seen.has(brokerId)) continue;

      const leader = leaderById.get(brokerId);
      const name = leader?.name ?? "Unknown Agent";

      let groupId: string | null = null;
      let groupName: string | null = null;

      if (code.agencyId) {
        const agency = partnerById.get(code.agencyId as string);
        if (agency) { groupId = agency._id; groupName = agency.name; }
      }
      if (!groupId && leader?.partnerId) {
        const partner = partnerById.get(leader.partnerId as string);
        if (partner) { groupId = partner._id; groupName = partner.name; }
      }

      if (groupId !== args.groupId) continue;

      seen.add(brokerId);
      const slug = (code.slug as string | undefined) ||
        name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      results.push({ id: brokerId, name, repCode: code.code, groupId, groupName, slug });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// ── Rep URL Resolution ─────────────────────────────────────────────────────

export interface RepUrlResolution {
  repCode: string;
  canonicalSlug: string | null;
  agentName: string | null;
  groupId: string | null;
  productHint: "essentials" | "oralcare" | "plans" | null;
}

/**
 * Resolve a URL segment to a rep code.
 *
 * Resolution order:
 *  1. Exact rep-code match (tries UPPER then raw)
 *  2. Stored slug match (by_slug index)
 *  3. Legacy computed name-slug scan (backward compat for pre-slug links)
 *
 * Used by /[agentSlug]/route.ts for URL routing.
 */
export const resolveRepUrl = query({
  args: { segment: v.string() },
  handler: async (ctx, { segment }): Promise<RepUrlResolution | null> => {
    const raw = segment.trim();
    const upper = raw.toUpperCase();
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Exact code match
    const byUpper = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", upper))
      .first();
    if (byUpper?.status === "active") return enrichCodeRow(byUpper, ctx);

    if (raw !== upper) {
      const byRaw = await ctx.db
        .query("brokerTrackingCodes")
        .withIndex("by_code", (q) => q.eq("code", raw))
        .first();
      if (byRaw?.status === "active") return enrichCodeRow(byRaw, ctx);
    }

    // 2. Stored slug
    const bySlug = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_slug", (q) => q.eq("slug", normalized))
      .first();
    if (bySlug?.status === "active") return enrichCodeRow(bySlug, ctx);

    // 3. Legacy: scan and match computed name slug
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (codes.length === 0) return null;

    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    for (const code of codes) {
      const leader = leaderById.get(code.brokerId);
      if (!leader?.name) continue;
      const nameSlug = leader.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nameSlug === normalized) return enrichCodeRow(code, ctx);
    }

    return null;
  },
});
