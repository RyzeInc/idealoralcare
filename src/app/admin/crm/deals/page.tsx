'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Breadcrumbs, Modal, useToast } from '@/components/admin/ui';
import { formatCurrency } from '@/lib/admin-format';
import { PipelineBoard } from '@/components/admin/crm/PipelineBoard';
import { CompanyPicker } from '@/components/admin/crm/CompanyPicker';

function NewDealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const createDeal = useMutation(api.crm.deals.createDeal);
  const [company, setCompany] = useState<Doc<'crmCompanies'> | null>(null);
  const [name, setName] = useState('');
  const [mrr, setMrr] = useState('');
  const [lives, setLives] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const id = await createDeal({
        companyId: company._id,
        name: name.trim() || undefined,
        mrrCents: mrr ? Math.round(Number(mrr) * 100) : undefined,
        estimatedLives: lives ? Number(lives) : undefined,
      });
      onClose();
      setCompany(null);
      setName('');
      setMrr('');
      setLives('');
      router.push(`/admin/crm/deals/${id}`);
    } catch (err) {
      toast.fromError(err, 'Could not create deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Deal" size="max-w-md">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Company</p>
          <CompanyPicker value={company} onSelect={setCompany} />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={company ? `${company.name} — benefits` : 'Deal name (optional)'}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Monthly value ($)</p>
            <input
              type="number"
              value={mrr}
              onChange={(e) => setMrr(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Est. lives</p>
            <input
              type="number"
              value={lives}
              onChange={(e) => setLives(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !company}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ForecastBar() {
  const summary = useQuery(api.crm.analytics.dealPipelineSummary, {});
  if (!summary) return null;

  const open = summary.stages.filter((s) => !s.isWon && !s.isLost);
  const openGross = open.reduce((sum, s) => sum + s.grossCents, 0);
  const openWeighted = open.reduce((sum, s) => sum + s.weightedCents, 0);
  const openCount = open.reduce((sum, s) => sum + s.count, 0);
  const openLives = open.reduce((sum, s) => sum + s.lives, 0);

  const tiles = [
    { label: 'Open deals', value: String(openCount) },
    { label: 'Pipeline value', value: openGross > 0 ? formatCurrency(openGross / 100) : '—' },
    { label: 'Weighted forecast', value: openWeighted > 0 ? formatCurrency(openWeighted / 100) : '—' },
    { label: 'Covered lives', value: openLives > 0 ? openLives.toLocaleString() : '—' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">{tile.label}</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

function DealListView() {
  const router = useRouter();
  const summary = useQuery(api.crm.analytics.dealPipelineSummary, {});
  if (!summary) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-xs text-slate-500">
            <th className="px-4 py-2 font-medium">Stage</th>
            <th className="px-4 py-2 font-medium text-center">Deals</th>
            <th className="px-4 py-2 font-medium text-right">Value</th>
            <th className="px-4 py-2 font-medium text-right">Weighted</th>
            <th className="px-4 py-2 font-medium text-right">Lives</th>
            <th className="px-4 py-2 font-medium text-center">Default win %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summary.stages.map((stage) => (
            <tr
              key={stage.stageId}
              className="hover:bg-slate-50 cursor-pointer"
              onClick={() => router.push(`/admin/crm/deals?stage=${stage.stageId}`)}
            >
              <td className="px-4 py-2.5 font-medium text-slate-900">{stage.name}</td>
              <td className="px-4 py-2.5 text-center tabular-nums text-slate-700">{stage.count}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                {stage.grossCents > 0 ? formatCurrency(stage.grossCents / 100) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                {stage.weightedCents > 0 ? formatCurrency(stage.weightedCents / 100) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{stage.lives || '—'}</td>
              <td className="px-4 py-2.5 text-center text-slate-500">{stage.probability}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DealsPage() {
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Pipeline' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setView('board')}
              className={`px-2.5 py-1.5 text-sm ${view === 'board' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              aria-label="Board view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-2.5 py-1.5 text-sm border-l border-slate-300 ${view === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              aria-label="Summary view"
            >
              <List size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> New Deal
          </button>
        </div>
      </div>

      <ForecastBar />

      {view === 'board' ? <PipelineBoard /> : <DealListView />}

      <NewDealModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
