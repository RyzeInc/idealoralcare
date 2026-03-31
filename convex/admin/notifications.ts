import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";

/**
 * EMAIL NOTIFICATION SYSTEM
 *
 * Transactional emails via Resend API.
 * Simple HTML templates for onboarding, receipts, and admin reminders.
 *
 * Bulk email: batchSendWelcomeEmails dispatches individual sends via
 * ctx.scheduler to avoid action timeout and respect Resend rate limits.
 */

const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@idealoralcare.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Resend free tier: 100 emails/day, paid: 50K+/month
// We batch at 10/second via scheduler staggering to stay safe
const EMAIL_BATCH_SIZE = 50;
const EMAIL_STAGGER_MS = 5000; // 5 seconds between batches of 50

/**
 * Helper: send email via Resend
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, email not sent");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.id };
  } catch (error) {
    return { success: false, error: (error as any).message };
  }
}

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
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Welcome to Ideal Health Oral Care!</h2>
          <p>Hi ${args.firstName},</p>
          <p>Welcome! Your enrollment is complete. Here's your welcome details:</p>
          <ul>
            <li><strong>Plan:</strong> ${args.planName}</li>
            <li><strong>Member ID:</strong> ${args.memberId}</li>
          </ul>
          <p>You can now access your member portal and view your plan benefits.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;

    const result = await sendEmailViaResend(
      args.email,
      "Welcome to Ideal Health Oral Care",
      html
    );

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
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Payment Receipt</h2>
          <p>Hi ${args.firstName},</p>
          <p>Thank you for your payment. Here's your receipt:</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Plan</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${args.planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">$${(args.amount / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Transaction ID</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${args.transactionId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleDateString()}</td>
            </tr>
          </table>
          <p>If you have questions, contact support.</p>
          <p>Best regards,<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;

    const result = await sendEmailViaResend(args.email, "Payment Receipt", html);

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
 * Member ID card email (with PDF attachment)
 * Note: In production, would attach PDF generated by member ID card action
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
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Your Ideal Health Member ID Card</h2>
          <p>Hi ${args.firstName},</p>
          <p>Your member ID card is attached below. You can also download it from your member portal.</p>
          <p><strong>Member ID:</strong> ${args.memberId}</p>
          <p>Keep this card handy when visiting your dentist or accessing other plan benefits.</p>
          <p>Best regards,<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;

    const result = await sendEmailViaResend(args.email, "Your Member ID Card", html);

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

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Monthly Eligibility File Reminder</h2>
          <p>Hi ${args.adminName},</p>
          <p>This is a friendly reminder to submit your eligibility file for <strong>${args.groupName}</strong>.</p>
          <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
          <p>Please log into your admin portal to upload the latest member eligibility data.</p>
          <p><a href="https://idealoralcare.com/admin">Go to Admin Portal</a></p>
          <p>Thank you!<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;

    const result = await sendEmailViaResend(
      args.email,
      `Monthly Eligibility File Reminder: ${args.groupName}`,
      html
    );

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
 * Bulk email for testing
 */
export const sendTestEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Test Email</h2>
          <p>This is a test email from Ideal Health Oral Care.</p>
          <p>If you received this, the email system is working correctly!</p>
        </body>
      </html>
    `;

    return await sendEmailViaResend(args.email, "Test Email from Ideal Health", html);
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

    const planName = args.planName ?? "Ideal Oral Health Plan";
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

import { query } from "../_generated/server";

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
  handler: async (ctx, args) => {
    const memberPortalUrl = `https://getidealoh.com/member/${args.memberId}/card`;
    const cardDownloadUrl = `https://getidealoh.com/api/card/download/${args.memberId}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(90deg, #0066CC, #14b8a6); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border-top: 3px solid #0066CC; }
            .card-info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0066CC; }
            .card-field { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .card-field:last-child { border-bottom: none; }
            .card-label { font-weight: 600; color: #666; }
            .card-value { font-weight: 700; color: #0f172a; font-family: monospace; }
            .button-group { margin: 25px 0; text-align: center; }
            .button { display: inline-block; padding: 12px 24px; margin: 5px; border-radius: 6px; text-decoration: none; font-weight: 600; transition: all 0.3s; }
            .button-primary { background: #0066CC; color: white; }
            .button-primary:hover { background: #0052a3; }
            .button-secondary { background: #e5e7eb; color: #333; }
            .button-secondary:hover { background: #d1d5db; }
            .benefits { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .benefits h3 { margin-top: 0; color: #0066CC; }
            .benefits ul { margin: 10px 0; padding-left: 20px; }
            .benefits li { margin: 8px 0; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .support-info { background: #fff8e1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f9a825; }
            .support-info strong { color: #b8860b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Ideal Oral Health!</h1>
              <p style="margin: 10px 0 0 0;">Your membership is now active</p>
            </div>
            
            <div class="content">
              <p style="margin-top: 0;">Hi ${args.firstName},</p>
              <p>Congratulations! You've been successfully enrolled in the <strong>${args.planName}</strong>. Your benefits are now active and ready to use.</p>
              
              <div class="card-info">
                <h3 style="margin-top: 0; color: #0066CC;">Your Member ID Card</h3>
                <div class="card-field">
                  <span class="card-label">Member ID</span>
                  <span class="card-value">${args.memberId}</span>
                </div>
                <div class="card-field">
                  <span class="card-label">Plan Name</span>
                  <span class="card-value">${args.planName}</span>
                </div>
              </div>

              <div class="button-group">
                <a href="${memberPortalUrl}" class="button button-primary">View Your Card</a>
                <a href="${cardDownloadUrl}" class="button button-secondary">Download PDF</a>
              </div>

              <div class="benefits">
                <h3>What's Included:</h3>
                <ul>
                  <li><strong>Dental Discounts:</strong> Save 10-60% on dental services through the Careington network (140,000+ providers)</li>
                  <li><strong>Teledentistry:</strong> Access to virtual dental consultations via DialCare</li>
                  <li><strong>AI Oral Scanning:</strong> Use ToothlensAI for at-home oral health assessments</li>
                  <li><strong>No Insurance Required:</strong> Use your benefits immediately—no claims to file</li>
                </ul>
              </div>

              <div class="support-info">
                <strong>📱 How to Use:</strong> Present your member ID card (digital or printed) at any participating provider. Let them know you're a Careington member to receive your member discount.
              </div>

              <h3>Getting Started:</h3>
              <ol>
                <li><strong>Find a Provider:</strong> Visit <a href="https://www.careington.com/members" style="color: #0066CC;">careington.com</a> and enter your zip code to find dentists near you</li>
                <li><strong>Schedule Your Appointment:</strong> Call ahead and mention your Careington membership</li>
                <li><strong>Present Your Card:</strong> Show your member ID at the appointment</li>
                <li><strong>Save Money:</strong> Enjoy your member discounts on the spot</li>
              </ol>

              <p><strong>Questions?</strong> Our support team is here to help:</p>
              <p style="margin: 10px 0;">
                📧 Email: <a href="mailto:support@getidealoh.com" style="color: #0066CC;">support@getidealoh.com</a><br>
                📞 Phone: <a href="tel:+18003524325" style="color: #0066CC;">(800) IDEAL-CARE</a><br>
                🌐 Web: <a href="https://getidealoh.com" style="color: #0066CC;">getidealoh.com</a>
              </p>

              <p style="color: #666; font-style: italic; margin-bottom: 0;">Disclaimer: This plan is not insurance. It is a discount membership program that provides access to negotiated discounts through participating providers.</p>
            </div>

            <div class="footer">
              <p>© 2025 Ideal Oral Health. All rights reserved.</p>
              <p>You're receiving this email because you were enrolled in the Ideal Oral Health program.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await sendEmailViaResend(
      args.email,
      "Welcome to Ideal Oral Health - Your Member ID Card",
      html
    );
  },
});
