import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ASSUREVANTAGE_PRESET } from "../lib/sitePresets";

/** Deployment-console setup only. Never moves existing groups, accounts or members. */
export const configureAssureVantage = internalMutation({
  args: { activate: v.optional(v.boolean()) },
  handler: async (ctx, { activate = false }) => {
    const preset = ASSUREVANTAGE_PRESET;
    const existing = await ctx.db.query("sites").withIndex("by_slug", q => q.eq("slug", preset.slug)).unique();
    if (existing) {
      if (activate && ["suspended", "terminated"].includes(existing.status)) throw new Error("This site has been suspended or terminated; review it before reactivation");
      if (existing.domain && !["assurevantage.com", "www.assurevantage.com"].includes(existing.domain)) throw new Error("AssureVantage already has a different domain; review the assignment");
      await ctx.db.patch(existing._id, {
        domain: "www.assurevantage.com",
        ...(activate ? { status: "active" as const, activatedAt: existing.activatedAt ?? Date.now() } : {}),
        updatedAt: Date.now(),
      });
      return { siteId: existing._id, created: false, status: activate ? "active" : existing.status };
    }
    const primary = await ctx.db.query("sites").withIndex("by_slug", q => q.eq("slug", "ideal-health")).unique();
    if (!primary || primary.status !== "active") throw new Error("An active Ideal site is required as the existing oral-program template");
    const visible = await ctx.db.query("catalogProducts").withIndex("by_visible", q => q.eq("isVisible", true)).collect();
    const plans = visible.filter(product => product.category === "dental");
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
      status: activate ? "active" : "onboarding",
      ...(activate ? { activatedAt: now } : {}),
      createdAt: now, updatedAt: now,
    });
    return { siteId, created: true, status: activate ? "active" : "onboarding" };
  },
});
