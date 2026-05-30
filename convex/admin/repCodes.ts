import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
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

// Slugs that may not be used as rep code URL slugs
const SLUG_RESERVED = new Set([
  "admin","api","health","newideal","bootstrap","debug",
  "login","signup","sign-in","sign-up","sign-out","sso-callback",
  "about","contact","privacy","terms","legal",
  "plans","checkout","enroll","dashboard","claim-invite",
  "manage-plans","oral-health-scan","dental","discount",
  "teledentistry","how-it-works","faq","blog","compare","success",
  "essentials","oralcare",
  "_next","favicon.ico","robots.txt","sitemap.xml","manifest.json",
]);

/** Validate and normalise a candidate slug. Throws on invalid input. */
async function validateSlug(
  ctx: any,
  slug: string,
  excludeId?: string
): Promise<string> {
  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!normalized) throw new Error("Slug must contain at least one alphanumeric character");
  if (SLUG_RESERVED.has(normalized)) {
    throw new Error(`"${normalized}" is a reserved URL path and cannot be used as a slug`);
  }
  // Collide with another row's slug?
  const existingSlug = await ctx.db
    .query("brokerTrackingCodes")
    .withIndex("by_slug", (q: any) => q.eq("slug", normalized))
    .first();
  if (existingSlug && existingSlug._id !== excludeId) {
    throw new Error(`Slug "${normalized}" is already in use`);
  }
  // Collide with another row's code (case-insensitive)?
  const existingCode = await ctx.db
    .query("brokerTrackingCodes")
    .withIndex("by_code", (q: any) => q.eq("code", normalized.toUpperCase()))
    .first();
  if (existingCode && existingCode._id !== excludeId) {
    throw new Error(`Slug "${normalized}" conflicts with an existing rep code`);
  }
  return normalized;
}

const productHintValidator = v.optional(v.union(
  v.literal("essentials"),
  v.literal("oralcare"),
  v.literal("plans"),
));

/** Create a new rep code. Enforces uniqueness server-side. */
export const create = mutation({
  args: {
    brokerId: v.string(),
    agencyId: v.optional(v.string()),
    code: v.string(),
    slug: v.optional(v.string()),
    productHint: productHintValidator,
    notes: v.optional(v.string()),
    // Used to auto-generate code/slug when agency has a 4-digit code
    repFirstName: v.optional(v.string()),
    repLastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    let finalCode = args.code.toUpperCase();
    let finalSlug = args.slug;
    let agencySeqNo: number | undefined;

    // --- Auto-generate code/slug when agency has a 4-digit code ---
    if (args.agencyId) {
      const partner = await ctx.db.get(args.agencyId as Id<"distributionPartners">);
      const agencyCode: string | undefined = (partner as any)?.agencyCode;
      if (agencyCode) {
        // Find current max sequence number for this agency
        const existingCodes = await ctx.db
          .query("brokerTrackingCodes")
          .filter((q: any) => q.eq(q.field("agencyId"), args.agencyId))
          .collect();
        const maxSeq = existingCodes.reduce(
          (max: number, c: any) => Math.max(max, c.agencySeqNo ?? 0),
          0
        );
        agencySeqNo = maxSeq + 1;
        const seqStr = String(agencySeqNo).padStart(2, "0");
        finalCode = `${agencyCode}${seqStr}`;
        // Build name slug: firstnamelastname + seqStr
        const first = (args.repFirstName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const last = (args.repLastName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (first || last) {
          finalSlug = `${first}${last}${seqStr}`;
        }
      }
    }

    const existing = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", finalCode))
      .first();

    if (existing) {
      throw new Error(`Rep code "${finalCode}" is already in use`);
    }

    let slug: string | undefined;
    if (finalSlug) {
      slug = await validateSlug(ctx, finalSlug);
    }

    return await ctx.db.insert("brokerTrackingCodes", {
      brokerId: args.brokerId,
      agencyId: args.agencyId,
      code: finalCode,
      slug,
      productHint: args.productHint,
      agencySeqNo,
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

/** Update a rep code's metadata (notes, slug, productHint, groupId, siteId) */
export const update = mutation({
  args: {
    id: v.id("brokerTrackingCodes"),
    notes: v.optional(v.string()),
    slug: v.optional(v.string()),
    productHint: productHintValidator,
    groupId: v.optional(v.id("groups")),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, slug: rawSlug, ...rest } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (rawSlug !== undefined) {
      // Only write the field when there's an actual value; pass through undefined to
      // avoid touching an already-absent field (Convex doesn't accept null for v.optional(v.string()))
      if (rawSlug) {
        updates.slug = await validateSlug(ctx, rawSlug, id);
      }
      // Intentionally no "else" — clearing a slug is handled by a future explicit unset action
    }

    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

/**
 * Back-fill slugs for all active rep codes that don't yet have one.
 * Derives slug from agent name (adminUsers or partnerLeaders).
 * Auto-suffixes (-2, -3 …) on collisions. Idempotent.
 */
export const backfillSlugs = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const codes = await ctx.db.query("brokerTrackingCodes").collect();
    const adminUsers = await ctx.db.query("adminUsers").collect();
    const leaders = await ctx.db.query("partnerLeaders").collect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminMap = new Map(adminUsers.map((u: any) => [u.clerkUserId, u]));
    const leaderMap = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leaders.filter((l: any) => l.clerkUserId).map((l: any) => [l.clerkUserId, l])
    );

    // Pre-seed taken slugs from rows that already have one
    const takenSlugs = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      codes.filter((c: any) => c.slug).map((c: any) => c.slug as string)
    );

    let updated = 0;
    for (const code of codes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((code as any).slug) continue;

      const admin = adminMap.get(code.brokerId);
      const leader = leaderMap.get(code.brokerId);
      const name: string = (admin as any)?.name || (leader as any)?.name || "";
      if (!name) continue;

      const base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!base) continue;

      let candidate = base;
      let suffix = 2;
      while (takenSlugs.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix++;
      }

      takenSlugs.add(candidate);
      await ctx.db.patch(code._id, { slug: candidate, updatedAt: Date.now() });
      updated++;
    }

    return { updated };
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

/**
 * Preview the auto-generated code and slug that would be assigned to a new rep
 * for the given agency. Returns null if the agency has no 4-digit code yet.
 */
export const previewAgencyRepCode = query({
  args: {
    agencyId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.agencyId as Id<"distributionPartners">);
    const agencyCode: string | undefined = (partner as any)?.agencyCode;
    if (!agencyCode) return null;

    const existingCodes = await ctx.db
      .query("brokerTrackingCodes")
      .filter((q: any) => q.eq(q.field("agencyId"), args.agencyId))
      .collect();
    const maxSeq = existingCodes.reduce(
      (max: number, c: any) => Math.max(max, c.agencySeqNo ?? 0),
      0
    );
    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(2, "0");
    const previewCode = `${agencyCode}${seqStr}`;

    const first = (args.firstName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const last = (args.lastName ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const previewSlug = (first || last) ? `${first}${last}${seqStr}` : null;

    return { agencyCode, nextSeq, seqStr, previewCode, previewSlug };
  },
});

/**
 * Assign the next available 4-digit agency code (starting at 1000) to a
 * distributionPartner. Idempotent — returns existing code if already assigned.
 */
export const assignAgencyCode = mutation({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const partner = await ctx.db.get(args.partnerId);
    if (!partner) throw new Error("Partner not found");
    if ((partner as any).agencyCode) {
      return { agencyCode: (partner as any).agencyCode as string };
    }

    // Collect all existing 4-digit codes
    const allPartners = await ctx.db.query("distributionPartners").collect();
    const usedCodes = new Set<string>(
      allPartners.map((p: any) => p.agencyCode).filter(Boolean)
    );

    let next = 1000;
    while (usedCodes.has(String(next))) next++;
    if (next > 9999) throw new Error("All 4-digit agency codes (1000–9999) are in use");

    const agencyCode = String(next);
    await ctx.db.patch(args.partnerId, { agencyCode } as any);
    return { agencyCode };
  },
});
