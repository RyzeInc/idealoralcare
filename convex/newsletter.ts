import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Subscribe to newsletter
export const subscribe = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("newsletterSubscriptions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // If previously unsubscribed, reactivate
      if (existing.status === "unsubscribed") {
        await ctx.db.patch(existing._id, {
          status: "active",
          subscribedAt: Date.now(),
        });
        return { success: true, message: "Subscription reactivated" };
      }
      return { success: false, message: "Email already subscribed" };
    }

    // Create new subscription
    await ctx.db.insert("newsletterSubscriptions", {
      email: args.email,
      subscribedAt: Date.now(),
      status: "active",
    });

    return { success: true, message: "Successfully subscribed" };
  },
});

// Unsubscribe from newsletter
export const unsubscribe = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("newsletterSubscriptions")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!subscription) {
      return { success: false, message: "Email not found" };
    }

    await ctx.db.patch(subscription._id, { status: "unsubscribed" });
    return { success: true, message: "Successfully unsubscribed" };
  },
});

// Get all active subscribers (for admin)
export const getActiveSubscribers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("newsletterSubscriptions")
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .collect();
  },
});

// Get subscriber count
export const getSubscriberCount = query({
  args: {},
  handler: async (ctx) => {
    const subscribers = await ctx.db
      .query("newsletterSubscriptions")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    return subscribers.length;
  },
});
