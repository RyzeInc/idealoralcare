/* eslint-disable @typescript-eslint/no-explicit-any */
import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Email Fulfillment Actions
 * Handles sending membership-related emails via Resend
 * Note: Requires RESEND_API_KEY set in environment
 */

export const sendMembershipWelcomeEmail = action({
  args: {
    memberName: v.string(),
    memberEmail: v.string(),
    planName: v.string(),
    effectiveDate: v.string(),
    memberId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Ideal Oral Health <noreply@getidealoh.com>",
          to: args.memberEmail,
          subject: "Welcome to Ideal Oral Health - Your Membership is Active",
          html: generateWelcomeEmailHTML(args),
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, emailId: data.id };
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      throw error;
    }
  },
});

export const sendMembershipConfirmationEmail = action({
  args: {
    memberName: v.string(),
    memberEmail: v.string(),
    memberId: v.string(),
    planName: v.string(),
    groupCode: v.string(),
    effectiveDate: v.string(),
    processingFee: v.optional(v.string()),
    billingAmount: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Ideal Oral Health <noreply@getidealoh.com>",
          to: args.memberEmail,
          subject: "Ideal Oral Health Membership Confirmation",
          html: generateConfirmationEmailHTML(args),
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, emailId: data.id };
    } catch (error) {
      console.error("Failed to send confirmation email:", error);
      throw error;
    }
  },
});

export const sendMembershipCancelledEmail = action({
  args: {
    memberName: v.string(),
    memberEmail: v.string(),
    memberId: v.string(),
    refundAmount: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Ideal Oral Health <noreply@getidealoh.com>",
          to: args.memberEmail,
          subject: "Ideal Oral Health Membership Cancelled",
          html: generateCancellationEmailHTML(args),
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, emailId: data.id };
    } catch (error) {
      console.error("Failed to send cancellation email:", error);
      throw error;
    }
  },
});

// ============================================
// EMAIL TEMPLATE GENERATORS
// ============================================

interface WelcomeEmailData {
  memberName: string;
  memberEmail: string;
  planName: string;
  effectiveDate: string;
  memberId: string;
}

interface ConfirmationEmailData extends WelcomeEmailData {
  groupCode: string;
  processingFee?: string;
  billingAmount?: string;
}

interface CancellationEmailData {
  memberName: string;
  memberEmail: string;
  memberId: string;
  refundAmount?: string;
}

function generateWelcomeEmailHTML(data: WelcomeEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Welcome to Ideal Oral Health</h1>
        <p style="margin: 10px 0 0 0; font-size: 14px;">Your membership is now active</p>
      </div>

      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <p>Hi ${data.memberName},</p>

        <p>Thank you for enrolling in <strong>${data.planName}</strong>! We're excited to have you as a member of the Ideal Oral Health family.</p>

        <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #667eea;">Your Membership Details</h3>
          <p style="margin: 5px 0;"><strong>Member ID:</strong> ${data.memberId}</p>
          <p style="margin: 5px 0;"><strong>Plan:</strong> ${data.planName}</p>
          <p style="margin: 5px 0;"><strong>Effective Date:</strong> ${data.effectiveDate}</p>
        </div>

        <h3 style="color: #667eea;">What You Get:</h3>
        <ul style="line-height: 1.8;">
          <li><strong>Careington Dental Network:</strong> Save 20-50% on dental procedures</li>
          <li><strong>DialCare Teledentistry:</strong> 24/7/365 virtual consultations</li>
          <li><strong>No Insurance Hassles:</strong> Simple discount pricing</li>
        </ul>

        <h3 style="color: #667eea;">Getting Started:</h3>
        <ol style="line-height: 1.8;">
          <li>Visit www.careington.com or call (800) 290-0523</li>
          <li>Find a dentist near you</li>
          <li>Present your ID card to receive discounts</li>
        </ol>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Need Help?</strong></p>
          <p style="margin: 5px 0;">
            Phone: <a href="tel:801-820-0010" style="color: #667eea; text-decoration: none;">801-820-0010</a> | 
            Email: <a href="mailto:info@getidealoh.com" style="color: #667eea; text-decoration: none;">info@getidealoh.com</a>
          </p>
        </div>

        <p>Best regards,<br><strong>The Ideal Oral Health Team</strong></p>
      </div>
    </div>
  `;
}

function generateConfirmationEmailHTML(data: ConfirmationEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Membership Confirmation</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <p>Thank you for your enrollment, ${data.memberName}!</p>

        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #2c3e50;">
          <h3 style="margin-top: 0; color: #2c3e50;">Enrollment Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold;">Member ID:</td>
              <td style="padding: 10px 0; text-align: right;">${data.memberId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold;">Plan:</td>
              <td style="padding: 10px 0; text-align: right;">${data.planName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold;">Plan Code:</td>
              <td style="padding: 10px 0; text-align: right;">${data.groupCode}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold;">Effective Date:</td>
              <td style="padding: 10px 0; text-align: right;">${data.effectiveDate}</td>
            </tr>
            ${data.billingAmount ? `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold;">Billing Amount:</td>
              <td style="padding: 10px 0; text-align: right;">${data.billingAmount}</td>
            </tr>
            ` : ""}
            ${data.processingFee ? `
            <tr>
              <td style="padding: 10px 0; font-weight: bold;">Processing Fee:</td>
              <td style="padding: 10px 0; text-align: right;">${data.processingFee}</td>
            </tr>
            ` : ""}
          </table>
        </div>

        <p>Your membership is effective immediately and you can start using your benefits right away!</p>

        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;"><strong>Cancellation Policy:</strong></p>
          <p style="margin: 10px 0 0 0; font-size: 13px;">
            30-day cancellation window available. Contact: <a href="tel:801-820-0010" style="color: #ffc107; text-decoration: none;">801-820-0010</a>
          </p>
        </div>

        <p>Questions? We're here to help!</p>
      </div>
    </div>
  `;
}

function generateCancellationEmailHTML(data: CancellationEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: #c0392b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Membership Cancelled</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <p>Hi ${data.memberName},</p>

        <p>Your Ideal Oral Health membership has been cancelled as requested.</p>

        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #c0392b;">
          <h3 style="margin-top: 0; color: #c0392b;">Cancellation Details</h3>
          <p style="margin: 5px 0;"><strong>Member ID:</strong> ${data.memberId}</p>
          <p style="margin: 5px 0;"><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
          ${data.refundAmount ? `<p style="margin: 5px 0;"><strong>Refund Amount:</strong> ${data.refundAmount}</p>` : ""}
        </div>

        <p>You will continue to have access to your benefits for the remainder of the period for which you've already paid.</p>

        <p style="font-size: 12px; color: #666;">
          Thank you for being part of our community. We hope to welcome you back in the future!
        </p>
      </div>
    </div>
  `;
}
