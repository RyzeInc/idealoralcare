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

    let slug: string | undefined;
    if (args.slug) {
      slug = await validateSlug(ctx, args.slug);
    }

    return await ctx.db.insert("brokerTrackingCodes", {
      brokerId: args.brokerId,
      agencyId: args.agencyId,
      code: args.code,
      slug,
      productHint: args.productHint,
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
