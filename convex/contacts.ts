import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/authGuards";

// Submit a partner / agency registration from /register
export const submitPartnerRegistration = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    business: v.string(),
    wantsPartnerKit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("partnerRegistrations", {
      ...args,
      status: "new",
      createdAt: Date.now(),
    });
    return id;
  },
});

// Submit a new contact form
export const submitContactForm = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const submissionId = await ctx.db.insert("contactSubmissions", {
      ...args,
      status: "new",
      createdAt: Date.now(),
    });
    return submissionId;
  },
});

// Get all contact submissions (for admin)
export const getContactSubmissions = query({
  args: {
    status: v.optional(v.union(v.literal("new"), v.literal("read"), v.literal("replied"))),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    if (args.status) {
      return await ctx.db
        .query("contactSubmissions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("contactSubmissions")
      .order("desc")
      .collect();
  },
});

// Get all partner registrations (admin)
export const getPartnerRegistrations = query({
  args: {
    status: v.optional(v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("closed"),
      v.literal("invited"),
      v.literal("converted"),
    )),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.status) {
      return await ctx.db
        .query("partnerRegistrations")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("partnerRegistrations").order("desc").collect();
  },
});

// Update partner registration status
export const updatePartnerRegistrationStatus = mutation({
  args: {
    id: v.id("partnerRegistrations"),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Update contact submission status
export const updateContactStatus = mutation({
  args: {
    id: v.id("contactSubmissions"),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Bulk add partner registrations (admin)
export const bulkAddPartnerRegistrations = mutation({
  args: {
    leads: v.array(
      v.object({
        name: v.string(),
        email: v.string(),
        phone: v.string(),
        business: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const ids: string[] = [];
    
    for (const lead of args.leads) {
      const id = await ctx.db.insert("partnerRegistrations", {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        business: lead.business,
        wantsPartnerKit: false,
        status: "new",
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    
    return { count: ids.length, ids };
  },
});
