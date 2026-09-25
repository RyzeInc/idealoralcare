import { mutation, query } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { PROVIDER_GROUP_CODE } from "../lib/constants";
import { restampMemberAttribution } from "../lib/repAttribution";
import { resolveBrokerKey } from "../lib/brokerResolve";

/**
 * Enrollment Session Management
 * Handles creation, updates, and completion of enrollment sessions
 */

/**
 * Generate a clean hex session ID
 */
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Initialize Enrollment
 * Single mutation that resolves hierarchy + creates session.
 * Handles both DTC (by slug) and Group (by groupCode) enrollment.
 */
export const initializeEnrollment = mutation({
  args: {
    siteSlug: v.optional(v.string()),
    groupCode: v.optional(v.string()),
    enrollmentType: v.union(
      v.literal("individual"),
      v.literal("group"),
      v.literal("admin_assisted")
    ),
    brokerCode: v.optional(v.string()),
    signupSource: v.optional(v.string()),
    zipCode: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    let site: any, account: any, group: any;

    // ── Auto-bootstrap catalog product if catalog is empty ──
    let oralPlanId: any = null;
    const existingProducts = await ctx.db.query("catalogProducts").collect();
    if (existingProducts.length === 0) {
      const now0 = Date.now();
      oralPlanId = await ctx.db.insert("catalogProducts", {
        slug: "oral-health-plan",
        name: "Ideal Oral Savings Plan",
        category: "dental",
        description:
          "Wide Ranging oral healthcare discount plan with AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network discounts.",
        inclusions: [
          "AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This plan is not insurance.",
        },
        activationBehavior: "immediate",
        // Must match convex/catalog/mutations.ts — classifyTier() in
        // lib/dispersal.ts matches these totals exactly, so a bootstrap that
        // seeds different prices produces bundles worth $0 to the revenue
        // engine. This branch only fires when catalogProducts is empty.
        pricing: {
          monthlyCardCents: 1499,
          monthlyACHCents: 1499,
          annualCardCents: 16499,
          annualACHCents: 16499,
        },
        metadata: { icon: "Smile", bestFor: ["Individuals", "Families"] },
        isVisible: true,
        isFeatured: true,
        order: 0,
        createdAt: now0,
        updatedAt: now0,
      });
    } else {
      oralPlanId = existingProducts[0]._id;
    }

    if (args.groupCode) {
      // ── Group enrollment: resolve full hierarchy from group code ──
      group = await ctx.db
        .query("groups")
        .withIndex("by_group_code", (q: any) => q.eq("groupCode", args.groupCode))
        .first();

      if (!group) throw new Error(`Group not found: ${args.groupCode}`);
      if (group.status !== "active") throw new Error(`Group is not active`);

      // Check capacity
      if (group.maxMembers) {
        const members = await ctx.db
          .query("memberProfiles")
          .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
          .collect();
        if (members.length >= group.maxMembers) {
          throw new Error(
            `Group enrollment is full (${members.length}/${group.maxMembers})`
          );
        }
      }

      account = await ctx.db.get(group.accountId);
      if (!account || account.status !== "active")
        throw new Error(`Account is not active`);

      site = await ctx.db.get(group.siteId);
      if (!site || site.status !== "active")
        throw new Error(`Site is not active`);
    } else {
      // ── DTC enrollment: resolve by site slug (auto-bootstrap if missing) ──
      const slug = args.siteSlug || "ideal-health";
      const now2 = Date.now();

      site = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q: any) => q.eq("slug", slug))
        .first();

      if (!site) {
        // Auto-create the DTC site on first use
        const siteId = await ctx.db.insert("sites", {
          slug,
          name: "Ideal Health",
          type: "primary",
          branding: {
            logoUrl: "/ideal-health-logo.png",
            primaryColor: "#1e3a5f",
            secondaryColor: "#14b8a6",
          },
          allowedPlanIds: oralPlanId ? [oralPlanId] : [],
          defaultCadence: "monthly",
          defaultPaymentMethod: "card",
          enrollmentDefaults: {
            requireGroupCode: false,
            requireEligibilityMatch: false,
            allowSelfEnrollment: true,
            requirePayment: true,
            autoActivate: true,
            collectAddress: true,
            collectPhone: true,
            collectEmployeeId: false,
            collectDependents: true,
            welcomeMessage: "Welcome to Ideal Health!",
            supportEmail: "support@getidealoh.com",
          },
          status: "active",
          createdAt: now2,
          updatedAt: now2,
          activatedAt: now2,
        });
        site = await ctx.db.get(siteId);
      }

      if (!site || site.status !== "active") throw new Error(`Site is not active`);

      // Find default individual account
      account = await ctx.db
        .query("accounts")
        .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
        .filter((q: any) => q.eq(q.field("accountType"), "individual"))
        .first();

      if (!account) {
        // Fallback to first active account under site
        account = await ctx.db
          .query("accounts")
          .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
          .first();
      }

      if (!account) {
        // Auto-create the DTC account on first use
        const accountId = await ctx.db.insert("accounts", {
          siteId: site._id,
          slug: "individual",
          name: "Individual Members",
          accountType: "individual",
          billingModel: "direct",
          contacts: [
            { name: "Support Team", email: "support@getidealoh.com", role: "primary" },
          ],
          status: "active",
          createdAt: now2,
          updatedAt: now2,
          activatedAt: now2,
        });
        account = await ctx.db.get(accountId);
      }

      if (!account) throw new Error(`Failed to resolve account for site: ${slug}`);

      // Find default group under that account
      group = await ctx.db
        .query("groups")
        .withIndex("by_account", (q: any) => q.eq("accountId", account._id))
        .first();

      if (!group) {
        // Auto-create the DTC default group on first use
        const groupId = await ctx.db.insert("groups", {
          siteId: site._id,
          accountId: account._id,
          slug: "default",
          name: "Individual Enrollment",
          description: "Default group for direct-to-consumer enrollment",
          groupCode: PROVIDER_GROUP_CODE,
          status: "active",
          createdAt: now2,
          updatedAt: now2,
        });
        group = await ctx.db.get(groupId);
      }

      if (!group) throw new Error(`Failed to resolve enrollment group for account`);
    }

    // ── Create enrollment session ──
    const sessionId = generateSessionId();
    const now = Date.now();

    const enrollmentSessionDocId = await ctx.db.insert("enrollmentSessions", {
      sessionId,
      siteId: site._id,
      accountId: account._id,
      groupId: group._id,
      enrollmentType: args.enrollmentType,
      currentStep: "eligibility",
      completedSteps: [],
      status: "in_progress",
      signupSource:
        args.signupSource ||
        (args.brokerCode ? `broker:${args.brokerCode}` : "direct"),
      assistedBy: args.brokerCode,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
      sessionId,
      enrollmentSessionDocId,
      site,
      account,
      group,
    };
  },
});

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
    // Clerk-free rep attribution (resolved from the rep tracking code at checkout)
    brokerId: v.optional(v.string()), // partnerLeaders._id of attributed rep
    agencyId: v.optional(v.string()), // distributionPartners._id of attributed agency
    brokerTrackingCode: v.optional(v.string()), // rep tracking code string used at signup
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

    const patch: any = {
      status: "completed",
      finalBundleId: args.bundleId,
      completedAt: now,
      updatedAt: now,
    };
    // Persist rep attribution on the sale record (canonical source of truth).
    if (args.brokerId) patch.brokerId = args.brokerId;
    if (args.agencyId) patch.agencyId = args.agencyId;
    if (args.brokerTrackingCode) patch.brokerTrackingCode = args.brokerTrackingCode;

    await ctx.db.patch(session._id, patch);

    // Refresh the member's denormalized attribution stamp. A session that only
    // reaches "completed" here may have been created before its broker code
    // was known, so the stamp written at member-creation time can be stale.
    if (session.memberId) {
      await restampMemberAttribution(ctx, session.memberId);
    }

    return { ...session, ...patch };
  },
});

/**
 * Ensure a DTC checkout has an enrollment session (the "backstop").
 *
 * The direct-to-consumer path goes straight from /health/plans to Stripe
 * Checkout without running the enrollment wizard, so historically it created
 * no `enrollmentSessions` row at all. That left two holes:
 *
 *   - the production funnel had no record of the sale, and
 *   - rep attribution for those members could only ever come from the group
 *     deal (Scenario B), losing the rep who actually sold it.
 *
 * This writes the missing row so both paths look the same downstream. It is
 * keyed on the Stripe Checkout session id, so a webhook replay finds the
 * existing row instead of creating a duplicate.
 *
 * Called BEFORE member creation, so the member's attribution stamp resolves
 * through the enrollment path like any wizard signup.
 */
export const webhookEnsureEnrollmentSession = mutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    /** Rep id, tracking code, or Clerk user ID — resolved by lookup. */
    brokerValue: v.optional(v.string()),
    signupSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionId = `stripe:${args.stripeCheckoutSessionId}`;

    const existing = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      return { _id: existing._id, sessionId, created: false };
    }

    const resolved = args.brokerValue
      ? await resolveBrokerKey(ctx, args.brokerValue)
      : null;

    const now = Date.now();
    const _id = await ctx.db.insert("enrollmentSessions", {
      sessionId,
      siteId: args.siteId,
      accountId: args.accountId,
      groupId: args.groupId,
      enrollmentType: "individual",
      // The wizard never ran; record that plainly rather than inventing steps.
      currentStep: "confirmation",
      completedSteps: [],
      status: "in_progress",
      signupSource: args.signupSource,
      brokerId: resolved?.leaderId,
      agencyId: resolved?.agencyId ?? undefined,
      // Keep the code as supplied when it did not resolve, so the value is
      // still visible for a later backfill rather than being discarded.
      brokerTrackingCode: resolved?.code ?? args.brokerValue,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    });

    return { _id, sessionId, created: true };
  },
});

/**
 * Link a member to their enrollment session.
 *
 * `RepAttributionResolver` indexes sessions BY member, so a session without
 * `memberId` is invisible to it and that member silently falls back to group
 * attribution. The backstop session above is created before the member exists,
 * so this closes the link immediately afterwards.
 */
export const webhookLinkSessionMember = mutation({
  args: {
    enrollmentSessionId: v.id("enrollmentSessions"),
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.enrollmentSessionId);
    if (!session) return { linked: false };
    if (session.memberId === args.memberId) return { linked: true };

    await ctx.db.patch(args.enrollmentSessionId, {
      memberId: args.memberId,
      updatedAt: Date.now(),
    });
    return { linked: true };
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

/**
 * Get the DTC (direct-to-consumer) site/account/group hierarchy for a given
 * site slug, defaulting to the primary "ideal-health" site when no slug is
 * given. Used as a fallback when an enrollment session is missing (e.g. Stripe
 * sync reconciliation for orphaned subscriptions, or checkout flows that skip
 * the enrollment wizard) — the slug lets white-label signups (e.g.
 * "flourishxv") still resolve to their own site instead of silently
 * defaulting to the primary brand.
 */
export const getDTCHierarchy = query({
  args: { siteSlug: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, args: { siteSlug?: string }) => {
    const slug = args.siteSlug || "ideal-health";
    // Find the DTC site by slug
    const site = await ctx.db
      .query("sites")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();

    if (!site) return null;

    // Find the first active account under this site
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
      .first();

    if (!account) return null;

    // Find the first active group under this account
    const group = await ctx.db
      .query("groups")
      .withIndex("by_account", (q: any) => q.eq("accountId", account._id))
      .first();

    if (!group) return null;

    return {
      siteId: site._id,
      accountId: account._id,
      groupId: group._id,
    };
  },
});
