import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";

// Get all team members (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_order")
      .collect();
  },
});

// Get visible team members (for public site)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return members.sort((a, b) => a.order - b.order);
  },
});

// Get single team member
export const getById = query({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create team member
export const create = mutation({
  args: {
    name: v.string(),
    role: v.union(
      v.literal("Co-Founder & Operator"),
      v.literal("Co-Founder & Partner"),
      v.literal("Advisor"),
      v.literal("Team Member")
    ),
    bio: v.string(),
    experience: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
      })
    ),
    linkedin: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get max order if not provided
    let order = args.order;
    if (order === undefined) {
      const allMembers = await ctx.db.query("teamMembers").collect();
      order = allMembers.length > 0 ? Math.max(...allMembers.map((m) => m.order)) + 1 : 0;
    }

    return await ctx.db.insert("teamMembers", {
      name: args.name,
      role: args.role,
      bio: args.bio,
      experience: args.experience,
      linkedin: args.linkedin,
      imageUrl: args.imageUrl,
      order,
      isVisible: args.isVisible ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update team member
export const update = mutation({
  args: {
    id: v.id("teamMembers"),
    name: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("Co-Founder & Operator"),
        v.literal("Co-Founder & Partner"),
        v.literal("Advisor"),
        v.literal("Team Member")
      )
    ),
    bio: v.optional(v.string()),
    experience: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.string(),
        })
      )
    ),
    linkedin: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Remove undefined values
    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    });

    await ctx.db.patch(id, cleanUpdates);
  },
});

// Delete team member
export const remove = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Toggle visibility
export const toggleVisibility = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.id);
    if (member) {
      await ctx.db.patch(args.id, {
        isVisible: !member.isVisible,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reorder team members
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("teamMembers")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }
  },
});

// Resync (clear and reseed) team member data
export const resyncData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing team members
    const existing = await ctx.db.query("teamMembers").collect();
    for (const member of existing) {
      await ctx.db.delete(member._id);
    }
    // Then seed fresh data
    await seedTeamData(ctx);
  },
});

// Seed initial team member data
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("teamMembers").first();
    if (existing) return; // Already seeded
    await seedTeamData(ctx);
  },
});

// Shared seeding logic
async function seedTeamData(ctx: MutationCtx) {

    const founders = [
      {
        name: "Co-Founder",
        role: "Co-Founder & Operator" as const,
        bio: "With a decade of experience managing large-scale operations, our first co-founder brings expertise in logistics, team leadership, and customer experience. Their background in fitness management—overseeing a facility with 10,000+ members—has honed their ability to build systems that scale while maintaining quality and personal touch.",
        experience: [
          {
            title: "General Manager, Crunch Fitness",
            description:
              "Led operations for a facility serving 10,000+ members, managing staff, member experience, and facility logistics.",
          },
          {
            title: "7+ Years in Fitness Industry",
            description:
              "Deep expertise in membership-based businesses, retention strategies, and community building.",
          },
          {
            title: "Logistics & Operations",
            description:
              "Extensive background in supply chain, scheduling, and operational efficiency across multiple industries.",
          },
          {
            title: "Childcare Industry Experience",
            description:
              "Understanding of regulated industries, safety protocols, and family-focused service delivery.",
          },
        ],
        order: 0,
      },
      {
        name: "Kyle",
        role: "Co-Founder & Partner" as const,
        bio: "Kyle brings 8 years of business ownership experience to Ideal. As co-owner of a successful playground installation company, he has built a reputation as a reliable partner to one of the industry's major distributors. His hands-on approach to business and proven track record in partnerships makes him an invaluable asset to our venture-building mission.",
        experience: [
          {
            title: "Co-Owner, Playground Installation Company",
            description:
              "Built and scaled a successful installation business from the ground up over 8 years.",
          },
          {
            title: "Strategic Partnership Development",
            description:
              "Established and maintained reliable partnership with a major playground equipment distributor.",
          },
          {
            title: "8+ Years Business Ownership",
            description:
              "Proven track record in entrepreneurship, financial management, and business growth.",
          },
          {
            title: "Operations & Project Management",
            description:
              "Expertise in managing complex installation projects, timelines, and client relationships.",
          },
        ],
        order: 1,
      },
      {
        name: "Julian Lago",
        role: "Advisor" as const,
        bio: "Julian brings strategic insight and industry connections to Ideal. His experience in technology and business development helps guide our venture portfolio toward sustainable growth and meaningful impact.",
        experience: [
          {
            title: "Strategic Advisory",
            description:
              "Provides guidance on business strategy, market positioning, and growth opportunities.",
          },
          {
            title: "Industry Connections",
            description:
              "Leverages extensive network to create partnership and investment opportunities.",
          },
        ],
        linkedin: "https://www.linkedin.com/in/jlago",
        order: 2,
      },
    ];

    for (const member of founders) {
      await ctx.db.insert("teamMembers", {
        ...member,
        imageUrl: undefined,
        isVisible: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
