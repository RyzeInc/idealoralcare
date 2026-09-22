import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import {
  EMAIL_TEMPLATES,
  isEmailTemplateId,
  listEmailTemplates,
  renderSampleEmail,
} from '@/convex/lib/emailTemplates';

async function logSend(entry: {
  templateId: string;
  to: string;
  subject: string;
  success: boolean;
  messageId?: string;
  error?: string;
  hasAttachments?: boolean;
}) {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || '');
    await convex.mutation(api.debug.emailLog.logSend, entry);
  } catch (err) {
    // Logging must never block or fail the actual send.
    console.error('[test-email] failed to record debug log entry:', err);
  }
}

/**
 * Debug email tester.
 *
 * GET  — lists every template in the registry, so the tester UI cannot fall
 *        behind the templates the app actually sends.
 * POST — renders one template from its sample fixture and sends it via Resend.
 */

export async function GET() {
  return NextResponse.json({ templates: listEmailTemplates() });
}

async function buildFulfillmentAttachments(
  to: string,
  memberName: string,
  memberFirstName: string,
): Promise<{ filename: string; content: string }[] | undefined> {
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const sample = EMAIL_TEMPLATES['fulfillment-packet'].sample({
    firstName: memberFirstName,
    lastName: '',
    email: to,
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret) headers['Authorization'] = `Bearer ${internalSecret}`;

  try {
    const res = await fetch(`${serverUrl}/api/generate-fulfillment-pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        memberName,
        memberFirstName,
        memberEmail: to,
        memberId: sample.memberId,
        groupCode: sample.groupCode,
        planName: sample.planName,
        effectiveDate: sample.effectiveDate,
        memberServicesPhone: sample.memberServicesPhone,
      }),
    });
    if (!res.ok) return undefined;

    const data = await res.json();
    const attachments: { filename: string; content: string }[] = [];
    if (data.pdf) {
      attachments.push({ filename: 'Ideal_Oral_Health_Membership_Packet.pdf', content: data.pdf });
    }
    if (data.agreementPdf) {
      attachments.push({ filename: 'Ideal_Oral_Health_Membership_Agreement.pdf', content: data.agreementPdf });
    }
    return attachments.length ? attachments : undefined;
  } catch {
    // PDF generation failed — still send the email body so the template is testable.
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, type, firstName, lastName } = body as {
      to: string;
      type: string;
      firstName?: string;
      lastName?: string;
    };

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: 'Missing "to" email address' }, { status: 400 });
    }

    if (!type || !isEmailTemplateId(type)) {
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const memberFirst = firstName || 'Test';
    const memberLast = lastName || 'Member';

    const { subject, html } = renderSampleEmail(type, {
      firstName: memberFirst,
      lastName: memberLast,
      email: to,
    });

    const attachments =
      EMAIL_TEMPLATES[type].attachments === 'fulfillment-pdfs'
        ? await buildFulfillmentAttachments(to, `${memberFirst} ${memberLast}`, memberFirst)
        : undefined;

    const emailPayload: Record<string, unknown> = {
      from: process.env.RESEND_FROM_EMAIL
        ? `Ideal Oral Health <${process.env.RESEND_FROM_EMAIL}>`
        : 'Ideal Oral Health <noreply@getidealoh.com>',
      to,
      replyTo: 'support@getidealoh.com',
      subject,
      html,
    };
    if (attachments) emailPayload.attachments = attachments;

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
      const errorMessage = (data as Record<string, string>).message || 'Resend API error';
      await logSend({
        templateId: type,
        to,
        subject,
        success: false,
        error: errorMessage,
        hasAttachments: !!attachments,
      });
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const messageId = (data as Record<string, string>).id;
    await logSend({
      templateId: type,
      to,
      subject,
      success: true,
      messageId,
      hasAttachments: !!attachments,
    });

    return NextResponse.json({
      success: true,
      messageId,
      subject,
      hadAttachment: !!attachments,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
