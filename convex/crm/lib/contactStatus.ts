/**
 * CONTACT STATUS, DRIP PROGRESS, DELIVERABILITY, NEXT ACTION.
 *
 * The four enums the contact list is driven by, in one module, deliberately
 * free of any `convex/` import so the admin UI can import it directly
 * (tsconfig maps `@/convex/*` → `./convex/*`) instead of keeping a second,
 * drifting copy of every label — the failure mode `crm/lib/filters.ts`
 * already warns about for filter shapes.
 *
 * WHY FOUR FIELDS AND NOT ONE. The old single `status` column was asked to
 * answer three unrelated questions at once: where this relationship stands,
 * how far through the email sequence they are, and whether we may email them
 * at all. Those move independently — a Qualified contact can be mid-drip with
 * a hard-bounced address — so conflating them means every answer is wrong for
 * someone. They are now:
 *
 *   status       — the relationship. Human-owned, the CRM's spine.
 *   dripStep     — 0-5, plus dripStatus. Automation-owned.
 *   emailStatus  — deliverability. Webhook-owned; gates every send.
 *   nextAction   — what a rep does next. Human-owned, the day-to-day view.
 *
 * VALIDATORS ARE NOT DEFINED HERE. `v.union(...)` needs its literals spelled
 * out to stay typed, so convex/schema.ts and convex/crm/contacts.ts each
 * write theirs out longhand. Those lists and these arrays must agree; the
 * tests in contactStatus.test.ts assert the schema's union matches.
 */

/* ------------------------------------------------------------------ *
 * RELATIONSHIP STATUS
 * ------------------------------------------------------------------ */

/**
 * Ordered as the relationship actually progresses — the list UI renders the
 * dropdown in this order, so it doubles as the funnel's definition.
 *
 * `partner` means an officially onboarded Strategic Distribution Partner —
 * an executed agreement, not someone who merely expressed interest. Interest
 * lives at `interested_qualified`; a sent-but-unsigned agreement lives at
 * `agreement_sent`. Keeping that line sharp is the whole point of having both.
 */
export const CONTACT_STATUSES = [
  "prospect",
  "contacted",
  "nurturing",
  "interested_qualified",
  "meeting_scheduled",
  "agreement_sent",
  "partner",
  "inactive_partner",
  "not_interested",
  "disqualified",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * The pre-redesign values. Still accepted by the schema union so a deploy
 * can land before every row is migrated (Convex validates the WHOLE table
 * against the schema at deploy time — dropping these while rows still carry
 * them fails the deploy, not just the next write).
 *
 * Removal is a follow-up commit, once
 * `internal.crm.maintenance.migrateContactStatuses` reports zero remaining.
 */
export const LEGACY_CONTACT_STATUSES = [
  "new",
  "working",
  "qualified",
  "customer",
  "unresponsive",
] as const;

export type LegacyContactStatus = (typeof LEGACY_CONTACT_STATUSES)[number];

/**
 * How the migration rewrites a legacy row.
 *
 * `unresponsive` → `nurturing` is the one judgement call: the new list has no
 * "we tried and heard nothing" bucket, and the alternative (`not_interested`)
 * would assert a decision the contact never actually made. Nurturing keeps
 * them in the funnel, which is the recoverable error.
 */
export const LEGACY_STATUS_MIGRATION: Record<LegacyContactStatus, ContactStatus> = {
  new: "prospect",
  working: "contacted",
  qualified: "interested_qualified",
  customer: "partner",
  unresponsive: "nurturing",
};

/** Labels cover legacy values too, so an un-migrated row still renders as words. */
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  nurturing: "Nurturing",
  interested_qualified: "Interested / Qualified",
  meeting_scheduled: "Meeting Scheduled",
  agreement_sent: "Agreement Sent",
  partner: "Partner",
  inactive_partner: "Inactive Partner",
  not_interested: "Not Interested",
  disqualified: "Disqualified",
  // Legacy — shown only until the migration has run.
  new: "New (legacy)",
  working: "Working (legacy)",
  qualified: "Qualified (legacy)",
  customer: "Customer (legacy)",
  unresponsive: "Unresponsive (legacy)",
};

/** The status a brand-new contact starts at, wherever it is created from. */
export const DEFAULT_CONTACT_STATUS: ContactStatus = "prospect";

/** Reached the end of the line — a drip must not keep running against these. */
export const CLOSED_CONTACT_STATUSES: readonly ContactStatus[] = [
  "not_interested",
  "disqualified",
];

export function isLegacyStatus(status: string): status is LegacyContactStatus {
  return (LEGACY_CONTACT_STATUSES as readonly string[]).includes(status);
}

/* ------------------------------------------------------------------ *
 * EMAIL DRIP PROGRESS
 * ------------------------------------------------------------------ */

/**
 * Stored as a state + a 0-5 step rather than one nine-value enum, because
 * automation wants arithmetic ("who is due email 3?") and the UI wants a
 * sentence. The nine labels the team asked for are derived from the pair by
 * `dripLabel`, so the two can never disagree.
 */
export const DRIP_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "paused",
  "replied_removed",
] as const;

export type DripStatus = (typeof DRIP_STATUSES)[number];

/** Emails 1-5. A step of 0 means nothing has gone out yet. */
export const DRIP_MAX_STEP = 5;

export const DRIP_STATUS_LABELS: Record<DripStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Drip Completed",
  paused: "Drip Paused",
  replied_removed: "Replied / Removed",
};

/** The label a rep actually sees: "Email 3 Sent", not "in_progress / 3". */
export function dripLabel(dripStatus: DripStatus | undefined, dripStep: number | undefined): string {
  const step = dripStep ?? 0;
  const status = dripStatus ?? "not_started";
  if (status === "in_progress") {
    return step > 0 ? `Email ${step} Sent` : "In Progress";
  }
  if (status === "paused" && step > 0) return `Drip Paused (after ${step})`;
  return DRIP_STATUS_LABELS[status];
}

/**
 * The one place a send advances the sequence. Returns the patch to apply, or
 * null when this contact should not advance at all.
 *
 * Pure so it is unit-testable without a database — the send paths that call
 * it (campaign engine, workflow engine) are the hardest things in the CRM to
 * exercise end-to-end.
 */
export function advanceDrip(contact: {
  dripStatus?: DripStatus;
  dripStep?: number;
}): { dripStatus: DripStatus; dripStep: number } | null {
  const status = contact.dripStatus ?? "not_started";
  // A contact who replied is out of the sequence for good — re-entering them
  // is the exact behaviour that makes people report a sender as spam.
  if (status === "replied_removed") return null;
  const step = Math.min(contact.dripStep ?? 0, DRIP_MAX_STEP);
  if (step >= DRIP_MAX_STEP) return { dripStatus: "completed", dripStep: DRIP_MAX_STEP };
  const nextStep = step + 1;
  return {
    dripStatus: nextStep >= DRIP_MAX_STEP ? "completed" : "in_progress",
    dripStep: nextStep,
  };
}

/* ------------------------------------------------------------------ *
 * EMAIL DELIVERABILITY
 * ------------------------------------------------------------------ */

export const EMAIL_STATUSES = [
  "unknown",
  "valid",
  "blocked",
  "bounced_soft",
  "bounced_hard",
  "invalid",
  "complained",
  "unsubscribed",
  "do_not_contact",
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  unknown: "Unknown",
  valid: "Good",
  blocked: "Email Blocked",
  bounced_soft: "Soft Bounce",
  bounced_hard: "Hard Bounce",
  invalid: "Invalid Email",
  complained: "Spam Complaint",
  unsubscribed: "Unsubscribed",
  do_not_contact: "Do Not Contact",
};

/**
 * Statuses that block an outbound send outright. THE deliverability rung of
 * the compliance ladder in crm/lib/emailGate.ts — imported by the gate and by
 * the list's `emailable` filter so a send and a preview can never disagree.
 *
 * `bounced_soft` is deliberately absent: a soft bounce is a full mailbox or a
 * transient server error, and permanently retiring an address over one is how
 * a real prospect silently stops hearing from you. The drip pauses on a soft
 * bounce instead (see recordEmailBlocked), which is reversible.
 */
export const BLOCKING_EMAIL_STATUSES: readonly EmailStatus[] = [
  "bounced_hard",
  "complained",
  "unsubscribed",
  "blocked",
  "invalid",
  "do_not_contact",
];

export function isBlockingEmailStatus(status: string): boolean {
  return (BLOCKING_EMAIL_STATUSES as readonly string[]).includes(status);
}

/* ------------------------------------------------------------------ *
 * NEXT ACTION
 * ------------------------------------------------------------------ */

/**
 * "What do I do next", as opposed to every other field here, which records
 * what already happened. Optional: an empty next action is a real state
 * (nothing owed), not a missing value, so there is no "none" member.
 */
export const NEXT_ACTIONS = [
  "send_follow_up",
  "call",
  "schedule_meeting",
  "send_partner_kit",
  "send_agreement",
  "awaiting_response",
] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number];

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  send_follow_up: "Send Follow-Up",
  call: "Call",
  schedule_meeting: "Schedule Meeting",
  send_partner_kit: "Send Partner Kit",
  send_agreement: "Send Agreement",
  awaiting_response: "Awaiting Response",
};
