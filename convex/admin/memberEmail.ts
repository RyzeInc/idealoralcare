/**
 * MEMBER COMMUNICATIONS
 *
 * One path for "send this member an email, and write it down."
 *
 * Everything an admin can send from the member detail page or the mass-send
 * screen goes through here: a template from lib/emailTemplates.ts rendered with
 * the member's real data, a one-off message typed by an admin, or a re-send of
 * something that already went out. Every send produces an `emailSends` row (the
 * log the Communications screens read) plus the usual `memberActivities`
 * email_sent row, so the member timeline and the Resend bounce handling keep
 * working unchanged.
 *
 * Mass sends create an `emailCampaigns` row and schedule one staggered action
 * per recipient, the same shape batchSendWelcomeEmails uses — an action that
 * tried to send hundreds of emails inline would hit the action timeout.
 */

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";
import { sendViaResend } from "../lib/resend";
import { EMAIL_TEMPLATES, isEmailTemplateId } from "../lib/emailTemplates";
import { getBaseUrl } from "../lib/env";
import { PROVIDER_GROUP_CODE } from "../lib/constants";

/** Stagger between individual sends in a mass send — ~7 emails/sec. */
const BULK_STAGGER_MS = 150;

// ─────────────────────────────────────────────────────────────────────
// SENDABLE TEMPLATES
// ─────────────────────────────────────────────────────────────────────

/**
 * The member context every sendable template draws from. Assembled once per
 * send by getSendContext so each template builder is a pure mapping.
 */
export interface MemberEmailContext {
  memberProfileId: string;
  memberIdCode: string;
  memberName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  effectiveDate: string;
  planName: string;
  groupName: string;
  groupCode: string;
  subscriberId: string | null;
  totalCents: number | null;
  portalUrl: string;
  memberServicesPhone: string;
}

type TemplateBuild =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * Templates that can be sent to a real member, and how their data is built.
 *
 * Two kinds live here:
 *  - "delegate" — the send needs work this module should not duplicate (real
 *    PDF generation, a fresh Clerk invite), so it calls the action that already
 *    owns that flow and logs the result.
 *  - "render"   — the template is rendered here from the member context.
 *
 * A template absent from this map is not offered for member sends; it can still
 * be used through the custom composer.
 */
const SENDABLE: Record<
  string,
  | { kind: "render"; build: (c: MemberEmailContext) => TemplateBuild }
  | { kind: "delegate"; note: string }
> = {
  "fulfillment-packet": {
    kind: "delegate",
    note: "Sends through resendMemberPacket so the real membership PDFs are attached.",
  },
  "essentials-fulfillment-packet": {
    kind: "delegate",
    note: "Sends through resendMemberPacket so the real Essentials PDFs are attached.",
  },
  "eligibility-set-password": {
    kind: "delegate",
    note: "Issues a fresh Clerk invitation, so the set-password link in the email is valid.",
  },
  welcome: {
    kind: "render",
    build: (c) => ({
      ok: true,
      data: {
        memberName: c.memberName,
        planName: c.planName,
        effectiveDate: c.effectiveDate,
        memberId: c.memberIdCode,
        portalUrl: c.portalUrl,
      },
    }),
  },
  confirmation: {
    kind: "render",
    build: (c) => ({
      ok: true,
      data: {
        memberName: c.memberName,
        memberId: c.memberIdCode,
        planName: c.planName,
        groupCode: c.groupCode,
        effectiveDate: c.effectiveDate,
        billingAmount:
          c.totalCents != null ? `$${(c.totalCents / 100).toFixed(2)}` : undefined,
      },
    }),
  },
  cancelled: {
    kind: "render",
    build: (c) => ({
      ok: true,
      data: { memberName: c.memberName, memberId: c.memberIdCode },
    }),
  },
  "member-id-card": {
    kind: "render",
    build: (c) => ({
      ok: true,
      data: { firstName: c.firstName, memberId: c.memberIdCode },
    }),
  },
  "bulk-welcome-card": {
    kind: "render",
    build: (c) => ({
      ok: true,
      data: {
        firstName: c.firstName,
        planName: c.planName,
        memberId: c.memberIdCode,
      },
    }),
  },
};

/** Template metadata for the send pickers — registry data plus how we send it. */
export const listSendableTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return Object.keys(SENDABLE).map((id) => {
      const template = (EMAIL_TEMPLATES as any)[id];
      const entry = SENDABLE[id];
      return {
        id,
        label: template.label as string,
        description: template.description as string,
        category: template.category as string,
        hasAttachments: template.attachments !== undefined,
        delegated: entry.kind === "delegate",
        note: entry.kind === "delegate" ? entry.note : null,
      };
    });
  },
});

// ─────────────────────────────────────────────────────────────────────
// MEMBER CONTEXT
// ─────────────────────────────────────────────────────────────────────

function formatDate(value: string | number | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function buildContext(ctx: any, memberProfileId: any): Promise<MemberEmailContext> {
  const member = await ctx.db.get(memberProfileId);
  if (!member) throw new Error("Member not found");

  const group = member.groupId ? await ctx.db.get(member.groupId) : null;

  // Plan name and billed amount come from the member's current bundle when
  // there is one — a lead or eligible member has neither.
  let planName = "Ideal Oral Savings Plan";
  let totalCents: number | null = null;
  if (member.customerId) {
    const bundles = await ctx.db
      .query("subscriptionBundles")
      .filter((q: any) => q.eq(q.field("customerId"), member.customerId))
      .collect();
    const bundle =
      bundles.find((b: any) => b.status === "active") ??
      bundles.sort((a: any, b: any) => (b._creationTime ?? 0) - (a._creationTime ?? 0))[0];
    if (bundle) {
      totalCents = bundle.pricingSnapshot?.totalCents ?? null;
      const entitlement = await ctx.db
        .query("entitlements")
        .filter((q: any) => q.eq(q.field("customerId"), member.customerId))
        .first();
      if (entitlement?.productName) planName = entitlement.productName;
    }
  }

  const firstName = member.firstName ?? "Member";
  const lastName = member.lastName ?? "";

  return {
    memberProfileId: String(member._id),
    memberIdCode: member.memberId,
    memberName: [firstName, lastName].filter(Boolean).join(" ").trim() || "Member",
    firstName,
    lastName,
    email: member.email ?? null,
    effectiveDate: formatDate(member.effectiveDate),
    planName,
    groupName: group?.name ?? "Ideal Health",
    groupCode: group?.groupCode ?? PROVIDER_GROUP_CODE,
    subscriberId: member.subscriberId ?? null,
    totalCents,
    portalUrl: getBaseUrl(),
    memberServicesPhone: "(844) 679-9367",
  };
}

export const getSendContext = internalQuery({
  args: { memberProfileId: v.id("memberProfiles") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberProfileId);
    if (!member) throw new Error("Member not found");
    const context = await buildContext(ctx, args.memberProfileId);
    return {
      context,
      siteId: member.siteId,
      groupId: member.groupId,
    };
  },
});

/**
 * Render what a member would actually receive, without sending it.
 * Drives the preview panes on both send screens.
 */
export const previewForMember = query({
  args: {
    memberProfileId: v.id("memberProfiles"),
    templateId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const entry = SENDABLE[args.templateId];
    if (!entry) {
      return { available: false, reason: `Template "${args.templateId}" is not member-sendable.` };
    }

    const context = await buildContext(ctx, args.memberProfileId);

    if (entry.kind === "delegate") {
      // Delegated sends build their data (PDFs, invite links) at send time, so
      // the closest honest preview is the registry sample.
      const rendered = (EMAIL_TEMPLATES as any)[args.templateId].renderSample({
        firstName: context.firstName,
        lastName: context.lastName,
        email: context.email ?? "",
      });
      return {
        available: true,
        approximate: true,
        note: entry.note,
        to: context.email,
        subject: rendered.subject,
        html: rendered.html,
      };
    }

    const built = entry.build(context);
    if (!built.ok) return { available: false, reason: built.reason };

    const rendered = (EMAIL_TEMPLATES as any)[args.templateId].render(built.data);
    return {
      available: true,
      approximate: false,
      note: null,
      to: context.email,
      subject: rendered.subject,
      html: rendered.html,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────
// CUSTOM COMPOSE
// ─────────────────────────────────────────────────────────────────────

/** Tokens an admin can drop into a custom subject or body. */
export const MERGE_TOKENS = [
  "{{firstName}}",
  "{{lastName}}",
  "{{memberName}}",
  "{{memberId}}",
  "{{planName}}",
  "{{effectiveDate}}",
  "{{groupName}}",
  "{{portalUrl}}",
] as const;

function applyMergeTokens(text: string, c: MemberEmailContext): string {
  return text
    .replace(/\{\{\s*firstName\s*\}\}/g, c.firstName)
    .replace(/\{\{\s*lastName\s*\}\}/g, c.lastName)
    .replace(/\{\{\s*memberName\s*\}\}/g, c.memberName)
    .replace(/\{\{\s*memberId\s*\}\}/g, c.memberIdCode)
    .replace(/\{\{\s*planName\s*\}\}/g, c.planName)
    .replace(/\{\{\s*effectiveDate\s*\}\}/g, c.effectiveDate)
    .replace(/\{\{\s*groupName\s*\}\}/g, c.groupName)
    .replace(/\{\{\s*portalUrl\s*\}\}/g, c.portalUrl);
}

/**
 * Wrap an admin-written body in the same plain branded shell the other
 * operational emails use, so a one-off message does not arrive as bare text.
 */
function customEmailShell(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Ideal Oral Health</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; line-height: 1.6;">
        ${bodyHtml}
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
        Ideal Oral Health · Member Services (844) 679-9367 · support@getidealoh.com
      </p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────────────

const sendPayload = v.object({
  mode: v.union(v.literal("template"), v.literal("custom"), v.literal("resend")),
  /** Registry template id — required when mode is "template". */
  templateId: v.optional(v.string()),
  /** Subject and body — required when mode is "custom". */
  subject: v.optional(v.string()),
  html: v.optional(v.string()),
  /** The prior send to duplicate — required when mode is "resend". */
  sourceSendId: v.optional(v.id("emailSends")),
});

export const recordSend = internalMutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    to: v.string(),
    templateId: v.string(),
    templateLabel: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    hasAttachments: v.boolean(),
    mode: v.union(v.literal("template"), v.literal("custom"), v.literal("resend")),
    sourceSendId: v.optional(v.id("emailSends")),
    campaignId: v.optional(v.id("emailCampaigns")),
    success: v.boolean(),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentBy: v.optional(v.string()),
    sentByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberProfileId);
    if (!member) throw new Error("Member not found");

    const now = Date.now();
    const memberName =
      [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || args.to;

    const sendId = await ctx.db.insert("emailSends", {
      memberProfileId: args.memberProfileId,
      memberName,
      memberIdCode: member.memberId,
      to: args.to,
      siteId: member.siteId,
      groupId: member.groupId,
      templateId: args.templateId,
      templateLabel: args.templateLabel,
      subject: args.subject,
      // Only custom bodies are stored — template sends are re-rendered on demand.
      html: args.mode === "template" ? undefined : args.html,
      hasAttachments: args.hasAttachments,
      mode: args.mode,
      sourceSendId: args.sourceSendId,
      campaignId: args.campaignId,
      status: args.success ? "sent" : "failed",
      resendEmailId: args.resendEmailId,
      error: args.error,
      sentBy: args.sentBy,
      sentByName: args.sentByName,
      createdAt: now,
      sentAt: args.success ? now : undefined,
    });

    // Mirror into the member timeline so the existing activity feed and the
    // Resend bounce handling (which looks up by resendEmailId) see it too.
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: args.success ? "email_sent" : "email_failed",
      title: args.success ? `Email sent: ${args.templateLabel}` : `Email failed: ${args.templateLabel}`,
      description: args.success
        ? `"${args.subject}" to ${args.to}`
        : `"${args.subject}" to ${args.to} — ${args.error ?? "unknown error"}`,
      metadata: {
        emailSendId: sendId,
        templateId: args.templateId,
        campaignId: args.campaignId,
        sentByName: args.sentByName,
      },
      resendEmailId: args.resendEmailId,
      actorType: args.sentBy && args.sentBy !== "system" ? "admin" : "system",
      actorId: args.sentBy,
      actorName: args.sentByName,
      createdAt: now,
    });

    return sendId;
  },
});

/**
 * Patch an emailSends row from a Resend delivery webhook event.
 * Called alongside the memberActivities update in
 * eligibilityProvisioning.recordEmailDeliveryEvent.
 */
export const applyDeliveryEvent = internalMutation({
  args: {
    resendEmailId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const send = await ctx.db
      .query("emailSends")
      .withIndex("by_resend_email_id", (q) => q.eq("resendEmailId", args.resendEmailId))
      .first();
    if (!send) return { matched: false };

    const statusMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
      "email.opened": "opened",
      "email.clicked": "clicked",
    };
    const next = statusMap[args.eventType];
    if (!next) return { matched: false };

    // Opens and clicks must not overwrite a bounce or complaint — those are the
    // states an admin needs to keep seeing.
    const terminal = new Set(["bounced", "complained", "failed"]);
    if (terminal.has(send.status) && !terminal.has(next)) {
      await ctx.db.patch(send._id, { lastEventAt: Date.now() });
      return { matched: true, kept: send.status };
    }

    await ctx.db.patch(send._id, { status: next as any, lastEventAt: Date.now() });
    return { matched: true, status: next };
  },
});

// ─────────────────────────────────────────────────────────────────────
// SENDING
// ─────────────────────────────────────────────────────────────────────

interface ResolvedEmail {
  templateId: string;
  templateLabel: string;
  subject: string;
  html: string;
  hasAttachments: boolean;
  /** Set when the send must run through another module's flow. */
  delegate: "packet" | "invite" | null;
}

/**
 * Send one email to one member and log it.
 *
 * Internal and unauthenticated on purpose: the two public entry points below
 * check admin first, and the scheduler (which has no identity) drives the
 * per-recipient sends of a mass send. Never throws for a delivery failure —
 * it records the failure and reports it, so one bad address cannot abort a
 * campaign.
 */
export const deliverToMember = internalAction({
  args: {
    memberProfileId: v.id("memberProfiles"),
    payload: sendPayload,
    campaignId: v.optional(v.id("emailCampaigns")),
    sentBy: v.optional(v.string()),
    sentByName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; to?: string; error?: string }> => {
    const { context }: any = await ctx.runQuery(
      internal.admin.memberEmail.getSendContext,
      { memberProfileId: args.memberProfileId }
    );

    // Resolve what to send before touching the member's address, so a bad
    // request fails the same way for everyone in a campaign.
    let resolved: ResolvedEmail;
    try {
      resolved = await resolveEmail(ctx, args.payload, context);
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }

    if (!context.email) {
      await ctx.runMutation(internal.admin.memberEmail.recordSend, {
        memberProfileId: args.memberProfileId,
        to: "(no email on file)",
        templateId: resolved.templateId,
        templateLabel: resolved.templateLabel,
        subject: resolved.subject,
        html: resolved.html,
        hasAttachments: resolved.hasAttachments,
        mode: args.payload.mode,
        sourceSendId: args.payload.sourceSendId,
        campaignId: args.campaignId,
        success: false,
        error: "Member has no email address on file",
        sentBy: args.sentBy,
        sentByName: args.sentByName,
      });
      return { success: false, error: "Member has no email address on file" };
    }

    let success = false;
    let resendEmailId: string | undefined;
    let error: string | undefined;

    try {
      if (resolved.delegate === "packet") {
        resendEmailId = await sendPacket(ctx, args.memberProfileId, context);
        success = true;
      } else if (resolved.delegate === "invite") {
        const res: any = await ctx.runAction(
          internal.admin.eligibilityProvisioning.sendWelcomeInviteInternal,
          { memberProfileId: args.memberProfileId, sourceTag: "member_email_resend" }
        );
        resendEmailId = res?.resendEmailId;
        success = true;
      } else {
        const result = await sendViaResend({
          to: context.email,
          subject: resolved.subject,
          html: resolved.html,
          tags: [
            { name: "category", value: resolved.templateId.slice(0, 50) },
            { name: "source", value: args.campaignId ? "campaign" : "admin-console" },
          ],
        });
        success = result.success;
        resendEmailId = result.messageId;
        error = result.error;
      }
    } catch (err: any) {
      success = false;
      error = err?.message ?? String(err);
    }

    await ctx.runMutation(internal.admin.memberEmail.recordSend, {
      memberProfileId: args.memberProfileId,
      to: context.email,
      templateId: resolved.templateId,
      templateLabel: resolved.templateLabel,
      subject: resolved.subject,
      html: resolved.html,
      hasAttachments: resolved.hasAttachments,
      mode: args.payload.mode,
      sourceSendId: args.payload.sourceSendId,
      campaignId: args.campaignId,
      success,
      resendEmailId,
      error,
      sentBy: args.sentBy,
      sentByName: args.sentByName,
    });

    return success ? { success: true, to: context.email } : { success: false, error };
  },
});

/** Turn a send request into the exact subject/body (or a delegation) to use. */
async function resolveEmail(
  ctx: any,
  payload: any,
  context: MemberEmailContext
): Promise<ResolvedEmail> {
  if (payload.mode === "custom") {
    if (!payload.subject || !payload.html) {
      throw new Error("A custom email needs both a subject and a body");
    }
    return {
      templateId: "custom",
      templateLabel: "Custom message",
      subject: applyMergeTokens(payload.subject, context),
      html: customEmailShell(applyMergeTokens(payload.html, context)),
      hasAttachments: false,
      delegate: null,
    };
  }

  if (payload.mode === "resend") {
    if (!payload.sourceSendId) throw new Error("No source email to re-send");
    const source: any = await ctx.runQuery(internal.admin.memberEmail.getSendById, {
      sendId: payload.sourceSendId,
    });
    if (!source) throw new Error("The email being re-sent no longer exists");

    // A stored body (custom message) goes out verbatim; a template send is
    // re-rendered so the member gets current data, not a stale snapshot.
    if (source.html) {
      return {
        templateId: source.templateId,
        templateLabel: source.templateLabel,
        subject: source.subject,
        html: source.html,
        hasAttachments: false,
        delegate: null,
      };
    }
    return renderTemplate(source.templateId, context);
  }

  if (!payload.templateId) throw new Error("No template selected");
  return renderTemplate(payload.templateId, context);
}

function renderTemplate(templateId: string, context: MemberEmailContext): ResolvedEmail {
  if (!isEmailTemplateId(templateId)) throw new Error(`Unknown template: ${templateId}`);
  const entry = SENDABLE[templateId];
  if (!entry) throw new Error(`Template "${templateId}" cannot be sent to a member`);

  const template = (EMAIL_TEMPLATES as any)[templateId];

  if (entry.kind === "delegate") {
    // The real subject/body is produced by the delegated flow; what we store is
    // the sample render, which uses the same template.
    const preview = template.renderSample({
      firstName: context.firstName,
      lastName: context.lastName,
      email: context.email ?? "",
    });
    return {
      templateId,
      templateLabel: template.label,
      subject: preview.subject,
      html: preview.html,
      hasAttachments: template.attachments !== undefined,
      delegate: templateId === "eligibility-set-password" ? "invite" : "packet",
    };
  }

  const built = entry.build(context);
  if (!built.ok) throw new Error(built.reason);
  const rendered = template.render(built.data);
  return {
    templateId,
    templateLabel: template.label,
    subject: rendered.subject,
    html: rendered.html,
    hasAttachments: false,
    delegate: null,
  };
}

/**
 * Re-send the fulfillment packet with freshly generated PDFs, picking the
 * packet that matches the product the member actually bought. Mirrors
 * notifications.resendMemberPacket, but callable without an identity and
 * returning the Resend email ID so the send can be logged.
 */
async function sendPacket(
  ctx: any,
  memberProfileId: any,
  context: MemberEmailContext
): Promise<string | undefined> {
  const profile: any = await ctx.runQuery(
    internal.admin.eligibilityProvisioning.getMemberProfileById,
    { memberProfileId }
  );
  if (!profile?.customerId) {
    throw new Error(
      "Member has no linked account yet, so their plan cannot be resolved. Send the set-password invite first."
    );
  }

  const cardData: any = await ctx.runQuery(
    api.subscriptions.queries.getMemberCardDataPublic,
    { customerId: profile.customerId }
  );
  if (!cardData) throw new Error("No active membership found for this member");

  const isEssentials = String(cardData.productSlug ?? "").startsWith("essentials-");

  if (isEssentials) {
    const suffix = String(cardData.productSlug).slice("essentials-".length);
    const coverageType =
      ({
        employee: "Employee",
        "employee-spouse": "Employee + Spouse",
        "employee-child": "Employee + Child",
        "employee-family": "Employee + Family",
      } as Record<string, string>)[suffix] ?? "Employee";

    const res: any = await ctx.runAction(api.legal.emailFulfillment.sendEssentialsPacketEmail, {
      memberName: cardData.memberName,
      memberFirstName: context.firstName,
      memberEmail: context.email!,
      essentialsMemberNumber: cardData.essentialsMemberNumber,
      essentialsGroupNumber: cardData.essentialsGroupNumber,
      planName: cardData.planName,
      coverageType,
      effectiveDate: cardData.effectiveDate,
    });
    return res?.emailId;
  }

  const res: any = await ctx.runAction(api.legal.emailFulfillment.sendFulfillmentPacketEmail, {
    memberName: cardData.memberName,
    memberFirstName: context.firstName,
    memberEmail: context.email!,
    memberId: cardData.memberId,
    subscriberId: cardData.subscriberId,
    groupCode: PROVIDER_GROUP_CODE,
    planName: cardData.planName,
    effectiveDate: cardData.effectiveDate,
    networks: cardData.networks,
  });
  return res?.emailId;
}

export const getSendById = internalQuery({
  args: { sendId: v.id("emailSends") },
  handler: async (ctx, args) => ctx.db.get(args.sendId),
});

// ─────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINTS
// ─────────────────────────────────────────────────────────────────────

/** Send one email to one member, from the member detail page. */
export const sendToMember = action({
  args: {
    memberProfileId: v.id("memberProfiles"),
    payload: sendPayload,
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; to?: string; error?: string }> => {
    // @ts-ignore - avoid deep type instantiation
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    return await ctx.runAction(internal.admin.memberEmail.deliverToMember, {
      memberProfileId: args.memberProfileId,
      payload: args.payload,
      sentBy: identity.clerkUserId,
      sentByName: identity.name ?? identity.email ?? "Admin",
    });
  },
});

/**
 * Mass send: one email to every selected member.
 *
 * Returns as soon as the campaign is recorded and the sends are scheduled —
 * the campaign row then fills in as each recipient completes, which is what
 * the campaign progress view watches.
 */
export const sendBulk = action({
  args: {
    memberProfileIds: v.array(v.id("memberProfiles")),
    payload: sendPayload,
    /** Optional label for the campaign; defaults to the template name + date. */
    name: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ campaignId: string; scheduled: number }> => {
    // @ts-ignore - avoid deep type instantiation
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    if (args.memberProfileIds.length === 0) {
      throw new Error("Select at least one member");
    }

    // Resolve the label and subject once, off the first recipient, so the
    // campaign row reads sensibly before any send has happened.
    const { context }: any = await ctx.runQuery(
      internal.admin.memberEmail.getSendContext,
      { memberProfileId: args.memberProfileIds[0] }
    );
    const resolved = await resolveEmail(ctx, args.payload, context);

    const campaignId: any = await ctx.runMutation(
      internal.admin.memberEmail.createCampaign,
      {
        name:
          args.name?.trim() ||
          `${resolved.templateLabel} — ${new Date().toLocaleDateString("en-US")}`,
        templateId: resolved.templateId,
        templateLabel: resolved.templateLabel,
        subject: resolved.subject,
        html: args.payload.mode === "custom" ? resolved.html : undefined,
        mode: args.payload.mode,
        recipientCount: args.memberProfileIds.length,
        createdBy: identity.clerkUserId,
        createdByName: identity.name ?? identity.email ?? "Admin",
      }
    );

    for (let i = 0; i < args.memberProfileIds.length; i++) {
      await ctx.scheduler.runAfter(
        i * BULK_STAGGER_MS,
        internal.admin.memberEmail.deliverForCampaign,
        {
          memberProfileId: args.memberProfileIds[i],
          payload: args.payload,
          campaignId,
          sentBy: identity.clerkUserId,
          sentByName: identity.name ?? identity.email ?? "Admin",
        }
      );
    }

    return { campaignId: String(campaignId), scheduled: args.memberProfileIds.length };
  },
});

/** One recipient of a campaign: send, then advance the campaign's counters. */
export const deliverForCampaign = internalAction({
  args: {
    memberProfileId: v.id("memberProfiles"),
    payload: sendPayload,
    campaignId: v.id("emailCampaigns"),
    sentBy: v.optional(v.string()),
    sentByName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const result: any = await ctx.runAction(internal.admin.memberEmail.deliverToMember, {
      memberProfileId: args.memberProfileId,
      payload: args.payload,
      campaignId: args.campaignId,
      sentBy: args.sentBy,
      sentByName: args.sentByName,
    });

    await ctx.runMutation(internal.admin.memberEmail.advanceCampaign, {
      campaignId: args.campaignId,
      success: !!result?.success,
    });
  },
});

export const createCampaign = internalMutation({
  args: {
    name: v.string(),
    templateId: v.string(),
    templateLabel: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    mode: v.union(v.literal("template"), v.literal("custom"), v.literal("resend")),
    recipientCount: v.number(),
    createdBy: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emailCampaigns", {
      ...args,
      sentCount: 0,
      failedCount: 0,
      status: "sending",
      createdAt: Date.now(),
    });
  },
});

export const advanceCampaign = internalMutation({
  args: { campaignId: v.id("emailCampaigns"), success: v.boolean() },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    const sentCount = campaign.sentCount + (args.success ? 1 : 0);
    const failedCount = campaign.failedCount + (args.success ? 0 : 1);
    const done = sentCount + failedCount >= campaign.recipientCount;

    await ctx.db.patch(args.campaignId, {
      sentCount,
      failedCount,
      status: done
        ? failedCount > 0
          ? "completed_with_errors"
          : "completed"
        : "sending",
      completedAt: done ? Date.now() : undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────────────

function shapeSend(row: any) {
  return {
    id: row._id,
    memberProfileId: row.memberProfileId ?? null,
    memberName: row.memberName,
    memberIdCode: row.memberIdCode ?? null,
    to: row.to,
    templateId: row.templateId,
    templateLabel: row.templateLabel,
    subject: row.subject,
    mode: row.mode,
    status: row.status,
    hasAttachments: row.hasAttachments,
    hasStoredBody: !!row.html,
    campaignId: row.campaignId ?? null,
    error: row.error ?? null,
    sentByName: row.sentByName ?? "System",
    createdAt: row.createdAt,
    sentAt: row.sentAt ?? null,
    lastEventAt: row.lastEventAt ?? null,
  };
}

/** Everything ever sent to one member — the Communications card on their page. */
export const memberEmailHistory = query({
  args: { memberProfileId: v.id("memberProfiles"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const rows = await ctx.db
      .query("emailSends")
      .withIndex("by_member", (q) => q.eq("memberProfileId", args.memberProfileId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));

    return rows.map(shapeSend);
  },
});

/** The global send log, newest first, with optional filters. */
export const recentSends = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    templateId: v.optional(v.string()),
    campaignId: v.optional(v.id("emailCampaigns")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(args.limit ?? 100, 500);

    let rows;
    if (args.campaignId) {
      rows = await ctx.db
        .query("emailSends")
        .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
        .order("desc")
        .take(limit);
    } else if (args.templateId) {
      rows = await ctx.db
        .query("emailSends")
        .withIndex("by_template", (q) => q.eq("templateId", args.templateId!))
        .order("desc")
        .take(limit);
    } else if (args.status) {
      rows = await ctx.db
        .query("emailSends")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db.query("emailSends").withIndex("by_created").order("desc").take(limit);
    }

    // Status and template narrow further when combined with another filter.
    let filtered = rows;
    if (args.status && (args.campaignId || args.templateId)) {
      filtered = filtered.filter((r) => r.status === args.status);
    }
    if (args.templateId && args.campaignId) {
      filtered = filtered.filter((r) => r.templateId === args.templateId);
    }

    const search = args.search?.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.memberName.toLowerCase().includes(search) ||
          r.to.toLowerCase().includes(search) ||
          r.subject.toLowerCase().includes(search) ||
          (r.memberIdCode ?? "").toLowerCase().includes(search)
      );
    }

    return filtered.map(shapeSend);
  },
});

/** Headline counts for the log screen. */
export const sendStats = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Bounded scan — the log screen wants a recent-activity summary, not an
    // all-time aggregate over an unbounded table.
    const rows = await ctx.db
      .query("emailSends")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 500, 2000));

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      scanned: rows.length,
      last24h: rows.filter((r) => r.createdAt >= dayAgo).length,
      sent: (counts.sent ?? 0) + (counts.delivered ?? 0) + (counts.opened ?? 0) + (counts.clicked ?? 0),
      delivered: counts.delivered ?? 0,
      opened: counts.opened ?? 0,
      failed: (counts.failed ?? 0) + (counts.bounced ?? 0) + (counts.complained ?? 0),
      byStatus: counts,
    };
  },
});

export const listCampaigns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const rows = await ctx.db
      .query("emailCampaigns")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));

    return rows.map((c) => ({
      id: c._id,
      name: c.name,
      templateId: c.templateId,
      templateLabel: c.templateLabel,
      subject: c.subject,
      // Carried so a custom-message campaign can be re-run against a new selection.
      html: c.html ?? null,
      mode: c.mode,
      recipientCount: c.recipientCount,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      status: c.status,
      createdByName: c.createdByName ?? "Admin",
      createdAt: c.createdAt,
      completedAt: c.completedAt ?? null,
    }));
  },
});

/** The stored body of one send, for the "view what was sent" drawer. */
export const getSendBody = query({
  args: { sendId: v.id("emailSends") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const row = await ctx.db.get(args.sendId);
    if (!row) return null;

    // Template sends are not stored — re-render them against current member data.
    let html = row.html ?? null;
    if (!html && row.memberProfileId && SENDABLE[row.templateId]) {
      try {
        const context = await buildContext(ctx, row.memberProfileId);
        html = renderTemplate(row.templateId, context).html;
      } catch {
        html = null;
      }
    }

    return { ...shapeSend(row), html };
  },
});

/**
 * Members eligible to receive mail, for the mass-send picker.
 * Members with no email address are returned too, flagged, so it is obvious
 * why they cannot be selected rather than them silently disappearing.
 */
export const listRecipients = query({
  args: {
    search: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    memberType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(args.limit ?? 500, 2000);

    const rows = args.groupId
      ? await ctx.db
          .query("memberProfiles")
          .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
          .take(limit)
      : await ctx.db.query("memberProfiles").take(limit);

    const groupNames = new Map<string, string>();
    for (const g of await ctx.db.query("groups").collect()) {
      groupNames.set(String(g._id), g.name);
    }

    const search = args.search?.trim().toLowerCase();

    return rows
      .filter((m) => !args.memberType || m.memberType === args.memberType)
      .filter((m) => {
        if (!search) return true;
        const hay = [m.firstName, m.lastName, m.email, m.memberId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      })
      .map((m) => ({
        id: m._id,
        name: [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || m.memberId,
        memberIdCode: m.memberId,
        email: m.email ?? null,
        memberType: m.memberType,
        groupId: m.groupId,
        groupName: groupNames.get(String(m.groupId)) ?? "—",
        emailable: !!m.email,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Groups, for the recipient filter. */
export const listGroupsForFilter = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db.query("groups").collect();
    return groups
      .map((g) => ({ id: g._id, name: g.name, groupCode: g.groupCode }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
