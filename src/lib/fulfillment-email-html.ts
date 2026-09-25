/**
 * Shared fulfillment email HTML generator.
 * Used by the Stripe webhook handler and the test-email route so both
 * always produce identical email bodies.
 */
export function generateFulfillmentEmailHTML(data: {
  memberFirstName: string;
  memberId: string;
  planName: string;
  effectiveDate: string;
  groupCode: string;
  memberServicesPhone: string;
  portalUrl: string;
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
        </ul>
        <div style="border-top: 2px solid #e2e8f0; margin: 28px 0 20px; padding-top: 24px;">
          <h2 style="margin: 0 0 6px; font-size: 18px; color: #0f172a;">How to Use Your Program</h2>
          <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">Your membership includes 3 core benefits — here's how to get started.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${BLUE};">AI Dental Scan</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Log in to your <a href="${data.portalUrl}/health/dashboard" style="color: ${BLUE}; text-decoration: none;">Member Portal</a> and open the <strong>Oral Scan</strong> tab.</li>
            <li>Upload or take a clear photo of your teeth.</li>
            <li>Review your results and any recommended next steps.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;"><strong>Best for:</strong> Spotting possible problem areas, monitoring visible changes, and knowing when to seek follow-up care.</p>
          <p style="font-size: 11px; color: #9ca3af; margin: 6px 0 0;">Note: The AI scan is a screening tool — not a clinical diagnosis. Always consult a licensed dentist.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${CYAN};">Teledentistry (DialCare)</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Open the <strong>Teledentistry</strong> tab in your portal, or visit <a href="https://www.dialcare.com" style="color: ${CYAN}; text-decoration: none;">dialcare.com</a>.</li>
            <li>Request or schedule a virtual consultation (available 24/7).</li>
            <li>Share your concern, scan results, or symptoms with the dentist.</li>
            <li>Receive professional guidance on what to do next.</li>
          </ol>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0; line-height: 1.5;"><strong>Best for:</strong> Questions about dental concerns, guidance after an AI scan, and deciding if in-person care is needed.</p>
        </div>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: ${TEAL};">Dental Savings Network</h3>
          <ol style="margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2.0; color: #374151;">
            <li>Search for a participating provider in your <a href="${data.portalUrl}/health/dashboard" style="color: ${TEAL}; text-decoration: none;">Member Portal</a> or at <a href="https://getidealoh.com" style="color: ${TEAL}; text-decoration: none;">getidealoh.com</a>, alternatively <a href="mailto:support@getidealoh.com" style="color: ${TEAL}; text-decoration: none;">email support@getidealoh.com</a>.</li>
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
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 0; line-height: 1.5;">You can ask any participating provider for a discounted treatment plan before your visit.</p>
        </div>
        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${data.portalUrl}/health/dashboard" style="display: inline-block; padding: 14px 36px; background: ${BLUE}; color: white; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px;">
            Go to Your Member Portal
          </a>
        </div>
        <div style="background: #EAF4FD; border-radius: 6px; padding: 14px; margin-bottom: 12px; font-size: 13px;">
          Contact Member Services at <a href="mailto:support@getidealoh.com" style="color: #1E88E5; text-decoration: none;">support@getidealoh.com</a>.
        </div>
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0;">
          This plan is not insurance. Members are responsible for payment at the time of service
          and receive access to negotiated discounts through participating providers.
          The range of discounts varies by provider and service.
        </p>
      </div>
    </div>`;
}
