import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Get all leads (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("nexusLeads")
      .order("desc")
      .collect();
  },
});

// Get leads by status
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("active"),
      v.literal("contacted"),
      v.literal("converted"),
      v.literal("inactive")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nexusLeads")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

// Get lead by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nexusLeads")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

// Get lead by ID
export const getById = query({
  args: { id: v.id("nexusLeads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Register or update lead access (for gate page)
export const registerAccess = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();
    const existingLead = await ctx.db
      .query("nexusLeads")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingLead) {
      // Update existing lead's access
      await ctx.db.patch(existingLead._id, {
        lastAccessedAt: Date.now(),
        accessCount: existingLead.accessCount + 1,
        // Update name if provided
        ...(args.name && { name: args.name }),
        ...(args.company && { company: args.company }),
      });
      return { id: existingLead._id, isNew: false };
    }

    // Create new lead
    const now = Date.now();
    const id = await ctx.db.insert("nexusLeads", {
      name: args.name,
      email: email,
      company: args.company,
      accessGrantedAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      source: args.source,
      status: "active",
    });
    return { id, isNew: true };
  },
});

// Update lead status
export const updateStatus = mutation({
  args: {
    id: v.id("nexusLeads"),
    status: v.union(
      v.literal("active"),
      v.literal("contacted"),
      v.literal("converted"),
      v.literal("inactive")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Add notes to lead
export const addNotes = mutation({
  args: {
    id: v.id("nexusLeads"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { notes: args.notes });
  },
});

// Delete lead
export const remove = mutation({
  args: { id: v.id("nexusLeads") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Get lead stats (for admin dashboard)
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("nexusLeads").collect();
    
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      total: leads.length,
      active: leads.filter((l) => l.status === "active").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      converted: leads.filter((l) => l.status === "converted").length,
      newToday: leads.filter((l) => l.accessGrantedAt > dayAgo).length,
      newThisWeek: leads.filter((l) => l.accessGrantedAt > weekAgo).length,
      newThisMonth: leads.filter((l) => l.accessGrantedAt > monthAgo).length,
    };
  },
});
