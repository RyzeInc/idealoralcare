/**
 * EMAIL TEMPLATE REGISTRY — the single source of truth for every email we send.
 *
 * Production senders (Convex actions) and the debug tester both render from this
 * registry, so the tester cannot drift from what members actually receive and a
 * newly added template shows up in the tester automatically.
 *
 * Adding an email: add an entry here, then call it from a Convex action via
 * `renderEmail(id, data)` + `sendViaResend`. No tester changes are needed.
 */

import { getBaseUrl } from "./env";

export type EmailCategory = "member" | "employer" | "admin" | "diagnostic";

/**
 * "live"      — reachable from a production code path today.
 * "not-wired" — template exists and renders, but nothing in production sends it.
 */
export type EmailStatus = "live" | "not-wired";

export interface RenderedEmail {
  subject: string;
  html: string;
}

/** Values the tester substitutes so a test send is addressed to the tester. */
export interface SampleOverrides {
  firstName: string;
  lastName: string;
  email: string;
}

interface TemplateConfig<TData> {
  label: string;
  description: string;
  category: EmailCategory;
  status: EmailStatus;
  /** Where this email is sent from in production — shown in the debug tester. */
  trigger: string;
  /** Extra documents the sender attaches. The tester generates them too. */
  attachments?: "fulfillment-pdfs";
  render: (data: TData) => RenderedEmail;
  sample: (overrides: SampleOverrides) => TData;
}

interface RegisteredTemplate<TData> extends TemplateConfig<TData> {
  renderSample: (overrides: SampleOverrides) => RenderedEmail;
}

function defineTemplate<TData>(config: TemplateConfig<TData>): RegisteredTemplate<TData> {
  return {
    ...config,
    renderSample: (overrides) => config.render(config.sample(overrides)),
  };
}

const SUPPORT_EMAIL = "support@getidealoh.com";
const MEMBER_SERVICES_PHONE = "(844) 679-9367";

function sampleDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================================
// Member-facing templates
// ============================================================================

export interface FulfillmentEmailData {
  memberFirstName: string;
  memberId: string;
  planName: string;
  effectiveDate: string;
  groupCode: string;
  memberServicesPhone: string;
  portalUrl: string;
}

function fulfillmentHtml(data: FulfillmentEmailData): string {
  const BLUE = "#0066CC";
  const TEAL = "#14b8a6";
  const CYAN = "#0d9de0";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #333; background: #f9fafb;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1E88E5 0%, #35C48A 100%); color: white; padding: 28px 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Your Membership Packet &amp; Program Guide</h1>
        <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Ideal Oral Health — AI Dental Scan &middot; Teledentistry &middot; Dental Savings</p>
      </div>

      <div style="padding: 28px 24px;">
        <p style="font-size: 16px; margin-bottom: 8px;">Hi ${data.memberFirstName},</p>

        <p style="font-size: 14px; line-height: 1.7;">
          Your enrollment is confirmed and your membership is <strong>active as of ${data.effectiveDate}</strong>.
          Your complete member fulfillment packet and your membership agreement are both attached to this email as PDFs.
        </p>

        <!-- Membership Snapshot -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1E88E5; font-size: 14px;">Your Membership Snapshot</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 8px 0; color: #666;">Member ID</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.memberId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 8px 0; color: #666;">Plan</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.planName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 8px 0; color: #666;">Group Code</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.groupCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Effective Date</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.effectiveDate}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #1E88E5; font-size: 14px;">What's in your packet:</h3>
        <ul style="font-size: 13px; line-height: 2.0; color: #374151; padding-left: 20px;">
          <li>Welcome letter &amp; member summary card</li>
          <li>AI Oral Scan &mdash; how to access and use</li>
          <li>DialCare Teledentistry program details &amp; how to access</li>
          <li>Dental Discount Network program details &amp; how to access savings</li>
          <li>Member ID card (front &amp; back)</li>
        </ul>
        <p style="font-size: 13px; color: #374151; line-height: 1.7;">
          <strong>Your Membership Agreement</strong> is attached as a separate PDF for your records.
        </p>

        <!-- ─── How to Use Your Program ───────────────────────────────── -->
        <div style="border-top: 2px solid #e2e8f0; margin: 28px 0 20px; padding-top: 24px;">
          <h2 style="margin: 0 0 6px; font-size: 18px; color: #0f172a;">How to Use Your Program</h2>
          <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Your membership includes 3 core benefits — here's how to get started.</p>
        </div>

        <!-- Benefit 1: AI Dental Scan -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${BLUE};">AI Dental Scan</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Log in to your <a href="${data.portalUrl}/health/dashboard" style="color: ${BLUE}; text-decoration: none;">Member Portal</a> and open the <strong>Oral Scan</strong> tab.</li>
            <li>Upload or take a clear photo of your teeth.</li>
            <li>Review your results and any recommended next steps.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;">
            <strong>Best for:</strong> Spotting possible problem areas, monitoring visible changes, and knowing when to seek follow-up care.
          </p>
          <p style="font-size: 11px; color: #9ca3af; margin: 6px 0 0;">Note: The AI scan is a screening tool — not a clinical diagnosis. Always consult a licensed dentist.</p>
        </div>

        <!-- Benefit 2: Teledentistry -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${CYAN};">Teledentistry (DialCare)</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Open the <strong>Teledentistry</strong> tab in your portal, or visit <a href="https://www.dialcare.com" style="color: ${CYAN}; text-decoration: none;">dialcare.com</a>.</li>
            <li>Request or schedule a virtual consultation (available 24/7).</li>
            <li>Share your concern, scan results, or symptoms with the dentist.</li>
            <li>Receive professional guidance on what to do next.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;">
            <strong>Best for:</strong> Questions about dental concerns, guidance after an AI scan, and deciding if in-person care is needed.
          </p>
          <div style="background: #FFF8E1; border-left: 3px solid #F9A825; padding: 10px 12px; margin-top: 10px; border-radius: 4px;">
            <p style="font-size: 12px; color: #374151; margin: 0; line-height: 1.5;">
              <strong style="color: #F9A825;">Look for your DialCare email:</strong>
              Shortly after enrollment, you will receive a separate &ldquo;Register Your Account&rdquo; email directly from DialCare. Use it to set up your teledentistry account. If you don&rsquo;t see it, check your spam/junk folder or call DialCare at (855) 335-2255.
            </p>
          </div>
        </div>

        <!-- Benefit 3: Dental Discount Network -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${TEAL};">Dental Savings Network</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Search for a participating provider in your <a href="${data.portalUrl}/health/dashboard" style="color: ${TEAL}; text-decoration: none;">Member Portal</a> or contact <a href="mailto:${SUPPORT_EMAIL}" style="color: ${TEAL}; text-decoration: none;">${SUPPORT_EMAIL}</a>.</li>
            <li>Confirm the provider accepts the discount program <strong>before</strong> your visit.</li>
            <li>Present your Member ID card at your appointment.</li>
            <li>Pay the discounted member amount directly at time of service.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;">
            <strong>Best for:</strong> Routine dental care, savings on eligible services, and finding participating providers.
          </p>
        </div>

        <!-- Recommended order -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 14px; color: ${BLUE};">Recommended Order</h3>
          <p style="font-size: 13px; line-height: 1.7; color: #374151; margin: 0;">
            For the best results: <strong>Start with an AI Scan</strong> to understand any visible areas of concern,
            then <strong>use Teledentistry</strong> if you have questions, and
            <strong>use the Discount Network</strong> when you're ready for in-person care.
          </p>
        </div>

        <!-- FAQ -->
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 14px; font-size: 14px; color: #0f172a;">Frequently Asked Questions</h3>

          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">Do I need my member ID at my appointment?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">Yes. Present your member ID card (or the digital card from your dashboard) so the provider can apply your discounts.</p>

          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">When do my benefits begin?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">Benefits are activated within 24 hours of enrollment.</p>

          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">Is the AI scan a diagnosis?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">No. It is a screening tool. Always consult a licensed dentist for professional evaluation.</p>

          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">How do I know what services are eligible for savings?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 0; line-height: 1.5;">You can ask any participating provider for a discounted treatment plan before your visit.</p>
        </div>

        <!-- CTA + QR Code -->
        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${data.portalUrl}/health/dashboard" style="display: inline-block; padding: 14px 36px; background: ${BLUE}; color: white; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px;">
            Go to Your Member Portal
          </a>
          <div style="margin-top: 16px;">
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">Or scan this QR code to open your dashboard:</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("https://www.getidealoh.com/health/dashboard")}" alt="QR Code to Member Dashboard" width="150" height="150" style="border: 1px solid #e5e7eb; border-radius: 8px;" />
          </div>
        </div>

        <!-- Support -->
        <div style="background: #EAF4FD; border-radius: 6px; padding: 14px; margin-bottom: 12px; font-size: 13px;">
          Contact Member Services at <a href="mailto:${SUPPORT_EMAIL}" style="color: #1E88E5; text-decoration: none;">${SUPPORT_EMAIL}</a>.
        </div>

        <!-- Disclaimer -->
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0;">
          This plan is not insurance. Members are responsible for payment at the time of service
          and receive access to negotiated discounts through participating providers.
          The range of discounts varies by provider and service.
        </p>
      </div>
    </div>
  `;
}

export interface WelcomeEmailData {
  memberName: string;
  planName: string;
  effectiveDate: string;
  memberId: string;
  portalUrl: string;
}

function welcomeHtml(data: WelcomeEmailData): string {
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
          <li><strong>AI Oral Scan:</strong> Monitor your dental health from home</li>
          <li><strong>DialCare Teledentistry:</strong> 24/7/365 virtual consultations</li>
          <li><strong>Dental Discount Network:</strong> Save 20-50% on dental procedures</li>
          <li><strong>No Insurance Hassles:</strong> Simple discount pricing</li>
        </ul>

        <h3 style="color: #667eea;">Getting Started:</h3>
        <ol style="line-height: 1.8;">
          <li>Log in to your <a href="https://www.getidealoh.com/health/dashboard" style="color: #667eea; text-decoration: none;">Member Portal</a> for your AI Oral Scan and digital ID card</li>
          <li>Find a provider in your <a href="${data.portalUrl}/health/dashboard" style="color: #667eea; text-decoration: none;">Member Portal</a> or contact <a href="mailto:${SUPPORT_EMAIL}" style="color: #667eea; text-decoration: none;">${SUPPORT_EMAIL}</a> for assistance</li>
          <li>Present your ID card to receive discounts</li>
        </ol>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;">Contact Member Services at <a href="mailto:${SUPPORT_EMAIL}" style="color: #667eea; text-decoration: none;">${SUPPORT_EMAIL}</a></p>
        </div>

        <p>Best regards,<br><strong>The Ideal Oral Health Team</strong></p>
      </div>
    </div>
  `;
}

export interface ConfirmationEmailData {
  memberName: string;
  memberId: string;
  planName: string;
  groupCode: string;
  effectiveDate: string;
  processingFee?: string;
  billingAmount?: string;
}

function confirmationHtml(data: ConfirmationEmailData): string {
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
            30-day cancellation window available. Contact: <a href="mailto:${SUPPORT_EMAIL}" style="color: #ffc107; text-decoration: none;">${SUPPORT_EMAIL}</a>
          </p>
        </div>

        <p>Questions? We're here to help!</p>
      </div>
    </div>
  `;
}

export interface CancellationEmailData {
  memberName: string;
  memberId: string;
}

function cancellationHtml(data: CancellationEmailData): string {
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
        </div>

        <p>You will continue to have access to your benefits for the remainder of the period for which you've already paid.</p>

        <p style="font-size: 12px; color: #666;">
          Thank you for being part of our community. We hope to welcome you back in the future!
        </p>
      </div>
    </div>
  `;
}

export interface DependentInviteEmailData {
  dependentFirstName: string;
  primaryMemberName: string;
  planName: string;
  claimUrl: string;
}

function dependentInviteHtml(data: DependentInviteEmailData): string {
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">You&apos;re Invited!</h1>
          <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">Family plan access from Ideal Oral Health</p>
        </div>
        <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi ${data.dependentFirstName},</p>
          <p style="font-size: 15px; line-height: 1.6;">
            <strong>${data.primaryMemberName}</strong> has added you to their
            <strong>${data.planName}</strong> plan. As a family member on this plan, you&apos;ll get
            full access to all plan benefits &mdash; with no separate billing.
          </p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
              Click the button below to create your account and activate your access.
            </p>
            <a href="${data.claimUrl}"
              style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
              Accept &amp; Get Access
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
            If you don&apos;t want to be added to this plan, you can simply ignore this email.
            Questions? Contact us at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC;">${SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>`;
}

export interface EligibilitySetPasswordEmailData {
  memberName: string;
  invitationUrl: string;
  sponsorName?: string;
  portalUrl: string;
}

function eligibilitySetPasswordHtml(data: EligibilitySetPasswordEmailData): string {
  const sponsorLine = data.sponsorName
    ? `Your access has been activated through <strong>${data.sponsorName}</strong>.`
    : `Your access has been activated through your sponsoring organization.`;
  const portalDisplay = data.portalUrl.replace(/^https?:\/\//, "");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Welcome to Ideal Oral Health</h1>
        <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">Set your password to activate your account</p>
      </div>

      <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${data.memberName},</p>

        <p style="font-size: 14px; line-height: 1.7;">
          ${sponsorLine} To finish setting up your member account, please choose a
          password using the secure link below.
        </p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 22px; margin: 24px 0; text-align: center;">
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">
            Click below to set your password and sign in.
          </p>
          <a href="${data.invitationUrl}"
            style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
            Set My Password
          </a>
          <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">
            For your security, this invitation link is single-use and expires in 30 days.
          </p>
        </div>

        <h3 style="color: #0066CC; font-size: 15px;">What you get with your membership:</h3>
        <ul style="line-height: 1.8; font-size: 14px; color: #4b5563;">
          <li><strong>AI Oral Scan:</strong> Monitor your dental health from home (screening, not a clinical diagnosis).</li>
          <li><strong>DialCare Teledentistry:</strong> 24/7/365 virtual consultations with licensed dentists.</li>
          <li><strong>Dental Discount Network:</strong> Save 20&ndash;50% on dental procedures at thousands of participating providers nationwide.</li>
          <li><strong>No claim forms or waiting periods</strong> &mdash; you receive negotiated discounts at the time of service.</li>
        </ul>

        <div style="background: #FFF8E1; padding: 12px 15px; border-left: 4px solid #F9A825; border-radius: 5px; margin: 18px 0;">
          <p style="margin: 0; font-size: 13px; line-height: 1.5;">
            <strong style="color: #F9A825;">Look for your DialCare email:</strong>
            Shortly after activation you will receive a separate &ldquo;Register Your Account&rdquo;
            email directly from DialCare. Use it to set up your teledentistry account. If you
            don&rsquo;t see it, check your spam/junk folder or call DialCare at (855) 335-2255.
          </p>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 18px 0;">
          <p style="margin: 0; font-size: 13px;">
            Questions? Contact Member Services at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC; text-decoration: none;">${SUPPORT_EMAIL}</a>
            or visit
            <a href="${data.portalUrl}" style="color: #0066CC; text-decoration: none;">${portalDisplay}</a>.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="font-size: 11px; color: #6b7280; line-height: 1.6; margin: 0 0 8px;">
          <strong>Important:</strong> This plan is NOT insurance, is not intended to replace
          insurance, and is not a qualified health plan under the Affordable Care Act. The plan
          provides discounts on certain dental services from participating providers. The plan
          does not make payments directly to providers; you are obligated to pay for all services
          at the time of service but will receive a discount from participating providers.
          Discounts range based on provider and service. The discount program is administered by
          Careington International Corporation, 7400 Safari Blvd., Frisco, TX 75033, ${SUPPORT_EMAIL}.
          Teledentistry services are provided by DialCare. Not available in all states. Member may
          cancel within the first 30 days for a full refund of fees paid.
        </p>

        <p style="font-size: 11px; color: #9ca3af; margin: 8px 0 0;">
          You received this email because your sponsoring organization added you to the Ideal
          Oral Health program. If this looks unfamiliar, you can safely ignore this email or
          contact <a href="mailto:${SUPPORT_EMAIL}" style="color: #9ca3af;">${SUPPORT_EMAIL}</a>.
        </p>

        <p style="font-size: 11px; color: #9ca3af; margin: 12px 0 0; word-break: break-all;">
          If the button above does not work, copy and paste this link into your browser:<br />
          <a href="${data.invitationUrl}" style="color: #9ca3af;">${data.invitationUrl}</a>
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// Employer template
// ============================================================================

export interface EmployerAgreementEmailData {
  memberName: string;
  memberAddress?: string;
  memberId: string;
  groupName: string;
  groupCode: string;
  term?: string;
  effectiveDate: string;
  employerPhone?: string;
  classification?: string;
  modeOfPayment?: string;
  periodicCharge?: string;
  processingFee?: string;
}

function employerAgreementHtml(data: EmployerAgreementEmailData): string {
  return `
      <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Your Membership Agreement</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">Employer-Paid Ideal Oral Health Membership</p>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi ${data.memberName},</p>

          <p style="font-size: 14px; line-height: 1.7;">
            Thank you for joining the <strong>Ideal Oral Health</strong> program through your employer.
            Below is your Membership Agreement for your records. Your access has been activated and
            you can begin using your AI Oral Scan, DialCare teledentistry, and Dental Discount Network
            benefits immediately.
          </p>

          <!-- Membership Agreement Document Card -->
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; margin: 24px 0;">

            <div style="border-bottom: 2px solid #0066CC; padding-bottom: 12px; margin-bottom: 16px;">
              <h2 style="margin: 0; font-size: 18px; color: #0066CC; letter-spacing: 0.5px;">MEMBERSHIP AGREEMENT</h2>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">Discount Plan Organization: Careington International Corporation &middot; 7400 Gaylord Parkway, Frisco, TX 75034</p>
            </div>

            <!-- Member Information -->
            <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #0066CC; text-transform: uppercase; letter-spacing: 0.5px;">Member Information</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; width: 40%; color: #475569;">Member ID</td>
                <td style="padding: 6px 0;">${data.memberId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Member Name</td>
                <td style="padding: 6px 0;">${data.memberName}</td>
              </tr>
              ${data.memberAddress ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px 0; font-weight: bold; color: #475569;">Address</td><td style="padding: 6px 0;">${data.memberAddress.replace(/\n/g, '<br/>')}</td></tr>` : ''}
            </table>

            <!-- Plan Details -->
            <h3 style="margin: 16px 0 8px 0; font-size: 13px; color: #0066CC; text-transform: uppercase; letter-spacing: 0.5px;">Plan Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; width: 40%; color: #475569;">Group Name</td>
                <td style="padding: 6px 0;">${data.groupName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Group Code</td>
                <td style="padding: 6px 0;">${data.groupCode}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Coverage Term</td>
                <td style="padding: 6px 0;">${data.term ?? 'ANNUAL'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Effective Date</td>
                <td style="padding: 6px 0;">${data.effectiveDate}</td>
              </tr>
            </table>

            <!-- Billing Information -->
            <h3 style="margin: 16px 0 8px 0; font-size: 13px; color: #0066CC; text-transform: uppercase; letter-spacing: 0.5px;">Billing Information</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; width: 40%; color: #475569;">Classification</td>
                <td style="padding: 6px 0;">${data.classification ?? 'Employee'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Mode of Payment</td>
                <td style="padding: 6px 0;">${data.modeOfPayment ?? 'Employer-Paid'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Periodic Charge</td>
                <td style="padding: 6px 0;">${data.periodicCharge ?? '$0.00 (paid by employer)'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #475569;">Processing Fee</td>
                <td style="padding: 6px 0;">${data.processingFee ?? '$0.00'}</td>
              </tr>
            </table>
          </div>

          <!-- Contact callout -->
          <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 18px 0;">
            <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 1.6;">
              <strong>To add a family member to your plan</strong>, contact your employer${data.employerPhone ? ` at <strong>${data.employerPhone}</strong>` : ''}.
            </p>
            <p style="margin: 0; font-size: 13px; line-height: 1.6;">
              <strong>For assistance using your plan</strong>, contact Member Services at
              <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC; text-decoration: none;">${SUPPORT_EMAIL}</a>
              or call DialCare at <strong>1-855-335-2255</strong>.
            </p>
          </div>

          <!-- Terms & Conditions -->
          <h3 style="color: #0066CC; font-size: 15px; margin-top: 24px;">Terms and Conditions</h3>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Terms and Conditions:</strong>
            The Terms and Conditions you have accepted or will accept upon registering at
            <a href="https://www.dialcare.com" style="color: #0066CC; text-decoration: none;">www.dialcare.com</a>
            are part of this membership agreement (Agreement) between you and DialCare, LLC
            (&ldquo;DialCare&rdquo;). DialCare provides administrative services to DialCare clinicians
            and does not provide professional medical services. The Terms and Conditions define the
            obligations of DialCare, its authorized agents and yourself, and they establish the basic
            rules of safe and fair use of DialCare&rsquo;s public website, member website, and services
            (Services). DialCare and its authorized agents reserve the right to immediately and without
            advance notice terminate the Services and deny access to individuals who do not abide by
            the Terms and Conditions.
          </p>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Membership and Renewal Conditions:</strong>
            By joining a plan, for yourself or on behalf of a minor child for whom you are a parent or
            legal guardian, you confirm that you are at least 18 years old and have read and agree to
            the terms and conditions of the plan.
          </p>

          <p style="font-size: 13px; line-height: 1.7; color: #374151; font-style: italic;">
            This plan will automatically renew at the end of your membership term.
          </p>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Termination Conditions:</strong>
            Your employer and DialCare reserve the right to terminate plan members from its plan for
            any reason.
          </p>

          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 16px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #92400e;">Cancellation Conditions</p>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #374151;">
              You have the right to cancel within the first 30 days after effective date or receipt of
              membership materials (whichever is later) and receive a full refund, less the processing
              fee and/or any employer contributions, if applicable. To cancel, submit a request with
              your name and member ID to your employer, or email
              <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC; text-decoration: none;">${SUPPORT_EMAIL}</a>.
              Your employer will stop collecting membership fees in a reasonable amount of time, but
              no later than 30 days after receiving a cancellation request. When you cancel, you will
              continue to have access to the plan for the remainder of the period for which you have
              paid; your membership will terminate at the end of that period. The preceding sentence
              does not apply to quarterly, semi-annual or annual memberships in FL and OK, where you
              will receive a pro-rata refund whenever you cancel.
            </p>
          </div>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Description of Services:</strong>
            Please see the enclosed materials for a specific description of the programs included in
            your plan.
          </p>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Limitations, Exclusions &amp; Exceptions:</strong>
            This is a discount plan offered by Careington International Corporation (Careington).
            Careington is not a licensed insurer, health maintenance organization or other underwriter
            of health care services. This plan is not insurance. No portion of any provider&rsquo;s fees
            will be reimbursed or otherwise paid by Careington. Careington is not licensed to provide
            and does not provide health care services or items to individuals. You will receive
            discounts for services at certain health care providers who have contracted with the plan.
            You are obligated to pay for all health care services at the time of service. Savings are
            based upon the provider&rsquo;s normal fees. Actual savings will vary depending upon
            location and specific services or products purchased. Please verify such services with
            each individual provider. The plan&rsquo;s discounts may not be used in conjunction with
            any other discount plan or program. All listed or quoted prices are current prices by
            participating providers and subject to change without notice. Any procedures performed by
            a non-participating provider are not discounted. From time to time, certain providers may
            offer products or services to the general public at prices lower than the discounted
            prices available through this plan. In such event, members will be charged the lowest
            price. Discounts on professional services are not available when prohibited by law. This
            plan does not discount all procedures. Providers are subject to change without notice and
            services may vary in some states. It is your responsibility to verify that the provider
            participates in the plan. At any time Careington may substitute a provider network at its
            sole discretion. Careington cannot guarantee the continued participation of any provider.
            If the provider leaves the plan, you will need to select another provider. Providers
            contracted by Careington are solely responsible for the professional advice and treatment
            rendered to members and Careington disclaims any liability with respect to such matters.
          </p>

          <p style="font-size: 13px; line-height: 1.7; color: #374151;">
            <strong>Complaint Procedure:</strong>
            If you would like to file a complaint regarding your plan membership, you must submit your
            complaint in writing to: DialCare, P.O. Box 2568, Frisco, TX 75034. You have the right to
            request an appeal if you are dissatisfied with the complaint resolution. After completing
            the complaint resolution process, if you remain dissatisfied you may contact your state
            insurance department. Contact information for your state insurance department is available
            upon request.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

          <p style="font-size: 13px; line-height: 1.7;">
            Best regards,<br/>
            <strong>The Ideal Oral Health Team</strong>
          </p>

          <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
            <strong>Contact Information</strong><br/>
            Email: <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC; text-decoration: none;">${SUPPORT_EMAIL}</a><br/>
            DialCare Member Services: 1-855-335-2255<br/>
            Website: <a href="https://www.getidealoh.com" style="color: #0066CC; text-decoration: none;">www.getidealoh.com</a>
          </p>

          <p style="font-size: 11px; color: #9ca3af; margin-top: 16px; line-height: 1.5;">
            <strong>Important:</strong> This plan is NOT insurance, is not intended to replace insurance,
            and is not a qualified health plan under the Affordable Care Act. The plan provides
            discounts on certain dental services from participating providers. The plan does not make
            payments directly to providers; you are obligated to pay for all services at the time of
            service but will receive a discount from participating providers. The discount program is
            administered by Careington International Corporation, 7400 Gaylord Parkway, Frisco, TX
            75034. Teledentistry services are provided by DialCare. Not available in all states.
          </p>

          <p style="font-size: 10px; color: #9ca3af; text-align: center; margin-top: 16px;">
            DialCare DPO Employer Funded Membership Agreement &middot; Ideal Oral Health &middot; Powered by Careington International Corporation
          </p>
        </div>
      </div>
    `;
}

// ============================================================================
// Admin / operational templates
// ============================================================================

export interface AdminWelcomeEmailData {
  firstName: string;
  planName: string;
  memberId: string;
}

function adminWelcomeHtml(data: AdminWelcomeEmailData): string {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Welcome to Ideal Health Oral Care!</h2>
          <p>Hi ${data.firstName},</p>
          <p>Welcome! Your enrollment is complete. Here's your welcome details:</p>
          <ul>
            <li><strong>Plan:</strong> ${data.planName}</li>
            <li><strong>Member ID:</strong> ${data.memberId}</li>
          </ul>
          <p>You can now access your member portal and view your plan benefits.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;
}

export interface PaymentReceiptEmailData {
  firstName: string;
  /** Amount in cents. */
  amount: number;
  planName: string;
  transactionId: string;
}

function paymentReceiptHtml(data: PaymentReceiptEmailData): string {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Payment Receipt</h2>
          <p>Hi ${data.firstName},</p>
          <p>Thank you for your payment. Here's your receipt:</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Plan</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${data.planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">$${(data.amount / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Transaction ID</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${data.transactionId}</td>
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
}

export interface MemberIdCardEmailData {
  firstName: string;
  memberId: string;
}

function memberIdCardHtml(data: MemberIdCardEmailData): string {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Your Ideal Health Member ID Card</h2>
          <p>Hi ${data.firstName},</p>
          <p>Your member ID card is attached below. You can also download it from your member portal.</p>
          <p><strong>Member ID:</strong> ${data.memberId}</p>
          <p>Keep this card handy when visiting your dentist or accessing other plan benefits.</p>
          <p>Best regards,<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;
}

export interface EligibilityReminderEmailData {
  groupName: string;
  adminName: string;
  dueDate: string;
}

function eligibilityReminderHtml(data: EligibilityReminderEmailData): string {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Monthly Eligibility File Reminder</h2>
          <p>Hi ${data.adminName},</p>
          <p>This is a friendly reminder to submit your eligibility file for <strong>${data.groupName}</strong>.</p>
          <p><strong>Due Date:</strong> ${data.dueDate}</p>
          <p>Please log into your admin portal to upload the latest member eligibility data.</p>
          <p><a href="https://getidealoh.com/admin">Go to Admin Portal</a></p>
          <p>Thank you!<br/>The Ideal Health Team</p>
        </body>
      </html>
    `;
}

export interface BulkWelcomeCardEmailData {
  firstName: string;
  planName: string;
  memberId: string;
}

function bulkWelcomeCardHtml(data: BulkWelcomeCardEmailData): string {
  const memberPortalUrl = `https://getidealoh.com/member/${data.memberId}/card`;
  const cardDownloadUrl = `https://getidealoh.com/api/card/download/${data.memberId}`;

  return `
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
              <p style="margin-top: 0;">Hi ${data.firstName},</p>
              <p>Congratulations! You've been successfully enrolled in the <strong>${data.planName}</strong>. Your benefits are now active and ready to use.</p>

              <div class="card-info">
                <h3 style="margin-top: 0; color: #0066CC;">Your Member ID Card</h3>
                <div class="card-field">
                  <span class="card-label">Member ID</span>
                  <span class="card-value">${data.memberId}</span>
                </div>
                <div class="card-field">
                  <span class="card-label">Plan Name</span>
                  <span class="card-value">${data.planName}</span>
                </div>
              </div>

              <div class="button-group">
                <a href="${memberPortalUrl}" class="button button-primary">View Your Card</a>
                <a href="${cardDownloadUrl}" class="button button-secondary">Download PDF</a>
              </div>

              <div class="benefits">
                <h3>What's Included:</h3>
                <ul>
                  <li><strong>Dental Discounts:</strong> Save 10-60% on dental services through our Dental Discount Network (140,000+ providers)</li>
                  <li><strong>Teledentistry:</strong> Access to virtual dental consultations via DialCare</li>
                  <li><strong>AI Oral Scan:</strong> At-home oral health assessments from your Member Portal</li>
                  <li><strong>No Insurance Required:</strong> Use your benefits immediately—no claims to file</li>
                </ul>
              </div>

              <div class="support-info">
                <strong>📱 How to Use:</strong> Present your member ID card (digital or printed) at any participating provider. Let them know you're a Careington member to receive your member discount.
              </div>

              <h3>Getting Started:</h3>
              <ol>
                <li><strong>Find a Provider:</strong> Search in your <a href="https://www.getidealoh.com/health/dashboard" style="color: #0066CC;">Member Portal</a> or email ${SUPPORT_EMAIL} to search for participating providers near you</li>
                <li><strong>Schedule Your Appointment:</strong> Call ahead and mention your Careington membership</li>
                <li><strong>Present Your Card:</strong> Show your member ID at the appointment</li>
                <li><strong>Save Money:</strong> Enjoy your member discounts on the spot</li>
              </ol>

              <p><strong>Questions?</strong> Our support team is here to help:</p>
              <p style="margin: 10px 0;">
                📧 Email: <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC;">${SUPPORT_EMAIL}</a><br>
                📞 Phone: <a href="tel:+18003524325" style="color: #0066CC;">(800) IDEAL-CARE</a><br>
                🌐 Web: <a href="https://getidealoh.com" style="color: #0066CC;">getidealoh.com</a>
              </p>

              <p style="color: #666; font-style: italic; margin-bottom: 0;">Disclaimer: This plan is not insurance. It is a discount membership program that provides access to negotiated discounts through participating providers.</p>
            </div>

            <div class="footer">
              <p>© ${new Date().getFullYear()} Ideal Oral Health. All rights reserved.</p>
              <p>You're receiving this email because you were enrolled in the Ideal Oral Health program.</p>
            </div>
          </div>
        </body>
      </html>
    `;
}

export interface ReenrollmentLinkEmailData {
  firstName: string;
  memberId: string;
  groupName: string;
  reenrollUrl: string;
}

function reenrollmentLinkHtml(data: ReenrollmentLinkEmailData): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(90deg, #0066CC, #14b8a6); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border-top: 3px solid #0066CC; }
            .highlight { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0066CC; }
            .button { display: inline-block; padding: 14px 28px; background: #0066CC; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Keep Your Oral Care Coverage</h1>
              <p style="margin: 10px 0 0 0;">Continue your benefits as an individual member</p>
            </div>
            <div class="content">
              <p>Hi ${data.firstName},</p>
              <p>Your payroll-deducted dental benefit through <strong>${data.groupName}</strong> has ended.
                 The good news: you can continue your <strong>Ideal Oral Health</strong> coverage on your own
                 — billed directly to your credit card or bank account.</p>

              <div class="highlight">
                <p style="margin:0;"><strong>Your Member ID:</strong> ${data.memberId}</p>
                <p style="margin:8px 0 0 0;">Your existing member history and discounts carry over when you re-enroll.</p>
              </div>

              <p style="text-align:center;">
                <a href="${data.reenrollUrl}" class="button">Re-Enroll Now (CC or ACH)</a>
              </p>

              <p>This link is unique to your account and expires in <strong>30 days</strong>.
                 Once enrolled, your benefits are active immediately — no waiting period.</p>

              <p>Questions? We're here to help:</p>
              <p>📧 <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br>
                 📞 <a href="tel:+18003524325">(800) IDEAL-CARE</a></p>

              <p style="color:#666; font-style:italic;">
                This plan is not insurance. It is a discount membership program providing access to negotiated discounts.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Ideal Oral Health. All rights reserved.</p>
              <p>You received this because you were previously enrolled through your employer's group plan.</p>
            </div>
          </div>
        </body>
      </html>
    `;
}

export interface PartnerInviteEmailData {
  recipientName: string;
  partnerName: string;
  typeLabel: string;
  claimUrl: string;
}

function partnerInviteHtml(data: PartnerInviteEmailData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Your Ideal Oral Health Access</h1>
        <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">${data.typeLabel} — ${data.partnerName}</p>
      </div>
      <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${data.recipientName},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          You've been invited to access the <strong>Ideal Oral Health</strong> member platform as part of your partnership with us.
          This gives you full access to explore the benefits your clients and prospects will receive.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
            Click below to create your account and activate your complimentary membership.
          </p>
          <a href="${data.claimUrl}"
            style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
            Accept Invite &amp; Get Access
          </a>
          <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
          Questions? Contact us at
          <a href="mailto:${SUPPORT_EMAIL}" style="color: #0066CC;">${SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>`;
}

function connectivityTestHtml(): string {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Test Email</h2>
          <p>This is a test email from Ideal Health Oral Care.</p>
          <p>If you received this, the email system is working correctly!</p>
        </body>
      </html>
    `;
}

// ============================================================================
// Registry
// ============================================================================

export const EMAIL_TEMPLATES = {
  "fulfillment-packet": defineTemplate<FulfillmentEmailData>({
    label: "Fulfillment Packet (PDF + Program Guide)",
    description: "Full welcome packet with the membership packet and agreement PDFs attached.",
    category: "member",
    status: "not-wired",
    trigger: "convex/legal/emailFulfillment.ts → sendFulfillmentPacketEmail (no production caller)",
    attachments: "fulfillment-pdfs",
    render: (data) => ({
      subject: "Your Ideal Oral Health Membership Packet & Program Guide",
      html: fulfillmentHtml(data),
    }),
    sample: (o) => ({
      memberFirstName: o.firstName,
      memberId: "IOH-TEST-001",
      planName: "Ideal Oral Savings Plan",
      effectiveDate: sampleDate(),
      groupCode: "IOH-DTC",
      memberServicesPhone: MEMBER_SERVICES_PHONE,
      portalUrl: getBaseUrl(),
    }),
  }),

  welcome: defineTemplate<WelcomeEmailData>({
    label: "Welcome — Membership Active",
    description: "Sent once a membership goes active. Overlaps with the two other welcome emails.",
    category: "member",
    status: "not-wired",
    trigger: "convex/legal/emailFulfillment.ts → sendMembershipWelcomeEmail (no production caller)",
    render: (data) => ({
      subject: "Welcome to Ideal Oral Health - Your Membership is Active",
      html: welcomeHtml(data),
    }),
    sample: (o) => ({
      memberName: `${o.firstName} ${o.lastName}`,
      planName: "Ideal Oral Savings Plan",
      effectiveDate: sampleDate(),
      memberId: "IOH-TEST-001",
      portalUrl: getBaseUrl(),
    }),
  }),

  confirmation: defineTemplate<ConfirmationEmailData>({
    label: "Confirmation — Enrollment Summary",
    description: "Itemised enrollment summary with billing amounts.",
    category: "member",
    status: "not-wired",
    trigger: "convex/legal/emailFulfillment.ts → sendMembershipConfirmationEmail (no production caller)",
    render: (data) => ({
      subject: "Ideal Oral Health Membership Confirmation",
      html: confirmationHtml(data),
    }),
    sample: (o) => ({
      memberName: `${o.firstName} ${o.lastName}`,
      memberId: "IOH-TEST-001",
      planName: "Ideal Oral Savings Plan",
      groupCode: "IOH-DTC",
      effectiveDate: sampleDate(),
      billingAmount: "$19.95/mo",
    }),
  }),

  cancelled: defineTemplate<CancellationEmailData>({
    label: "Membership Cancelled",
    description: "Confirms a cancellation and explains remaining paid access.",
    category: "member",
    status: "live",
    trigger: "Stripe cancellation webhook and admin-initiated cancellation",
    render: (data) => ({
      subject: "Ideal Oral Health Membership Cancelled",
      html: cancellationHtml(data),
    }),
    sample: (o) => ({
      memberName: `${o.firstName} ${o.lastName}`,
      memberId: "IOH-TEST-001",
    }),
  }),

  "eligibility-set-password": defineTemplate<EligibilitySetPasswordEmailData>({
    label: "Eligibility Welcome — Set Your Password",
    description: "Clerk invitation link for members provisioned through an eligibility file.",
    category: "member",
    status: "live",
    trigger: "Eligibility provisioning, admin resend invite, and bulk resend",
    render: (data) => ({
      subject: "Set your password and activate your Ideal Oral Health membership",
      html: eligibilitySetPasswordHtml(data),
    }),
    sample: (o) => ({
      memberName: `${o.firstName} ${o.lastName}`,
      invitationUrl: `${getBaseUrl()}/sign-up?ticket=TEST_INVITE_URL`,
      sponsorName: "Acme Corp (Test Sponsor)",
      portalUrl: getBaseUrl(),
    }),
  }),

  "dependent-invite": defineTemplate<DependentInviteEmailData>({
    label: "Dependent Invite",
    description: "Invites a family member to claim access under the primary member's plan.",
    category: "member",
    status: "live",
    trigger: "Member adds a dependent, or a dependent invite is resent",
    render: (data) => ({
      subject: `${data.primaryMemberName} added you to their Ideal Oral Health plan`,
      html: dependentInviteHtml(data),
    }),
    sample: (o) => ({
      dependentFirstName: o.firstName,
      primaryMemberName: "Jordan Reyes",
      planName: "Ideal Oral Savings Plan",
      claimUrl: `${getBaseUrl()}/health/claim-invite?token=TEST_TOKEN`,
    }),
  }),

  "employer-membership-agreement": defineTemplate<EmployerAgreementEmailData>({
    label: "Employer-Paid Membership Agreement",
    description: "Full membership agreement for employer-funded members.",
    category: "employer",
    status: "not-wired",
    trigger: "No production caller — reachable only from debug tooling",
    render: (data) => ({
      subject: "Your Ideal Oral Health Employer-Paid Membership Agreement",
      html: employerAgreementHtml(data),
    }),
    sample: (o) => ({
      memberName: `${o.firstName} ${o.lastName}`,
      memberAddress: "123 Any Street\nCity, State 00000",
      memberId: "IOH-TEST-001",
      groupName: "Ideal Oral Savings Plan",
      groupCode: "IOH-DTC",
      term: "ANNUAL",
      effectiveDate: sampleDate(),
      employerPhone: "(800) 555-1234",
      classification: "Employee",
      modeOfPayment: "Payroll Deduction",
      periodicCharge: "$9.95",
      processingFee: "$0.00",
    }),
  }),

  "admin-welcome": defineTemplate<AdminWelcomeEmailData>({
    label: "Admin Welcome (plain)",
    description: "Minimal welcome an admin can fire manually. Overlaps with the other welcome emails.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendWelcomeEmail (admin-triggered)",
    render: (data) => ({
      subject: "Welcome to Ideal Health Oral Care",
      html: adminWelcomeHtml(data),
    }),
    sample: (o) => ({
      firstName: o.firstName,
      planName: "Ideal Oral Savings Plan",
      memberId: "IOH-TEST-001",
    }),
  }),

  "payment-receipt": defineTemplate<PaymentReceiptEmailData>({
    label: "Payment Receipt",
    description: "Receipt for a single payment, with transaction id.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendPaymentReceiptEmail (admin-triggered)",
    render: (data) => ({
      subject: "Payment Receipt",
      html: paymentReceiptHtml(data),
    }),
    sample: () => ({
      firstName: "Test",
      amount: 1995,
      planName: "Ideal Oral Savings Plan",
      transactionId: "txn_TEST_0001",
    }),
  }),

  "member-id-card": defineTemplate<MemberIdCardEmailData>({
    label: "Member ID Card",
    description: "Points the member at their ID card. Note: no PDF is actually attached yet.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendMemberIdCardEmail (admin-triggered)",
    render: (data) => ({
      subject: "Your Member ID Card",
      html: memberIdCardHtml(data),
    }),
    sample: (o) => ({
      firstName: o.firstName,
      memberId: "IOH-TEST-001",
    }),
  }),

  "eligibility-reminder": defineTemplate<EligibilityReminderEmailData>({
    label: "Monthly Eligibility File Reminder",
    description: "Reminds a group admin to upload the monthly eligibility file.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendEligibilityReminderEmail (admin-triggered; the monthly cron is not registered)",
    render: (data) => ({
      subject: `Monthly Eligibility File Reminder: ${data.groupName}`,
      html: eligibilityReminderHtml(data),
    }),
    sample: (o) => {
      const due = new Date();
      due.setDate(due.getDate() + 5);
      return {
        groupName: "Acme Corp",
        adminName: o.firstName,
        dueDate: due.toLocaleDateString(),
      };
    },
  }),

  "bulk-welcome-card": defineTemplate<BulkWelcomeCardEmailData>({
    label: "Bulk Welcome — Digital Member Card",
    description: "Rich welcome with digital card used for bulk eligibility onboarding.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → batchSendWelcomeEmails (bulk admin-triggered)",
    render: (data) => ({
      subject: "Welcome to Ideal Oral Health - Your Member ID Card",
      html: bulkWelcomeCardHtml(data),
    }),
    sample: (o) => ({
      firstName: o.firstName,
      planName: "Ideal Oral Savings Plan",
      memberId: "IOH-TEST-001",
    }),
  }),

  "reenrollment-link": defineTemplate<ReenrollmentLinkEmailData>({
    label: "Re-Enrollment Link",
    description: "Offers a terminated payroll-deduction member a direct-billed continuation.",
    category: "admin",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendReenrollmentLinkEmail (admin-triggered)",
    render: (data) => ({
      subject: "Continue Your Dental Coverage — Re-Enroll Today",
      html: reenrollmentLinkHtml(data),
    }),
    sample: (o) => ({
      firstName: o.firstName,
      memberId: "IOH-TEST-001",
      groupName: "Acme Corp",
      reenrollUrl: `${getBaseUrl()}/health/enroll?token=TEST_TOKEN&source=listbill_term`,
    }),
  }),

  "partner-invite": defineTemplate<PartnerInviteEmailData>({
    label: "Distribution Partner Invite",
    description: "Complimentary platform access for an agency, FMO, or program manager.",
    category: "admin",
    status: "live",
    trigger: "Adding a distribution partner, or resending a partner invite",
    render: (data) => ({
      subject: `Your complimentary access to Ideal Oral Health — ${data.partnerName}`,
      html: partnerInviteHtml(data),
    }),
    sample: (o) => ({
      recipientName: `${o.firstName} ${o.lastName}`,
      partnerName: "Summit Benefits Group",
      typeLabel: "Agency Partner",
      claimUrl: `${getBaseUrl()}/partner/claim?token=TEST_TOKEN`,
    }),
  }),

  "connectivity-test": defineTemplate<Record<string, never>>({
    label: "Connectivity Test",
    description: "Bare-bones send used to confirm Resend delivery is working.",
    category: "diagnostic",
    status: "live",
    trigger: "convex/admin/notifications.ts → sendTestEmail (admin-triggered)",
    render: () => ({
      subject: "Test Email from Ideal Health",
      html: connectivityTestHtml(),
    }),
    sample: () => ({}),
  }),
};

export type EmailTemplateId = keyof typeof EMAIL_TEMPLATES;

export function isEmailTemplateId(value: string): value is EmailTemplateId {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, value);
}

/** Metadata for every template — drives the debug tester's option list. */
export interface EmailTemplateSummary {
  id: EmailTemplateId;
  label: string;
  description: string;
  category: EmailCategory;
  status: EmailStatus;
  trigger: string;
  hasAttachments: boolean;
}

export function listEmailTemplates(): EmailTemplateSummary[] {
  return (Object.keys(EMAIL_TEMPLATES) as EmailTemplateId[]).map((id) => {
    const template = EMAIL_TEMPLATES[id];
    return {
      id,
      label: template.label,
      description: template.description,
      category: template.category,
      status: template.status,
      trigger: template.trigger,
      hasAttachments: template.attachments === "fulfillment-pdfs",
    };
  });
}

/** Render a template with the sample fixture, for the debug tester. */
export function renderSampleEmail(
  id: EmailTemplateId,
  overrides: SampleOverrides
): RenderedEmail {
  return EMAIL_TEMPLATES[id].renderSample(overrides);
}
