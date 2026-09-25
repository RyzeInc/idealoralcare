'use client';

import { useState } from 'react';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { LoadMore, FilterChip } from '@/components/admin/ui';
import { ActivityItem } from '../ActivityItem';
import { TimelineComposer } from '../TimelineComposer';

type ActivityType = Doc<'crmActivities'>['activityType'];

const EMAIL_TYPES: ActivityType[] = [
  'email_outbound', 'email_inbound', 'email_delivered', 'email_bounced',
  'email_complained', 'email_opened', 'email_clicked', 'email_unsubscribed',
];
const SYSTEM_TYPES: ActivityType[] = [
  'system', 'imported', 'merged', 'contact_created', 'tag_added', 'tag_removed',
  'status_changed', 'owner_changed', 'stage_changed', 'task_created', 'task_completed',
];

const FILTERS: { key: string; label: string; types: ActivityType[] | null; tone: string }[] = [
  { key: 'all', label: 'All', types: null, tone: 'text-slate-600 bg-slate-100 border-slate-200' },
  { key: 'call', label: 'Calls', types: ['call'], tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'email', label: 'Emails', types: EMAIL_TYPES, tone: 'text-purple-700 bg-purple-50 border-purple-200' },
  { key: 'note', label: 'Notes', types: ['note'], tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'system', label: 'System', types: SYSTEM_TYPES, tone: 'text-slate-500 bg-slate-50 border-slate-200' },
];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export function TimelineColumn({ contactId }: { contactId: Id<'crmContacts'> }) {
  const [filterKey, setFilterKey] = useState('all');
  const pinned = useQuery(api.crm.activities.listPinned, { contactId });
  const { results, status, loadMore } = usePaginatedQuery(
    api.crm.activities.listByContact,
    { contactId },
    { initialNumItems: 25 },
  );

  const activeFilter = FILTERS.find((f) => f.key === filterKey)!;
  const matchesFilter = (a: Doc<'crmActivities'>) => !activeFilter.types || activeFilter.types.includes(a.activityType);

  const pinnedIds = new Set((pinned ?? []).map((p) => p._id));
  const feed = results.filter((a) => !pinnedIds.has(a._id) && matchesFilter(a));
  const visiblePinned = (pinned ?? []).filter(matchesFilter);

  const feedWithDaySeparators = feed.reduce<{ activity: Doc<'crmActivities'>; label: string; showSeparator: boolean }[]>(
    (acc, activity) => {
      const label = dayLabel(activity.occurredAt);
      const previousLabel = acc.length > 0 ? acc[acc.length - 1].label : '';
      acc.push({ activity, label, showSeparator: label !== previousLabel });
      return acc;
    },
    [],
  );

  return (
    <div className="space-y-4">
      <TimelineComposer contactId={contactId} />

      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={f.types ? results.filter((a) => f.types!.includes(a.activityType)).length : results.length}
            active={filterKey === f.key}
            tone={f.tone}
            onClick={() => setFilterKey(f.key)}
          />
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        {visiblePinned.length > 0 && (
          <div className="mb-4 pb-4 border-b border-slate-100 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Pinned</p>
            {visiblePinned.map((a) => <ActivityItem key={a._id} activity={a} />)}
          </div>
        )}

        {status === 'LoadingFirstPage' && <p className="text-sm text-slate-400 py-8 text-center">Loading timeline…</p>}
        {status !== 'LoadingFirstPage' && feed.length === 0 && visiblePinned.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">No activity yet.</p>
        )}

        <div className="space-y-3">
          {feedWithDaySeparators.map(({ activity, label, showSeparator }) => (
            <div key={activity._id}>
              {showSeparator && <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2 mt-1">{label}</p>}
              <ActivityItem activity={activity} />
            </div>
          ))}
        </div>

        <LoadMore status={status} loadMore={loadMore} pageSize={25} label="Load older" />
      </div>
    </div>
  );
}
