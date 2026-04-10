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
    const partnerById = new Map(partners.map((p) => [p._id, p]));

    // Build agent list - one entry per unique broker
    const agentMap = new Map<string, PublicAgent>();

    for (const code of codes) {
      const brokerId = code.brokerId;
      if (agentMap.has(brokerId)) continue; // Already added

      const admin = adminMap.get(brokerId);
      let name = admin?.name || "Unknown Agent";
      let groupId: string | null = null;
      let groupName: string | null = null;

      // Check if broker is a distribution partner
      const partner = partnerByClerkId.get(brokerId);
      if (partner) {
        groupId = partner._id;
        groupName = partner.name;
      } else {
        // Check if broker is a partner leader
        const leader = leaderByClerkId.get(brokerId);
        if (leader) {
          const leaderPartner = partnerById.get(leader.partnerId);
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
      if (!groupId && code.agencyId) {
        const agency = partners.find((p) => p.clerkUserId === code.agencyId);
        if (agency) {
          groupId = agency._id;
          groupName = agency.name;
        }
      }

      // Generate URL slug from name
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();

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
    
    // Get all active agents and find matching slug
    // (Could be optimized with an index if this becomes a bottleneck)
    const codes = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (codes.length === 0) return null;

    const adminUsers = await ctx.db.query("adminUsers").collect();
    const partners = await ctx.db.query("distributionPartners").collect();
    const leaders = await ctx.db.query("partnerLeaders").collect();

    const partnerByClerkId = new Map(
      partners.filter((p) => p.clerkUserId).map((p) => [p.clerkUserId!, p])
    );
    const leaderByClerkId = new Map(
      leaders.filter((l) => l.clerkUserId).map((l) => [l.clerkUserId!, l])
    );
    const partnerById = new Map(partners.map((p) => [p._id, p]));

    for (const code of codes) {
      const brokerId = code.brokerId;
      const admin = adminUsers.find((u) => u.clerkUserId === brokerId);
      let name = admin?.name || "";
      let groupId: string | null = null;
      let groupName: string | null = null;

      // Get name from leader if not in adminUsers
      if (!admin) {
        const leader = leaderByClerkId.get(brokerId);
        if (leader) name = leader.name;
      }

      const agentSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (agentSlug === normalizedSlug) {
        // Found match - build full agent record
        const partner = partnerByClerkId.get(brokerId);
        if (partner) {
          groupId = partner._id;
          groupName = partner.name;
        } else {
          const leader = leaderByClerkId.get(brokerId);
          if (leader) {
            const leaderPartner = partnerById.get(leader.partnerId);
            if (leaderPartner) {
              groupId = leaderPartner._id;
              groupName = leaderPartner.name;
            }
          }
        }

        if (!groupId && code.agencyId) {
          const agency = partners.find((p) => p.clerkUserId === code.agencyId);
          if (agency) {
            groupId = agency._id;
            groupName = agency.name;
          }
        }

        return {
          id: brokerId,
          name,
          repCode: code.code,
          groupId,
          groupName,
          slug: agentSlug,
        };
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
    const normalizedCode = args.code.trim().toUpperCase();
    
    const trackingCode = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .first();

    // Also try lowercase/original case
    const trackingCodeLower = trackingCode || await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .first();

    const code = trackingCode || trackingCodeLower;
    if (!code || code.status !== "active") return null;

    const brokerId = code.brokerId;
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", brokerId))
      .first();

    let name = admin?.name || "";
    let groupId: string | null = null;
    let groupName: string | null = null;

    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerByClerkId = new Map(
      partners.filter((p) => p.clerkUserId).map((p) => [p.clerkUserId!, p])
    );

    const partner = partnerByClerkId.get(brokerId);
    if (partner) {
      groupId = partner._id;
      groupName = partner.name;
    } else {
      const leader = await ctx.db
        .query("partnerLeaders")
        .filter((q) => q.eq(q.field("clerkUserId"), brokerId))
        .first();
      
      if (leader) {
        const leaderPartner = await ctx.db.get(leader.partnerId);
        if (leaderPartner) {
          groupId = leaderPartner._id;
          groupName = leaderPartner.name;
        }
        if (!admin) name = leader.name;
      }
    }

    if (!groupId && code.agencyId) {
      const agency = partners.find((p) => p.clerkUserId === code.agencyId);
      if (agency) {
        groupId = agency._id;
        groupName = agency.name;
      }
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    return {
      id: brokerId,
      name,
      repCode: code.code,
      groupId,
      groupName,
      slug,
    };
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
    const partnerById = new Map(partners.map((p) => [p._id, p]));

    // Build agent list filtered by group - one entry per unique broker
    const results: PublicAgent[] = [];

    for (const code of codes) {
      const brokerId = code.brokerId;
      // Skip if already added
      if (results.some((r) => r.id === brokerId)) continue;

      const admin = adminMap.get(brokerId);
      let name = admin?.name || "Unknown Agent";
      let groupId: string | null = null;
      let groupName: string | null = null;

      // Check if broker is a distribution partner
      const partner = partnerByClerkId.get(brokerId);
      if (partner) {
        groupId = partner._id;
        groupName = partner.name;
      } else {
        // Check if broker is a partner leader
        const leader = leaderByClerkId.get(brokerId);
        if (leader) {
          const leaderPartner = partnerById.get(leader.partnerId);
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
      if (!groupId && code.agencyId) {
        const agency = partners.find((p) => p.clerkUserId === code.agencyId);
        if (agency) {
          groupId = agency._id;
          groupName = agency.name;
        }
      }

      // Only include if matches the requested group
      if (groupId !== args.groupId) continue;

      // Generate URL slug from name
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim();

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
