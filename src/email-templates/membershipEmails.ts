/**
 * Email Templates & Utility Functions
 * Used by Resend for membership email fulfillment
 */

export const emailTemplates = {
  // Welcome email sent immediately after successful enrollment
  membershipWelcome: (memberData: {
    memberName: string;
    memberEmail: string;
    planName: string;
    effectiveDate: string;
    memberId: string;
  }) => ({
    to: memberData.memberEmail,
    subject: "Welcome to Ideal Oral Health - Your Membership is Active",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Welcome to Ideal Oral Health</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Your membership is now active</p>
        </div>

        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
          <p>Hi ${memberData.memberName},</p>

          <p>Thank you for enrolling in <strong>${memberData.planName}</strong>! We're excited to have you as a member of the Ideal Oral Health family.</p>

          <div style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Your Membership Details</h3>
            <p style="margin: 5px 0;"><strong>Member ID:</strong> ${memberData.memberId}</p>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${memberData.planName}</p>
            <p style="margin: 5px 0;"><strong>Effective Date:</strong> ${memberData.effectiveDate}</p>
          </div>

          <h3 style="color: #667eea;">What You Get:</h3>
          <ul style="line-height: 1.8;">
            <li><strong>AI Oral Scan:</strong> Monitor your dental health from home</li>
            <li><strong>DialCare Teledentistry:</strong> Access 24/7/365 virtual consultations with licensed dentists</li>
            <li><strong>Dental Discount Network:</strong> Save 20-50% on dental procedures at thousands of providers nationwide</li>
            <li><strong>No Insurance Hassles:</strong> Simple, straightforward discount pricing—no claim forms or waiting periods</li>
          </ul>

          <h3 style="color: #667eea;">Getting Started:</h3>
          <ol style="line-height: 1.8;">
            <li><strong>Log In to Your Portal:</strong> Visit <a href="https://www.getidealoh.com/health/dashboard" style="color: #667eea; text-decoration: none;">getidealoh.com/health/dashboard</a> to access your AI Oral Scan, digital ID card, and member tools.</li>
            <li><strong>Download Your ID Card:</strong> Your digital ID card is attached. You can also view it anytime in your member portal.</li>
            <li><strong>Find a Provider:</strong> Search in your <a href="https://www.getidealoh.com/health/dashboard" style="color: #667eea; text-decoration: none;">Member Portal</a> or contact <a href="mailto:support@getidealoh.com" style="color: #667eea; text-decoration: none;">support@getidealoh.com</a> for provider search assistance.</li>
            <li><strong>Schedule Your Appointment:</strong> Call to book and mention you are an Ideal Oral Health member.</li>
            <li><strong>Present Your ID:</strong> Show your card at your appointment to receive your member discount.</li>
          </ol>

          <h3 style="color: #667eea;">Using DialCare Teledentistry:</h3>
          <p>To get started with DialCare's virtual dental services:</p>
          <ol style="line-height: 1.8;">
            <li>Follow the link in your confirmation email or visit dialcare.com/verify</li>
            <li>Download the DialCare mobile app for easy access</li>
            <li>Request a 24/7 consultation whenever you need dental advice</li>
          </ol>

          <div style="background: #FFF8E1; padding: 12px 15px; border-left: 4px solid #F9A825; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0; font-size: 13px;"><strong style="color: #F9A825;">Look for your DialCare email:</strong>
            Shortly after enrollment, you will receive a separate &ldquo;Register Your Account&rdquo; email directly from DialCare. Use it to set up your teledentistry account. If you don't see it, check your spam/junk folder or call DialCare at (855) 335-2255.</p>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;">Contact Member Services at <a href="mailto:support@getidealoh.com" style="color: #667eea; text-decoration: none;">support@getidealoh.com</a></p>
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            <strong>Important Reminder:</strong> This plan is not insurance. You are responsible for payment at the time of service 
            and will receive negotiated discounts through participating providers.
          </p>

          <p>We look forward to helping you save on quality dental care!</p>
          <p>Best regards,<br><strong>The Ideal Oral Health Team</strong></p>

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 11px; color: #999; margin: 10px 0;">
            You received this email because you enrolled in an Ideal Oral Savings Plan. 
            <a href="#" style="color: #667eea; text-decoration: none;">Manage your preferences</a> | 
            <a href="#" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `,
  }),

  // Plan confirmation email with agreement details
  membershipConfirmation: (memberData: {
    memberName: string;
    memberEmail: string;
    planName: string;
    groupCode: string;
    effectiveDate: string;
    memberId: string;
    processingFee?: string;
    billingAmount?: string;
  }) => ({
    to: memberData.memberEmail,
    subject: "Ideal Oral Health Membership Confirmation",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Membership Confirmation</h1>
        </div>

        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
          <p>Thank you for your enrollment, ${memberData.memberName}!</p>

          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #2c3e50;">
            <h3 style="margin-top: 0; color: #2c3e50;">Enrollment Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold;">Member ID:</td>
                <td style="padding: 10px 0; text-align: right;">${memberData.memberId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold;">Plan:</td>
                <td style="padding: 10px 0; text-align: right;">${memberData.planName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold;">Plan Code:</td>
                <td style="padding: 10px 0; text-align: right;">${memberData.groupCode}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-weight: bold;">Effective Date:</td>
                <td style="padding: 10px 0; text-align: right;">${memberData.effectiveDate}</td>
              </tr>
              ${memberData.billingAmount ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold;">Billing Amount:</td><td style="padding: 10px 0; text-align: right;">${memberData.billingAmount}</td></tr>` : ""}
              ${memberData.processingFee ? `<tr><td style="padding: 10px 0; font-weight: bold;">Processing Fee:</td><td style="padding: 10px 0; text-align: right;">${memberData.processingFee}</td></tr>` : ""}
            </table>
          </div>

          <h3 style="color: #2c3e50;">What Happens Next:</h3>
          <ul style="line-height: 1.8;">
            <li>Your membership is effective immediately</li>
            <li>Your digital ID card is ready to use (attached to this email and available in your portal)</li>
            <li>You can start using DialCare teledentistry and your provider discounts right away</li>
          </ul>

          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Cancellation Policy:</strong></p>
            <p style="margin: 10px 0 0 0; font-size: 13px;">
              You have the right to cancel within 30 days of your effective date for a full refund. 
              Contact us at <a href="mailto:support@getidealoh.com" style="color: #ffc107; text-decoration: none;">support@getidealoh.com</a> to cancel.
            </p>
          </div>

          <p style="margin-top: 30px;">Questions? We're here to help!</p>
          <p>
            <strong>Email:</strong> <a href="mailto:support@getidealoh.com" style="color: #667eea; text-decoration: none;">support@getidealoh.com</a>
          </p>
        </div>
      </div>
    `,
  }),

  // Cancellation confirmation email
  membershipCancelled: (memberData: {
    memberName: string;
    memberEmail: string;
    memberId: string;
    refundAmount?: string;
  }) => ({
    to: memberData.memberEmail,
    subject: "Ideal Oral Health Membership Cancelled",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #c0392b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Membership Cancelled</h1>
        </div>

        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
          <p>Hi ${memberData.memberName},</p>

          <p>Your Ideal Oral Health membership has been cancelled as requested.</p>

          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #c0392b;">
            <h3 style="margin-top: 0; color: #c0392b;">Cancellation Details</h3>
            <p style="margin: 5px 0;"><strong>Member ID:</strong> ${memberData.memberId}</p>
            <p style="margin: 5px 0;"><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
            ${memberData.refundAmount ? `<p style="margin: 5px 0;"><strong>Refund Amount:</strong> ${memberData.refundAmount}</p>` : ""}
          </div>

          <p>You will continue to have access to your plan benefits for the remainder of the period for which you've paid. Your membership will terminate at the end of that period.</p>

          <p>If you have any questions about your cancellation or would like to re-enroll, please don't hesitate to contact us.</p>

          <p>
            <strong>Email:</strong> <a href="mailto:support@getidealoh.com" style="color: #667eea; text-decoration: none;">support@getidealoh.com</a>
          </p>

          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Thank you for being part of the Ideal Oral Health community. We hope to welcome you back in the future!
          </p>
        </div>
      </div>
    `,
  }),

  // Invitation email sent to a family member added as a dependent
  dependentInvite: (data: {
    dependentName: string;
    dependentEmail: string;
    primaryMemberName: string;
    planName: string;
    inviteToken: string;
    appUrl?: string;
  }) => {
    const baseUrl = data.appUrl ?? "https://getidealoh.com";
    const claimUrl = `${baseUrl}/health/claim-invite?token=${data.inviteToken}`;
    return {
      to: data.dependentEmail,
      subject: `${data.primaryMemberName} added you to their Ideal Oral Savings Plan`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">You&apos;re Invited!</h1>
            <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">Family plan access from Ideal Oral Health</p>
          </div>

          <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px;">Hi ${data.dependentName},</p>

            <p style="font-size: 15px; line-height: 1.6;">
              <strong>${data.primaryMemberName}</strong> has added you to their
              <strong>${data.planName}</strong> plan. As a family member on this plan, you&apos;ll get
              full access to all plan benefits — with no separate billing.
            </p>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
              <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
                Click the button below to create your account and activate your access.
              </p>
              <a href="${claimUrl}"
                style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
                Accept &amp; Get Access
              </a>
              <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">
                This link expires in 30 days.
              </p>
            </div>

            <h3 style="color: #0066CC; font-size: 15px;">What You Get:</h3>
            <ul style="line-height: 1.8; font-size: 14px; color: #4b5563;">
              <li><strong>AI Oral Scan:</strong> Monitor dental health from home</li>
              <li><strong>DialCare Teledentistry:</strong> 24/7 virtual consultations with licensed dentists</li>
              <li><strong>Dental Discount Network:</strong> Save 20–50% on dental procedures at thousands of providers nationwide</li>
              <li><strong>No separate charge:</strong> Your access is included under ${data.primaryMemberName}&apos;s plan</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

            <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
              If you don&apos;t want to be added to this plan, you can simply ignore this email.
              If you have questions, contact us at
              <a href="mailto:support@getidealoh.com" style="color: #0066CC; text-decoration: none;">support@getidealoh.com</a>.
            </p>

            <p style="font-size: 11px; color: #9ca3af; margin-top: 16px;">
              This plan is not insurance. Access link:
              <a href="${claimUrl}" style="color: #9ca3af;">${claimUrl}</a>
            </p>
          </div>
        </div>
      `,
    };
  },
  // Employer-paid membership agreement email (DialCare DPO Employer Funded layout)
  employerMembershipAgreement: (data: {
    memberName: string;
    memberEmail: string;
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
  }) => ({
    to: data.memberEmail,
    subject: "Your Ideal Oral Health Employer-Paid Membership Agreement",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
          <tr><td align="center">
            <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #cccccc;max-width:680px;">

              <!-- Document Header -->
              <tr>
                <td style="padding:16px 24px 12px 24px;border-bottom:2px solid #000000;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;">
                        <div style="font-size:20px;font-weight:bold;color:#000000;letter-spacing:1px;">MEMBERSHIP AGREEMENT</div>
                      </td>
                      <td style="vertical-align:top;text-align:right;padding-left:20px;border-left:1px solid #000000;">
                        <div style="font-size:9px;font-weight:bold;color:#000000;text-transform:uppercase;margin-bottom:2px;">DISCOUNT PLAN<br/>ORGANIZATION</div>
                        <div style="font-size:9px;color:#000000;">Careington International Corporation<br/>7400 Gaylord Parkway Frisco, TX 75034</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Member Info Row -->
              <tr>
                <td style="padding:12px 24px;border-bottom:1px solid #cccccc;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;width:50%;">
                        <div style="font-size:9px;color:#555555;text-transform:uppercase;font-weight:bold;margin-bottom:2px;">Member ID &nbsp;&nbsp;&nbsp; Member Name &amp; Address</div>
                        <div style="font-size:10px;color:#000000;">
                          <strong>[${data.memberId}]</strong> &nbsp;&nbsp;
                          ${data.memberName}
                        </div>
                        ${data.memberAddress ? `<div style="font-size:10px;color:#000000;margin-top:2px;">${data.memberAddress.replace(/\n/g, '<br/>')}</div>` : ''}
                      </td>
                      <td style="vertical-align:top;text-align:right;">
                        <div style="font-size:9px;color:#555555;text-transform:uppercase;font-weight:bold;margin-bottom:2px;">Group Name</div>
                        <div style="font-size:10px;color:#000000;">${data.groupName}</div>
                        <br/>
                        <table cellpadding="0" cellspacing="0" style="margin-left:auto;">
                          <tr>
                            <td style="font-size:9px;font-weight:bold;color:#555555;text-transform:uppercase;padding-right:12px;">Group Code</td>
                            <td style="font-size:9px;font-weight:bold;color:#555555;text-transform:uppercase;padding-right:12px;">Term</td>
                            <td style="font-size:9px;font-weight:bold;color:#555555;text-transform:uppercase;">Effective Date</td>
                          </tr>
                          <tr>
                            <td style="font-size:10px;color:#000000;padding-right:12px;">${data.groupCode}</td>
                            <td style="font-size:10px;color:#000000;padding-right:12px;">${data.term ?? 'ANNUAL'}</td>
                            <td style="font-size:10px;color:#000000;">${data.effectiveDate}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Contact Info + Total Fees Row -->
              <tr>
                <td style="padding:12px 24px;border-bottom:1px solid #cccccc;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;width:55%;">
                        <p style="margin:0 0 6px 0;font-size:10px;color:#000000;">
                          To add a family member to your plan, contact your employer
                          at ${data.employerPhone ? `<strong>${data.employerPhone}</strong>` : '[Employer&rsquo;s Phone Number]'}.
                          For assistance using your plan, please call Member Services at
                          <strong>1-800-290-0523</strong>.
                        </p>
                      </td>
                      <td style="vertical-align:top;padding-left:20px;border-left:1px solid #cccccc;">
                        <div style="font-size:9px;font-weight:bold;color:#000000;margin-bottom:4px;">Total Fees</div>
                        <div style="font-size:9px;color:#000000;">Classification: [${data.classification ?? '&nbsp;&nbsp;&nbsp;'}]</div>
                        <div style="font-size:9px;color:#000000;">Mode of Payment [${data.modeOfPayment ?? '&nbsp;&nbsp;&nbsp;'}]</div>
                        <div style="font-size:9px;color:#000000;">Periodic Charge: [${data.periodicCharge ?? '&nbsp;&nbsp;&nbsp;'}]</div>
                        <div style="font-size:9px;color:#000000;">Processing Fee: [${data.processingFee ?? '&nbsp;&nbsp;&nbsp;'}]</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Agreement Body -->
              <tr>
                <td style="padding:16px 24px;font-size:10px;line-height:1.6;color:#000000;">

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Terms and Conditions:</strong>
                    The Terms and Conditions you have accepted or will accept upon registering at
                    <a href="https://www.dialcare.com" style="color:#000000;">www.dialcare.com</a>,
                    are part of this membership agreement (Agreement) between you and DialCare, LLC
                    (&ldquo;DialCare&rdquo;). DialCare provides administrative services to DialCare
                    clinicians and does not provide professional medical services. The Terms and
                    Conditions define the obligations of DialCare, its authorized agents and
                    yourself, and they establish the basic rules of safe and fair use of DialCare&rsquo;s
                    public website, member website, and services (Services). DialCare and its
                    authorized agents reserve the right to immediately and without advance notice
                    terminate the Services and deny access to individuals who do not abide by the
                    Terms and Conditions.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Membership and Renewal Conditions:</strong>
                    By joining a plan, for yourself or on behalf of a minor child for whom you are a
                    parent or legal guardian, you confirm that you are at least 18 years old and have
                    read and agree to the terms and conditions of the plan.
                  </p>

                  <p style="margin:0 0 10px 0;font-style:italic;">
                    This plan will automatically renew at the end of your membership term.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Termination Conditions:</strong>
                    Your employer and DialCare reserve the right to terminate plan members from its
                    plan for any reason.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Cancellation Conditions:</strong>
                    You have the right to cancel within the first 30 days after effective date or
                    receipt of membership materials (whichever is later) and receive a full refund,
                    less the processing fee and/or any employer contributions, if applicable. If for
                    any reason you wish to cancel, submit a cancellation request with your name and
                    member ID by mail, email or phone &nbsp;to your employer. Your employer will stop
                    collecting membership fees in a reasonable amount of time, but no later than 30
                    days after receiving a cancellation request. When you cancel, you will continue
                    to have access to the plan for the remainder of the period for which you have
                    paid; your membership will terminate at the end of that period. The preceding
                    sentence does not apply to quarterly, semi-annual or annual memberships in FL
                    and OK, where you will receive a pro-rata refund whenever you cancel.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Description of Services:</strong>
                    Please see the enclosed materials for a specific description of the programs
                    included in your plan.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Limitations, Exclusions &amp; Exceptions:</strong>
                    This is a discount plan offered by Careington International Corporation
                    (Careington). Careington is not a licensed insurer, health maintenance
                    organization or other underwriter of health care services. This plan is not
                    insurance. No portion of any provider&rsquo;s fees will be reimbursed or
                    otherwise paid by Careington. Careington is not licensed to provide and does
                    not provide health care services or items to individuals. You will receive
                    discounts for services at certain health care providers who have contracted
                    with the plan. You are obligated to pay for all health care services at the
                    time of service. Savings are based upon the provider&rsquo;s normal fees.
                    Actual savings will vary depending upon location and specific services or
                    products purchased. Please verify such services with each individual provider.
                    The plan&rsquo;s discounts may not be used in conjunction with any other
                    discount plan or program. All listed or quoted prices are current prices by
                    participating providers and subject to change without notice. Any procedures
                    performed by a non-participating provider are not discounted. From time to
                    time, certain providers may offer products or services to the general public
                    at prices lower than the discounted prices available through this plan. In
                    such event, members will be charged the lowest price. Discounts on
                    professional services are not available when prohibited by law. This plan
                    does not discount all procedures. Providers are subject to change without
                    notice and services may vary in some states. It is your responsibility to
                    verify that the provider participates in the plan. At any time Careington may
                    substitute a provider network at its sole discretion. Careington cannot
                    guarantee the continued participation of any provider. If the provider leaves
                    the plan, you will need to select another provider. Providers contracted by
                    Careington are solely responsible for the professional advice and treatment
                    rendered to members and Careington disclaims any liability with respect to
                    such matters.
                  </p>

                  <p style="margin:0 0 10px 0;">
                    <strong style="text-decoration:underline;">Complaint Procedure:</strong>
                    If you would like to file a complaint regarding your plan membership, you must
                    submit your complaint in writing to: DialCare, P.O. Box 2568, Frisco, TX 75034.
                    You have the right to request an appeal if you are dissatisfied with the
                    complaint resolution. After completing the complaint resolution process, if you
                    remain dissatisfied you may contact your state insurance department. Contact
                    information for your state insurance department is available upon request.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:10px 24px;border-top:1px solid #cccccc;background:#f9f9f9;">
                  <p style="margin:0;font-size:8px;color:#666666;text-align:center;">
                    DialCare DPO Employer Funded Partial Pay Membership Agreement &mdash;
                    Ideal Oral Health &bull; Powered by Careington International Corporation
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  }),

  // Set-Your-Password welcome email sent when a member is granted access
  // through the eligibility pipeline (employer / sponsor list-bill).
  // The link is the Clerk invitation URL — clicking it lets them choose a
  // password and complete sign-in.
  eligibilityWelcomeSetPassword: (data: {
    memberName: string;
    memberEmail: string;
    sponsorName?: string; // employer / group display name
    invitationUrl: string;
    appUrl?: string;
  }) => {
    const baseUrl = data.appUrl ?? "https://getidealoh.com";
    const sponsorLine = data.sponsorName
      ? `Your access has been activated through <strong>${data.sponsorName}</strong>.`
      : `Your access has been activated through your sponsoring organization.`;
    return {
      to: data.memberEmail,
      subject: "Set your password and activate your Ideal Oral Health membership",
      html: `
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
              <li><strong>Dental Discount Network:</strong> Save 20–50% on dental procedures at thousands of participating providers nationwide.</li>
              <li><strong>No claim forms or waiting periods</strong> — you receive negotiated discounts at the time of service.</li>
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
                <a href="mailto:support@getidealoh.com" style="color: #0066CC; text-decoration: none;">support@getidealoh.com</a>
                or visit
                <a href="${baseUrl}" style="color: #0066CC; text-decoration: none;">${baseUrl.replace(/^https?:\/\//, "")}</a>.
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
              Careington International Corporation, 7400 Safari Blvd., Frisco, TX 75033, support@getidealoh.com.
              Teledentistry services are provided by DialCare. Not available in all states. Member may
              cancel within the first 30 days for a full refund of fees paid.
            </p>

            <p style="font-size: 11px; color: #9ca3af; margin: 8px 0 0;">
              You received this email because your sponsoring organization added you to the Ideal
              Oral Health program. If this looks unfamiliar, you can safely ignore this email or
              contact <a href="mailto:support@getidealoh.com" style="color: #9ca3af;">support@getidealoh.com</a>.
            </p>

            <p style="font-size: 11px; color: #9ca3af; margin: 12px 0 0; word-break: break-all;">
              If the button above does not work, copy and paste this link into your browser:<br />
              <a href="${data.invitationUrl}" style="color: #9ca3af;">${data.invitationUrl}</a>
            </p>
          </div>
        </div>
      `,
    };
  },
};

/**
 * Get email template by type
 */
export const getEmailTemplate = (
  templateType:
    | "welcome"
    | "confirmation"
    | "cancelled"
    | "dependent-invite"
    | "eligibility-welcome-set-password"
    | "employer-membership-agreement",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memberData: any
) => {
  switch (templateType) {
    case "welcome":
      return emailTemplates.membershipWelcome(memberData);
    case "confirmation":
      return emailTemplates.membershipConfirmation(memberData);
    case "cancelled":
      return emailTemplates.membershipCancelled(memberData);
    case "dependent-invite":
      return emailTemplates.dependentInvite(memberData);
    case "eligibility-welcome-set-password":
      return emailTemplates.eligibilityWelcomeSetPassword(memberData);
    case "employer-membership-agreement":
      return emailTemplates.employerMembershipAgreement(memberData);
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
};
