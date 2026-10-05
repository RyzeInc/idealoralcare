'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SkeletonText, useToast } from '@/components/admin/ui';
import { errorText, primaryCls } from './shared';

const LABELS = {
  staff: 'Staff (admin users)',
  leaders: 'Partner people and reps who have signed in',
  contacts: 'Partner contacts who have signed in',
  grants: 'Organization upload contacts',
} as const;

export function ImportTab() {
  const status = useQuery(api.access.sync.syncStatus);
  const importBatch = useMutation(api.access.sync.importBatch);
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ imported: number; skipped: number } | null>(null);

  const run = async () => {
    setRunning(true);
    const totals = { imported: 0, skipped: 0 };
    setProgress(totals);
    try {
      let step: { source: 'staff' | 'leaders' | 'contacts' | 'grants' | null; cursor: string | null; done: boolean } = { source: 'staff', cursor: null, done: false };
      while (!step.done && step.source) {
        const result = await importBatch({ source: step.source, cursor: step.cursor });
        totals.imported += result.imported;
        totals.skipped += result.skipped;
        setProgress({ ...totals });
        step = result;
      }
      toast.success('Existing accounts imported', `${totals.imported} records checked${totals.skipped ? `, ${totals.skipped} skipped (no email)` : ''}.`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setRunning(false);
    }
  };

  if (status === undefined) return <SkeletonText lines={4} />;
  const waiting = Object.values(status.notImported).reduce((a, b) => a + b, 0);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          Import turns the access people already have into people, roles and packs here, so you can review and narrow it. Nobody&apos;s access changes on import:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Owners get the Owner pack.</li>
          <li>Editors get &quot;Staff — legacy full console&quot; (plus CRM manager for the executive department). Replace it with narrower packs when you&apos;re ready.</li>
          <li>Partners and reps get &quot;Partner — legacy portal&quot;.</li>
          <li>Organization upload contacts get &quot;Organization — eligibility uploads&quot;.</li>
        </ul>
        <p className="mt-2">Safe to run again; already-imported people are skipped.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">Not imported yet</div>
        <ul className="divide-y divide-slate-100 text-sm">
          {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => (
            <li key={key} className="flex justify-between px-4 py-2">
              <span className="text-slate-700">{LABELS[key]}</span>
              <span className={status.notImported[key] ? 'font-semibold text-amber-700' : 'text-slate-400'}>{status.notImported[key]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3">
        <button className={primaryCls} disabled={running || waiting === 0} onClick={run}>
          {running ? 'Importing…' : waiting ? 'Import existing accounts' : 'Everyone is imported'}
        </button>
        {progress && <span className="text-sm text-slate-600">{progress.imported} imported{progress.skipped ? `, ${progress.skipped} skipped` : ''}</span>}
      </div>
    </div>
  );
}
