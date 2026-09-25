/**
 * PER-USER CRM SETTINGS — dial provider preference, email signature.
 *
 * getMySettings always returns an object (never null): the default dial
 * provider is "manual" (copy-to-clipboard, no navigation), which is the
 * honest default until a rep's actual phone setup is known — see
 * components/admin/crm/DialButton.tsx.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireCrmUser } from "./guards";

const DIAL_PROVIDER_VALIDATOR = v.union(
  v.literal("tel"), v.literal("ringcentral"), v.literal("dialpad"), v.literal("zoom"),
  v.literal("twilio"), v.literal("custom"), v.literal("manual"),
);

const DEFAULT_DIAL_URL_TEMPLATES: Record<string, string> = {
  tel: "tel:{e164}",
  ringcentral: "rcmobile://call?number={e164}",
  dialpad: "dialpad://{e164}",
  zoom: "zoomphonecall://{e164}",
  twilio: "",
  custom: "",
  manual: "",
};

export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const existing = await ctx.db.query("crmUserSettings").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId)).first();
    if (existing) return existing;
    return {
      clerkUserId: identity.clerkUserId,
      dialProvider: "manual" as const,
      dialUrlTemplate: DEFAULT_DIAL_URL_TEMPLATES.manual,
      emailSignatureHtml: undefined as string | undefined,
      assignSelfOnCreate: true,
      _isDefault: true,
    };
  },
});

export const updateMySettings = mutation({
  args: {
    dialProvider: DIAL_PROVIDER_VALIDATOR,
    dialUrlTemplate: v.optional(v.string()),
    emailSignatureHtml: v.optional(v.string()),
    assignSelfOnCreate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const existing = await ctx.db.query("crmUserSettings").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId)).first();
    const now = Date.now();
    const dialUrlTemplate = args.dialUrlTemplate ?? DEFAULT_DIAL_URL_TEMPLATES[args.dialProvider] ?? "";

    if (existing) {
      await ctx.db.patch(existing._id, {
        dialProvider: args.dialProvider, dialUrlTemplate,
        emailSignatureHtml: args.emailSignatureHtml, assignSelfOnCreate: args.assignSelfOnCreate,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("crmUserSettings", {
      clerkUserId: identity.clerkUserId, dialProvider: args.dialProvider, dialUrlTemplate,
      emailSignatureHtml: args.emailSignatureHtml, assignSelfOnCreate: args.assignSelfOnCreate,
      createdAt: now, updatedAt: now,
    });
  },
});
