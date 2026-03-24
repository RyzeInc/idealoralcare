import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

const partnerTypeValidator = v.union(
  v.literal("program_manager"),
  v.literal("fmo"),
  v.literal("agency"),
);

const statusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("suspended"),
);

/** All distribution partners */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("distributionPartners").collect();
  },
});

/** Program Managers only */
export const getProgramManagers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("distributionPartners")
      .withIndex("by_type", (q) => q.eq("type", "program_manager"))
      .collect();
  },
});

/**
 * Add a distribution partner.
 * If clerkUserId is provided, automatically creates an adminUsers entry
 * so the contact gains portal access with the correct department role.
 */
export const add = mutation({
  args: {
    name: v.string(),
    type: partnerTypeValidator,
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: statusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const id = await ctx.db.insert("distributionPartners", {
      name: args.name,
      type: args.type,
      parentId: args.parentId,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      clerkUserId: args.clerkUserId,
      overrideRate: args.overrideRate,
      status: args.status,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: identity?.subject,
    });

    // Auto-grant admin portal access when a Clerk user ID is provided
    if (args.clerkUserId) {
      const deptName =
        args.type === "program_manager" ? "program_manager" : "fmo";
      const existing = await ctx.db
        .query("adminUsers")
        .withIndex("by_clerk_id", (q) =>
          q.eq("clerkUserId", args.clerkUserId!)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("adminUsers", {
          clerkUserId: args.clerkUserId,
          email: args.contactEmail,
          name: args.contactName,
          phone: args.contactPhone,
          role: "editor",
          departments: [deptName],
          createdAt: Date.now(),
        });
      }
    }

    return id;
  },
});

/** Update a distribution partner */
export const update = mutation({
  args: {
    id: v.id("distributionPartners"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: v.optional(statusValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/** Remove a distribution partner */
export const remove = mutation({
  args: { id: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
