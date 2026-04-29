/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/**
 * ADMIN AUDIT LOG
 *
 * Append-only record of admin-initiated actions.
 * Use `recordAdminAction` from any admin mutation/action to log activity.
 * Surface entries via the user-audit page.
 */

/**
 * Internal helper: write an audit entry from another mutation.
 * Call as `await ctx.runMutation(internal.admin.adminAudit.record, {...})`
 * or use the `recordAdminAction` helper below from inside a mutation/action.
 */
export const record = internalMutation({
  args: {
    actorClerkUserId: v.string(),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminAuditLog", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * Public mutation: log an action from a Next.js API route or action context
 * (after that caller has independently verified admin status).
 */
export const logAdminAction = mutation({
  args: {
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();
    return await ctx.db.insert("adminAuditLog", {
      actorClerkUserId: identity.clerkUserId,
      actorName: admin?.name,
      actorRole: admin?.role,
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * Trusted-server variant for Next.js API routes that have already verified
 * the caller's admin status (e.g. via convex.query(isAdmin) before invoking).
 * Re-validates the actor exists in adminUsers; rejects otherwise.
 */
export const logAdminActionAsActor = mutation({
  args: {
    actorClerkUserId: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.actorClerkUserId))
      .first();
    if (!admin) {
      throw new Error("Forbidden: actor is not an admin");
    }
    const { actorClerkUserId, ...rest } = args;
    return await ctx.db.insert("adminAuditLog", {
      actorClerkUserId,
      actorName: admin.name,
      actorRole: admin.role,
      ...rest,
      createdAt: Date.now(),
    });
  },
});

/**
 * List recent audit entries. Optional filters by actor, action, or target.
 */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    actorClerkUserId: v.optional(v.string()),
    action: v.optional(v.string()),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 100, 500);

    let entries: any[];
    if (args.targetType && args.targetId) {
      entries = await ctx.db
        .query("adminAuditLog")
        .withIndex("by_target", (q) =>
          q.eq("targetType", args.targetType).eq("targetId", args.targetId)
        )
        .order("desc")
        .take(limit);
    } else if (args.actorClerkUserId) {
      entries = await ctx.db
        .query("adminAuditLog")
        .withIndex("by_actor", (q) => q.eq("actorClerkUserId", args.actorClerkUserId!))
        .order("desc")
        .take(limit);
    } else if (args.action) {
      entries = await ctx.db
        .query("adminAuditLog")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .take(limit);
    } else {
      entries = await ctx.db
        .query("adminAuditLog")
        .withIndex("by_created")
        .order("desc")
        .take(limit);
    }
    return entries;
  },
});

/**
 * Inline helper to record an audit entry from any admin mutation handler.
 * Resolves the actor's name/role from adminUsers automatically.
 */
export async function recordAdminAction(
  ctx: any,
  identity: { clerkUserId: string },
  entry: {
    action: string;
    targetType?: string;
    targetId?: string;
    summary: string;
    metadata?: unknown;
  },
) {
  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
    .first();
  await ctx.db.insert("adminAuditLog", {
    actorClerkUserId: identity.clerkUserId,
    actorName: admin?.name,
    actorRole: admin?.role,
    ...entry,
    createdAt: Date.now(),
  });
}
