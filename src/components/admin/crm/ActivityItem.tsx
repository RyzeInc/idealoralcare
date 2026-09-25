'use client';

import {
  StickyNote, Phone, Mail, MailCheck, MailX, MailWarning, MailOpen, MousePointerClick,
  Users, Linkedin, ListChecks, CheckCircle2, TrendingUp, UserCog, Tag as TagIcon,
  UserPlus, Upload, Merge, Settings2, PhoneOff, Pin,
} from 'lucide-react';
import type { Doc } from '@/convex/_generated/dataModel';
import { formatDateTime } from '@/lib/admin-format';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

type Activity = Doc<'crmActivities'>;

const ICON_MAP: Record<Activity['activityType'], typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email_outbound: Mail,
  email_inbound: MailOpen,
  email_delivered: MailCheck,
  email_bounced: MailX,
  email_complained: MailWarning,
  email_opened: MailOpen,
  email_clicked: MousePointerClick,
  email_unsubscribed: MailX,
  meeting: Users,
  linkedin: Linkedin,
  task_created: ListChecks,
  task_completed: CheckCircle2,
  stage_changed: TrendingUp,
  status_changed: UserCog,
  owner_changed: UserCog,
  tag_added: TagIcon,
  tag_removed: TagIcon,
  contact_created: UserPlus,
  imported: Upload,
  merged: Merge,
  system: Settings2,
};

const CALL_OUTCOME_TONE: Record<string, string> = {
  connected: 'text-green-600',
  do_not_call: 'text-red-600',
  wrong_number: 'text-red-600',
  bad_number: 'text-red-600',
};

export function ActivityItem({ activity }: { activity: Activity }) {
  const togglePin = useMutation(api.crm.activities.togglePin);
  const Icon = activity.activityType === 'call' && activity.callOutcome === 'do_not_call'
    ? PhoneOff
    : (ICON_MAP[activity.activityType] ?? StickyNote);
  const tone = activity.activityType === 'call' && activity.callOutcome ? CALL_OUTCOME_TONE[activity.callOutcome] : undefined;

  return (
    <div className="flex gap-3 group">
      <div className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 ${tone ?? 'text-slate-500'}`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-slate-100 last:border-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-800 font-medium">{activity.title}</p>
          <button
            type="button"
            onClick={() => togglePin({ activityId: activity._id })}
            className={`flex-shrink-0 ${activity.isPinned ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100'} hover:text-amber-500`}
            title={activity.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={12} fill={activity.isPinned ? 'currentColor' : 'none'} />
          </button>
        </div>
        {activity.body && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{activity.body}</p>}
        <p className="text-xs text-slate-400 mt-1">
          {activity.actorName ?? 'System'} · {formatDateTime(activity.occurredAt)}
          {activity.callDurationSeconds !== undefined && ` · ${Math.floor(activity.callDurationSeconds / 60)}:${String(activity.callDurationSeconds % 60).padStart(2, '0')}`}
        </p>
      </div>
    </div>
  );
}
