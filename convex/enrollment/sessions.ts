import { mutation, query } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";

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
        name: "Ideal Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with Toothlens AI oral scanning, 24/7 teledentistry, and Dental Discount Network discounts.",
        inclusions: [
          "Toothlens AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1500,
          monthlyACHCents: 1300,
          annualCardCents: 15000,
          annualACHCents: 13000,
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
            { name: "Support Team", email: "support@idealhealth.com", role: "primary" },
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
          groupCode: "DTC-DEFAULT",
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
