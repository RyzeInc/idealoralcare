'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { CheckSquare, Users, Building2, Upload, Inbox, Tag as TagIcon } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs } from '@/components/admin/ui';
import { Card, SectionHeader } from '@/components/admin/crm/primitives';
import { formatDateTime } from '@/lib/admin-format';

const QUICK_LINKS = [
  { href: '/admin/crm/contacts', label: 'Contacts', icon: Users },
  { href: '/admin/crm/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/crm/tags', label: 'Tags', icon: TagIcon },
  { href: '/admin/crm/import', label: 'Import CSV', icon: Upload },
  { href: '/admin/crm/inbox', label: 'Ingest Inbox', icon: Inbox },
];

export default function CrmHomePage() {
  const myTasks = useQuery(api.crm.tasks.listMyTasks, {});
  const recent = useQuery(api.crm.activities.listRecent, { limit: 15 });
  const completeTask = useMutation(api.crm.tasks.completeTask);

  // Snapshot "now" once per mount via a lazy useState initializer (not a bare
  // Date.now() read in the render body, and not useMemo — its factory still
  // runs on the render path) — a task shifting from upcoming to overdue
  // mid-session is fine to pick up on the next natural re-render.
  const [now] = useState(() => Date.now());
  const overdue = (myTasks ?? []).filter((t) => t.dueAt < now);
  const upcoming = (myTasks ?? []).filter((t) => t.dueAt >= now);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">CRM</h1>
        <p className="text-sm text-slate-500 mt-1">Sales contacts, companies, and pipeline — internal staff only.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white border border-slate-200 rounded-xl p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <link.icon size={20} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">{link.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <SectionHeader icon={CheckSquare} title="My Tasks" badge={<span className="text-xs text-slate-400">{(myTasks ?? []).length} open</span>} />
          <div className="space-y-2">
            {overdue.length > 0 && (
              <>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Overdue</p>
                {overdue.map((task) => (
                  <TaskRow key={task._id} title={task.title} dueAt={task.dueAt} onComplete={() => completeTask({ taskId: task._id })} overdue />
                ))}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-3">Upcoming</p>
                {upcoming.slice(0, 8).map((task) => (
                  <TaskRow key={task._id} title={task.title} dueAt={task.dueAt} onComplete={() => completeTask({ taskId: task._id })} />
                ))}
              </>
            )}
            {(myTasks ?? []).length === 0 && <p className="text-sm text-slate-400">No open tasks. Nice.</p>}
          </div>
        </Card>

        <Card>
          <SectionHeader icon={Users} title="Team Activity" />
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {(recent ?? []).map(({ activity, contactName }) => (
              <div key={activity._id} className="pb-3 border-b border-slate-100 last:border-0">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{activity.actorName ?? 'System'}</span>{' '}
                  <span className="text-slate-500">{activity.title.toLowerCase()}</span>
                  {contactName && <> for <Link href={`/admin/crm/contacts`} className="text-blue-600 hover:underline">{contactName}</Link></>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(activity.occurredAt)}</p>
              </div>
            ))}
            {(recent ?? []).length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({ title, dueAt, onComplete, overdue = false }: { title: string; dueAt: number; onComplete: () => void; overdue?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onComplete} className="text-slate-300 hover:text-green-600" aria-label="Mark complete">
        <CheckSquare size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 truncate">{title}</p>
      </div>
      <p className={`text-xs flex-shrink-0 ${overdue ? 'text-red-500' : 'text-slate-400'}`}>{formatDateTime(dueAt)}</p>
    </div>
  );
}
