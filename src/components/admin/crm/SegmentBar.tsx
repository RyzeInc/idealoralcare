'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Bookmark, Plus } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Modal, useToast } from '@/components/admin/ui';
import type { ContactListFilters } from './filterTypes';

export function SegmentBar({ filters, onLoad }: {
  filters: ContactListFilters;
  onLoad: (filters: ContactListFilters) => void;
}) {
  const toast = useToast();
  const segments = useQuery(api.crm.segments.listSegments, {});
  const saveSegment = useMutation(api.crm.segments.saveSegment);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState('');
  const [isShared, setIsShared] = useState(true);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await saveSegment({ name: name.trim(), filters, isShared });
      toast.success('Segment saved');
      setShowSave(false);
      setName('');
    } catch (err) {
      toast.fromError(err, 'Could not save segment');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(segments ?? []).map((s) => (
        <button
          key={s._id}
          type="button"
          onClick={() => onLoad(s.filters as ContactListFilters)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full"
        >
          <Bookmark size={11} /> {s.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setShowSave(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1"
      >
        <Plus size={11} /> Save as segment
      </button>

      <Modal open={showSave} onClose={() => setShowSave(false)} title="Save Segment" size="max-w-md">
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Texas HR Directors"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded border-slate-300" />
            Share with the whole team
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowSave(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
