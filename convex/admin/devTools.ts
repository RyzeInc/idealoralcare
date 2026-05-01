import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { createMemberProfile, deriveCareingtonUniqueId } from "../lib/memberCreation";
import { requireAdmin } from "../lib/authGuards";
import { recordAdminAction } from "./adminAudit";

/**
 * Seed the catalog with initial products — no auth required.
 * Use this from the CLI: npx convex run admin/devTools:seedCatalog
 * (The regular catalog/mutations:seedInitialData requires admin JWT which CLI can't provide.)
 */
export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("catalogProducts").collect();
    if (existing.length > 0) {
      return {
        success: false,
        message: `Catalog already has ${existing.length} products. Clear them first if needed.`,
      };
    }

    const now = Date.now();
    const products = [
      {
        slug: "oral-health-individual",
        name: "Ideal Oral Savings Plan",
        category: "dental",
        description:
          "Wide Ranging oral healthcare discount plan with AI Oral Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network.",
        inclusions: [
          "AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: { requiresVerification: false, disclosureText: "This plan is not insurance." },
        activationBehavior: "immediate" as const,
        pricing: { monthlyCardCents: 1499, monthlyACHCents: 1499, annualCardCents: 16499, annualACHCents: 16499 },
        metadata: { icon: "Heart", bestFor: ["Individuals"] },
        isVisible: true,
        isFeatured: true,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: "oral-health-family",
        name: "Ideal Oral Savings Plan — Family",
        category: "dental",
        description:
          "Wide Ranging oral healthcare discount plan for the whole family with AI Oral Scanning, 24/7 teledentistry, and the Dental Discount Network.",
        inclusions: [
          "Everything in Individual Plan",
          "Unlimited Dependents Covered",
          "AI Oral Scanning for Family",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Family Member ID Cards",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: { requiresVerification: false, disclosureText: "This plan is not insurance." },
        activationBehavior: "immediate" as const,
        pricing: { monthlyCardCents: 2499, monthlyACHCents: 2499, annualCardCents: 27499, annualACHCents: 27499 },
        metadata: { icon: "Users", bestFor: ["Families"] },
        isVisible: true,
        isFeatured: true,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const ids = [];
    for (const p of products) {
      ids.push(await ctx.db.insert("catalogProducts", p));
    }

    return { success: true, message: `Seeded ${ids.length} products`, count: ids.length };
  },
});

/**
 * Links an admin account to an active memberProfile so they can test
 * all member-facing flows (dependents, entitlements, member cards, etc.).
 *
 * - Idempotent: if a profile already exists for this admin, returns it unchanged.
 * - Attaches to the first active site → account → group hierarchy found in the DB.
 * - Run once from the Convex dashboard: pass your Clerk user_xxx ID as clerkUserId.
 */
export const linkAdminAsMember = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Look up the admin record to get name/email
    const adminRecord = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!adminRecord) throw new Error("Admin record not found");

    // Idempotency: return existing profile if already linked
    const existing = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.clerkUserId))
      .filter((q) => q.neq(q.field("status"), "terminated"))
      .first();

    if (existing) {
      return { profileId: existing._id, memberId: existing.memberId, created: false };
    }

    // Resolve hierarchy — pick the first active site/account/group
    const site = await ctx.db
      .query("sites")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (!site) throw new Error("No active site found. Run seedDTCData first.");

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!account) throw new Error("No active account found under that site.");

    const group = await ctx.db
      .query("groups")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!group) throw new Error("No active group found under that account.");

    const nameParts = adminRecord.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "-";

    const { _id: profileId, memberId } = await createMemberProfile(ctx, {
      groupId: group._id,
      groupOverride: group,
      customerId: args.clerkUserId,
      firstName,
      lastName,
      email: adminRecord.email,
      phone: adminRecord.phone,
      memberType: "active",
      memberRole: "primary",
      signupSource: "admin-dev-tool",
      communicationPrefs: {
        emailOptIn: true,
        smsOptIn: false,
        callOptIn: false,
        preferredChannel: "email",
      },
    });

    return { profileId, memberId, created: true };
  },
});

/**
 * Check whether a given Clerk user ID already has a linked member profile.
 */
export const getMyMemberProfile = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.clerkUserId))
      .filter((q) => q.neq(q.field("status"), "terminated"))
      .first();
  },
});

/**
 * Set Stripe product IDs on a catalog product by slug.
 * Called by scripts/setup-test-stripe.js to wire up test Stripe products.
 * No auth required — intended to be run via `npx convex run` in dev only.
 */
export const setTestStripeIds = mutation({
  args: {
    slug: v.string(),
    stripeProducts: v.object({
      monthlyCardId: v.string(),
      monthlyACHId: v.string(),
      annualCardId: v.string(),
      annualACHId: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!product) {
      throw new Error(`Catalog product not found: ${args.slug}`);
    }

    await ctx.db.patch(product._id, {
      stripeProducts: args.stripeProducts,
      updatedAt: Date.now(),
    });

    return { success: true, productId: product._id, slug: args.slug };
  },
});

/**
 * BACKFILL: populate `subscriberId` on every memberProfile from its
 * group's `organizationCode`. Skips members whose group has no
 * `organizationCode`. Idempotent — only writes when the value would change.
 */
export const backfillSubscriberIds = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const dryRun = args.dryRun ?? false;

    const groups = await ctx.db.query("groups").collect();
    const groupById = new Map<string, any>();
    for (const g of groups) groupById.set(g._id, g);

    const members = await ctx.db.query("memberProfiles").collect();
    let updated = 0;
    let skippedNoOrgCode = 0;
    let alreadyCorrect = 0;
    const skippedGroupIds = new Set<string>();

    for (const m of members) {
      const group = m.groupId ? groupById.get(m.groupId) : null;
      const orgCode = (group as any)?.organizationCode;
      if (!orgCode) {
        skippedNoOrgCode++;
        if (m.groupId) skippedGroupIds.add(String(m.groupId));
        continue;
      }
      if ((m as any).subscriberId === orgCode) {
        alreadyCorrect++;
        continue;
      }
      if (!dryRun) {
        await ctx.db.patch(m._id, { subscriberId: orgCode, updatedAt: Date.now() });
      }
      updated++;
    }

    const summary = {
      dryRun,
      totalMembers: members.length,
      updated,
      alreadyCorrect,
      skippedNoOrgCode,
      groupsMissingOrgCode: Array.from(skippedGroupIds),
    };

    if (!dryRun) {
      await recordAdminAction(ctx, identity, {
        action: "backfillSubscriberIds",
        summary: `Backfilled ${updated} member subscriberIds (${alreadyCorrect} already correct, ${skippedNoOrgCode} skipped)`,
        metadata: summary,
      });
    }

    return summary;
  },
});

/**
 * BACKFILL: populate `careingtonUniqueId` and `toothlensMemberId` on every
 * member missing them. Uses the deterministic FNV-1a hash of memberId so
 * future runs produce the same IDs (idempotent). Dependents are also given
 * a `toothlensMemberId` derived from the parent's Careington Unique ID +
 * the dependent's seqNum.
 */
export const backfillVendorIds = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const dryRun = args.dryRun ?? false;

    const members = await ctx.db.query("memberProfiles").collect();
    let careingtonAdded = 0;
    let toothlensAdded = 0;
    let dependentsUpdated = 0;
    let untouched = 0;

    for (const m of members) {
      let needsPatch = false;
      const patch: any = {};

      let careingtonUniqueId = (m as any).careingtonUniqueId as string | undefined;
      if (!careingtonUniqueId) {
        careingtonUniqueId = deriveCareingtonUniqueId(m.memberId ?? String(m._id));
        patch.careingtonUniqueId = careingtonUniqueId;
        patch.careingtonSeqNum = (m as any).careingtonSeqNum ?? "00";
        careingtonAdded++;
        needsPatch = true;
      }

      if (!(m as any).toothlensMemberId && careingtonUniqueId) {
        patch.toothlensMemberId = careingtonUniqueId + ((m as any).careingtonSeqNum ?? "00");
        toothlensAdded++;
        needsPatch = true;
      }

      // Backfill dependents that are missing toothlensMemberId
      const deps = (m as any).dependents as any[] | undefined;
      if (Array.isArray(deps) && deps.length > 0 && careingtonUniqueId) {
        let depsChanged = false;
        const newDeps = deps.map((d: any, idx: number) => {
          if (d.toothlensMemberId) return d;
          const seqNum = d.seqNum ?? String(idx + 1).padStart(2, "0");
          depsChanged = true;
          return { ...d, seqNum, toothlensMemberId: careingtonUniqueId + seqNum };
        });
        if (depsChanged) {
          patch.dependents = newDeps;
          dependentsUpdated++;
          needsPatch = true;
        }
      }

      if (needsPatch) {
        if (!dryRun) {
          patch.updatedAt = Date.now();
          await ctx.db.patch(m._id, patch);
        }
      } else {
        untouched++;
      }
    }

    const summary = {
      dryRun,
      totalMembers: members.length,
      careingtonAdded,
      toothlensAdded,
      dependentsUpdated,
      untouched,
    };

    if (!dryRun) {
      await recordAdminAction(ctx, identity, {
        action: "backfillVendorIds",
        summary: `Backfilled vendor IDs: +${careingtonAdded} Careington, +${toothlensAdded} Toothlens, +${dependentsUpdated} dependents updated`,
        metadata: summary,
      });
    }

    return summary;
  },
});

/**
 * CLEANUP: Deactivate duplicate memberProfile rows for a given Clerk user.
 *
 * When a user has multiple non-terminated memberProfiles (e.g. a dev-tools
 * "link admin as member" row alongside a real enrollment row), the card query
 * may land on the wrong one. This mutation:
 *   1. Finds all non-terminated profiles for the customerId.
 *   2. Identifies the canonical profile (the one whose enrolledBundleId matches
 *      the user's active subscriptionBundle, or the most-recently-updated one).
 *   3. Sets all OTHER profiles' status to "terminated" so they're excluded
 *      from card queries.
 *
 * Safe to run repeatedly (idempotent). Use dryRun:true to preview.
 */
export const deduplicateMemberProfiles = mutation({
  args: {
    customerId: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const dryRun = args.dryRun ?? false;

    const allProfiles = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q: any) => q.eq("customerId", args.customerId))
      .filter((q: any) => q.neq(q.field("status"), "terminated"))
      .collect();

    if (allProfiles.length <= 1) {
      return { customerId: args.customerId, total: allProfiles.length, terminated: 0, canonicalId: allProfiles[0]?._id ?? null, dryRun };
    }

    // Find the active bundle so we can anchor the canonical profile.
    const bundles: any[] = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q: any) => q.eq("customerId", args.customerId))
      .filter((q: any) => q.neq(q.field("status"), "cancelled"))
      .collect();
    const bundle =
      bundles.find((b) => b.status === "active") ??
      bundles.find((b) => b.status === "cancel_at_period_end") ??
      bundles[0] ?? null;

    const canonical =
      (bundle ? allProfiles.find((p: any) => p.enrolledBundleId === bundle._id) : null) ??
      [...allProfiles].sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];

    const toTerminate = allProfiles.filter((p: any) => p._id !== canonical._id);

    if (!dryRun) {
      const now = Date.now();
      for (const p of toTerminate) {
        await ctx.db.patch(p._id, { status: "terminated", updatedAt: now } as any);
      }
      await recordAdminAction(ctx, identity, {
        action: "deduplicateMemberProfiles",
        targetType: "memberProfiles",
        targetId: String(canonical._id),
        summary: `Terminated ${toTerminate.length} duplicate profile(s) for customerId ${args.customerId}; kept ${canonical._id}`,
        metadata: { customerId: args.customerId, terminated: toTerminate.map((p: any) => p._id) },
      });
    }

    return {
      customerId: args.customerId,
      total: allProfiles.length,
      terminated: toTerminate.length,
      canonicalId: canonical._id,
      terminatedIds: toTerminate.map((p: any) => p._id),
      dryRun,
    };
  },
});
