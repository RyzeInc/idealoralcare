import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";

/**
 * EMAIL NOTIFICATION SYSTEM
 *
 * Transactional emails via Resend API.
 * Simple HTML templates for onboarding, receipts, and admin reminders.
 */

const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@idealoralcare.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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
    // TODO: Implement Resend API call
    // const response = await fetch("https://api.resend.com/emails", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${RESEND_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     from: SENDER_EMAIL,
    //     to,
    //     subject,
    //     html,
    //   }),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Resend API error: ${response.status}`);
    // }
    //
    // const data = await response.json();
    // return { success: true, messageId: data.id };

    return { success: true, messageId: `mock_${Date.now()}` };
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
