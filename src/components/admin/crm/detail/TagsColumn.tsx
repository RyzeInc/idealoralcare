'use client';

import { useMutation, useQuery } from 'convex/react';
import { CheckSquare } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { formatDateTime } from '@/lib/admin-format';
import { Card, SectionHeader } from '../primitives';
import { TagChip } from '../TagChip';
import { TagPicker } from '../TagPicker';
import { Tag as TagIcon, BarChart3, ListTodo } from 'lucide-react';

export function TagsColumn({ contact }: { contact: Doc<'crmContacts'> }) {
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const tasks = useQuery(api.crm.tasks.listTasksForContact, { contactId: contact._id });
  const removeTags = useMutation(api.crm.tags.removeTags);
  const completeTask = useMutation(api.crm.tasks.completeTask);

  const connectRate = contact.callsMadeCount > 0
    ? Math.round((contact.callsConnectedCount / contact.callsMadeCount) * 100)
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader icon={TagIcon} title="Tags" />
        <div className="space-y-3">
          {(tree ?? []).map(({ category, tags }) => {
            const applied = tags.filter((t) => contact.tagIds.includes(t._id));
            return (
              <div key={category._id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{category.name}</p>
                  <TagPicker contactId={contact._id} currentTagIds={contact.tagIds} categoryId={category._id} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {applied.length === 0 && <span className="text-xs text-slate-300">None</span>}
                  {applied.map((tag) => (
                    <TagChip
                      key={tag._id}
                      name={tag.name}
                      color={tag.color ?? category.color}
                      onRemove={() => removeTags({ contactId: contact._id, tagIds: [tag._id] })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {(tree ?? []).length === 0 && <p className="text-xs text-slate-400">No tag categories yet — add one from the Tags page.</p>}
        </div>
      </Card>

      <Card>
        <SectionHeader icon={BarChart3} title="Quick Facts" />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Emails sent</span><span className="text-slate-800 font-medium">{contact.emailsSentCount}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Calls made</span><span className="text-slate-800 font-medium">{contact.callsMadeCount}</span></div>
          {connectRate !== null && (
            <div className="flex justify-between"><span className="text-slate-500">Connect rate</span><span className="text-slate-800 font-medium">{connectRate}%</span></div>
          )}
          <div className="pt-2 mt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">Last contacted</p>
            <p className="text-sm text-slate-700">
              {contact.lastContactedAt ? `${formatDateTime(contact.lastContactedAt)} by ${contact.lastContactedByName ?? 'staff'}` : 'Never'}
            </p>
          </div>
        </div>
      </Card>

      {tasks && tasks.filter((t) => t.status === 'open').length > 0 && (
        <Card>
          <SectionHeader icon={ListTodo} title="Open Tasks" />
          <div className="space-y-2">
            {tasks.filter((t) => t.status === 'open').map((task) => (
              <div key={task._id} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => completeTask({ taskId: task._id })}
                  className="text-slate-300 hover:text-green-600 mt-0.5"
                  aria-label="Mark complete"
                >
                  <CheckSquare size={14} />
                </button>
                <div>
                  <p className="text-sm text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-400">Due {formatDateTime(task.dueAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
