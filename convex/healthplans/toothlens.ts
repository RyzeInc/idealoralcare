/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Toothlens / RyzeHealth AI Detection Integration
 *
 * Flow:
 *   1. Authenticate with RyzeHealth API → get JWT token
 *   2. Create a detection user (once per member) → get UID
 *   3. Use UID + session_id to open the selfcheck scanner URL
 *
 * Environment variables required (set in Convex dashboard):
 *   RYZEHEALTH_COMPANY   – "idealhealth"
 *   RYZEHEALTH_ACCESS_KEY – secret access key
 */

import { action, mutation, query, internalMutation, internalQuery } from "../_generated/server";
// @ts-ignore - Type instantiation too deep
import { internal as internalOriginal } from "../_generated/api";
import { v } from "convex/values";
import { requireAuthAction } from "../lib/authGuards";

const TOOTHLENS_API_BASE = "https://annotation.toothlens.com/api/v1";
const SELFCHECK_BASE = "https://selfcheck.toothlens.com/ai";

// @ts-ignore - Type instantiation too deep
const getInternal = () => internalOriginal as any;

// ─── Queries ──────────────────────────────────────────────────────────────

/**
 * Get the Toothlens UID for the current user (if already registered).
 */
export const getToothlensUser = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

/**
 * Get scan history for the current user.
 */
export const getScanHistory = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("toothlensScans")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .collect();
  },
});

// ─── Mutations (DB writes called by the action) ──────────────────────────

/**
 * Internal: Save a new Toothlens user record after API registration.
 */
export const saveToothlensUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    toothlensUid: v.string(),
    company: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    memberProfileId: v.optional(v.id("memberProfiles")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("toothlensUsers", {
      clerkUserId: args.clerkUserId,
      toothlensUid: args.toothlensUid,
      company: args.company,
      name: args.name,
      email: args.email,
      memberProfileId: args.memberProfileId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Record a scan session start.
 */
export const recordScanStarted = mutation({
  args: {
    clerkUserId: v.string(),
    toothlensUid: v.string(),
    sessionId: v.string(),
    scanUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("toothlensScans", {
      clerkUserId: args.clerkUserId,
      toothlensUid: args.toothlensUid,
      sessionId: args.sessionId,
      scanUrl: args.scanUrl,
      status: "started",
      startedAt: Date.now(),
    });
  },
});

/**
 * Mark a scan session as completed or cancelled.
 */
export const markScanCompleted = mutation({
  args: {
    scanId: v.id("toothlensScans"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      status: args.completed ? "completed" : "cancelled",
      completedAt: Date.now(),
    });
  },
});

/**
 * Flag a scan as forwarded to teledentist.
 */
export const forwardToTeledentist = mutation({
  args: { scanId: v.id("toothlensScans") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      forwardedToTeledentist: true,
      forwardedAt: Date.now(),
    });
  },
});

/**
 * Get a single scan by ID (for viewing report).
 */
export const getScanById = query({
  args: { scanId: v.id("toothlensScans") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.scanId);
  },
});

// ─── Actions (external API calls) ────────────────────────────────────────

/**
 * Authenticate with the RyzeHealth API and get a JWT token.
 * This is an internal helper called by getOrCreateToothlensUser.
 */
async function authenticateRyzeHealth(): Promise<string> {
  const company = process.env.RYZEHEALTH_COMPANY;
  const accessKey = process.env.RYZEHEALTH_ACCESS_KEY;

  if (!company || !accessKey) {
    throw new Error("RyzeHealth credentials not configured (RYZEHEALTH_COMPANY, RYZEHEALTH_ACCESS_KEY)");
  }

  const response = await fetch(`${TOOTHLENS_API_BASE}/detection-users/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company,
      access_key: accessKey,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RyzeHealth auth failed (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (!result.data?.token) {
    throw new Error("RyzeHealth auth response missing token");
  }

  return result.data.token;
}

/**
 * Create a detection user on Toothlens via the RyzeHealth API.
 */
async function createDetectionUser(
  token: string,
  payload: {
    company: string;
    name?: string;
    email?: string;
    age?: number;
    gender?: string;
    phone_number?: string;
    city?: string;
    state?: string;
    country?: string;
    zip_code?: string;
  }
): Promise<{ uid: string }> {
  const response = await fetch(`${TOOTHLENS_API_BASE}/detection-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Toothlens user creation failed (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (!result.data?.uid) {
    throw new Error("Toothlens user creation response missing uid");
  }

  return { uid: result.data.uid };
}

/**
 * Main action: Get an existing Toothlens UID for the user, or register a new
 * detection user via the RyzeHealth API and persist the UID.
 *
 * Returns the Toothlens UID and the selfcheck scanner base URL.
 */
export const getOrCreateToothlensUser = action({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    zipCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ uid: string; scanBaseUrl: string }> => {
    const identity = await requireAuthAction(ctx);
    const company = process.env.RYZEHEALTH_COMPANY ?? "idealhealth";

    // Check if user already has a Toothlens UID
    const existing = await ctx.runQuery(
      getInternal().healthplans.toothlens.getToothlensUserInternal,
      { clerkUserId: identity.clerkUserId }
    );

    if (existing) {
      return {
        uid: existing.toothlensUid,
        scanBaseUrl: `${SELFCHECK_BASE}/${company}`,
      };
    }

    // Authenticate with RyzeHealth
    const token = await authenticateRyzeHealth();

    const resolvedEmail = args.email ?? identity.email;
    // Toothlens API requires a non-empty name — fall back through available sources
    const resolvedName =
      args.name ??
      identity.name ??
      (resolvedEmail ? resolvedEmail.split("@")[0] : undefined) ??
      "Member";

    // Create detection user
    const { uid } = await createDetectionUser(token, {
      company,
      name: resolvedName,
      email: resolvedEmail,
      age: args.age,
      gender: args.gender,
      phone_number: args.phone,
      city: args.city,
      state: args.state,
      country: args.country,
      zip_code: args.zipCode,
    });

    // Persist the UID
    await ctx.runMutation(getInternal().healthplans.toothlens.saveToothlensUser, {
      clerkUserId: identity.clerkUserId,
      toothlensUid: uid,
      company,
      name: resolvedName,
      email: resolvedEmail,
    });

    return {
      uid,
      scanBaseUrl: `${SELFCHECK_BASE}/${company}`,
    };
  },
});

// ─── Internal query used by the action ───────────────────────────────────

export const getToothlensUserInternal = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});
