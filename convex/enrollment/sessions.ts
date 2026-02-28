import { mutation, query } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";

/**
 * Enrollment Session Management
 * Handles creation, updates, and completion of enrollment sessions
 */

export const createEnrollmentSession = mutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    enrollmentType: v.union(
      v.literal("individual"),
      v.literal("group"),
      v.literal("admin_assisted")
    ),
    signupSource: v.optional(v.string()),
    referredByMemberId: v.optional(v.id("memberProfiles")),
    assistedBy: v.optional(v.string()), // Staff user ID
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const sessionId = crypto.getRandomValues(new Uint8Array(16)).toString();
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    const enrollmentSession = await ctx.db.insert("enrollmentSessions", {
      sessionId,
      siteId: args.siteId,
      accountId: args.accountId,
      groupId: args.groupId,
      enrollmentType: args.enrollmentType,
      currentStep: "eligibility",
      completedSteps: [],
      status: "in_progress",
      signupSource: args.signupSource,
      referredByMemberId: args.referredByMemberId,
      assistedBy: args.assistedBy,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    return enrollmentSession;
  },
});

export const updateEnrollmentSession = mutation({
  args: {
    sessionId: v.string(),
    currentStep: v.optional(v.string()),
    completedSteps: v.optional(v.array(v.string())),
    stepData: v.optional(v.any()),
    cartSessionId: v.optional(v.string()),
    memberId: v.optional(v.id("memberProfiles")),
    status: v.optional(
      v.union(
        v.literal("in_progress"),
        v.literal("pending_payment"),
        v.literal("completed"),
        v.literal("abandoned"),
        v.literal("expired"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const session = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Enrollment session not found: ${args.sessionId}`);
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.currentStep !== undefined) updates.currentStep = args.currentStep;
    if (args.completedSteps !== undefined)
      updates.completedSteps = args.completedSteps;
    if (args.stepData !== undefined) updates.stepData = args.stepData;
    if (args.cartSessionId !== undefined)
      updates.cartSessionId = args.cartSessionId;
    if (args.memberId !== undefined) updates.memberId = args.memberId;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(session._id, updates);

    return { ...session, ...updates };
  },
});

export const completeEnrollmentSession = mutation({
  args: {
    sessionId: v.string(),
    bundleId: v.id("subscriptionBundles"),
    customerId: v.string(), // Clerk user ID
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const session = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Enrollment session not found: ${args.sessionId}`);
    }

    const now = Date.now();

    await ctx.db.patch(session._id, {
      status: "completed",
      finalBundleId: args.bundleId,
      completedAt: now,
      updatedAt: now,
    });

    return { ...session, status: "completed", finalBundleId: args.bundleId };
  },
});

export const getEnrollmentSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx: QueryCtx, args: { sessionId: string }) => {
    const session = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Enrollment session not found: ${args.sessionId}`);
    }

    return session;
  },
});
