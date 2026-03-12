/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Membership Agreement Management
 * Handles creation, storage, and retrieval of digitally signed membership agreements
 */

export const createMembershipAgreement = mutation({
  args: {
    userId: v.string(),
    memberId: v.string(),
    memberName: v.string(),
    memberAddress: v.string(),
    email: v.string(),
    planName: v.string(),
    groupCode: v.string(),
    term: v.optional(v.string()),
    classification: v.optional(v.string()),
    paymentMode: v.optional(v.string()),
    periodicCharge: v.optional(v.string()),
    processingFee: v.optional(v.string()),
    membershipTermsAgreed: v.boolean(),
    termsAndConditionsAgreed: v.boolean(),
    memberSignature: v.string(),
    signatureTimestamp: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    // Calculate effective date as today
    const effectiveDate = new Date().toISOString().split("T")[0];

    // Create membership agreement record
    const agreementId = await ctx.db.insert("membershipAgreements", {
      userId: args.userId,
      memberId: args.memberId,
      memberName: args.memberName,
      memberAddress: args.memberAddress,
      email: args.email,
      planName: args.planName,
      groupCode: args.groupCode,
      term: args.term || "Annual",
      classification: args.classification || "Standard",
      paymentMode: args.paymentMode || "Credit Card",
      periodicCharge: args.periodicCharge || "TBD",
      processingFee: args.processingFee || "TBD",
      effectiveDate,
      membershipTermsAgreed: args.membershipTermsAgreed,
      termsAndConditionsAgreed: args.termsAndConditionsAgreed,
      memberSignature: args.memberSignature,
      signatureTimestamp: args.signatureTimestamp,
      createdAt: Date.now(),
      status: "active",
    });

    return {
      success: true,
      agreementId,
      effectiveDate,
    };
  },
});

export const getMembershipAgreement = query({
  args: {
    agreementId: v.id("membershipAgreements"),
  },
  handler: async (ctx: any, args: any) => {
    const agreement = await ctx.db.get(args.agreementId);
    return agreement;
  },
});

export const getMembershipAgreementByUserId = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const agreements = await ctx.db
      .query("membershipAgreements")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect();

    return agreements.sort(
      (a: any, b: any) => b.createdAt - a.createdAt
    );
  },
});

export const getMembershipAgreementByMemberId = query({
  args: {
    memberId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const agreements = await ctx.db
      .query("membershipAgreements")
      .withIndex("by_memberId", (q: any) => q.eq("memberId", args.memberId))
      .collect();

    return agreements.length > 0 ? agreements[0] : null;
  },
});

export const updateMembershipAgreementStatus = mutation({
  args: {
    agreementId: v.id("membershipAgreements"),
    status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired")),
    cancelReason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const agreement = await ctx.db.get(args.agreementId);

    if (!agreement) {
      throw new Error("Agreement not found");
    }

    await ctx.db.patch(args.agreementId, {
      status: args.status,
      cancelReason: args.cancelReason,
      lastUpdated: Date.now(),
    });

    return {
      success: true,
      status: args.status,
    };
  },
});

export const validateMembershipAgreement = query({
  args: {
    agreementId: v.id("membershipAgreements"),
  },
  handler: async (ctx: any, args: any) => {
    const agreement = await ctx.db.get(args.agreementId);

    if (!agreement) {
      return { valid: false, error: "Agreement not found" };
    }

    if (!agreement.membershipTermsAgreed || !agreement.termsAndConditionsAgreed) {
      return { valid: false, error: "Terms not fully agreed to" };
    }

    if (!agreement.memberSignature) {
      return { valid: false, error: "Member signature missing" };
    }

    if (agreement.status !== "active") {
      return { valid: false, error: `Agreement status is ${agreement.status}` };
    }

    return { valid: true, agreement };
  },
});
