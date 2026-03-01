import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/authGuards";

// Submit a new inquiry (partnership, investment, careers, or other)
export const submitInquiry = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    inquiryType: v.union(
      v.literal("partnership"),
      v.literal("investment"),
      v.literal("careers"),
      v.literal("other")
    ),
    // Partnership fields
    companyName: v.optional(v.string()),
    industry: v.optional(v.string()),
    partnershipDescription: v.optional(v.string()),
    timeline: v.optional(v.string()),
    // Investment fields
    investmentType: v.optional(v.string()),
    amountRange: v.optional(v.string()),
    investmentDescription: v.optional(v.string()),
    // Careers fields
    positionInterest: v.optional(v.string()),
    careerIntro: v.optional(v.string()),
    // Other
    otherMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inquiryId = await ctx.db.insert("inquiries", {
      ...args,
      status: "new",
      createdAt: Date.now(),
    });
    return inquiryId;
  },
});

// Get all inquiries (for admin)
export const getInquiries = query({
  args: {
    type: v.optional(v.union(
      v.literal("partnership"),
      v.literal("investment"),
      v.literal("careers"),
      v.literal("other")
    )),
    status: v.optional(v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("contacted"),
      v.literal("closed")
    )),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    const inquiriesQuery = ctx.db.query("inquiries");
    
    if (args.type) {
      return await inquiriesQuery
        .withIndex("by_type", (q) => q.eq("inquiryType", args.type!))
        .order("desc")
        .collect();
    }
    
    if (args.status) {
      return await inquiriesQuery
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    
    return await inquiriesQuery.order("desc").collect();
  },
});

// Update inquiry status
export const updateInquiryStatus = mutation({
  args: {
    id: v.id("inquiries"),
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("contacted"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Get inquiry by ID
export const getInquiryById = query({
  args: { id: v.id("inquiries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
