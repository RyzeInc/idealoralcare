'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { Plus, Search } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, LoadMore, Modal, useToast, type DataTableColumn } from '@/components/admin/ui';
import { STAGE_LABELS } from '@/components/admin/crm/constants';

function NewCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const createCompany = useMutation(api.crm.companies.createCompany);
  const [name, setName] = useState('');
  const [companyType, setCompanyType] = useState<Doc<'crmCompanies'>['companyType']>('employer');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await createCompany({ name: name.trim(), companyType });
      onClose();
      router.push(`/admin/crm/companies/${id}`);
    } catch (err) {
      toast.fromError(err, 'Could not create company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Company" size="max-w-md">
      <div className="space-y-3">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <select value={companyType} onChange={(e) => setCompanyType(e.target.value as typeof companyType)} className="text-sm border border-slate-300 rounded-lg px-2 py-2">
          <option value="employer">Employer</option>
          <option value="broker">Broker</option>
          <option value="agency">Agency</option>
          <option value="fmo">FMO</option>
          <option value="association">Association</option>
          <option value="vendor">Vendor</option>
          <option value="other">Other</option>
        </select>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !name.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create Company'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function CompaniesListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.crm.companies.listCompanies,
    { searchTerm: search || undefined },
    { initialNumItems: 50 },
  );

  const columns: DataTableColumn<Doc<'crmCompanies'>>[] = [
    { key: 'name', label: 'Company', fixed: true, sortValue: (c) => c.name.toLowerCase(), render: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
    { key: 'type', label: 'Type', sortValue: (c) => c.companyType, render: (c) => <span className="text-slate-700 capitalize">{c.companyType}</span> },
    { key: 'stage', label: 'Stage', sortValue: (c) => c.stage, render: (c) => <span className="text-slate-700">{STAGE_LABELS[c.stage]}</span> },
    { key: 'location', label: 'Location', sortValue: (c) => (c.state ?? ''), render: (c) => <span className="text-slate-700">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'lives', label: 'Est. Lives', align: 'center', sortValue: (c) => c.estimatedLives ?? 0, render: (c) => <span className="text-slate-700">{c.estimatedLives ?? '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Companies' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
        <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Company
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-400"
        />
      </div>

      <DataTable
        columns={columns}
        rows={results}
        getRowKey={(c) => c._id}
        storageKey="crmCompaniesVisibleColumns.v1"
        emptyMessage={status === 'LoadingFirstPage' ? 'Loading…' : 'No companies yet.'}
        onRowClick={(c) => router.push(`/admin/crm/companies/${c._id}`)}
      />
      <LoadMore status={status} loadMore={loadMore} pageSize={50} />

      <NewCompanyModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
