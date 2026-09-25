/**
 * Display labels for workflow triggers and actions. Kept alongside the other
 * CRM display constants rather than derived from the Convex validators — the
 * wording here is user-facing copy ("When a deal enters a stage"), not a
 * mechanical prettification of the enum keys.
 */

export const TRIGGER_LABELS: Record<string, string> = {
  contact_created: 'When a contact is created',
  company_created: 'When a company is created',
  deal_created: 'When a deal is created',
  stage_entered: 'When a deal enters a stage',
  tag_applied: 'When a tag is applied',
  status_changed: 'When a contact status changes',
  no_activity_days: 'When there has been no activity for N days',
  manual: 'Only when run manually',
};

export const ACTION_LABELS: Record<string, string> = {
  create_task: 'Create a task',
  apply_tag: 'Apply a tag',
  remove_tag: 'Remove a tag',
  update_deal_stage: 'Move the deal to a stage',
  send_email_template: 'Send an email template',
  notify_owner: 'Note for the owner',
  add_note: 'Add a note to the timeline',
};

export const RUN_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'pending'> = {
  completed: 'success',
  pending_steps: 'pending',
  failed: 'danger',
  cancelled: 'neutral',
};

/** Human phrasing for a step delay. 0 means "immediately after the previous step". */
export function formatDelay(delayMinutes: number): string {
  if (delayMinutes <= 0) return 'Immediately';
  if (delayMinutes < 60) return `After ${delayMinutes} min`;
  if (delayMinutes < 60 * 24) {
    const hours = Math.round(delayMinutes / 60);
    return `After ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(delayMinutes / (60 * 24));
  return `After ${days} day${days === 1 ? '' : 's'}`;
}
