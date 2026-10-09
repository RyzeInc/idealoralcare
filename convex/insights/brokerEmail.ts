/**
 * BROKER → MEMBER EMAIL
 *
 * Lets a broker write to the members in their own book from the partner
 * portal's Members page. Pending approval, so it is gated on the
 * `partner.email` permission, which no built-in access pack grants — nobody
 * can send until an admin adds it to a pack or a person in Access & Roles.
 *
 * What keeps this safe to turn on:
 *  - The recipient list is built here from the caller's own scoped book
 *    (loadScopedMembers), never from ids the browser sends.
 *  - Brokers write plain text. It is escaped and wrapped in the standard
 *    Ideal member-email shell, so a broker cannot inject markup or links
 *    dressed up as ours.
 *  - Members who opted out of email, and members with no address, are
 *    skipped; every message carries an opt-out link to member services.
 *  - Replies go to the broker; each send is logged on the member timeline
 *    and in Communications exactly like a staff send.
 *  - Per-send and per-day caps.
 */

import { action, internalQuery, query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { tryResolveViewerScope, isAdminScope, type ScopeNeed, type ViewerScope } from "./scope";
import { loadScopedMembers } from "./book";
import { escapeHtml } from "../lib/sanitize";

const NEED: ScopeNeed = { staff: [], partner: "partner.email" };

export const MAX_RECIPIENTS_PER_SEND = 1000;
export const MAX_SENDS_PER_DAY = 3;
export const MAX_SUBJECT_LENGTH = 150;
export const MAX_MESSAGE_LENGTH = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BULK_STAGGER_MS = 150;

/** With no status filter, write to people currently on a plan. */
const CURRENT_MEMBER_TYPES = new Set(["active", "enrolling", "eligible"]);

const audienceArgs = {
  memberType: v.optional(v.string()),
  groupId: v.optional(v.id("groups")),
};

type AudienceFilters = { memberType?: string; groupId?: Id<"groups"> };

function scopeName(scope: ViewerScope): string {
  if (scope.kind === "partner") return scope.partnerName;
  if (scope.kind === "rep") return scope.leaderName;
  return "Ideal Health";
}

async function resolveSender(ctx: QueryCtx) {
  const scope = await tryResolveViewerScope(ctx, NEED);
  // Staff already have the Communications console; this surface is brokers only.
  if (!scope || isAdminScope(scope)) return null;
  const identity = await ctx.auth.getUserIdentity();
  const replyTo = identity?.email;
  if (!replyTo) return null;
  return {
    scope,
    clerkUserId: scope.clerkUserId,
    replyTo,
    senderName: identity?.name?.trim() || scopeName(scope),
    agencyName: scopeName(scope),
  };
}

async function buildAudience(ctx: QueryCtx, scope: ViewerScope, filters: AudienceFilters) {
  const { members } = await loadScopedMembers(ctx, scope);
  const inView = members.filter(
    (m) =>
      m.memberRole !== "dependent" &&
      (filters.memberType ? m.memberType === filters.memberType : CURRENT_MEMBER_TYPES.has(m.memberType)) &&
      (!filters.groupId || String(m.groupId) === String(filters.groupId)),
  );
  const sendable: Doc<"memberProfiles">[] = [];
  let noEmail = 0;
  let optedOut = 0;
  for (const m of inView) {
    if (!m.email?.trim()) noEmail++;
    else if (m.communicationPrefs?.emailOptIn === false) optedOut++;
    else sendable.push(m);
  }
  return { sendable, noEmail, optedOut };
}

async function sendsInLastDay(ctx: QueryCtx, clerkUserId: string) {
  const recent = await ctx.db
    .query("emailCampaigns")
    .withIndex("by_created", (q) => q.gte("createdAt", Date.now() - DAY_MS))
    .collect();
  return recent.filter((c) => c.createdBy === clerkUserId && c.templateId === "broker-custom").length;
}

/**
 * What the composer needs: whether this person may send at all (null = hide
 * the button), who it will come from, and how many members it will reach.
 */
export const getComposer = query({
  args: audienceArgs,
  handler: async (ctx, args) => {
    const sender = await resolveSender(ctx);
    if (!sender) return null;
    const { sendable, noEmail, optedOut } = await buildAudience(ctx, sender.scope, args);
    const sentToday = await sendsInLastDay(ctx, sender.clerkUserId);
    return {
      senderName: sender.senderName,
      agencyName: sender.agencyName,
      replyTo: sender.replyTo,
      recipients: sendable.length,
      skippedNoEmail: noEmail,
      skippedOptedOut: optedOut,
      overLimit: sendable.length > MAX_RECIPIENTS_PER_SEND,
      sentToday,
      sendsLeftToday: Math.max(0, MAX_SENDS_PER_DAY - sentToday),
      limits: {
        recipients: MAX_RECIPIENTS_PER_SEND,
        perDay: MAX_SENDS_PER_DAY,
        subject: MAX_SUBJECT_LENGTH,
        message: MAX_MESSAGE_LENGTH,
      },
    };
  },
});

/** The send's authority check and recipient list, run with the caller's identity. */
export const prepareSend = internalQuery({
  args: audienceArgs,
  handler: async (ctx, args) => {
    const sender = await resolveSender(ctx);
    if (!sender) throw new Error("You don't have permission to email members.");
    if ((await sendsInLastDay(ctx, sender.clerkUserId)) >= MAX_SENDS_PER_DAY) {
      throw new Error(`You can send up to ${MAX_SENDS_PER_DAY} member emails a day. Try again tomorrow.`);
    }
    const { sendable } = await buildAudience(ctx, sender.scope, args);
    if (sendable.length === 0) throw new Error("No members in this selection have an email address we can use.");
    if (sendable.length > MAX_RECIPIENTS_PER_SEND) {
      throw new Error(`That's ${sendable.length} members — narrow it to ${MAX_RECIPIENTS_PER_SEND} or fewer with the filters.`);
    }
    return {
      memberProfileIds: sendable.map((m) => m._id),
      clerkUserId: sender.clerkUserId,
      replyTo: sender.replyTo,
      senderName: sender.senderName,
      agencyName: sender.agencyName,
    };
  },
});

/**
 * The email body: the broker's text, escaped, with a signature and the
 * reason-you-got-this / opt-out footer. {{memberId}} and {{firstName}} are
 * filled per member by memberEmail's merge step.
 */
export function brokerEmailHtml(message: string, senderName: string, agencyName: string, replyTo: string): string {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin: 0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  const name = escapeHtml(senderName);
  const agency = escapeHtml(agencyName);
  const optOut =
    "mailto:support@getidealoh.com?subject=" +
    encodeURIComponent("Stop broker emails") +
    "&body=" +
    encodeURIComponent("Please stop emails from my broker. Member ID: {{memberId}}");
  return `
    ${paragraphs}
    <p style="margin: 20px 0 0;">${name}${agency && agency !== name ? `<br /><span style="color: #64748b;">${agency}</span>` : ""}<br />
      <a href="mailto:${escapeHtml(replyTo)}" style="color: #0066CC;">${escapeHtml(replyTo)}</a></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px;" />
    <p style="font-size: 12px; color: #6b7280; margin: 0;">
      You're receiving this because ${name} is the broker on your Ideal Health membership.
      Replies go to ${name}. <a href="${optOut}" style="color: #6b7280;">Stop emails from my broker</a>.
    </p>
  `;
}

export const send = action({
  args: {
    subject: v.string(),
    message: v.string(),
    ...audienceArgs,
  },
  handler: async (ctx, args): Promise<{ campaignId: string; scheduled: number }> => {
    const subject = args.subject.trim();
    const message = args.message.trim();
    if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
      throw new Error(`Enter a subject of up to ${MAX_SUBJECT_LENGTH} characters.`);
    }
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Enter a message of up to ${MAX_MESSAGE_LENGTH} characters.`);
    }

    const prep: {
      memberProfileIds: Id<"memberProfiles">[];
      clerkUserId: string;
      replyTo: string;
      senderName: string;
      agencyName: string;
    } = await ctx.runQuery(internal.insights.brokerEmail.prepareSend, {
      memberType: args.memberType,
      groupId: args.groupId,
    });

    const html = brokerEmailHtml(message, prep.senderName, prep.agencyName, prep.replyTo);
    const sentByName = `${prep.senderName} (broker)`;

    const campaignId: Id<"emailCampaigns"> = await ctx.runMutation(internal.admin.memberEmail.createCampaign, {
      name: `Broker email — ${prep.senderName} — ${new Date().toLocaleDateString("en-US")}`,
      templateId: "broker-custom",
      templateLabel: "Broker message",
      subject,
      html,
      mode: "custom",
      recipientCount: prep.memberProfileIds.length,
      createdBy: prep.clerkUserId,
      createdByName: sentByName,
    });

    for (let i = 0; i < prep.memberProfileIds.length; i++) {
      await ctx.scheduler.runAfter(i * BULK_STAGGER_MS, internal.admin.memberEmail.deliverForCampaign, {
        memberProfileId: prep.memberProfileIds[i],
        payload: { mode: "custom", subject, html },
        campaignId,
        sentBy: prep.clerkUserId,
        sentByName,
        broker: { replyTo: prep.replyTo },
      });
    }

    return { campaignId: String(campaignId), scheduled: prep.memberProfileIds.length };
  },
});
