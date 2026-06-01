/**
 * Public Agent Queries
 * Used by checkout page for agent/rep code selection
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Public-facing agent record structure
 * Used for the Agent dropdown selector on checkout
 */
export interface PublicAgent {
  id: string; // brokerId (clerkUserId)
  name: string;
  repCode: string;
  groupId: string | null; // distributionPartner ID if linked
  groupName: string | null;
  slug: string; // URL-friendly: firstnamelastname (lowercase, no spaces)
}

/**
 * Public-facing group record structure
 * Used for the Group dropdown selector on checkout
 */
export interface PublicGroup {
  id: string; // distributionPartner _id
  name: string;
  type: "program_manager" | "fmo" | "agency";
}

/**
 * List all active groups (distribution partners)
 * Returns groups that customers can select from
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
 * Returns agents that customers can select from, with their group associations
 */
export const listPublicAgents = query({
  args: {},
  handler: async (ctx): Promise<PublicAgent[]> => {
    // Get all active rep codes
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return [];

    // Get unique broker IDs
    const brokerIds = [...new Set(codes.map((c) => c.brokerId))];

    // Fetch admin users for these brokers
    const adminUsers = await ctx.db.query("adminUsers").collect();
    const adminMap = new Map(
      adminUsers
        .filter((u) => brokerIds.includes(u.clerkUserId))
        .map((u) => [u.clerkUserId, u])
    );

    // Fetch distribution partners for group names
    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerByClerkId = new Map(
      partners
        .filter((p) => p.clerkUserId)
        .map((p) => [p.clerkUserId!, p])
    );

    // Also check partnerLeaders for group associations
    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderByClerkId = new Map(
      leaders
        .filter((l) => l.clerkUserId)
        .map((l) => [l.clerkUserId!, l])
    );
    // Index for unclaimed-invite reps whose brokerId == partnerLeader._id
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));
    const partnerById = new Map(partners.map((p) => [p._id as string, p]));

    // Build agent list - one entry per unique broker
    const agentMap = new Map<string, PublicAgent>();

    for (const code of codes) {
      const brokerId = code.brokerId;
      if (agentMap.has(brokerId)) continue; // Already added

      const admin = adminMap.get(brokerId);
      let name = admin?.name || "";
      let groupId: string | null = null;
      let groupName: string | null = null;

      // Check if broker is a distribution partner
      const partner = partnerByClerkId.get(brokerId);
      if (partner) {
        groupId = partner._id;
        groupName = partner.name;
      } else {
        // Check if broker is a partner leader (by clerkUserId first, then by _id)
        const leader = leaderByClerkId.get(brokerId) || leaderById.get(brokerId);
        if (leader) {
          const leaderPartner = partnerById.get(leader.partnerId as string);
          if (leaderPartner) {
            groupId = leaderPartner._id;
            groupName = leaderPartner.name;
          }
          if (!admin) {
            name = leader.name;
          }
        }
      }

      // Check agencyId from the rep code
      // agencyId stores the distributionPartners _id directly
      if (!groupId && code.agencyId) {
        const agency =
          partnerById.get(code.agencyId as string) ||
          partners.find((p) => p.clerkUserId === code.agencyId);
        if (agency) {
          groupId = agency._id;
          groupName = agency.name;
        }
      }

      if (!name) name = "Unknown Agent";

      // Generate URL slug from name (use stored slug if available)
      const slug = (code.slug as string | undefined) ||
        name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      agentMap.set(brokerId, {
        id: brokerId,
        name,
        repCode: code.code, // Use first code found for this broker
        groupId,
        groupName,
        slug,
      });
    }

    return Array.from(agentMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },
});

/**
 * Get agent by URL slug (firstnamelastname)
 * Used for /[agentSlug] URL routing
 */
export const getAgentBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<PublicAgent | null> => {
    const normalizedSlug = args.slug.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Direct stored-slug lookup (fastest path)
    const bySlug = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
      .first();
    if (bySlug?.status === "active") {
      return resolveCodeToAgent(bySlug, ctx);
    }

    // 2. Legacy: scan by computed name slug
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return null;

    const adminUsers = await ctx.db.query("adminUsers").collect();
    const partners = await ctx.db.query("distributionPartners").collect();
    const leaders = await ctx.db.query("partnerLeaders").collect();

    const leaderByClerkId = new Map(
      leaders.filter((l) => l.clerkUserId).map((l) => [l.clerkUserId!, l])
    );
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    for (const code of codes) {
      const brokerId = code.brokerId;
      const admin = adminUsers.find((u) => u.clerkUserId === brokerId);
      let name = admin?.name || "";

      if (!admin) {
        const leader = leaderByClerkId.get(brokerId) || leaderById.get(brokerId);
        if (leader) name = leader.name;
      }

      const agentSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (agentSlug === normalizedSlug) {
        return resolveCodeToAgent(code, ctx);
      }
    }

    return null;
  },
});

/**
 * Get agent by rep code
 * Used for cross-population when switching from Rep Code to Agent mode
 */
export const getAgentByRepCode = query({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<PublicAgent | null> => {
    const codeRow = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .first() ?? await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .first();

    if (!codeRow || codeRow.status !== "active") return null;
    return resolveCodeToAgent(codeRow, ctx);
  },
});

/**
 * List agents filtered by group
 * Used when user selects a group first
 */
export const listAgentsByGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, args): Promise<PublicAgent[]> => {
    // Get all active rep codes
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return [];

    const brokerIds = [...new Set(codes.map((c) => c.brokerId))];

    const adminUsers = await ctx.db.query("adminUsers").collect();
    const adminMap = new Map(
      adminUsers
        .filter((u) => brokerIds.includes(u.clerkUserId))
        .map((u) => [u.clerkUserId, u])
    );

    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerByClerkId = new Map(
      partners.filter((p) => p.clerkUserId).map((p) => [p.clerkUserId!, p])
    );
    const partnerById = new Map(partners.map((p) => [p._id as string, p]));

    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderByClerkId = new Map(
      leaders.filter((l) => l.clerkUserId).map((l) => [l.clerkUserId!, l])
    );
    const leaderById = new Map(leaders.map((l) => [l._id as string, l]));

    const results: PublicAgent[] = [];

    for (const code of codes) {
      const brokerId = code.brokerId;
      if (results.some((r) => r.id === brokerId)) continue;

      const admin = adminMap.get(brokerId);
      let name = admin?.name || "";
      let groupId: string | null = null;
      let groupName: string | null = null;

      const partner = partnerByClerkId.get(brokerId);
      if (partner) {
        groupId = partner._id;
        groupName = partner.name;
      } else {
        const leader = leaderByClerkId.get(brokerId) || leaderById.get(brokerId);
        if (leader) {
          const leaderPartner = partnerById.get(leader.partnerId as string);
          if (leaderPartner) {
            groupId = leaderPartner._id;
            groupName = leaderPartner.name;
          }
          if (!admin) name = leader.name;
        }
      }

      if (!groupId && code.agencyId) {
        const agency =
          partnerById.get(code.agencyId as string) ||
          partners.find((p) => p.clerkUserId === code.agencyId);
        if (agency) {
          groupId = agency._id;
          groupName = agency.name;
        }
      }

      if (groupId !== args.groupId) continue;

      if (!name) name = "Unknown Agent";
      const slug = (code.slug as string | undefined) ||
        name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      results.push({
        id: brokerId,
        name,
        repCode: code.code,
        groupId,
        groupName,
        slug,
      });
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
 * Shared helper: given an active brokerTrackingCodes row, enrich it with
 * agent name, group info, and productHint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichCodeRow(code: any, ctx: any): Promise<RepUrlResolution> {
  const brokerId = code.brokerId;

  // Fetch admin user (brokerId is normally a Clerk userId)
  const admin = await ctx.db
    .query("adminUsers")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", brokerId))
    .first();

  let name: string = admin?.name || "";
  let groupId: string | null = null;
  let groupName: string | null = null;

  // Determine group via distribution partner or leader
  const partners = await ctx.db.query("distributionPartners").collect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partner = partners.find((p: any) => p.clerkUserId === brokerId);

  if (partner) {
    groupId = partner._id;
    groupName = partner.name;
  } else {
    // Try by Clerk userId first
    let leader = await ctx.db
      .query("partnerLeaders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.eq(q.field("clerkUserId"), brokerId))
      .first();

    // Fallback: brokerId might be a partnerLeader _id (unclaimed-invite rep)
    if (!leader) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leader = await ctx.db.get(brokerId as any);
        // Make sure it's actually a partnerLeaders doc (has partnerId field)
        if (leader && !(leader as any).partnerId) leader = null;
      } catch {
        leader = null;
      }
    }

    if (leader) {
      if (!admin) name = (leader as any).name || name;
      const leaderPartner = await ctx.db.get((leader as any).partnerId);
      if (leaderPartner) {
        groupId = (leaderPartner as any)._id;
        groupName = (leaderPartner as any).name;
      }
    }
  }

  // Fallback: agency recorded on the rep code row
  // agencyId stores the distributionPartners _id directly (not clerkUserId)
  if (!groupId && code.agencyId) {
    const agency =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (partners as any[]).find((p: any) => p._id === code.agencyId) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (partners as any[]).find((p: any) => p.clerkUserId === code.agencyId);
    if (agency) {
      groupId = agency._id;
      groupName = agency.name;
    }
  }

  const derivedSlug = name ? name.toLowerCase().replace(/[^a-z0-9]/g, "") : null;

  return {
    repCode: code.code,
    canonicalSlug: code.slug ?? derivedSlug,
    agentName: name || null,
    groupId,
    productHint: code.productHint ?? null,
  };
}

/**
 * Shared helper: resolve a brokerTrackingCodes row to a PublicAgent record.
 * Handles both Clerk-userId brokers AND unclaimed-invite reps (brokerId == partnerLeader._id).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCodeToAgent(code: any, ctx: any): Promise<PublicAgent> {
  const brokerId = code.brokerId;

  const admin = await ctx.db
    .query("adminUsers")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", brokerId))
    .first();

  let name: string = admin?.name || "";
  let groupId: string | null = null;
  let groupName: string | null = null;

  const partners = await ctx.db.query("distributionPartners").collect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partnerByClerkId = new Map(partners.filter((p: any) => p.clerkUserId).map((p: any) => [p.clerkUserId!, p]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partnerById = new Map(partners.map((p: any) => [p._id as string, p]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partner = partnerByClerkId.get(brokerId) as any;
  if (partner) {
    groupId = partner._id;
    groupName = partner.name;
  } else {
    // Try leader by clerkUserId first
    let leader: any = await ctx.db
      .query("partnerLeaders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.eq(q.field("clerkUserId"), brokerId))
      .first();
    // Fallback: brokerId may be a partnerLeader _id (unclaimed-invite rep)
    if (!leader) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidate = await ctx.db.get(brokerId as any);
        if (candidate && (candidate as any).partnerId) leader = candidate;
      } catch { /* ignore */ }
    }
    if (leader) {
      if (!admin) name = leader.name || name;
      const leaderPartner = partnerById.get(String(leader.partnerId));
      if (leaderPartner) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        groupId = (leaderPartner as any)._id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        groupName = (leaderPartner as any).name;
      }
    }
  }

  if (!groupId && code.agencyId) {
    const agency =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partnerById.get(code.agencyId as string) as any ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (partners as any[]).find((p: any) => p.clerkUserId === code.agencyId);
    if (agency) {
      groupId = agency._id;
      groupName = agency.name;
    }
  }

  if (!name) name = "Unknown Agent";
  const slug = (code.slug as string | undefined) ||
    name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  return {
    id: brokerId,
    name,
    repCode: code.code,
    groupId,
    groupName,
    slug,
  };
}

/**
 * Resolve a URL segment to a rep code.
 *
 * Resolution order:
 *  1. Exact rep-code match (case-insensitive: tries UPPER then raw)
 *  2. Stored slug match (by_slug index)
 *  3. Legacy computed name-slug scan (backward compat for pre-slug links)
 *
 * Used by /[agentSlug]/page.tsx for the URL routing layer.
 */
export const resolveRepUrl = query({
  args: { segment: v.string() },
  handler: async (ctx, { segment }): Promise<RepUrlResolution | null> => {
    const raw = segment.trim();
    const upper = raw.toUpperCase();
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Exact code match — try uppercase first (canonical form), then raw
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

    // 3. Legacy: scan active codes and match computed name slug
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (codes.length === 0) return null;

    const adminUsers = await ctx.db.query("adminUsers").collect();
    const leaders = await ctx.db.query("partnerLeaders").collect();

    for (const code of codes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = adminUsers.find((u: any) => u.clerkUserId === code.brokerId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leader = admin ? null : leaders.find((l: any) => l.clerkUserId === code.brokerId);
      const name = admin?.name || leader?.name || "";
      if (!name) continue;
      const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nameSlug && nameSlug === normalized) {
        return enrichCodeRow(code, ctx);
      }
    }

    return null;
  },
});
