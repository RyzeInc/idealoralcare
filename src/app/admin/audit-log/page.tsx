'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, SkeletonTable } from '@/components/admin/ui';
import { formatDateTime, shortenId } from '@/lib/admin-format';
import { Activity, Filter, RefreshCw } from 'lucide-react';

/**
 * Admin Audit Log viewer.
 * Displays append-only adminAuditLog entries with optional filters.
 */
export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);

  const entriesRaw = useQuery(api.admin.adminAudit.listRecent, {
    limit,
    action: actionFilter || undefined,
    actorClerkUserId: actorFilter || undefined,
  });
  const entries = entriesRaw ?? [];
  const isLoading = entriesRaw === undefined;

  // Distinct actions for filter dropdown (built from current page of entries)
  const distinctActions = Array.from(new Set(entries.map((e: any) => e.action))).sort();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Audit Log' }]} />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity size={22} className="text-blue-600" />
            Admin Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Append-only record of admin-initiated actions across the platform.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All actions</option>
            {distinctActions.map((a: any) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Actor (Clerk User ID)
          </label>
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="user_..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div className="min-w-[120px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Limit
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </div>
        <button
          onClick={() => { setActionFilter(''); setActorFilter(''); }}
          className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <Filter size={14} /> Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {isLoading ? 'Loading…' : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Activity size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No audit entries found</p>
            <p className="text-slate-400 text-sm mt-1">Adjust your filters or wait for admin activity to be recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Target</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e: any) => (
                  <tr key={e._id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-slate-700 whitespace-nowrap">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">{e.actorName ?? '—'}</div>
                      <div className="text-xs text-slate-400">
                        {e.actorRole ?? '—'} · {shortenId(e.actorClerkUserId)}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {e.targetType ? (
                        <div>
                          <div className="text-xs text-slate-400">{e.targetType}</div>
                          <div className="font-mono text-xs">{e.targetId ? shortenId(e.targetId) : '—'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      <details>
                        <summary className="cursor-pointer">{e.summary}</summary>
                        {e.metadata && (
                          <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto max-w-xl">
                            {JSON.stringify(e.metadata, null, 2)}
                          </pre>
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
