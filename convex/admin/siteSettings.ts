import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Get site settings
export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();
  },
});

// Update site settings
export const update = mutation({
  args: {
    siteName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    socialTwitter: v.optional(v.string()),
    socialLinkedin: v.optional(v.string()),
    socialGithub: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();

    const updateData = {
      ...args,
      updatedAt: Date.now(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    if (existing) {
      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      // Create with defaults if doesn't exist
      return await ctx.db.insert("siteSettings", {
        key: "main",
        siteName: args.siteName ?? "Ideal",
        tagline: args.tagline ?? "We launch and scale products people can trust.",
        description:
          args.description ??
          "Ideal is a venture studio that builds, launches, and scales trustworthy products.",
        contactEmail: args.contactEmail ?? "hello@idealhealth.com",
        supportEmail: args.supportEmail,
        socialTwitter: args.socialTwitter,
        socialLinkedin: args.socialLinkedin,
        socialGithub: args.socialGithub,
        updatedAt: Date.now(),
      });
    }
  },
});

// Initialize default settings (run once)
export const initializeDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();

    if (!existing) {
      await ctx.db.insert("siteSettings", {
        key: "main",
        siteName: "Ideal",
        tagline: "We launch and scale products people can trust.",
        description:
          "Ideal is a venture studio that builds, launches, and scales trustworthy products.",
        contactEmail: "hello@idealhealth.com",
        supportEmail: "support@idealhealth.com",
        socialTwitter: "https://twitter.com/idealhealth",
        socialLinkedin: "https://linkedin.com/company/idealhealth",
        socialGithub: "https://github.com/idealhealth",
        updatedAt: Date.now(),
      });
    }
  },
});
