import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/** All broker/agent rep tracking codes */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("brokerTrackingCodes").collect();
  },
});

/** Get all codes belonging to a specific agent */
export const getByAgent = query({
  args: { brokerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_broker", (q) => q.eq("brokerId", args.brokerId))
      .collect();
  },
});

/** Create a new rep code. Enforces uniqueness server-side. */
export const create = mutation({
  args: {
    brokerId: v.string(),
    agencyId: v.optional(v.string()),
    code: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const existing = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error(`Rep code "${args.code}" is already in use`);
    }

    return await ctx.db.insert("brokerTrackingCodes", {
      brokerId: args.brokerId,
      agencyId: args.agencyId,
      code: args.code,
      usageCount: 0,
      status: "active",
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: identity?.subject,
    });
  },
});

/** Revoke a rep code — it will no longer accept new enrollments */
export const revoke = mutation({
  args: { id: v.id("brokerTrackingCodes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "revoked", updatedAt: Date.now() });
  },
});

/** Reactivate a revoked or inactive rep code */
export const reactivate = mutation({
  args: { id: v.id("brokerTrackingCodes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

/** Permanently delete a rep code */
export const remove = mutation({
  args: { id: v.id("brokerTrackingCodes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
