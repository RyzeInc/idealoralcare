import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/authGuards";

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
