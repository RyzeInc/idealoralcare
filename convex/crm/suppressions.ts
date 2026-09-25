/**
 * SUPPRESSIONS — the list nothing in the CRM's email path is allowed to skip
 * checking. unsubscribeByToken and getUnsubscribeContext are the two public,
 * unauthenticated entry points (the recipient has no Clerk account) — both
 * are careful to never return or accept anything beyond a masked email and a
 * write-only idempotent state change.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireCrmUser, requireCrmManager } from "./guards";
import { recordAdminAction } from "../admin/adminAudit";

const REASON_VALIDATOR = v.union(
  v.literal("unsubscribed"), v.literal("complained"), v.literal("hard_bounce"),
  v.literal("manual"), v.literal("role_address"), v.literal("competitor"), v.literal("member"),
);

export const listSuppressions = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmSuppressions").withIndex("by_created").order("desc").take(500);
  },
});

export const addSuppression = mutation({
  args: { value: v.string(), scope: v.union(v.literal("email"), v.literal("domain")), reason: REASON_VALIDATOR, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const value = args.value.trim().toLowerCase();
    const existing = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", args.scope).eq("value", value)).first();
    if (existing) return existing._id;
    return await ctx.db.insert("crmSuppressions", { value, scope: args.scope, reason: args.reason, note: args.note, createdBy: identity.clerkUserId, createdAt: Date.now() });
  },
});

export const removeSuppression = mutation({
  args: { suppressionId: v.id("crmSuppressions") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const suppression = await ctx.db.get(args.suppressionId);
    if (!suppression) return;
    await ctx.db.delete(args.suppressionId);
    await recordAdminAction(ctx, identity, {
      action: "crm.suppression.remove",
      targetType: "crmSuppressions",
      targetId: args.suppressionId,
      summary: `Removed suppression for ${suppression.value} (was: ${suppression.reason})`,
    });
  },
});

/** Checked by every send path before dialing Resend. Domain-scope suppressions cover "unsubscribe everyone at acme.com". */
export async function isSuppressed(ctx: QueryCtx | MutationCtx, emailLower: string): Promise<boolean> {
  const byEmail = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "email").eq("value", emailLower)).first();
  if (byEmail) return true;
  const domain = emailLower.split("@")[1];
  if (!domain) return false;
  const byDomain = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "domain").eq("value", domain)).first();
  return !!byDomain;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••@•••";
  const visible = local.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

/**
 * Resolves an unsubscribe link's token to an email address two ways:
 *   1. A crmCampaignRecipients.token (nanoid) — batch sends.
 *   2. A bare crmContacts _id — one-off sends, which have no per-send
 *      recipient row to hang a nanoid token on. Convex document IDs are
 *      unguessable in practice, so reusing the contact's own ID as its
 *      unsubscribe token is the same bearer-link threat model as a nanoid:
 *      whoever holds the link (which we only ever send to that address) can
 *      unsubscribe it — that IS one-click unsubscribe's contract.
 */
async function resolveUnsubscribeTarget(ctx: QueryCtx | MutationCtx, token: string) {
  const recipient = await ctx.db.query("crmCampaignRecipients").withIndex("by_token", (q) => q.eq("token", token)).first();
  if (recipient) return { kind: "recipient" as const, email: recipient.email, recipient };

  const contactId = ctx.db.normalizeId("crmContacts", token);
  if (contactId) {
    const contact = await ctx.db.get(contactId);
    if (contact && contact.email) return { kind: "contact" as const, email: contact.email, contact };
  }
  return null;
}

/**
 * PUBLIC, UNAUTHENTICATED. Returns only a masked email for display — never
 * the recipient's name, company, or any other field. The recipient has no
 * Clerk account, so there is no auth guard to call here; the token itself is
 * the only gate.
 */
export const getUnsubscribeContext = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const target = await resolveUnsubscribeTarget(ctx, args.token);
    if (!target) return null;
    const alreadyUnsubscribed = target.kind === "recipient" ? !!target.recipient.unsubscribedAt : target.contact.emailOptOut;
    return { maskedEmail: maskEmail(target.email), alreadyUnsubscribed };
  },
});

/**
 * PUBLIC, UNAUTHENTICATED, write-only-idempotent. Inserts a suppression and
 * opts the underlying contact out — the same effects a hard-bounce/complaint
 * webhook event produces. domainWide additionally suppresses every address
 * at that domain (HR teams ask for this).
 */
export const unsubscribeByToken = mutation({
  args: { token: v.string(), domainWide: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const target = await resolveUnsubscribeTarget(ctx, args.token);
    if (!target) return { ok: false as const };
    const now = Date.now();

    if (target.kind === "recipient" && !target.recipient.unsubscribedAt) {
      await ctx.db.patch(target.recipient._id, { unsubscribedAt: now, status: "cancelled" });
      const campaign = await ctx.db.get(target.recipient.campaignId);
      if (campaign) await ctx.db.patch(target.recipient.campaignId, { unsubscribedCount: campaign.unsubscribedCount + 1 });
    }

    const emailLower = target.email.toLowerCase();
    const existing = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "email").eq("value", emailLower)).first();
    if (!existing) {
      await ctx.db.insert("crmSuppressions", {
        value: emailLower, scope: "email", reason: "unsubscribed",
        campaignId: target.kind === "recipient" ? target.recipient.campaignId : undefined,
        contactId: target.kind === "contact" ? target.contact._id : undefined,
        createdAt: now,
      });
    }

    if (args.domainWide) {
      const domain = emailLower.split("@")[1];
      if (domain) {
        const existingDomain = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "domain").eq("value", domain)).first();
        if (!existingDomain) {
          await ctx.db.insert("crmSuppressions", { value: domain, scope: "domain", reason: "unsubscribed", createdAt: now });
        }
      }
    }

    const contact = target.kind === "contact" ? target.contact : await ctx.db.query("crmContacts").withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower)).first();
    if (contact) {
      await ctx.db.patch(contact._id, { emailOptOut: true, emailStatus: "unsubscribed", updatedAt: now });
    }

    return { ok: true as const };
  },
});
