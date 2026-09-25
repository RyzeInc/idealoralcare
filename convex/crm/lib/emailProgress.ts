/**
 * EMAIL SEQUENCE PROGRESS — the single write path for every drip and
 * engagement field on crmContacts.
 *
 * Same argument as crm/activities.ts:insertActivity, for the same reason:
 * there are now FOUR places that put mail on the wire (one-off send, campaign
 * engine, workflow engine, and the Resend webhook writing back what happened
 * to it). Each one previously hand-rolled its own `emailsSentCount + 1` patch,
 * and a fifth sender forgetting to advance the drip would not fail loudly —
 * it would just quietly send email 2 forever.
 *
 * THE RULE ABOUT WHAT ADVANCES A SEQUENCE. Automated sends advance it
 * (campaign and workflow: they ARE the sequence). A rep's one-off email does
 * not — it records the touch, but a personal reply mid-drip should not push
 * someone from "Email 2 Sent" to "Email 3 Sent" and skip a real step.
 */

import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { advanceDrip, type EmailStatus, type DripStatus } from "./contactStatus";
import { exitEnrollmentsForContact } from "./dripAdvance";

/**
 * Record an outbound email against a contact.
 *
 * `advanceSequence` is required rather than defaulted, so every new sender has
 * to state which kind it is instead of inheriting whichever default happened
 * to be convenient.
 */
export async function recordEmailSent(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
  opts: { advanceSequence: boolean; at?: number },
): Promise<void> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return;
  const at = opts.at ?? Date.now();

  const patch: Partial<Doc<"crmContacts">> = {
    emailsSentCount: contact.emailsSentCount + 1,
    lastEmailSentAt: at,
    // The send it was waiting for has happened; whoever schedules the next
    // step sets this again. Leaving a stale date here would make the "due"
    // view permanently wrong.
    nextEmailScheduledAt: undefined,
    updatedAt: at,
  };

  if (opts.advanceSequence) {
    const next = advanceDrip(contact);
    if (next) {
      patch.dripStatus = next.dripStatus;
      patch.dripStep = next.dripStep;
    }
  }

  await ctx.db.patch(contactId, patch);
}

/** Opens and clicks, from the Resend webhook. Never blocks anything — purely "are they warm". */
export async function recordEmailEngagement(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
  event: "opened" | "clicked",
  at: number = Date.now(),
): Promise<void> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return;
  await ctx.db.patch(contactId, {
    ...(event === "opened" ? { lastEmailOpenedAt: at } : { lastLinkClickedAt: at }),
    updatedAt: at,
  });
}

/**
 * A bounce, complaint, block or manual "do not contact".
 *
 * Pausing the drip here is the point: emailGate already refuses the NEXT send
 * to a blocked address, but a paused drip is what makes that visible in the
 * list instead of silently stalling at "Email 2 Sent" forever. A soft bounce
 * pauses too — it does not block sending (see BLOCKING_EMAIL_STATUSES), so
 * without the pause a full mailbox would burn through emails 3, 4 and 5.
 */
export async function recordEmailBlocked(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
  opts: { emailStatus: EmailStatus; optOut?: boolean; at?: number },
): Promise<void> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return;
  const at = opts.at ?? Date.now();

  const patch: Partial<Doc<"crmContacts">> = {
    emailStatus: opts.emailStatus,
    updatedAt: at,
  };
  if (opts.optOut) patch.emailOptOut = true;

  // Only pause a sequence that is actually running: a completed drip stays
  // completed, and a contact who replied stays out of it.
  if ((contact.dripStatus ?? "not_started") === "in_progress") {
    patch.dripStatus = "paused";
  }

  await ctx.db.patch(contactId, patch);

  // The cached column above is not what stops the next phase — the enrollment
  // is, and syncPrimaryDripCache would otherwise recompute the cache straight
  // back to "in progress" on the next write.
  await exitEnrollmentsForContact(ctx, contactId, {
    status: "paused",
    reason: `email_${opts.emailStatus}`,
    at,
  });
}

/**
 * The fields a reply writes. Returned rather than patched so
 * crm/activities.ts can fold them into the single contact patch it already
 * makes for an inbound timeline row, instead of writing the document twice.
 */
export function buildReplyPatch(contact: Doc<"crmContacts">, at: number): Partial<Doc<"crmContacts">> {
  const patch: Partial<Doc<"crmContacts">> = { hasReplied: true, repliedAt: at };
  const current: DripStatus = contact.dripStatus ?? "not_started";
  // A reply ends the sequence — the remaining "just following up" emails are
  // exactly what makes an interested prospect stop replying.
  if (current === "in_progress" || current === "paused") {
    patch.dripStatus = "replied_removed";
  }
  return patch;
}
