import { action, internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";
import { sendViaResend } from "../lib/resend";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { getBaseUrl } from "../lib/env";
import { PROVIDER_GROUP_CODE } from "../lib/constants";

/**
 * EMAIL NOTIFICATION SYSTEM
 *
 * Admin/internal emails. Everything goes through Resend — the same path as the
 * member-facing emails in legal/emailFulfillment.ts. All HTML lives in
 * lib/emailTemplates.ts so the debug tester stays in sync.
 *
 * Bulk email: batchSendWelcomeEmails dispatches individual sends via
 * ctx.scheduler to avoid action timeout and respect rate limits.
 */

const EMAIL_BATCH_SIZE = 50;
const EMAIL_STAGGER_MS = 5000; // 5 seconds between batches of 50

/**
 * Re-send a member their fulfillment packet.
 *
 * Support-facing counterpart to the automatic send in the Stripe webhook, for
 * members who lost the email or enrolled before the send was wired up. Picks
 * the packet that matches the product the member actually bought.
 */
export const resendMemberPacket = action({
  args: { memberId: v.id("memberProfiles") },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: boolean; program: "essentials" | "oral-care"; to: string }> => {
    // @ts-ignore - avoid deep type instantiation
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const detail: any = await ctx.runQuery(api.admin.members.getMemberDetail, {
      memberId: args.memberId,
    });
    const member = detail?.member;
    if (!member) throw new Error("Member not found");
    if (!member.email) throw new Error("Member has no email address on file");
    if (!member.customerId) {
      throw new Error(
        "Member has no linked account yet, so their plan cannot be resolved. Send the set-password invite first.",
      );
    }

    const cardData: any = await ctx.runQuery(
      api.subscriptions.queries.getMemberCardDataPublic,
      { customerId: member.customerId },
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

      await ctx.runAction((api as any)["legal/emailFulfillment"].sendEssentialsPacketEmail, {
        memberName: cardData.memberName,
        memberFirstName: member.firstName ?? "Member",
        memberEmail: member.email,
        essentialsMemberNumber: cardData.essentialsMemberNumber,
        essentialsGroupNumber: cardData.essentialsGroupNumber,
        planName: cardData.planName,
        coverageType,
        effectiveDate: cardData.effectiveDate,
      });
    } else {
      await ctx.runAction((api as any)["legal/emailFulfillment"].sendFulfillmentPacketEmail, {
        memberName: cardData.memberName,
        memberFirstName: member.firstName ?? "Member",
        memberEmail: member.email,
        memberId: cardData.memberId,
        subscriberId: cardData.subscriberId,
        groupCode: PROVIDER_GROUP_CODE,
        planName: cardData.planName,
        effectiveDate: cardData.effectiveDate,
        networks: cardData.networks,
      });
    }

    return {
      sent: true,
      program: isEssentials ? "essentials" : "oral-care",
      to: member.email,
    };
  },
});

/**
 * Welcome email after enrollment
 */
export const sendWelcomeEmail = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    planName: v.string(),
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const { subject, html } = EMAIL_TEMPLATES["admin-welcome"].render({
      firstName: args.firstName,
      planName: args.planName,
      memberId: args.memberId,
    });

    const result = await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "admin-welcome" }],
    });

    // Log event
    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "notification.welcome_email_sent",
      actor: "system",
      payload: {
        email: args.email,
        memberId: args.memberId,
        emailSuccess: result.success,
      },
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  },
});

/**
 * Payment receipt email
 */
export const sendPaymentReceiptEmail = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    amount: v.number(),
    planName: v.string(),
    transactionId: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const { subject, html } = EMAIL_TEMPLATES["payment-receipt"].render({
      firstName: args.firstName,
      amount: args.amount,
      planName: args.planName,
      transactionId: args.transactionId,
    });

    const result = await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "payment-receipt" }],
    });

    // Log event
    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "notification.receipt_email_sent",
      actor: "system",
      payload: {
        email: args.email,
        amount: args.amount,
        transactionId: args.transactionId,
        emailSuccess: result.success,
      },
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  },
});

/**
 * Member ID card email
 * Note: the card PDF is not attached yet — the email links to the portal.
 */
export const sendMemberIdCardEmail = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const { subject, html } = EMAIL_TEMPLATES["member-id-card"].render({
      firstName: args.firstName,
      memberId: args.memberId,
    });

    const result = await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "member-id-card" }],
    });

    // Log event
    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "notification.member_card_email_sent",
      actor: "system",
      payload: {
        email: args.email,
        memberId: args.memberId,
        emailSuccess: result.success,
      },
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  },
});

/**
 * Monthly eligibility reminder for group admins
 */
export const sendEligibilityReminderEmail = action({
  args: {
    email: v.string(),
    groupName: v.string(),
    adminName: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // 5 days from now (roughly 1st of next month)

    const { subject, html } = EMAIL_TEMPLATES["eligibility-reminder"].render({
      groupName: args.groupName,
      adminName: args.adminName,
      dueDate: dueDate.toLocaleDateString(),
    });

    const result = await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "eligibility-reminder" }],
    });

    // Log event
    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "notification.eligibility_reminder_sent",
      actor: "system",
      payload: {
        email: args.email,
        groupName: args.groupName,
        emailSuccess: result.success,
      },
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  },
});

/**
 * Connectivity check for the Resend send path
 */
export const sendTestEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const { subject, html } = EMAIL_TEMPLATES["connectivity-test"].render({});

    return await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "connectivity-test" }],
    });
  },
});

/**
 * Batch send welcome emails for bulk-onboarded members
 * Queries members from a specific eligibility file and schedules staggered sends.
 */
export const batchSendWelcomeEmails = action({
  args: {
    groupId: v.id("groups"),
    eligibilityFileId: v.optional(v.id("eligibilityFiles")),
    planName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ scheduled: number; batches: number; message: string }> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    // Get members to email via query
    const members: Array<{ email: string; firstName: string; memberId: string }> = await ctx.runQuery(
      api.admin.notifications._getMembersForBulkEmailQuery,
      {
        groupId: args.groupId,
        eligibilityFileId: args.eligibilityFileId,
      }
    );

    if (members.length === 0) {
      return { scheduled: 0, batches: 0, message: "No members with email addresses found" };
    }

    const planName = args.planName ?? "Ideal Oral Savings Plan";
    const totalBatches = Math.ceil(members.length / EMAIL_BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * EMAIL_BATCH_SIZE;
      const end = Math.min(start + EMAIL_BATCH_SIZE, members.length);
      const batch = members.slice(start, end);

      await ctx.scheduler.runAfter(
        batchIdx * EMAIL_STAGGER_MS,
        internal.admin.notifications.internalSendEmailBatch,
        {
          recipients: batch.map((m) => ({
            email: m.email,
            firstName: m.firstName,
            memberId: m.memberId,
          })),
          planName,
          templateType: "welcome" as const,
        }
      );
    }

    return {
      scheduled: members.length,
      batches: totalBatches,
      message: `Scheduled ${totalBatches} batch(es) for ${members.length} welcome emails`,
    };
  },
});

/**
 * Internal query for bulk email member list
 */
export const _getMembersForBulkEmailQuery = query({
  args: {
    groupId: v.id("groups"),
    eligibilityFileId: v.optional(v.id("eligibilityFiles")),
  },
  handler: async (ctx, args) => {
    let members;
    if (args.eligibilityFileId) {
      members = await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
        .filter((q) =>
          q.and(
            q.eq(q.field("eligibilityFileId"), args.eligibilityFileId),
            q.neq(q.field("email"), undefined)
          )
        )
        .collect();
    } else {
      members = await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
        .filter((q) => q.neq(q.field("email"), undefined))
        .collect();
    }

    return members
      .filter((m) => m.email)
      .map((m) => ({
        email: m.email!,
        firstName: m.firstName,
        memberId: m.memberId,
      }));
  },
});

/**
 * Internal mutation: send a batch of emails (called via scheduler)
 */
export const internalSendEmailBatch = internalMutation({
  args: {
    recipients: v.array(v.object({
      email: v.string(),
      firstName: v.string(),
      memberId: v.string(),
    })),
    planName: v.string(),
    templateType: v.union(v.literal("welcome"), v.literal("reminder")),
  },
  handler: async (ctx, args) => {
    // internalMutation can't make external HTTP calls, so schedule individual action sends
    // Each recipient gets a scheduled action call
    for (let i = 0; i < args.recipients.length; i++) {
      const r = args.recipients[i];
      await ctx.scheduler.runAfter(
        i * 100, // 100ms stagger within a batch = ~10 emails/sec
        api.admin.notifications.sendSingleWelcomeEmailInternal,
        {
          email: r.email,
          firstName: r.firstName,
          planName: args.planName,
          memberId: r.memberId,
        }
      );
    }
  },
});

/**
 * Send a single welcome email (no auth — called by scheduler from internal mutation)
 * Includes digital member card information and links to member portal
 */
export const sendSingleWelcomeEmailInternal = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    planName: v.string(),
    memberId: v.string(),
  },
  handler: async (_ctx, args) => {
    const { subject, html } = EMAIL_TEMPLATES["bulk-welcome-card"].render({
      firstName: args.firstName,
      planName: args.planName,
      memberId: args.memberId,
    });

    return await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "bulk-welcome-card" }],
    });
  },
});

/**
 * Send a re-enrollment link to a terminated list-bill (FT/payroll) employee.
 * Allows them to continue coverage via CC or ACH after leaving the group plan.
 */
export const sendReenrollmentLinkEmail = action({
  args: {
    email: v.string(),
    firstName: v.string(),
    memberId: v.string(),
    reenrollmentToken: v.string(),
    groupName: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const appUrl = getBaseUrl();
    const reenrollUrl = `${appUrl}/health/enroll?token=${args.reenrollmentToken}&source=listbill_term`;

    const { subject, html } = EMAIL_TEMPLATES["reenrollment-link"].render({
      firstName: args.firstName,
      memberId: args.memberId,
      groupName: args.groupName,
      reenrollUrl,
    });

    const result = await sendViaResend({
      to: args.email,
      subject,
      html,
      tags: [{ name: "category", value: "reenrollment-link" }],
    });

    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "notification.reenrollment_link_sent",
      actor: "system",
      payload: {
        email: args.email,
        memberId: args.memberId,
        reenrollmentToken: args.reenrollmentToken,
        emailSuccess: result.success,
      },
      success: result.success,
      errorMessage: result.error,
    });

    return result;
  },
});
