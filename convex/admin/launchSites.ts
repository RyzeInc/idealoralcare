import { internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { ASSUREVANTAGE_PRESET } from "../lib/sitePresets";
import { PROVIDER_GROUP_CODE } from "../lib/constants";
import { isMembershipProgramSlug } from "../lib/productSlugs";

async function ensureDtcHierarchy(ctx: MutationCtx, siteId: Id<"sites">) {
  const accounts = await ctx.db.query("accounts").withIndex("by_site", q => q.eq("siteId", siteId)).collect();
  const individual = accounts.find(account => account.accountType === "individual");
  if (individual && individual.status !== "active") throw new Error("Review the inactive direct-enrollment account before launch");
  const now = Date.now();
  const accountId = individual?._id ?? await ctx.db.insert("accounts", {
    siteId, slug: "individual", name: "Individual Members", accountType: "individual", billingModel: "direct",
    contacts: [{ name: "Member Support", email: "support@getidealoh.com", role: "primary" }],
    status: "active", createdAt: now, updatedAt: now, activatedAt: now,
  });
  const groups = await ctx.db.query("groups").withIndex("by_account", q => q.eq("accountId", accountId)).collect();
  const activeGroup = groups.find(group => group.status === "active");
  if (groups.length && !activeGroup) throw new Error("Review the inactive direct-enrollment group before launch");
  const groupId = activeGroup?._id ?? await ctx.db.insert("groups", {
    siteId, accountId, slug: "default", name: "Individual Enrollment",
    description: "Direct-to-consumer oral membership enrollment",
    groupCode: PROVIDER_GROUP_CODE, status: "active", createdAt: now, updatedAt: now,
  });
  return { accountId, groupId };
}

/** Deployment-console setup only. Never moves existing groups, accounts or members. */
export const configureAssureVantage = internalMutation({
  args: { activate: v.optional(v.boolean()), enableMemberBranding: v.optional(v.boolean()), promoteToPrimary: v.optional(v.boolean()) },
  handler: async (ctx, { activate = false, enableMemberBranding, promoteToPrimary = false }) => {
    const preset = ASSUREVANTAGE_PRESET;
    const existing = await ctx.db.query("sites").withIndex("by_slug", q => q.eq("slug", preset.slug)).unique();
    if (existing) {
      if (activate && ["suspended", "terminated"].includes(existing.status)) throw new Error("This site has been suspended or terminated; review it before reactivation");
      if (existing.domain && !["assurevantage.com", "www.assurevantage.com"].includes(existing.domain)) throw new Error("AssureVantage already has a different domain; review the assignment");
      const hierarchy = await ensureDtcHierarchy(ctx, existing._id);
      const programs = promoteToPrimary ? (await ctx.db.query("catalogProducts").withIndex("by_visible", q => q.eq("isVisible", true)).collect()).filter(product => product.category === "dental" || isMembershipProgramSlug(product.slug) || product.slug.startsWith("oralcare-")) : [];
      await ctx.db.patch(existing._id, {
        domain: "www.assurevantage.com",
        ...(promoteToPrimary ? { type: "primary" as const, allowedPlanIds: [...new Set([...existing.allowedPlanIds, ...programs.map(product => product._id)])] } : {}),
        ...(enableMemberBranding !== undefined ? { memberBrandingEnabled: enableMemberBranding } : {}),
        ...(activate ? { status: "active" as const, activatedAt: existing.activatedAt ?? Date.now() } : {}),
        updatedAt: Date.now(),
      });
      return { siteId: existing._id, ...hierarchy, created: false, status: activate ? "active" : existing.status };
    }
    const primary = await ctx.db.query("sites").withIndex("by_slug", q => q.eq("slug", "ideal-health")).unique();
    if (!primary || primary.status !== "active") throw new Error("An active Ideal site is required as the existing oral-program template");
    const visible = await ctx.db.query("catalogProducts").withIndex("by_visible", q => q.eq("isVisible", true)).collect();
    const plans = visible.filter(product => product.category === "dental" || isMembershipProgramSlug(product.slug) || product.slug.startsWith("oralcare-"));
    if (!plans.length) throw new Error("No visible oral plans found; configure the intended offering before launch");
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      ...preset,
      branding: { ...preset.branding, heroSubtext: "AI oral scanning, 24/7 teledentistry and nationwide dental discount network access." },
      domain: "www.assurevantage.com",
      basePath: "/assurevantage",
      allowedPlanIds: plans.map(product => product._id),
      defaultCadence: primary.defaultCadence,
      defaultPaymentMethod: primary.defaultPaymentMethod,
      enrollmentDefaults: {
        ...primary.enrollmentDefaults,
        welcomeMessage: "Welcome to AssureVantage.",
        supportEmail: "support@getidealoh.com",
        supportPhone: "(844) 679-9367",
      },
      shopEnabled: false,
      memberBrandingEnabled: enableMemberBranding ?? false,
      status: activate ? "active" : "onboarding",
      ...(activate ? { activatedAt: now } : {}),
      createdAt: now, updatedAt: now,
    });
    const hierarchy = await ensureDtcHierarchy(ctx, siteId);
    return { siteId, ...hierarchy, created: true, status: activate ? "active" : "onboarding" };
  },
});
