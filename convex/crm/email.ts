/**
 * ONE-OFF CRM EMAIL — sending a single email from a contact's page.
 *
 * This is deliberately the FIRST thing to exercise the CRM's Resend path,
 * ahead of any batch campaign: at one recipient, a bad merge field or a
 * missing unsubscribe link only ever affects one person, not a whole segment.
 */

import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireCrmUser, requireCrmUserAction } from "./guards";
import { sendViaResend } from "../lib/resend";
import { getBaseUrl } from "../lib/env";
import { renderMergeFields, appendComplianceFooter, extractMergeFields } from "./lib/merge";
import { isSuppressed } from "./suppressions";
import { insertActivity } from "./activities";
import { recordEmailSent } from "./lib/emailProgress";

const CRM_POSTAL_ADDRESS = process.env.CRM_POSTAL_ADDRESS ?? "";
const CRM_FROM_NAME = process.env.CRM_FROM_NAME ?? "Ideal Oral Health";
const CRM_FROM_EMAIL = process.env.CRM_FROM_EMAIL; // e.g. sales@outreach.getidealoh.com, once configured

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmEmailTemplates").withIndex("by_archived", (q) => q.eq("isArchived", false)).collect();
  },
});

export const saveTemplate = mutation({
  args: {
    templateId: v.optional(v.id("crmEmailTemplates")),
    name: v.string(),
    subject: v.string(),
    bodyHtml: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const mergeFields = extractMergeFields(`${args.subject} ${args.bodyHtml}`);
    const now = Date.now();
    if (args.templateId) {
      await ctx.db.patch(args.templateId, { name: args.name, subject: args.subject, bodyHtml: args.bodyHtml, category: args.category, mergeFields, updatedAt: now });
      return args.templateId;
    }
    return await ctx.db.insert("crmEmailTemplates", {
      name: args.name, subject: args.subject, bodyHtml: args.bodyHtml, category: args.category, mergeFields,
      isArchived: false, createdBy: identity.clerkUserId, createdAt: now, updatedAt: now,
    });
  },
});

export const archiveTemplate = mutation({
  args: { templateId: v.id("crmEmailTemplates"), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.templateId, { isArchived: args.archived, updatedAt: Date.now() });
  },
});

/** Internal-only read used by the action — actions can't touch ctx.db directly. */
export const _getSendableContact = internalQuery({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return { ok: false as const, reason: "Contact not found" };
    if (!contact.email) return { ok: false as const, reason: "Contact has no email on file" };
    if (contact.emailOptOut) return { ok: false as const, reason: "Contact has opted out of email" };
    if (["bounced_hard", "complained", "unsubscribed"].includes(contact.emailStatus)) {
      return { ok: false as const, reason: `Email is ${contact.emailStatus.replace(/_/g, " ")}` };
    }
    if (contact.emailLower && (await isSuppressed(ctx, contact.emailLower))) {
      return { ok: false as const, reason: "Email is on the suppression list" };
    }
    return { ok: true as const, contact };
  },
});

/** Records the send on the timeline WITH resendEmailId — the one thing every non-CRM sender in this codebase forgets, which is why their webhook events silently vanish. */
export const _recordOutboundEmail = internalMutation({
  args: {
    contactId: v.id("crmContacts"),
    subject: v.string(),
    resendEmailId: v.optional(v.string()),
    actorClerkUserId: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return;
    const now = Date.now();

    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "email_outbound",
      title: `Email: ${args.subject}`,
      isTouch: true,
      direction: "outbound",
      resendEmailId: args.resendEmailId,
      emailSubject: args.subject,
      emailTo: contact.email,
      actorType: "staff",
      actorClerkUserId: args.actorClerkUserId,
      actorName: args.actorName,
    });

    // advanceSequence: false — a rep's one-off is a touch, not a drip step.
    // Pushing someone from "Email 2 Sent" to "Email 3 Sent" here would skip a
    // real sequence email they never received.
    await recordEmailSent(ctx, args.contactId, { advanceSequence: false, at: now });
  },
});

export const sendOneOffEmail = action({
  args: { contactId: v.id("crmContacts"), subject: v.string(), bodyHtml: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const identity = await requireCrmUserAction(ctx);

    const result = await ctx.runQuery(internal.crm.email._getSendableContact, { contactId: args.contactId });
    if (!result.ok) return { success: false, error: result.reason };
    const { contact } = result;

    const mergeData: Record<string, string | undefined> = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle,
    };
    const renderedSubject = renderMergeFields(args.subject, mergeData);
    const renderedBody = renderMergeFields(args.bodyHtml, mergeData);

    // Two different URLs, deliberately: the visible footer link goes to the
    // human-facing page (GET); the List-Unsubscribe HEADER goes to the API
    // route, because RFC 8058 one-click requires the mail client to POST
    // there directly, and a Next.js page route doesn't handle POST.
    const unsubscribePageUrl = `${getBaseUrl()}/unsubscribe/${args.contactId}`;
    const unsubscribeApiUrl = `${getBaseUrl()}/api/crm/unsubscribe?token=${args.contactId}`;
    const finalHtml = CRM_POSTAL_ADDRESS
      ? appendComplianceFooter(renderedBody, { postalAddress: CRM_POSTAL_ADDRESS, unsubscribeUrl: unsubscribePageUrl, companyName: CRM_FROM_NAME })
      : renderedBody; // CRM_POSTAL_ADDRESS unset — see convex/crm/settings for the CRM setup checklist; sends still work without it, footer is just omitted until it's set.

    const sendResult = await sendViaResend({
      to: contact.email!,
      subject: renderedSubject,
      html: finalHtml,
      from: CRM_FROM_EMAIL ? `${CRM_FROM_NAME} <${CRM_FROM_EMAIL}>` : undefined,
      category: "crm-one-off",
      headers: { "List-Unsubscribe": `<${unsubscribeApiUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      idempotencyKey: `crm-oneoff-${args.contactId}-${Date.now()}`,
      useOutreachKey: true,
    });

    if (!sendResult.success) return { success: false, error: sendResult.error };

    await ctx.runMutation(internal.crm.email._recordOutboundEmail, {
      contactId: args.contactId,
      subject: renderedSubject,
      resendEmailId: sendResult.messageId,
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });

    return { success: true };
  },
});

export const sendTestEmail = action({
  args: { to: v.string(), subject: v.string(), bodyHtml: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    await requireCrmUserAction(ctx);
    const mergeData = { firstName: "Jamie", lastName: "Example", fullName: "Jamie Example", companyName: "Acme Co.", jobTitle: "VP of HR" };
    const renderedBody = renderMergeFields(args.bodyHtml, mergeData);
    const unsubscribeUrl = `${getBaseUrl()}/unsubscribe/preview`;
    // Renders through the SAME footer path as a real send, so a test email is
    // an honest preview of what a recipient actually gets.
    const finalHtml = CRM_POSTAL_ADDRESS
      ? appendComplianceFooter(renderedBody, { postalAddress: CRM_POSTAL_ADDRESS, unsubscribeUrl, companyName: CRM_FROM_NAME })
      : renderedBody;

    const result = await sendViaResend({
      to: args.to,
      subject: `[TEST] ${renderMergeFields(args.subject, mergeData)}`,
      html: finalHtml,
      from: CRM_FROM_EMAIL ? `${CRM_FROM_NAME} <${CRM_FROM_EMAIL}>` : undefined,
      category: "crm-test",
      useOutreachKey: true,
    });
    return { success: result.success, error: result.error };
  },
});
