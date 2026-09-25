/**
 * MAIL MERGE + COMPLIANCE FOOTER
 *
 * Pure functions — no ctx, no network — so template rendering can be unit
 * tested and previewed identically in sendTestEmail and the real send path.
 */

const MERGE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Extracts the set of {{tokenName}} placeholders referenced in a template. */
export function extractMergeFields(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  MERGE_TOKEN_RE.lastIndex = 0;
  while ((match = MERGE_TOKEN_RE.exec(template)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/**
 * Replaces {{token}} with data[token]. Unknown tokens render as empty string
 * rather than throwing — a bad merge field in a template should degrade the
 * email, not break the send loop for every other recipient in the batch.
 */
export function renderMergeFields(template: string, data: Record<string, string | undefined>): string {
  return template.replace(MERGE_TOKEN_RE, (_match, token: string) => data[token] ?? "");
}

export interface ComplianceFooterOptions {
  /** Physical postal address — CAN-SPAM requires this on every commercial email. */
  postalAddress: string;
  /** Absolute URL, unique per recipient: https://.../unsubscribe/{token} */
  unsubscribeUrl: string;
  companyName?: string;
}

/**
 * Appends the CAN-SPAM footer to an HTML email body. Called unconditionally
 * at render time by every CRM send path (one-off and campaign) — never left
 * as a toggle a template author could accidentally omit.
 */
export function appendComplianceFooter(bodyHtml: string, opts: ComplianceFooterOptions): string {
  const company = opts.companyName ?? "Ideal Oral Health";
  const footer = `
<table role="presentation" width="100%" style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
  <tr>
    <td style="font-family:sans-serif;font-size:12px;color:#94a3b8;line-height:1.5;">
      <p style="margin:0 0 4px 0;">${company} &middot; ${escapeHtml(opts.postalAddress)}</p>
      <p style="margin:0;">
        <a href="${opts.unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a> from these emails.
      </p>
    </td>
  </tr>
</table>`.trim();
  return `${bodyHtml}\n${footer}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
