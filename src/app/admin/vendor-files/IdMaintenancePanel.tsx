'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Table2, Lock } from 'lucide-react';
import { useToast } from '@/components/admin/ui';

export default function IdMaintenancePanel() {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [running, setRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    assigned: number;
    changes: Array<{ memberId: string; name: string; assignedId: string; action: string }>;
  } | null>(null);

  const report = useQuery((api as any).admin.idMaintenance.getMemberIdHealthReport);
  const problems = useQuery((api as any).admin.idMaintenance.getMembersNeedingIdBackfill);
  const roster = useQuery(
    (api as any).admin.idMaintenance.getAllMembersWithResolvedIds,
    showRoster ? {} : 'skip'
  );
  const backfill = useMutation((api as any).admin.idMaintenance.backfillCareingtonUniqueIds);

  const handleDryRun = async () => {
    setRunning(true);
    try {
      const result = await backfill({ problematicOnly: true, dryRun: true });
      setDryRunResult(result);
    } catch (err: any) {
      toast.error('Dry run failed', err?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const handleBackfill = async () => {
    if (!confirm(
      `This will assign new numeric Careington Unique IDs to ${report?.problematicDerived ?? 0} member(s).\n\n` +
      `The same IDs will be written to future eligibility files and shown on member ID cards.\n\nProceed?`
    )) return;
    setRunning(true);
    try {
      const result = await backfill({ problematicOnly: true, dryRun: false });
      setDryRunResult(null);
      toast.success('Backfill complete', `${result.assigned} member(s) assigned new Careington Unique IDs.`);
    } catch (err: any) {
      toast.error('Backfill failed', err?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  // Lock-in: finalize ALL fallback members by storing their derived ID (or a new one if collision)
  const handleLockInAll = async () => {
    const count = report?.needsLockIn ?? 0;
    const collisions = report?.collisionCount ?? 0;
    const msg = collisions > 0
      ? `This will finalize IDs for ${count} fallback member(s).\n\n` +
        `⚠ ${collisions} member(s) have a shared derived ID (collision) — they will receive new unique sequential IDs.\n` +
        `The remaining ${count - collisions} member(s) will have their current displayed ID stored as-is (no visible change).\n\nProceed?`
      : `This will permanently store the current displayed ID for ${count} fallback member(s).\n\n` +
        `No IDs will change — this just locks them in so they can never drift.\n\nProceed?`;
    if (!confirm(msg)) return;
    setRunning(true);
    try {
      const result = await backfill({ problematicOnly: false, dryRun: false });
      setDryRunResult(null);
      toast.success('Lock-in complete', `${result.assigned} member ID(s) finalized.`);
    } catch (err: any) {
      toast.error('Lock-in failed', err?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const handleLockInPreview = async () => {
    setRunning(true);
    try {
      const result = await backfill({ problematicOnly: false, dryRun: true });
      setDryRunResult(result);
    } catch (err: any) {
      toast.error('Preview failed', err?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  if (!report) return null;

  const isFullyFinalized = report.finalizedCount === report.total;
  const hasProblems = report.problematicDerived > 0;
  const hasCollisions = report.collisionCount > 0;
  const hasFallbacks = report.needsLockIn > 0;
  const needsAttention = hasProblems || hasCollisions;

  return (
    <div className={`rounded-lg border ${needsAttention ? 'border-amber-200 bg-amber-50' : hasFallbacks ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {needsAttention
            ? <AlertTriangle size={20} className="text-amber-500 shrink-0" />
            : hasFallbacks
            ? <Lock size={20} className="text-blue-500 shrink-0" />
            : <ShieldCheck size={20} className="text-green-600 shrink-0" />}
          <div>
            <p className={`font-semibold text-sm ${needsAttention ? 'text-amber-800' : hasFallbacks ? 'text-blue-800' : 'text-green-800'}`}>
              Careington ID Health
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${needsAttention ? 'bg-amber-200 text-amber-900' : hasFallbacks ? 'bg-blue-200 text-blue-900' : 'bg-green-200 text-green-900'}`}>
                {report.finalizedCount}/{report.total} finalized
              </span>
            </p>
            <p className={`text-xs mt-0.5 ${needsAttention ? 'text-amber-600' : hasFallbacks ? 'text-blue-600' : 'text-green-600'}`}>
              {isFullyFinalized
                ? `All ${report.total} members have a locked-in Careington Unique ID`
                : hasCollisions
                ? `${report.collisionCount} members share a duplicate ID — run Lock In to resolve`
                : hasFallbacks
                ? `${report.needsLockIn} members use a derived fallback ID — click to permanently lock them in`
                : `${report.problematicDerived} members need a Careington ID assigned`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-inherit px-5 py-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: report.total, color: 'text-slate-700', hint: 'Active/eligible/enrolling members' },
              { label: 'Finalized', value: report.finalizedCount, color: 'text-green-700',
                hint: 'careingtonUniqueId explicitly stored — these are locked in and will never drift' },
              { label: 'Fallback (not locked)', value: report.needsLockIn, color: report.needsLockIn > 0 ? 'text-blue-700' : 'text-slate-400',
                hint: 'ID is derived from memberId on the fly — valid now but not stored, can drift if memberId changes' },
              { label: 'Collisions', value: report.collisionCount, color: report.collisionCount > 0 ? 'text-red-600 font-bold' : 'text-slate-400',
                hint: 'Two or more members whose memberId derives to the same number — must be resolved' },
              { label: 'Need New ID', value: report.problematicDerived, color: report.problematicDerived > 0 ? 'text-red-600 font-bold' : 'text-slate-400',
                hint: 'memberId strips down to a number that is too short to be unique' },
            ].map(({ label, value, color, hint }) => (
              <div key={label} className="bg-white rounded-md border border-slate-200 px-3 py-2.5" title={hint}>
                <p className="text-xs text-slate-500 truncate">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Collision warning */}
          {hasCollisions && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <span className="font-bold">⚠ ID Collision detected:</span>{' '}
              {report.collisionCount} members share a duplicate derived Careington ID. They cannot both appear correctly in the eligibility file. Run <strong>Lock In All</strong> to automatically assign unique IDs to the conflicting members.
            </div>
          )}

          {/* Roster toggle */}
          <button
            onClick={() => setShowRoster((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            <Table2 size={13} />
            {showRoster ? 'Hide' : 'Show'} full ID roster
          </button>

          {/* Roster table */}
          {showRoster && (
            <div>
              {!roster ? (
                <p className="text-xs text-slate-400 italic">Loading…</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[0.65rem] tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Internal memberId</th>
                        <th className="px-3 py-2 text-left">Stored careingtonUniqueId</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-700">Resolved ID (card + file)</th>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-left">Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {roster.map((m: any) => {
                        // Highlight collision rows (fallback members sharing a resolved ID)
                        const rosterResolved = roster.filter((r: any) => r.idSource !== 'explicit' && r.resolvedId === m.resolvedId);
                        const isCollision = m.idSource === 'fallback' && rosterResolved.length > 1;
                        return (
                          <tr key={m._id} className={m.idSource === 'problematic' ? 'bg-red-50' : isCollision ? 'bg-orange-50' : ''}>
                            <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{m.firstName} {m.lastName}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{m.memberId}</td>
                            <td className="px-3 py-2 font-mono">
                              {m.careingtonUniqueId
                                ? <span className="text-green-700">{m.careingtonUniqueId}</span>
                                : <span className="text-slate-300 italic">not set</span>}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">
                              {m.resolvedId || <span className="text-red-500 italic">empty!</span>}
                              {isCollision && <span className="ml-1 text-orange-500 text-[0.6rem] font-sans">duplicate</span>}
                            </td>
                            <td className="px-3 py-2">
                              {m.idSource === 'explicit' && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">locked in</span>}
                              {m.idSource === 'fallback' && !isCollision && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">fallback</span>}
                              {m.idSource === 'fallback' && isCollision && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">⚠ collision</span>}
                              {m.idSource === 'problematic' && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">⚠ needs fix</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{m.groupCode ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Problem members table */}
          {problems && problems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Members requiring a new ID</p>
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[0.65rem] tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Internal Member ID</th>
                      <th className="px-3 py-2 text-left">Would Derive</th>
                      <th className="px-3 py-2 text-left">Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {problems.map((m: any) => (
                      <tr key={m._id}>
                        <td className="px-3 py-2 font-medium text-slate-800">{m.firstName} {m.lastName}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{m.memberId}</td>
                        <td className="px-3 py-2 font-mono text-red-600">
                          {m.derivedId || <span className="text-slate-400 italic">empty</span>}
                          <span className="ml-1 text-red-400 text-[0.6rem]">(too short)</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{m.groupName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dry-run results */}
          {dryRunResult && dryRunResult.changes.length > 0 && (
            <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-700 mb-1.5">
                Preview — {dryRunResult.assigned} change(s):
              </p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {dryRunResult.changes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-800 font-mono">
                    <span className={`font-sans text-[0.6rem] px-1 rounded ${
                      c.action === 'locked-in' ? 'bg-blue-100 text-blue-600' :
                      c.action === 'collision-resolved' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-600'
                    }`}>{c.action}</span>
                    <span className="text-blue-400">{c.memberId}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold">{c.assignedId}</span>
                    <span className="font-sans text-slate-500 ml-1">({c.name})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {hasProblems && (
              <>
                <button onClick={handleDryRun} disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50">
                  <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
                  Preview New IDs
                </button>
                <button onClick={handleBackfill} disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                  <CheckCircle size={12} />
                  Fix {report.problematicDerived} Problematic Member(s)
                </button>
              </>
            )}
            {hasFallbacks && (
              <>
                <button onClick={handleLockInPreview} disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50">
                  <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
                  Preview Lock-In
                </button>
                <button onClick={handleLockInAll} disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  <Lock size={12} />
                  Lock In All {report.needsLockIn} Fallback IDs
                </button>
              </>
            )}
          </div>

          {isFullyFinalized && (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle size={13} className="text-green-500" />
              All {report.total} member IDs are finalized and consistent between eligibility files and member cards.
            </div>
          )}

          <p className="text-[0.65rem] text-slate-400 leading-relaxed">
            <strong>Finalized</strong> = careingtonUniqueId explicitly stored on the profile (locked, never drifts).{' '}
            <strong>Fallback</strong> = derived from memberId on the fly — valid now but not stored.{' '}
            <strong>Lock In</strong> stores each member&apos;s current displayed ID permanently. Collision members are assigned a new sequential ID.
          </p>
        </div>
      )}
    </div>
  );
}
