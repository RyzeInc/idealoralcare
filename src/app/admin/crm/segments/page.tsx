'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Trash2, Users } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import type { ContactListFilters } from '@/components/admin/crm/filterTypes';

export default function SegmentsPage() {
  const router = useRouter();
  const toast = useToast();
  const segments = useQuery(api.crm.segments.listSegments, {});
  const deleteSegment = useMutation(api.crm.segments.deleteSegment);

  const handleUse = (filters: ContactListFilters) => {
    // Saved segments aren't URL-addressable (no query-param filter sync in
    // this admin console yet) — hand off via sessionStorage rather than
    // adding a bespoke serialization scheme just for this one flow.
    sessionStorage.setItem('crmPendingSegmentFilters', JSON.stringify(filters));
    router.push('/admin/crm/contacts?fromSegment=1');
  };

  const handleDelete = async (segmentId: Parameters<typeof deleteSegment>[0]['segmentId']) => {
    try {
      await deleteSegment({ segmentId });
      toast.success('Segment deleted');
    } catch (err) {
      toast.fromError(err, 'Could not delete segment');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Segments' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Segments</h1>
        <p className="text-sm text-slate-500 mt-0.5">Saved filter sets — build one from the contacts list, or reuse one when building a campaign.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {(segments ?? []).map((s) => (
          <div key={s._id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{s.name}</p>
              {s.description && <p className="text-xs text-slate-500">{s.description}</p>}
              <p className="text-xs text-slate-400">{s.isShared ? 'Shared with team' : 'Private'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleUse(s.filters as ContactListFilters)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                <Users size={12} /> Use
              </button>
              <button type="button" onClick={() => handleDelete(s._id)} className="text-slate-300 hover:text-red-600" aria-label="Delete segment">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {(segments ?? []).length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">No saved segments yet — build a filter on the contacts list and save it.</div>
        )}
      </div>
    </div>
  );
}
