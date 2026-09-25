/**
 * EMAIL ELIGIBILITY GATE — the one place that decides whether the CRM is
 * allowed to email a contact.
 *
 * This ladder used to live inline in campaigns.ts:buildRecipients, which was
 * fine while a human clicking "send" was the only way mail left the system.
 * Workflow automation makes that assumption false: a rule can now send
 * unattended, at volume, without anyone reviewing a recipient list first. A
 * second sender re-implementing (or quietly forgetting) this ladder is a
 * CAN-SPAM violation vector, so both senders call this instead.
 *
 * Order matters and is preserved from the original: each rung produces a
 * distinct reason string so "why did only 88 of 96 go out" always has an
 * answer. Suppression is checked last of the blocking rungs because it is the
 * only one that costs a database read.
 */

import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { isSuppressed } from "../suppressions";
import { isRoleAddress } from "./normalize";

export type EmailSkipReason =
  | "no_email"
  | "opted_out"
  | "email_bounced_hard"
  | "email_complained"
  | "email_unsubscribed"
  | "email_blocked"
  | "email_invalid"
  | "email_do_not_contact"
  | "suppressed"
  | "role_address";

export interface EmailEligibility {
  emailable: boolean;
  reason: EmailSkipReason | null;
  email: string | null;
  emailLower: string | null;
}

/**
 * Imported, not re-declared: the contact list's `emailable` filter applies the
 * same test, and two copies of "who may we email" is precisely the drift this
 * module exists to prevent.
 */
import { isBlockingEmailStatus } from "./contactStatus";

/**
 * Evaluate a contact's eligibility to receive CRM outbound mail.
 *
 * `allowRoleAddress` exists because the two senders differ legitimately: a
 * batch campaign skips info@/sales@ addresses (they tank deliverability on a
 * cold-ish list), whereas a workflow replying into an existing thread may
 * legitimately need to. It defaults to the stricter behaviour.
 */
export async function checkEmailEligibility(
  ctx: QueryCtx | MutationCtx,
  contact: Pick<Doc<"crmContacts">, "email" | "emailLower" | "emailOptOut" | "emailStatus">,
  opts: { allowRoleAddress?: boolean } = {},
): Promise<EmailEligibility> {
  const email = contact.email ?? null;
  const emailLower = contact.emailLower ?? null;
  const base = { email, emailLower };

  if (!email || !emailLower) return { emailable: false, reason: "no_email", ...base };
  if (contact.emailOptOut) return { emailable: false, reason: "opted_out", ...base };

  if (isBlockingEmailStatus(contact.emailStatus)) {
    return { emailable: false, reason: `email_${contact.emailStatus}` as EmailSkipReason, ...base };
  }
  if (await isSuppressed(ctx, emailLower)) {
    return { emailable: false, reason: "suppressed", ...base };
  }
  if (!opts.allowRoleAddress && isRoleAddress(email)) {
    return { emailable: false, reason: "role_address", ...base };
  }

  return { emailable: true, reason: null, ...base };
}

/**
 * Throwing form for automated senders, where "eligible" is a precondition
 * rather than a filter — a workflow step that reaches the send call with an
 * ineligible contact is a bug in the engine, not an expected outcome.
 */
export async function assertEmailable(
  ctx: QueryCtx | MutationCtx,
  contact: Pick<Doc<"crmContacts">, "email" | "emailLower" | "emailOptOut" | "emailStatus">,
): Promise<{ email: string; emailLower: string }> {
  const result = await checkEmailEligibility(ctx, contact);
  if (!result.emailable) {
    throw new Error(`Contact is not emailable: ${result.reason}`);
  }
  return { email: result.email!, emailLower: result.emailLower! };
}
