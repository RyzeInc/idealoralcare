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
  // Auth uses the RyzeHealth platform company ("ryzehealth"), NOT the client company.
  // The client company ("idealhealth") is only used when creating detection users.
  const authCompany = process.env.RYZEHEALTH_AUTH_COMPANY ?? "ryzehealth";
  const accessKey = process.env.RYZEHEALTH_ACCESS_KEY;

  if (!accessKey) {
    throw new Error("RyzeHealth credentials not configured (RYZEHEALTH_ACCESS_KEY)");
  }

  const response = await fetch(`${TOOTHLENS_API_BASE}/detection-users/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company: authCompany,
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
    uid?: string;
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

    // UID is valid only if it was created under the current company.
    // If the stored company differs (e.g. old "ryzehealth" vs current "idealhealth")
    // we must create a new UID under the right company — fall through to registration.
    if (existing && existing.company === company) {
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

    // Persist the UID — update existing record if company changed, else insert new
    if (existing) {
      await ctx.runMutation(getInternal().healthplans.toothlens.updateToothlensUserUid, {
        id: existing._id,
        toothlensUid: uid,
        company,
      });
    } else {
      await ctx.runMutation(getInternal().healthplans.toothlens.saveToothlensUser, {
        clerkUserId: identity.clerkUserId,
        toothlensUid: uid,
        company,
        name: resolvedName,
        email: resolvedEmail,
      });
    }

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

/**
 * Internal: Update an existing Toothlens user record with a new UID and company.
 */
export const updateToothlensUserUid = internalMutation({
  args: {
    id: v.id("toothlensUsers"),
    toothlensUid: v.string(),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string> = { toothlensUid: args.toothlensUid };
    if (args.company) patch.company = args.company;
    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Re-register the current user with Toothlens.
 * Re-sends the existing UID to restore access to prior scan reports.
 * Falls back to a fresh UID if the old one is rejected.
 */
export const refreshToothlensUser = action({
  args: {},
  handler: async (ctx): Promise<{ uid: string; scanBaseUrl: string }> => {
    const identity = await requireAuthAction(ctx);
    const company = process.env.RYZEHEALTH_COMPANY ?? "idealhealth";

    const existing = await ctx.runQuery(
      getInternal().healthplans.toothlens.getToothlensUserInternal,
      { clerkUserId: identity.clerkUserId }
    );

    const token = await authenticateRyzeHealth();
    const resolvedName =
      identity.name ??
      (identity.email ? identity.email.split("@")[0] : undefined) ??
      "Member";

    const basePayload = {
      company,
      name: resolvedName,
      email: identity.email,
    };

    // If the stored UID belongs to the same company, try re-registering it so
    // old scan reports remain accessible under the same UID.
    // If the company differs (migration scenario), skip this — UIDs are per-company
    // on Toothlens' side so a token for `idealhealth` cannot accept a `ryzehealth` UID.
    if (existing && existing.company === company) {
      try {
        const { uid } = await createDetectionUser(token, {
          ...basePayload,
          uid: existing.toothlensUid,
        });
        if (uid !== existing.toothlensUid) {
          await ctx.runMutation(
            getInternal().healthplans.toothlens.updateToothlensUserUid,
            { id: existing._id, toothlensUid: uid, company }
          );
        }
        return { uid, scanBaseUrl: `${SELFCHECK_BASE}/${company}` };
      } catch {
        // Same-UID registration rejected — fall through to create fresh UID
      }
    }

    // Create a brand-new detection user under the current company
    const { uid } = await createDetectionUser(token, basePayload);

    if (existing) {
      await ctx.runMutation(
        getInternal().healthplans.toothlens.updateToothlensUserUid,
        { id: existing._id, toothlensUid: uid, company }
      );
    } else {
      await ctx.runMutation(getInternal().healthplans.toothlens.saveToothlensUser, {
        clerkUserId: identity.clerkUserId,
        toothlensUid: uid,
        company,
        name: resolvedName,
        email: identity.email,
      });
    }

    return { uid, scanBaseUrl: `${SELFCHECK_BASE}/${company}` };
  },
});

// ─── Admin: Bulk Migration ───────────────────────────────────────────────

/**
 * Internal query: list ALL toothlensUsers records.
 */
export const listAllToothlensUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("toothlensUsers").collect();
  },
});

/**
 * Admin action: Re-register ALL existing Toothlens users under the current
 * RYZEHEALTH_COMPANY. Use this after changing the company slug / access key
 * in the Convex environment variables.
 *
 * Each user gets a new UID under the new company. Old UIDs (and old scan
 * report links) will no longer work on the new company endpoint.
 *
 * Call from Convex Dashboard → Functions → healthplans/toothlens:migrateAllUsers
 */
export const migrateAllUsers = action({
  args: {},
  handler: async (ctx): Promise<{
    migrated: number;
    skipped: number;
    failed: { clerkUserId: string; error: string }[];
    error?: string;
  }> => {
    const company = process.env.RYZEHEALTH_COMPANY;
    const accessKey = process.env.RYZEHEALTH_ACCESS_KEY;
    if (!company) return { migrated: 0, skipped: 0, failed: [], error: "RYZEHEALTH_COMPANY env var not set" };
    if (!accessKey) return { migrated: 0, skipped: 0, failed: [], error: "RYZEHEALTH_ACCESS_KEY env var not set" };

    const allUsers = await ctx.runQuery(
      getInternal().healthplans.toothlens.listAllToothlensUsers,
      {}
    );

    if (allUsers.length === 0) {
      return { migrated: 0, skipped: 0, failed: [], error: "No toothlensUsers records found in database" };
    }

    let token: string;
    try {
      token = await authenticateRyzeHealth();
    } catch (err: any) {
      return {
        migrated: 0,
        skipped: 0,
        failed: [],
        error: `Auth failed for company "${company}": ${err?.message ?? String(err)}`,
      };
    }

    let migrated = 0;
    let skipped = 0;
    const failed: { clerkUserId: string; error: string }[] = [];

    for (const user of allUsers) {
      // Already on the current company — skip
      if (user.company === company) {
        skipped++;
        continue;
      }

      try {
        const { uid } = await createDetectionUser(token, {
          company,
          name: user.name ?? "Member",
          email: user.email,
        });

        await ctx.runMutation(
          getInternal().healthplans.toothlens.updateToothlensUserUid,
          { id: user._id, toothlensUid: uid, company }
        );

        migrated++;
      } catch (err: any) {
        failed.push({
          clerkUserId: user.clerkUserId,
          error: err?.message ?? String(err),
        });
      }
    }

    return { migrated, skipped, failed };
  },
});
