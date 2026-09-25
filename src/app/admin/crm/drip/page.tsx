'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Plus } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, Modal, useToast, type DataTableColumn } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';

/**
 * DRIP CAMPAIGNS — the tracks themselves.
 *
 * A track here is the five-phase broker sequence; a "campaign" under
 * /admin/crm/campaigns is one blast within it. The distinction is the point:
 * a blast's recipient list is rebuilt from a filter every send, so only an
 * enrollment can answer "who is on this, and at which phase".
 */
function NewDripCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const createDripCampaign = useMutation(api.crm.dripCampaigns.createDripCampaign);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phaseCount, setPhaseCount] = useState('5');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await createDripCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
        phaseCount: Number(phaseCount) || 5,
      });
      onClose();
      router.push(`/admin/crm/drip/${id}`);
    } catch (err) {
      toast.fromError(err, 'Could not create the campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Drip Campaign" size="max-w-md">
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name (e.g. Broker Outreach 2026)"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this track is for (optional)"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />
        <div>
          <label className="text-xs text-slate-500">Number of phases</label>
          <input
            type="number"
            min={1}
            max={20}
            value={phaseCount}
            onChange={(e) => setPhaseCount(e.target.value)}
            className="w-24 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 block mt-1"
          />
          <p className="text-[11px] text-slate-400 mt-1">One per email in the sequence. The broker drip is 5.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function DripCampaignsPage() {
  const router = useRouter();
  const campaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const [showNew, setShowNew] = useState(false);

  const columns: DataTableColumn<Doc<'crmDripCampaigns'>>[] = [
    {
      key: 'name', label: 'Campaign', fixed: true, sortValue: (c) => c.name.toLowerCase(),
      render: (c) => (
        <div>
          <p className="font-medium text-slate-900">{c.name}</p>
          {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
        </div>
      ),
    },
    { key: 'phases', label: 'Phases', align: 'center', sortValue: (c) => c.phaseCount, render: (c) => <span className="text-slate-700">{c.phaseCount}</span> },
    { key: 'active', label: 'On it now', align: 'center', sortValue: (c) => c.activeCount, render: (c) => <span className="font-medium text-slate-900">{c.activeCount}</span> },
    { key: 'completed', label: 'Finished', align: 'center', sortValue: (c) => c.completedCount, render: (c) => <span className="text-slate-600">{c.completedCount}</span> },
    { key: 'created', label: 'Created', sortValue: (c) => c.createdAt, render: (c) => <span className="text-xs text-slate-500">{formatDateTime(c.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Drip Campaigns' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Drip Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Multi-phase outreach tracks. Enroll contacts, then move them through the phases as each email goes out.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> New Drip Campaign
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={campaigns ?? []}
        getRowKey={(c) => c._id}
        defaultSortKey="created"
        emptyMessage={campaigns === undefined ? 'Loading…' : 'No drip campaigns yet. Create one, then enroll contacts from the Contacts list.'}
        onRowClick={(c) => router.push(`/admin/crm/drip/${c._id}`)}
      />

      <NewDripCampaignModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
