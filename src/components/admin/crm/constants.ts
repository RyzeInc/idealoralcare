export const STAGE_ORDER = [
  'unqualified', 'prospect', 'contacted', 'engaged', 'proposal', 'verbal', 'won', 'lost', 'dormant',
] as const;

export const STAGE_LABELS: Record<string, string> = {
  unqualified: 'Unqualified',
  prospect: 'Prospect',
  contacted: 'Contacted',
  engaged: 'Engaged',
  proposal: 'Proposal',
  verbal: 'Verbal',
  won: 'Won',
  lost: 'Lost',
  dormant: 'Dormant',
};

/** Fallback used by pipeline math when a company has no explicit winProbability set. */
export const STAGE_DEFAULT_PROBABILITY: Record<string, number> = {
  unqualified: 5,
  prospect: 10,
  contacted: 20,
  engaged: 35,
  proposal: 55,
  verbal: 80,
  won: 100,
  lost: 0,
  dormant: 5,
};

/**
 * The contact-status / drip / deliverability / next-action vocabulary is
 * re-exported from the Convex module rather than restated here — one list, so
 * a value the server accepts and a value this UI offers cannot drift apart.
 * (tsconfig maps `@/convex/*` → `./convex/*`; contactStatus.ts is deliberately
 * free of server imports so it is safe in a client bundle.)
 */
export {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  DRIP_STATUSES,
  DRIP_STATUS_LABELS,
  DRIP_MAX_STEP,
  dripLabel,
  EMAIL_STATUSES,
  EMAIL_STATUS_LABELS,
  NEXT_ACTIONS,
  NEXT_ACTION_LABELS,
} from '@/convex/crm/lib/contactStatus';

export type {
  ContactStatus,
  DripStatus,
  EmailStatus,
  NextAction,
} from '@/convex/crm/lib/contactStatus';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';

/** Passed explicitly to StatusBadge's `tone` prop rather than editing the shared STATUS_TONE_MAP — avoids any future key collision in a file several other pages depend on. */
export const CONTACT_STATUS_TONE: Record<string, Tone> = {
  prospect: 'info',
  contacted: 'info',
  nurturing: 'pending',
  interested_qualified: 'pending',
  meeting_scheduled: 'warning',
  agreement_sent: 'warning',
  partner: 'success',
  inactive_partner: 'neutral',
  not_interested: 'neutral',
  disqualified: 'danger',
  // Legacy values, still rendered until the migration has run.
  new: 'neutral',
  working: 'neutral',
  qualified: 'neutral',
  customer: 'neutral',
  unresponsive: 'neutral',
};

export const DRIP_STATUS_TONE: Record<string, Tone> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
  paused: 'warning',
  replied_removed: 'pending',
};

/** Anything that stops a send reads as danger; a soft bounce is a warning, because it is recoverable. */
export const EMAIL_STATUS_TONE: Record<string, Tone> = {
  unknown: 'neutral',
  valid: 'success',
  blocked: 'danger',
  bounced_soft: 'warning',
  bounced_hard: 'danger',
  invalid: 'danger',
  complained: 'danger',
  unsubscribed: 'neutral',
  do_not_contact: 'danger',
};

export const CALL_OUTCOMES: { value: string; label: string }[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'bad_number', label: 'Bad Number' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'do_not_call', label: 'Do Not Call' },
];

/** Palette keys resolved against crmTagCategories.color / crmTags.color — never a raw Tailwind class stored in the DB. */
export const CRM_TAG_COLORS: Record<string, string> = {
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  green: 'text-green-700 bg-green-50 border-green-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  red: 'text-red-700 bg-red-50 border-red-200',
  purple: 'text-purple-700 bg-purple-50 border-purple-200',
  slate: 'text-slate-700 bg-slate-50 border-slate-200',
  pink: 'text-pink-700 bg-pink-50 border-pink-200',
  teal: 'text-teal-700 bg-teal-50 border-teal-200',
};

export function tagColorClass(color: string | undefined): string {
  return CRM_TAG_COLORS[color ?? 'slate'] ?? CRM_TAG_COLORS.slate;
}
