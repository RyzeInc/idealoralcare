/**
 * Single outbound email path for the whole app.
 *
 * Everything — member-facing, admin, internal, and CRM outreach mail — goes
 * through Resend. Convex actions call the Resend REST API directly rather than
 * hopping through a Next.js route, so an email send does not depend on the web
 * app being up (and Convex→Next fetches are the class of request Vercel
 * Deployment Protection can silently block).
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
  text?: string;
  /** Overrides the default sender. CRM outreach sends MUST pass an outreach-domain address once one exists. */
  from?: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
  /** Resend tags, used to break delivery stats down by email type. */
  tags?: Array<{ name: string; value: string }>;
  /** Shorthand for a single `category` tag, e.g. "partner-invite". Ignored when `tags` is set. */
  category?: string;
  /** Extra headers — CRM campaign sends use this for List-Unsubscribe / List-Unsubscribe-Post. */
  headers?: Record<string, string>;
  /**
   * Sent as the Idempotency-Key header. Without it, a Convex action that
   * fails after the fetch succeeds will double-send on retry.
   */
  idempotencyKey?: string;
  /** Selects RESEND_OUTREACH_API_KEY (falls back to RESEND_API_KEY if unset — the outreach domain/key split is a phase-2 CRM setup step, not a hard requirement to send at all). */
  useOutreachKey?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when a retry could succeed (429, 5xx, network failure). */
  retryable?: boolean;
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
  const apiKey = (opts.useOutreachKey && process.env.RESEND_OUTREACH_API_KEY) || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const tags = opts.tags?.length
    ? opts.tags
    : opts.category
      ? [{ name: "category", value: opts.category }]
      : undefined;

  const payload: Record<string, unknown> = {
    from: opts.from ?? fromAddress(),
    to: opts.to,
    replyTo: opts.replyTo ?? DEFAULT_REPLY_TO,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) payload.text = opts.text;
  if (opts.attachments?.length) payload.attachments = opts.attachments;
  if (tags) payload.tags = tags;
  if (opts.headers) payload.headers = opts.headers;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (opts.idempotencyKey) requestHeaders["Idempotency-Key"] = opts.idempotencyKey;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}) as Record<string, string>);

    if (!response.ok) {
      const detail = (data as Record<string, string>).message ?? response.statusText;
      // 429/5xx are transient (rate limit, Resend-side failure) — worth a
      // retry. 4xx otherwise (422 bad address, 401 bad key, ...) will fail
      // identically on retry, so never retry them automatically.
      const retryable = response.status === 429 || response.status >= 500;
      return { success: false, error: `Resend error (${response.status}): ${detail}`, retryable };
    }

    return { success: true, messageId: (data as Record<string, string>).id };
  } catch (error) {
    // Network-level failure (DNS, timeout, ...) — always worth a retry.
    return { success: false, error: (error as Error).message, retryable: true };
  }
}

/** Same as sendViaResend, but throws on failure — for callers that must surface errors. */
export async function sendViaResendOrThrow(opts: SendEmailOptions): Promise<{ success: true; emailId?: string }> {
  const result = await sendViaResend(opts);
  if (!result.success) throw new Error(result.error ?? "Email send failed");
  return { success: true, emailId: result.messageId };
}
