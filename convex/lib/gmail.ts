import { getBaseUrl } from "./env";

/**
 * Send email via Gmail SMTP (through the Next.js API route).
 *
 * Use this for admin/internal emails to avoid Resend costs.
 * For member-facing emails with attachments, continue using Resend.
 */
export async function sendViaGmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret) {
    headers["Authorization"] = `Bearer ${internalSecret}`;
  }

  try {
    const response = await fetch(`${baseUrl}/api/send-gmail`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: opts.replyTo ?? "support@getidealoh.com",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Gmail API error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
