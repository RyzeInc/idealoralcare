/**
 * Email Tester Utility
 * Use this to test Resend email delivery during development
 */

export interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export async function testBasicEmail(to: string): Promise<EmailTestResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY || process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL || 'noreply@getidealoh.com',
        to,
        subject: '[TEST] Basic Email from Ideal Oral Health',
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h1 style="color: #8B5CF6;">✅ Resend Email Test Successful</h1>
            <p>If you received this email, Resend integration is working properly!</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Recipient: ${to}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
              <li>From: noreply@getidealoh.com</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This is a test email. No action needed.</p>
          </div>
        `,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to send email',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      messageId: data.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function testFulfillmentEmail(to: string, memberData?: {
  firstName?: string;
  lastName?: string;
  memberId?: string;
}): Promise<EmailTestResult> {
  try {
    const firstName = memberData?.firstName || 'Member';
    const memberId = memberData?.memberId || 'TEST-ID-' + Date.now();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESEND_API_KEY || process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL || 'noreply@getidealoh.com',
        to,
        subject: `Welcome to Ideal Oral Health - Your Membership Package`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">Welcome to Ideal Oral Health</h1>
            </div>
            
            <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Dear ${firstName},</p>
              
              <p>Welcome to Ideal Oral Health! We're excited to have you as a member.</p>
              
              <p><strong>Your Membership Details:</strong></p>
              <ul style="background: #f3f4f6; padding: 15px; border-radius: 5px;">
                <li>Member ID: <code style="background: white; padding: 2px 5px; border-radius: 3px;">${memberId}</code></li>
                <li>Join Date: ${new Date().toLocaleDateString()}</li>
                <li>Status: Active</li>
              </ul>
              
              <p><strong>What's Next?</strong></p>
              <ol>
                <li>Download and review your membership agreement (attached)</li>
                <li>Visit a participating provider to start saving</li>
                <li>Contact us at <a href="mailto:support@getidealoh.com">support@getidealoh.com</a> with any questions</li>
              </ol>
              
              <p style="color: #666; font-size: 14px;"><em>📎 Your membership package PDF is attached to this email.</em></p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              
              <footer style="color: #999; font-size: 12px;">
                <p><strong>Ideal Oral Health</strong></p>
                <p>✉️ support@getidealoh.com</p>
                <p><em>[TEST EMAIL] This is a test to verify fulfillment email delivery is working.</em></p>
              </footer>
            </div>
          </div>
        `,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to send fulfillment email',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      messageId: data.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function testAllEmails(to: string): Promise<{
  basic: EmailTestResult;
  fulfillment: EmailTestResult;
}> {
  const [basic, fulfillment] = await Promise.all([
    testBasicEmail(to),
    testFulfillmentEmail(to, { firstName: 'Test User' }),
  ]);

  return { basic, fulfillment };
}
