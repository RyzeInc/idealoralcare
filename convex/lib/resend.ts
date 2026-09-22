/**
 * Single outbound email path for the whole app.
 *
 * Everything — member-facing, admin, and internal mail — goes through Resend.
 * Convex actions call the Resend REST API directly rather than hopping through
 * a Next.js route, so an email send does not depend on the web app being up.
 */

const DEFAULT_FROM = "Ideal Oral Health <noreply@getidealoh.com>";
const DEFAULT_REPLY_TO = "support@getidealoh.com";

export interface ResendAttachment {
  filename: string;
  /** Base64-encoded file contents. */
  content: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
  /** Resend tags, used to break delivery stats down by email type. */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function fromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL;
  if (!configured) return DEFAULT_FROM;
  // RESEND_FROM_EMAIL may be a bare address or an already-formatted "Name <addr>".
  return configured.includes("<") ? configured : `Ideal Oral Health <${configured}>`;
}

/**
 * Send one email. Never throws — callers that need to fail loudly check `success`.
 */
export async function sendViaResend(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const payload: Record<string, unknown> = {
    from: fromAddress(),
    to: opts.to,
    replyTo: opts.replyTo ?? DEFAULT_REPLY_TO,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.attachments?.length) payload.attachments = opts.attachments;
  if (opts.tags?.length) payload.tags = opts.tags;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}) as Record<string, string>);

    if (!response.ok) {
      const detail = (data as Record<string, string>).message ?? response.statusText;
      return { success: false, error: `Resend error (${response.status}): ${detail}` };
    }

    return { success: true, messageId: (data as Record<string, string>).id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Same as sendViaResend, but throws on failure — for callers that must surface errors. */
export async function sendViaResendOrThrow(opts: SendEmailOptions): Promise<{ success: true; emailId?: string }> {
  const result = await sendViaResend(opts);
  if (!result.success) throw new Error(result.error ?? "Email send failed");
  return { success: true, emailId: result.messageId };
}
