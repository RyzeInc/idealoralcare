import { mutation } from "../_generated/server";
import { MutationCtx } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seed DTC Data for Testing
 * Creates default site, account, and group for direct-to-consumer enrollment flow
 */

export const seedDTCData = mutation({
  handler: async (ctx: MutationCtx) => {
    const now = Date.now();

    // Get some catalog products to link
    const products = await ctx.db
      .query("catalogProducts")
      .collect();

    const productIds = products.slice(0, 3).map((p) => p._id);

    if (productIds.length === 0) {
      console.warn("No catalog products found. Seed catalog products first.");
    }

    // Create DTC Site
    const siteId = await ctx.db.insert("sites", {
      slug: "ryze-health",
      name: "Ryze Oral Health",
      type: "primary",
      branding: {
        logoUrl: "https://ryzehealth.com/logo.png",
        primaryColor: "#0066cc",
        secondaryColor: "#00aa66",
        accentColor: "#ff6600",
        heroHeadline: "Your Health, Our Mission",
        heroSubtext: "Affordable, quality dental and wellness coverage",
      },
      allowedPlanIds: productIds,
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
        welcomeMessage: "Welcome to Ryze Health!",
        supportEmail: "support@ryzehealth.com",
        supportPhone: "1-800-RYZE-123",
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    console.log("Created DTC site:", siteId);

    // Create DTC Account (Individual/Self-Enrolled)
    const accountId = await ctx.db.insert("accounts", {
      siteId,
      slug: "individual",
      name: "Individual Members",
      accountType: "individual",
      billingModel: "direct",
      contacts: [
        {
          name: "Support Team",
          email: "support@ryzehealth.com",
          role: "primary",
        },
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    console.log("Created DTC account:", accountId);

    // Create DTC Group (Default enrollment group)
    const groupId = await ctx.db.insert("groups", {
      siteId,
      accountId,
      slug: "default",
      name: "Individual Enrollment",
      description: "Default group for direct-to-consumer enrollment",
      groupCode: "DTC-DEFAULT-2026",
      allowedPlanIds: productIds,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created DTC group:", groupId);

    // Create a sample member for testing
    const memberId = await ctx.db.insert("memberProfiles", {
      memberId: "MBR-2026-00001",
      barcode: "RYZ26TEST01",
      siteId,
      accountId,
      groupId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-0100",
      dateOfBirth: "1990-05-15",
      gender: "male",
      address: {
        line1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94102",
        country: "USA",
      },
      memberType: "active",
      signupSource: "direct",
      status: "active",
      communicationPrefs: {
        emailOptIn: true,
        smsOptIn: true,
        callOptIn: true,
        preferredChannel: "email",
      },
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created sample member:", memberId);

    // Log creation activities
    await ctx.db.insert("memberActivities", {
      memberProfileId: memberId,
      siteId,
      groupId,
      activityType: "lead_created",
      title: "Member created",
      description: "Sample member created for testing",
      actorType: "system",
      createdAt: now,
    });

    return {
      siteId,
      accountId,
      groupId,
      memberId,
      groupCode: "DTC-DEFAULT-2026",
      message: "DTC seed data created successfully",
    };
  },
});

/**
 * Seed Test Data - Creates complete test hierarchy with multiple accounts and groups
 */
export const seedTestHierarchy = mutation({
  handler: async (ctx: MutationCtx) => {
    const now = Date.now();

    // Get catalog products
    const products = await ctx.db
      .query("catalogProducts")
      .collect();

    const productIds = products.slice(0, 5).map((p) => p._id);

    // Create a white-label site
    const whitelabelSiteId = await ctx.db.insert("sites", {
      slug: "acme-dental",
      name: "Acme Dental Benefits",
      type: "whitelabel",
      domain: "acme-dental.com",
      branding: {
        logoUrl: "https://acme-dental.com/logo.png",
        primaryColor: "#003366",
        secondaryColor: "#0066cc",
        accentColor: "#ff9900",
        heroHeadline: "Acme Dental Benefits",
        heroSubtext: "Trusted by thousands of members",
      },
      allowedPlanIds: productIds,
      enrollmentDefaults: {
        requireGroupCode: true,
        requireEligibilityMatch: true,
        allowSelfEnrollment: false,
        requirePayment: false,
        autoActivate: false,
        collectAddress: true,
        collectPhone: true,
        collectEmployeeId: true,
        collectDependents: true,
        welcomeMessage: "Welcome to Acme Dental!",
        supportEmail: "support@acme-dental.com",
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    // Create employer account under white-label
    const employerAccountId = await ctx.db.insert("accounts", {
      siteId: whitelabelSiteId,
      slug: "acme-corp",
      name: "Acme Corporation",
      accountType: "employer",
      billingModel: "per_member",
      billingDetails: {
        perMemberRateCents: 3000, // $30/member
        billingCadence: "monthly",
        paymentTermDays: 30,
      },
      contacts: [
        {
          name: "HR Manager",
          email: "hr@acme.com",
          phone: "555-0200",
          role: "enrollment_admin",
        },
      ],
      status: "active",
      contractStartDate: now,
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    // Create groups under employer account
    const hqGroupId = await ctx.db.insert("groups", {
      siteId: whitelabelSiteId,
      accountId: employerAccountId,
      slug: "hq-employees",
      name: "HQ Employees",
      groupCode: "ACME-HQ-2026",
      allowedPlanIds: productIds,
      maxMembers: 100,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const austinGroupId = await ctx.db.insert("groups", {
      siteId: whitelabelSiteId,
      accountId: employerAccountId,
      slug: "austin-office",
      name: "Austin Office",
      groupCode: "ACME-AUSTIN-2026",
      allowedPlanIds: productIds,
      maxMembers: 50,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created white-label test hierarchy");

    return {
      siteId: whitelabelSiteId,
      accountId: employerAccountId,
      groupIds: [hqGroupId, austinGroupId],
      message: "Test hierarchy created successfully",
    };
  },
});

/**
 * Clear all enrollment data (use with caution!)
 */
export const clearEnrollmentData = mutation({
  handler: async (ctx: MutationCtx) => {
    const sites = await ctx.db.query("sites").collect();
    const accounts = await ctx.db.query("accounts").collect();
    const groups = await ctx.db.query("groups").collect();
    const members = await ctx.db.query("memberProfiles").collect();
    const activities = await ctx.db.query("memberActivities").collect();
    const notes = await ctx.db.query("memberNotes").collect();
    const sessions = await ctx.db.query("enrollmentSessions").collect();

    let deleted = 0;

    for (const doc of activities) await ctx.db.delete(doc._id), deleted++;
    for (const doc of notes) await ctx.db.delete(doc._id), deleted++;
    for (const doc of sessions) await ctx.db.delete(doc._id), deleted++;
    for (const doc of members) await ctx.db.delete(doc._id), deleted++;
    for (const doc of groups) await ctx.db.delete(doc._id), deleted++;
    for (const doc of accounts) await ctx.db.delete(doc._id), deleted++;
    for (const doc of sites) await ctx.db.delete(doc._id), deleted++;

    return { deleted, message: "All enrollment data cleared" };
  },
});
