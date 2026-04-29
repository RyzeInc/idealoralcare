import { humanize } from '@/lib/admin-format';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  pending: 'bg-purple-100 text-purple-800 border-purple-200',
};

/**
 * Default tone mapping for member lifecycle / common statuses.
 * Pages can pass an explicit `tone` to override.
 */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  active: 'success',
  enrolled: 'success',
  paid: 'success',
  approved: 'success',
  succeeded: 'success',
  completed: 'success',
  eligible: 'warning',
  enrolling: 'pending',
  pending: 'pending',
  lead: 'info',
  invited: 'info',
  inactive: 'neutral',
  draft: 'neutral',
  terminated: 'danger',
  declined: 'danger',
  failed: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  past_due: 'danger',
  unpaid: 'danger',
};

export interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, tone, label, size = 'sm' }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE_MAP[status?.toLowerCase?.()] ?? 'neutral';
  const text = label ?? humanize(status);
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeCls} ${TONE_CLASSES[resolvedTone]}`}
    >
      {text}
    </span>
  );
}
