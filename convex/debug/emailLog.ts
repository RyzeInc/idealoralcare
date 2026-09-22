import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Debug email tester activity log.
 *
 * /debug/email-test has no auth gate right now (anyone with the URL can send
 * a real email through our verified domain), so every send it triggers is
 * recorded here for accountability. Deliberately public, matching the tester
 * itself — do not add an auth check here without also gating the tester.
 */

export const logSend = mutation({
  args: {
    templateId: v.string(),
    to: v.string(),
    subject: v.string(),
    success: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
    hasAttachments: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      eventType: "debug.test_email_sent",
      actor: "debug-tool",
      payload: {
        templateId: args.templateId,
        to: args.to,
        subject: args.subject,
        messageId: args.messageId,
        hasAttachments: args.hasAttachments ?? false,
      },
      success: args.success,
      errorMessage: args.error,
      createdAt: Date.now(),
    });
  },
});

export const recentSends = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    const rows = await ctx.db
      .query("events")
      .withIndex("by_event_type", (q) => q.eq("eventType", "debug.test_email_sent"))
      .order("desc")
      .take(limit);

    return rows.map((r) => {
      const payload = (r.payload ?? {}) as {
        templateId?: string;
        to?: string;
        subject?: string;
        messageId?: string;
        hasAttachments?: boolean;
      };
      return {
        id: r._id,
        createdAt: r.createdAt,
        templateId: payload.templateId ?? "unknown",
        to: payload.to ?? "",
        subject: payload.subject ?? "",
        success: r.success,
        messageId: payload.messageId,
        error: r.errorMessage,
        hasAttachments: payload.hasAttachments ?? false,
      };
    });
  },
});
