import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

// Get all ventures (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("ventures").withIndex("by_order").collect();
  },
});

// Get visible ventures (for public site)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return ventures.sort((a, b) => a.order - b.order);
  },
});

// Get ventures by category
export const getByCategory = query({
  args: {
    category: v.union(
      v.literal("Apps"),
      v.literal("Partnerships"),
      v.literal("In Development"),
      v.literal("All")
    ),
  },
  handler: async (ctx, args) => {
    if (args.category === "All") {
      const ventures = await ctx.db
        .query("ventures")
        .withIndex("by_visible", (q) => q.eq("isVisible", true))
        .collect();
      return ventures.sort((a, b) => a.order - b.order);
    }
    const category = args.category as "Apps" | "Partnerships" | "In Development";
    const ventures = await ctx.db
      .query("ventures")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();
    return ventures.filter((v) => v.isVisible).sort((a, b) => a.order - b.order);
  },
});

// Get venture by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ventures")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get single venture by ID
export const getById = query({
  args: { id: v.id("ventures") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create venture
export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    tagline: v.string(),
    description: v.string(),
    problem: v.string(),
    solution: v.string(),
    category: v.union(
      v.literal("Apps"),
      v.literal("Partnerships"),
      v.literal("In Development")
    ),
    status: v.union(
      v.literal("Active"),
      v.literal("In Development"),
      v.literal("Coming Soon")
    ),
    link: v.optional(v.string()),
    values: v.array(v.string()),
    metrics: v.optional(
      v.array(
        v.object({
          label: v.string(),
          value: v.string(),
        })
      )
    ),
    features: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Get max order if not provided
    let order = args.order;
    if (order === undefined) {
      const allVentures = await ctx.db.query("ventures").collect();
      order = allVentures.length > 0 ? Math.max(...allVentures.map((v) => v.order)) + 1 : 0;
    }

    return await ctx.db.insert("ventures", {
      slug: args.slug,
      name: args.name,
      tagline: args.tagline,
      description: args.description,
      problem: args.problem,
      solution: args.solution,
      category: args.category,
      status: args.status,
      link: args.link,
      values: args.values,
      metrics: args.metrics,
      features: args.features,
      order,
      isVisible: args.isVisible ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update venture
export const update = mutation({
  args: {
    id: v.id("ventures"),
    slug: v.optional(v.string()),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    problem: v.optional(v.string()),
    solution: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("Apps"),
        v.literal("Partnerships"),
        v.literal("In Development")
      )
    ),
    status: v.optional(
      v.union(
        v.literal("Active"),
        v.literal("In Development"),
        v.literal("Coming Soon")
      )
    ),
    link: v.optional(v.string()),
    values: v.optional(v.array(v.string())),
    metrics: v.optional(
      v.array(
        v.object({
          label: v.string(),
          value: v.string(),
        })
      )
    ),
    features: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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

// Delete venture
export const remove = mutation({
  args: { id: v.id("ventures") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// Toggle visibility
export const toggleVisibility = mutation({
  args: { id: v.id("ventures") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const venture = await ctx.db.get(args.id);
    if (venture) {
      await ctx.db.patch(args.id, {
        isVisible: !venture.isVisible,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reorder ventures
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("ventures")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }
  },
});

// Resync (clear and reseed) venture data
export const resyncData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing ventures
    const existing = await ctx.db.query("ventures").collect();
    for (const venture of existing) {
      await ctx.db.delete(venture._id);
    }
    // Then seed fresh data
    await seedVentureData(ctx);
  },
});

// Seed initial venture data
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("ventures").first();
    if (existing) return; // Already seeded
    await seedVentureData(ctx);
  },
});

// Shared seeding logic
async function seedVentureData(ctx: MutationCtx) {

    const ventures = [
      {
        slug: "iwtns",
        name: "iWTNS",
        tagline: "Real-time legal support for roadside encounters.",
        description:
          "iWTNS is an insurance-style preparedness membership for motorists that delivers immediate, real-time legal support during roadside encounters—powered by instant video calling and a routed attorney network—plus post-incident follow-through.",
        problem:
          "Roadside interactions are high-stakes, time-compressed, and asymmetrical—one party is trained and empowered while the other is often stressed and improvising. People make irreversible mistakes in the first few minutes: oversharing, consenting unnecessarily, escalating tone, or failing to preserve key details. Traditional legal coverage fails at the exact moment it's needed because it's not instant or operationalized for 'right now.'",
        solution:
          "iWTNS provides one-tap immediate connection to a routed attorney during traffic stops and roadside encounters. Our platform combines instant video/voice connection, smart geographic routing, structured incident capture, and post-incident follow-through. It's a stability mechanism in a chaotic moment—reducing the gap between what people think their rights are and what they actually do under stress.",
        category: "Apps" as const,
        status: "Active" as const,
        link: "https://iwtns.com",
        values: ["Stewardship", "Clarity", "Security"],
        metrics: [
          { label: "Response Time", value: "<60s" },
          { label: "Attorney Network", value: "50 States" },
          { label: "Member Satisfaction", value: "4.9/5" },
        ],
        features: [
          "One-tap instant attorney connection",
          "Geographic routing to local counsel",
          "Real-time video/voice support",
          "Incident documentation capture",
          "Post-incident case follow-through",
        ],
        order: 0,
      },
      {
        slug: "tallyup",
        name: "TallyUp",
        tagline: "Turn financial ambiguity into clear choices.",
        description:
          "TallyUp is a personal financial truth engine—an app that helps you build a clean, trustworthy picture of your money without requiring you to already be organized. It combines tracking, understanding, decision support, and readiness into one system.",
        problem:
          "Most personal finance apps either rely on aggregation and guesswork (leading to wrong categories and users who stop trusting it), require high discipline (causing burnout), or show what happened without helping with what to do next. People aren't broke from ignorance—they're broke from unclear reality, inconsistent income timing, hidden recurring costs, and decisions made under uncertainty.",
        solution:
          "TallyUp uses manual-first truth capture, a review inbox as a reliability layer, a recurring system as the planning backbone, and decision-shaped insights. Instead of pretty budgets, the focus is reducing false financial confidence by turning messy reality into actionable clarity. Smart categorization, pattern recognition, and context-aware guidance help users see their true spending behavior and make consistently better moves.",
        category: "Apps" as const,
        status: "In Development" as const,
        link: undefined,
        values: ["Transparency", "Clarity", "Ingenuity"],
        metrics: [
          { label: "Beta Users", value: "250+" },
          { label: "Avg. Savings Found", value: "$340/mo" },
          { label: "Launch Target", value: "Q2 2026" },
        ],
        features: [
          "Manual-first precision tracking",
          "Smart inbox for transaction review",
          "Recurring expense detection",
          "Safe-to-spend forecasting",
          "Tax readiness documentation",
        ],
        order: 1,
      },
      {
        slug: "openaisle",
        name: "OpenAisle",
        tagline: "Community-powered grocery price transparency.",
        description:
          "OpenAisle is a community-powered price and product truth layer for groceries—a place where everyday shoppers can see what items cost at nearby stores right now and help keep that information current by contributing prices from the real world.",
        problem:
          "Grocery pricing is increasingly hard to track: prices change often, promotions are inconsistent and confusing, different formats make comparisons messy, and people suspect unfairness or quiet price increases but lack concrete local evidence. Food is non-optional, and price opacity becomes a tax on time, transportation, and attention—resources many households don't have.",
        solution:
          "OpenAisle converts private frustration into public clarity. Using barcode identification, quick entry workflows, receipt confirmation, and smart normalization (unit pricing, membership vs. non-membership), we build a shared, usable picture of what food costs by item, store, and time. Users can plan where to shop, verify prices in-aisle, and track changes over time.",
        category: "Apps" as const,
        status: "In Development" as const,
        link: undefined,
        values: ["Transparency", "Stewardship", "Ingenuity"],
        metrics: [
          { label: "Price Points", value: "Coming Soon" },
          { label: "Avg. Savings", value: "15-20%" },
          { label: "Launch Target", value: "Q3 2026" },
        ],
        features: [
          "Barcode/UPC price lookup",
          "Real-time community price updates",
          "Unit price normalization",
          "Store comparison by basket",
          "Price trend & anomaly alerts",
        ],
        order: 2,
      },
      {
        slug: "venture-pipeline",
        name: "Venture Pipeline",
        tagline: "More ventures in the works.",
        description:
          "We're constantly exploring new opportunities to build, acquire, and license products that align with our values and mission.",
        problem:
          "The venture studio model allows us to identify market gaps and develop solutions efficiently. We're always looking for the next opportunity to create value.",
        solution:
          "Our pipeline includes several concepts in early exploration across healthcare, education, and local services. Each potential venture is evaluated against our core values before moving forward.",
        category: "In Development" as const,
        status: "Coming Soon" as const,
        link: undefined,
        values: ["Stewardship", "Ingenuity", "Transparency"],
        metrics: undefined,
        features: [
          "Healthcare solutions",
          "Education technology",
          "Local service platforms",
          "B2B partnerships",
        ],
        order: 3,
      },
    ];

    for (const venture of ventures) {
      await ctx.db.insert("ventures", {
        ...venture,
        isVisible: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
