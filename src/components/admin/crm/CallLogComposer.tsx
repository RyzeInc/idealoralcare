'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Drawer } from '@/components/admin/ui';
import { CALL_OUTCOMES } from './constants';

interface CallLogComposerProps {
  activityId: Id<'crmActivities'>;
  contactId: Id<'crmContacts'>;
  numberDialed: string;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const FOLLOW_UP_CHIPS = [
  { label: 'Tomorrow', days: 1 },
  { label: '+3d', days: 3 },
  { label: '+1w', days: 7 },
];

export function CallLogComposer({ activityId, contactId, numberDialed, onClose }: CallLogComposerProps) {
  const completeCall = useMutation(api.crm.activities.completeCall);
  const discardCall = useMutation(api.crm.activities.discardCall);
  const createTask = useMutation(api.crm.tasks.createTask);

  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      await completeCall({
        activityId,
        outcome: outcome as Parameters<typeof completeCall>[0]['outcome'],
        durationSeconds: seconds,
        notes: notes.trim() || undefined,
      });
      if (followUpDays !== null) {
        await createTask({
          contactId,
          title: 'Follow up call',
          taskType: 'call',
          dueAt: Date.now() + followUpDays * 24 * 60 * 60 * 1000,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    await discardCall({ activityId });
    onClose();
  };

  return (
    <Drawer
      open
      onClose={handleDiscard}
      title="Log Call"
      description={`Dialed ${numberDialed} · ${formatDuration(seconds)}`}
      preventClose={saving}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={handleDiscard} disabled={saving} className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50">
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!outcome || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Call'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Outcome</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CALL_OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left ${
                  outcome === o.value ? 'bg-blue-50 border-blue-400 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Notes</p>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="What did you talk about?"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
            <input
              type="checkbox"
              checked={followUpDays !== null}
              onChange={(e) => setFollowUpDays(e.target.checked ? 1 : null)}
              className="rounded border-slate-300"
            />
            Add follow-up task
          </label>
          {followUpDays !== null && (
            <div className="flex gap-1.5 pl-6">
              {FOLLOW_UP_CHIPS.map((chip) => (
                <button
                  key={chip.days}
                  type="button"
                  onClick={() => setFollowUpDays(chip.days)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${
                    followUpDays === chip.days ? 'bg-blue-50 border-blue-400 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
