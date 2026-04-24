/**
 * Toothlens / RyzeHealth AI Detection Integration
 *
 * Spec: Notes/toothlens_AIDetectionUsersAPI.md (authoritative — supersedes the
 * older CLIENT_DOCUMENTATION.md). Selfcheck URL is `/ai/{company}`.
 *
 * Flow:
 *   1. Authenticate with RyzeHealth API → JWT (cached per spec §2)
 *   2. Create a detection user (once per member) → UID
 *   3. Open selfcheck URL with UID + session_id (new per scan, spec §4)
 *
 * Convex env vars (set in dashboard):
 *   RYZEHEALTH_AUTH_COMPANY – platform auth company, default "ryzehealth"
 *   RYZEHEALTH_COMPANY      – client company slug, e.g. "idealhealth"
 *   RYZEHEALTH_ACCESS_KEY   – secret access key
 */

import {
  action,
  mutation,
  query,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireAuth,
  requireAuthAction,
  requireAdminAction,
} from "../lib/authGuards";

const TOOTHLENS_API_BASE = "https://annotation.toothlens.com/api/v1";

// ⚠️  CRITICAL — DO NOT CHANGE THIS ORIGIN WITHOUT UPDATING next.config.ts  ⚠️
//
// Downloading scan reports is a CORE product feature.  The selfcheck domain
// must always appear in BOTH of the following headers in next.config.ts:
//
//   Permissions-Policy:  downloads=(self "https://selfcheck.toothlens.com")
//   Content-Security-Policy frame-src: ... https://selfcheck.toothlens.com
//
// If either is removed, Chromium silently blocks all iframe-triggered downloads.
// History: v0.9.9 (2026-04-22) removed this from Permissions-Policy and broke
// report downloads for all members until v0.9.13.
const SELFCHECK_BASE = "https://selfcheck.toothlens.com/ai";

// Conservative JWT TTL — spec doesn't publish an exact value; re-auth on 401
// (below) makes an under-estimate safe. 50m leaves headroom under a typical 1h.
const TOKEN_TTL_MS = 50 * 60 * 1000;

const getAuthCompany = (): string => process.env.RYZEHEALTH_AUTH_COMPANY ?? "ryzehealth";
const getClientCompany = (): string => process.env.RYZEHEALTH_COMPANY ?? "idealhealth";

// ─── Queries (public — own data only) ─────────────────────────────────────

/** Get the Toothlens UID record for the authenticated user. */
export const getToothlensUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();
  },
});

/** Get scan history for the authenticated user. */
export const getScanHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    return ctx.db
      .query("toothlensScans")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .order("desc")
      .collect();
  },
});

/** Get a single scan — callers may only read their own scans. */
export const getScanById = query({
  args: { scanId: v.id("toothlensScans") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const scan = await ctx.db.get(args.scanId);
    if (!scan) return null;
    if (scan.clerkUserId !== identity.clerkUserId) {
      throw new Error("Unauthorized: You can only access your own scans");
    }
    return scan;
  },
});

// ─── Mutations (public — own data only) ──────────────────────────────────

/**
 * Start a new scan session for the authenticated user.
 * Server-authoritative: the UID and scan URL are derived from the caller's own
 * toothlensUsers record — never trusted from the client.
 */
export const startScan = mutation({
  args: {},
  handler: async (ctx): Promise<{
    scanId: Id<"toothlensScans">;
    sessionId: string;
    toothlensUid: string;
    scanUrl: string;
  }> => {
    const identity = await requireAuth(ctx);

    const user = await ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();

    if (!user) {
      throw new Error("Toothlens user not registered — call getOrCreateToothlensUser first");
    }

    // Unique session_id per scan (spec §4: new value every scan, never reuse).
    const sessionId = crypto.randomUUID().replace(/-/g, "");

    const scanUrl =
      `${SELFCHECK_BASE}/${user.company}` +
      `?uid=${encodeURIComponent(user.toothlensUid)}` +
      `&session_id=${encodeURIComponent(sessionId)}`;

    const scanId = await ctx.db.insert("toothlensScans", {
      clerkUserId: identity.clerkUserId,
      toothlensUid: user.toothlensUid,
      sessionId,
      scanUrl,
      status: "started",
      startedAt: Date.now(),
    });

    return { scanId, sessionId, toothlensUid: user.toothlensUid, scanUrl };
  },
});

/** Mark a scan as completed or cancelled. Caller must own the scan. */
export const markScanCompleted = mutation({
  args: {
    scanId: v.id("toothlensScans"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const scan = await ctx.db.get(args.scanId);
    if (!scan) throw new Error("Scan not found");
    if (scan.clerkUserId !== identity.clerkUserId) {
      throw new Error("Unauthorized: You can only modify your own scans");
    }
    await ctx.db.patch(args.scanId, {
      status: args.completed ? "completed" : "cancelled",
      completedAt: Date.now(),
    });
  },
});

/** Flag a scan as forwarded to the teledentist. Caller must own the scan. */
export const forwardToTeledentist = mutation({
  args: { scanId: v.id("toothlensScans") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const scan = await ctx.db.get(args.scanId);
    if (!scan) throw new Error("Scan not found");
    if (scan.clerkUserId !== identity.clerkUserId) {
      throw new Error("Unauthorized: You can only modify your own scans");
    }
    await ctx.db.patch(args.scanId, {
      forwardedToTeledentist: true,
      forwardedAt: Date.now(),
    });
  },
});

/**
 * Store a report URL captured from a postMessage event. Marks the scan as
 * completed if it is still "started". Caller must own the scan.
 */
export const storeReportUrl = mutation({
  args: {
    scanId: v.id("toothlensScans"),
    reportUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const scan = await ctx.db.get(args.scanId);
    if (!scan) return;
    if (scan.clerkUserId !== identity.clerkUserId) {
      throw new Error("Unauthorized: You can only modify your own scans");
    }
    await ctx.db.patch(args.scanId, {
      reportUrl: args.reportUrl,
      ...(scan.status === "started"
        ? { status: "completed" as const, completedAt: Date.now() }
        : {}),
    });
  },
});

// ─── Internal: JWT cache ─────────────────────────────────────────────────

export const getCachedToken = internalQuery({
  args: { authCompany: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("ryzehealthTokenCache")
      .withIndex("by_auth_company", (q) => q.eq("authCompany", args.authCompany))
      .first();
  },
});

export const setCachedToken = internalMutation({
  args: {
    authCompany: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ryzehealthTokenCache")
      .withIndex("by_auth_company", (q) => q.eq("authCompany", args.authCompany))
      .first();
    const patch = {
      token: args.token,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("ryzehealthTokenCache", {
        authCompany: args.authCompany,
        ...patch,
      });
    }
  },
});

export const invalidateCachedToken = internalMutation({
  args: { authCompany: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ryzehealthTokenCache")
      .withIndex("by_auth_company", (q) => q.eq("authCompany", args.authCompany))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// ─── External API helpers ────────────────────────────────────────────────

async function authenticateRyzeHealth(): Promise<string> {
  const accessKey = process.env.RYZEHEALTH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("RyzeHealth credentials not configured (RYZEHEALTH_ACCESS_KEY)");
  }

  const response = await fetch(`${TOOTHLENS_API_BASE}/detection-users/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: getAuthCompany(), access_key: accessKey }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RyzeHealth auth failed (${response.status}): ${text}`);
  }

  const result = (await response.json()) as { data?: { token?: string } };
  const token = result.data?.token;
  if (!token) throw new Error("RyzeHealth auth response missing token");
  return token;
}

/** Get a JWT, reusing the cached token until its TTL expires (spec §2). */
async function getTokenCached(
  ctx: ActionCtx,
  opts?: { forceRefresh?: boolean },
): Promise<string> {
  const authCompany = getAuthCompany();

  if (!opts?.forceRefresh) {
    const cached = (await ctx.runQuery(internal.healthplans.toothlens.getCachedToken, {
      authCompany,
    })) as Doc<"ryzehealthTokenCache"> | null;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
  }

  const token = await authenticateRyzeHealth();
  await ctx.runMutation(internal.healthplans.toothlens.setCachedToken, {
    authCompany,
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

type CreateUserPayload = {
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
};

async function createDetectionUserRaw(
  token: string,
  payload: CreateUserPayload,
): Promise<{ ok: true; uid: string } | { ok: false; status: number; text: string }> {
  const response = await fetch(`${TOOTHLENS_API_BASE}/detection-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, text: await response.text() };
  }

  const result = (await response.json()) as { data?: { uid?: string } };
  if (!result.data?.uid) {
    return { ok: false, status: 500, text: "Response missing uid" };
  }
  return { ok: true, uid: result.data.uid };
}

/**
 * Create a detection user. On 401/403 (expired token), re-auth once and retry
 * (spec Basic Flow step 3 — "If Token Expires, authenticate again").
 */
async function createDetectionUser(
  ctx: ActionCtx,
  payload: CreateUserPayload,
): Promise<{ uid: string }> {
  let token = await getTokenCached(ctx);
  let result = await createDetectionUserRaw(token, payload);

  if (!result.ok && (result.status === 401 || result.status === 403)) {
    await ctx.runMutation(internal.healthplans.toothlens.invalidateCachedToken, {
      authCompany: getAuthCompany(),
    });
    token = await getTokenCached(ctx, { forceRefresh: true });
    result = await createDetectionUserRaw(token, payload);
  }

  if (!result.ok) {
    throw new Error(`Toothlens user creation failed (${result.status}): ${result.text}`);
  }
  return { uid: result.uid };
}

// ─── Internal: user-record helpers ───────────────────────────────────────

export const getToothlensUserInternal = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

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

export const updateToothlensUserUid = internalMutation({
  args: {
    id: v.id("toothlensUsers"),
    toothlensUid: v.string(),
    company: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"toothlensUsers">> = {
      toothlensUid: args.toothlensUid,
    };
    if (args.company) patch.company = args.company;
    await ctx.db.patch(args.id, patch);
  },
});

export const listAllToothlensUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("toothlensUsers").collect();
  },
});

// ─── Actions (external API calls) ────────────────────────────────────────

/**
 * Ensure the authenticated user is registered with Toothlens. Returns the UID
 * and scanner base URL. Re-registers under the current company if the stored
 * record was created for a different company (migration scenario).
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
    const company = getClientCompany();

    const existing = (await ctx.runQuery(
      internal.healthplans.toothlens.getToothlensUserInternal,
      { clerkUserId: identity.clerkUserId },
    )) as Doc<"toothlensUsers"> | null;

    if (existing && existing.company === company) {
      return {
        uid: existing.toothlensUid,
        scanBaseUrl: `${SELFCHECK_BASE}/${company}`,
      };
    }

    const resolvedEmail = args.email ?? identity.email;
    const resolvedName =
      args.name ??
      identity.name ??
      (resolvedEmail ? resolvedEmail.split("@")[0] : undefined) ??
      "Member";

    const { uid } = await createDetectionUser(ctx, {
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

    if (existing) {
      await ctx.runMutation(internal.healthplans.toothlens.updateToothlensUserUid, {
        id: existing._id,
        toothlensUid: uid,
        company,
      });
    } else {
      await ctx.runMutation(internal.healthplans.toothlens.saveToothlensUser, {
        clerkUserId: identity.clerkUserId,
        toothlensUid: uid,
        company,
        name: resolvedName,
        email: resolvedEmail,
      });
    }

    return { uid, scanBaseUrl: `${SELFCHECK_BASE}/${company}` };
  },
});

// ─── Admin: Bulk Migration ───────────────────────────────────────────────

/**
 * Admin-only: Re-register all existing Toothlens users under the current
 * RYZEHEALTH_COMPANY. Each user gets a fresh UID — we never re-POST an
 * existing UID (spec §3: "Bad Practices — Sending duplicate UID values").
 */
export const migrateAllUsers = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    migrated: number;
    skipped: number;
    failed: { clerkUserId: string; error: string }[];
    error?: string;
  }> => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const company = process.env.RYZEHEALTH_COMPANY;
    const accessKey = process.env.RYZEHEALTH_ACCESS_KEY;
    if (!company) {
      return { migrated: 0, skipped: 0, failed: [], error: "RYZEHEALTH_COMPANY env var not set" };
    }
    if (!accessKey) {
      return { migrated: 0, skipped: 0, failed: [], error: "RYZEHEALTH_ACCESS_KEY env var not set" };
    }

    const allUsers = (await ctx.runQuery(
      internal.healthplans.toothlens.listAllToothlensUsers,
      {},
    )) as Doc<"toothlensUsers">[];

    if (allUsers.length === 0) {
      return { migrated: 0, skipped: 0, failed: [], error: "No toothlensUsers records found" };
    }

    let migrated = 0;
    let skipped = 0;
    const failed: { clerkUserId: string; error: string }[] = [];

    for (const user of allUsers) {
      if (user.company === company) {
        skipped++;
        continue;
      }

      try {
        const { uid } = await createDetectionUser(ctx, {
          company,
          name: user.name ?? "Member",
          email: user.email,
        });

        await ctx.runMutation(internal.healthplans.toothlens.updateToothlensUserUid, {
          id: user._id,
          toothlensUid: uid,
          company,
        });

        migrated++;
      } catch (err) {
        failed.push({
          clerkUserId: user.clerkUserId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { migrated, skipped, failed };
  },
});
