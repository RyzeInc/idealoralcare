/**
 * ENROLLMENT MODULE
 * Member enrollment and profile management
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

/**
 * Generate unique member ID
 */
function generateMemberId(): string {
  const year = new Date().getFullYear();
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  return `MBR-${year}-${random}`;
}

/**
 * Generate barcode (numeric sequence)
 */
function generateBarcode(): string {
  return String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
}

/**
 * Create member profile during enrollment
 */
export const createMemberProfile = mutation({
  args: {
    siteId: v.string(),
    accountId: v.string(),
    groupId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    employeeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const memberId = generateMemberId();
    const barcode = generateBarcode();
    const customerId = `cus_${nanoid(12)}`;

    // Create member profile in database
    // In production: store in Convex table
    const memberProfile = {
      _id: `member_${nanoid(12)}`,
      siteId: args.siteId,
      accountId: args.accountId,
      groupId: args.groupId,
      memberId,
      barcode,
      customerId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      employeeId: args.employeeId,
      memberType: "enrolling" as const,
      status: "active" as const,
      enrollmentStartedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return memberProfile;
  },
});

/**
 * Get member profile by ID
 */
export const getMemberProfile = query({
  args: { memberId: v.string() },
  handler: async (ctx, { memberId }) => {
    // In production: query Convex table
    return null;
  },
});

/**
 * Update member profile
 */
export const updateMemberProfile = mutation({
  args: {
    memberId: v.string(),
    updates: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      dateOfBirth: v.optional(v.string()),
      status: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { memberId, updates }) => {
    // In production: update Convex table
    return { memberId, ...updates, updatedAt: Date.now() };
  },
});

/**
 * Add member activity (audit log)
 */
export const addMemberActivity = mutation({
  args: {
    memberProfileId: v.string(),
    siteId: v.string(),
    accountId: v.string(),
    groupId: v.string(),
    activityType: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    // In production: store in activity log table
    return {
      _id: `activity_${nanoid(12)}`,
      ...args,
      actorType: "system" as const,
      createdAt: Date.now(),
    };
  },
});

/**
 * Create enrollment session
 */
export const createEnrollmentSession = mutation({
  args: {
    siteId: v.string(),
    accountId: v.string(),
    groupId: v.string(),
    zipCode: v.optional(v.string()),
    groupCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionId = `session_${nanoid(12)}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return {
      _id: sessionId,
      ...args,
      status: "in_progress" as const,
      expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

/**
 * Get enrollment session
 */
export const getEnrollmentSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    // In production: query Convex table
    return null;
  },
});

/**
 * Complete enrollment
 */
export const completeEnrollment = mutation({
  args: {
    sessionId: v.string(),
    memberProfileId: v.string(),
    cartSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // In production: mark enrollment as complete, trigger activation
    return {
      success: true,
      memberProfileId: args.memberProfileId,
      completedAt: Date.now(),
    };
  },
});
