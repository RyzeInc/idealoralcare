import { NextRequest, NextResponse } from 'next/server';

// ── Test data defaults ───────────────────────────────────────────────────────
const TEST_MEMBER = {
  memberName: 'Test Member',
  memberFirstName: 'Test',
  memberEmail: '',
  memberId: 'IOH-TEST-001',
  planName: 'Ideal Oral Health Plan',
  groupCode: 'IOH-100',
  effectiveDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  billingAmount: '$19.95/mo',
  memberServicesPhone: '801-820-0010',
};

type EmailType = 'fulfillment-packet' | 'welcome' | 'confirmation' | 'cancelled';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, type, firstName, lastName } = body as {
      to: string;
      type: EmailType;
      firstName?: string;
      lastName?: string;
    };

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: 'Missing "to" email address' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const memberFirst = firstName || TEST_MEMBER.memberFirstName;
    const memberLast = lastName || 'Member';
    const memberName = `${memberFirst} ${memberLast}`;

    let subject: string;
    let html: string;
    let attachments: { filename: string; content: string }[] | undefined;

    switch (type) {
      case 'fulfillment-packet': {
        // Internal server URL for PDF generation (can be localhost in dev)
        const serverUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        // Public-facing URL for links in emails (never localhost)
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://getidealoh.com';
        const pdfPayload = {
          memberName,
          memberFirstName: memberFirst,
          memberEmail: to,
          memberId: TEST_MEMBER.memberId,
          groupCode: TEST_MEMBER.groupCode,
          planName: TEST_MEMBER.planName,
          effectiveDate: TEST_MEMBER.effectiveDate,
          memberServicesPhone: TEST_MEMBER.memberServicesPhone,
        };

        const pdfHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const internalSecret = process.env.INTERNAL_API_SECRET;
        if (internalSecret) {
          pdfHeaders['Authorization'] = `Bearer ${internalSecret}`;
        }

        let pdfBase64: string | null = null;
        let agreementPdfBase64: string | null = null;
        try {
          const pdfRes = await fetch(`${serverUrl}/api/generate-fulfillment-pdf`, {
            method: 'POST',
            headers: pdfHeaders,
            body: JSON.stringify(pdfPayload),
          });
          if (pdfRes.ok) {
            const pdfData = await pdfRes.json();
            pdfBase64 = pdfData.pdf;
            agreementPdfBase64 = pdfData.agreementPdf ?? null;
          }
        } catch {
          // PDF generation failed — send email without attachment
        }

        subject = 'Your Ideal Oral Health Membership Packet & Program Guide';
        html = generateFulfillmentEmailHTML({
          memberFirstName: memberFirst,
          memberId: TEST_MEMBER.memberId,
          planName: TEST_MEMBER.planName,
          effectiveDate: TEST_MEMBER.effectiveDate,
          groupCode: TEST_MEMBER.groupCode,
          memberServicesPhone: TEST_MEMBER.memberServicesPhone,
          portalUrl: portalUrl,
        });
        if (pdfBase64) {
          attachments = [{ filename: 'Ideal_Oral_Health_Membership_Packet.pdf', content: pdfBase64 }];
          if (agreementPdfBase64) {
            attachments.push({ filename: 'Ideal_Oral_Health_Membership_Agreement.pdf', content: agreementPdfBase64 });
          }
        }
        break;
      }

      case 'welcome': {
        subject = 'Welcome to Ideal Oral Health - Your Membership is Active';
        html = generateWelcomeEmailHTML({
          memberName,
          memberEmail: to,
          planName: TEST_MEMBER.planName,
          effectiveDate: TEST_MEMBER.effectiveDate,
          memberId: TEST_MEMBER.memberId,
        });
        break;
      }

      case 'confirmation': {
        subject = 'Ideal Oral Health Membership Confirmation';
        html = generateConfirmationEmailHTML({
          memberName,
          memberEmail: to,
          memberId: TEST_MEMBER.memberId,
          planName: TEST_MEMBER.planName,
          groupCode: TEST_MEMBER.groupCode,
          effectiveDate: TEST_MEMBER.effectiveDate,
          billingAmount: TEST_MEMBER.billingAmount,
        });
        break;
      }

      case 'cancelled': {
        subject = 'Ideal Oral Health Membership Cancelled';
        html = generateCancellationEmailHTML({
          memberName,
          memberEmail: to,
          memberId: TEST_MEMBER.memberId,
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 });
    }

    const emailPayload: Record<string, unknown> = {
      from: 'Ideal Oral Health <noreply@getidealoh.com>',
      to,
      subject,
      html,
    };
    if (attachments) {
      emailPayload.attachments = attachments;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: (data as Record<string, string>).message || 'Resend API error' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: (data as Record<string, string>).id,
      hadAttachment: !!attachments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exact copies of the HTML generators from convex/legal/emailFulfillment.ts
// so the test emails are identical to production.
// ──────────────────────────────────────────────────────────────────────────────

function generateFulfillmentEmailHTML(data: {
  memberFirstName: string; memberId: string; planName: string;
  effectiveDate: string; groupCode: string; memberServicesPhone: string; portalUrl: string;
}): string {
  const BLUE = "#0066CC";
  const TEAL = "#14b8a6";
  const CYAN = "#0d9de0";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #333; background: #f9fafb;">
      <div style="background: linear-gradient(135deg, #1E88E5 0%, #35C48A 100%); color: white; padding: 28px 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">Your Membership Packet &amp; Program Guide</h1>
        <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Ideal Oral Health — AI Dental Scan &middot; Teledentistry &middot; Dental Savings</p>
      </div>
      <div style="padding: 28px 24px;">
        <p style="font-size: 16px; margin-bottom: 8px;">Hi ${data.memberFirstName},</p>
        <p style="font-size: 14px; line-height: 1.7;">
          Your enrollment is confirmed and your membership is <strong>active as of ${data.effectiveDate}</strong>.
          Your complete member fulfillment packet is attached to this email as a PDF.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1E88E5; font-size: 14px;">Your Membership Snapshot</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 0; color: #666;">Member ID</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.memberId}</td></tr>
            <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 0; color: #666;">Plan</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.planName}</td></tr>
            <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 0; color: #666;">Group Code</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.groupCode}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Effective Date</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.effectiveDate}</td></tr>
          </table>
        </div>
        <h3 style="color: #1E88E5; font-size: 14px;">What's in your packet:</h3>
        <ul style="font-size: 13px; line-height: 2.0; color: #374151; padding-left: 20px;">
          <li>Welcome letter &amp; member summary card</li>
          <li>Program summary and how to use your discount plan</li>
          <li>Membership agreement</li>
          <li>Sample schedule of dental services and member-pay amounts</li>
        </ul>
        <div style="border-top: 2px solid #e2e8f0; margin: 28px 0 20px; padding-top: 24px;">
          <h2 style="margin: 0 0 6px; font-size: 18px; color: #0f172a;">How to Use Your Program</h2>
          <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Your membership includes 3 core benefits — here's how to get started.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${BLUE};">1. AI Dental Scan</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Log in to your <a href="${data.portalUrl}/health/dashboard" style="color: ${BLUE}; text-decoration: none;">Member Portal</a> and open the <strong>Oral Scan</strong> tab.</li>
            <li>Upload or take a clear photo of your teeth.</li>
            <li>Review your results and any recommended next steps.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;"><strong>Best for:</strong> Spotting possible problem areas, monitoring visible changes, and knowing when to seek follow-up care.</p>
          <p style="font-size: 11px; color: #9ca3af; margin: 6px 0 0;">Note: The AI scan is a screening tool — not a clinical diagnosis. Always consult a licensed dentist.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${CYAN};">2. Teledentistry (DialCare)</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Open the <strong>Teledentistry</strong> tab in your portal, or visit <a href="https://www.dialcare.com" style="color: ${CYAN}; text-decoration: none;">dialcare.com</a>.</li>
            <li>Request or schedule a virtual consultation (available 24/7).</li>
            <li>Share your concern, scan results, or symptoms with the dentist.</li>
            <li>Receive professional guidance on what to do next.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;"><strong>Best for:</strong> Questions about dental concerns, guidance after an AI scan, and deciding if in-person care is needed.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${TEAL};">3. Dental Discount Network</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Search for a participating provider at <a href="https://www.careington.com" style="color: ${TEAL}; text-decoration: none;">careington.com</a> or call (800) 290-0523.</li>
            <li>Confirm the provider accepts the discount program <strong>before</strong> your visit.</li>
            <li>Present your Member ID card at your appointment.</li>
            <li>Pay the discounted member amount directly at time of service.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;"><strong>Best for:</strong> Routine dental care, savings on eligible services, and finding participating providers.</p>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 14px; color: ${BLUE};">Recommended Order</h3>
          <p style="font-size: 13px; line-height: 1.7; color: #374151; margin: 0;">
            For the best results: <strong>Start with an AI Scan</strong> to understand any visible areas of concern,
            then <strong>use Teledentistry</strong> if you have questions, and
            <strong>use the Discount Network</strong> when you're ready for in-person care.
          </p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 14px; font-size: 14px; color: #0f172a;">Frequently Asked Questions</h3>
          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">Do I need my member ID at my appointment?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">Yes. Present your member ID card (or the digital card from your dashboard) so the provider can apply your discounts.</p>
          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">When do my benefits begin?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">Benefits are activated within 24 hours of enrollment.</p>
          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">Is the AI scan a diagnosis?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 14px; line-height: 1.5;">No. It is a screening tool. Always consult a licensed dentist for professional evaluation.</p>
          <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px;">How do I know what services are eligible for savings?</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 0; line-height: 1.5;">Your attached packet includes a sample schedule. You can also ask any participating provider for a discounted treatment plan.</p>
        </div>
        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${data.portalUrl}/health/dashboard" style="display: inline-block; padding: 14px 36px; background: ${BLUE}; color: white; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px;">
            Go to Your Member Portal
          </a>
        </div>
        <div style="background: #EAF4FD; border-radius: 6px; padding: 14px; margin-bottom: 12px; font-size: 13px;">
          <strong>Need help?</strong> Call Member Services at
          <a href="tel:${data.memberServicesPhone}" style="color: #1E88E5; text-decoration: none;">${data.memberServicesPhone}</a>
          or email <a href="mailto:support@getidealoh.com" style="color: #1E88E5; text-decoration: none;">support@getidealoh.com</a>.
          Mon–Fri, 8am–6pm CT.
        </div>
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0;">
          This plan is not insurance. Members are responsible for payment at the time of service
          and receive access to negotiated discounts through participating providers.
          The range of discounts varies by provider and service.
        </p>
      </div>
    </div>`;
}

function generateWelcomeEmailHTML(data: {
  memberName: string; memberEmail: string; planName: string;
  effectiveDate: string; memberId: string;
}): string {
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
          <li><strong>AI Oral Scanning:</strong> Monitor your dental health from home with SmartCheck</li>
          <li><strong>DialCare Teledentistry:</strong> 24/7/365 virtual consultations</li>
          <li><strong>Dental Discount Network:</strong> Save 20-50% on dental procedures</li>
          <li><strong>No Insurance Hassles:</strong> Simple discount pricing</li>
        </ul>
        <h3 style="color: #667eea;">Getting Started:</h3>
        <ol style="line-height: 1.8;">
          <li>Log in to your <a href="https://www.getidealoh.com/health/dashboard" style="color: #667eea; text-decoration: none;">Member Portal</a></li>
          <li>Visit <a href="https://www.careington.com" style="color: #667eea; text-decoration: none;">careington.com</a> or call (800) 290-0523 to find a dentist</li>
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
    </div>`;
}

function generateConfirmationEmailHTML(data: {
  memberName: string; memberEmail: string; memberId: string; planName: string;
  groupCode: string; effectiveDate: string; processingFee?: string; billingAmount?: string;
}): string {
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
            <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Member ID:</td><td style="padding: 10px 0; text-align: right;">${data.memberId}</td></tr>
            <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Plan:</td><td style="padding: 10px 0; text-align: right;">${data.planName}</td></tr>
            <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Plan Code:</td><td style="padding: 10px 0; text-align: right;">${data.groupCode}</td></tr>
            <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Effective Date:</td><td style="padding: 10px 0; text-align: right;">${data.effectiveDate}</td></tr>
            ${data.billingAmount ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Billing Amount:</td><td style="padding: 10px 0; text-align: right;">${data.billingAmount}</td></tr>` : ""}
            ${data.processingFee ? `<tr><td style="padding: 10px 0; font-weight: bold;">Processing Fee:</td><td style="padding: 10px 0; text-align: right;">${data.processingFee}</td></tr>` : ""}
          </table>
        </div>
        <p>Your membership is effective immediately and you can start using your benefits right away!</p>
        <p>Questions? We're here to help!</p>
      </div>
    </div>`;
}

function generateCancellationEmailHTML(data: {
  memberName: string; memberEmail: string; memberId: string;
}): string {
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
    </div>`;
}
