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

/** Update notes on a rep code */
export const update = mutation({
  args: {
    id: v.id("brokerTrackingCodes"),
    notes: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...rest } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updates[k] = v;
    }
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

/** Get enrollment sessions that used a specific rep code */
export const getEnrollmentsByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("enrollmentSessions")
      .filter((q: any) => q.eq(q.field("brokerTrackingCode"), args.code))
      .order("desc")
      .take(50);

    // Enrich with member name
    const enriched = [];
    for (const s of sessions) {
      const member = s.memberId ? await ctx.db.get(s.memberId) : null;
      enriched.push({
        ...s,
        memberName: member ? `${member.firstName} ${member.lastName}` : null,
        memberEmail: (member as any)?.email ?? null,
      });
    }
    return enriched;
  },
});

/** Get all codes with commission rate info from commissionRates table */
export const getAllWithRates = query({
  args: {},
  handler: async (ctx) => {
    const codes = await ctx.db.query("brokerTrackingCodes").collect();
    const rates = await ctx.db.query("commissionRates").collect();
    return codes.map((code) => {
      const rate = rates.find(
        (r: any) => r.brokerId === code.brokerId && r.status === "active"
      );
      return {
        ...code,
        commissionRate: rate?.ratePercentage ?? null,
      };
    });
  },
});
