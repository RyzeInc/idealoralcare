'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { Plus, Download } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, LoadMore, Modal, useToast, type DataTableColumn } from '@/components/admin/ui';
import { ContactFilterRail } from '@/components/admin/crm/ContactFilterRail';
import { SegmentBar } from '@/components/admin/crm/SegmentBar';
import { BulkActionBar } from '@/components/admin/crm/BulkActionBar';
import { InlineSelect, CopyButton } from '@/components/admin/crm/InlineCells';
import {
  CONTACT_STATUSES, CONTACT_STATUS_LABELS, CONTACT_STATUS_TONE,
  DRIP_STATUSES, DRIP_STATUS_LABELS, DRIP_STATUS_TONE, dripLabel,
  EMAIL_STATUSES, EMAIL_STATUS_LABELS, EMAIL_STATUS_TONE,
  NEXT_ACTIONS, NEXT_ACTION_LABELS,
} from '@/components/admin/crm/constants';
import { formatDate, formatDateTime } from '@/lib/admin-format';
import type { ContactListFilters } from '@/components/admin/crm/filterTypes';

const STATUS_OPTIONS = CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }));
const DRIP_OPTIONS = DRIP_STATUSES.map((s) => ({ value: s, label: DRIP_STATUS_LABELS[s] }));
const EMAIL_STATUS_OPTIONS = EMAIL_STATUSES.map((s) => ({ value: s, label: EMAIL_STATUS_LABELS[s] }));
const NEXT_ACTION_OPTIONS = NEXT_ACTIONS.map((a) => ({ value: a, label: NEXT_ACTION_LABELS[a] }));

function NewContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const createContact = useMutation(api.crm.contacts.createContact);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', mobilePhone: '', jobTitle: '', companyName: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) return;
    setSaving(true);
    try {
      const contactId = await createContact({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        mobilePhone: form.mobilePhone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        source: 'manual',
      });
      onClose();
      router.push(`/admin/crm/contacts/${contactId}`);
    } catch (err) {
      toast.fromError(err, 'Could not create contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Contact" size="max-w-md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        </div>
        <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Job title" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Company" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <input value={form.mobilePhone} onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })} placeholder="Mobile phone" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (!form.firstName.trim() && !form.lastName.trim())}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create Contact'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ContactsListPage() {
  const router = useRouter();
  const toast = useToast();
  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile, {});
  // Lazy-initialized so a segment handed off from /admin/crm/segments (via
  // sessionStorage — this admin console has no URL-param filter sync yet)
  // is picked up once, on mount, the same way DataTable seeds its persisted
  // column selection from localStorage.
  const [filters, setFilters] = useState<ContactListFilters>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem('crmPendingSegmentFilters');
      if (raw) {
        sessionStorage.removeItem('crmPendingSegmentFilters');
        return JSON.parse(raw);
      }
    } catch { /* ignore */ }
    return {};
  });
  const [selected, setSelected] = useState<Set<Id<'crmContacts'>>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportCsv = useAction(api.crm.segments.exportSegmentCsv);
  const setStatus = useMutation(api.crm.contacts.setStatus);
  const setDripProgress = useMutation(api.crm.contacts.setDripProgress);
  const setEmailStatus = useMutation(api.crm.contacts.setEmailStatus);
  const setNextAction = useMutation(api.crm.contacts.setNextAction);

  const { results, status, loadMore } = usePaginatedQuery(
    api.crm.contacts.listContacts,
    { filters },
    { initialNumItems: 50 },
  );
  const count = useQuery(api.crm.segments.countSegment, { filters });
  // Campaign names for the list column. A handful of rows, fetched once and
  // mapped client-side, rather than denormalizing the name onto every contact.
  const dripCampaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const campaignNames = new Map((dripCampaigns ?? []).map((c) => [c._id as string, c.name]));
  const filteredCampaignId = filters.dripCampaignIds?.[0];

  const toggleSelect = (id: Id<'crmContacts'>) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedContacts = results.filter((c) => selected.has(c._id));
  const allLoadedSelected = results.length > 0 && results.every((c) => selected.has(c._id));

  const columns: DataTableColumn<Doc<'crmContacts'>>[] = [
    {
      key: 'select', label: '', fixed: true,
      render: (c) => (
        <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} onClick={(e) => e.stopPropagation()} className="rounded border-slate-300" />
      ),
    },
    {
      key: 'name', label: 'Name', fixed: true, sortValue: (c) => c.fullName.toLowerCase(),
      render: (c) => (
        <div>
          <p className="font-medium text-slate-900">{c.fullName || '(No name)'}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-slate-500">{c.email ?? '—'}</p>
            {c.email && <CopyButton value={c.email} label={`Copy ${c.email}`} />}
          </div>
        </div>
      ),
    },
    { key: 'jobTitle', label: 'Title', sortValue: (c) => (c.jobTitle ?? '').toLowerCase(), render: (c) => <span className="text-slate-700">{c.jobTitle ?? '—'}</span> },
    { key: 'company', label: 'Company', sortValue: (c) => (c.companyName ?? '').toLowerCase(), render: (c) => <span className="text-slate-700">{c.companyName ?? '—'}</span> },
    {
      key: 'status', label: 'Status', sortValue: (c) => c.status,
      render: (c) => (
        <InlineSelect
          ariaLabel={`Status for ${c.fullName}`}
          value={c.status}
          options={STATUS_OPTIONS}
          tone={CONTACT_STATUS_TONE[c.status]}
          onChange={(next) => setStatus({ contactId: c._id, status: next as Doc<'crmContacts'>['status'] })}
        />
      ),
    },
    {
      key: 'nextAction', label: 'Next Action', sortValue: (c) => c.nextAction ?? '',
      render: (c) => (
        <InlineSelect
          ariaLabel={`Next action for ${c.fullName}`}
          value={c.nextAction}
          options={NEXT_ACTION_OPTIONS}
          emptyLabel="—"
          tone={c.nextAction ? 'info' : 'neutral'}
          onChange={(next) => setNextAction({
            contactId: c._id,
            nextAction: (next || undefined) as Doc<'crmContacts'>['nextAction'],
          })}
        />
      ),
    },
    {
      key: 'campaign', label: 'Campaign',
      sortValue: (c) => campaignNames.get(c.primaryDripCampaignId ?? '')?.toLowerCase() ?? '',
      render: (c) => {
        const name = c.primaryDripCampaignId ? campaignNames.get(c.primaryDripCampaignId) : undefined;
        if (!name) return <span className="text-slate-300">—</span>;
        const extra = Math.max(0, (c.dripCampaignIds ?? []).length - 1);
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
              {name}
            </span>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {c.dripStep ? `Phase ${c.dripStep}` : 'Not sent'}
            </span>
            {extra > 0 && (
              <span className="text-[10px] text-slate-400" title={`On ${extra + 1} campaigns`}>+{extra}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'drip', label: 'Drip', sortValue: (c) => c.dripStep ?? 0,
      // The select carries the state; the sentence next to it carries the
      // step, because "Email 3 Sent" is the thing a rep actually reads.
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <InlineSelect
            ariaLabel={`Drip progress for ${c.fullName}`}
            value={c.dripStatus ?? 'not_started'}
            options={DRIP_OPTIONS}
            tone={DRIP_STATUS_TONE[c.dripStatus ?? 'not_started']}
            onChange={(next) => setDripProgress({
              contactId: c._id,
              dripStatus: next as NonNullable<Doc<'crmContacts'>['dripStatus']>,
            })}
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">{dripLabel(c.dripStatus, c.dripStep)}</span>
        </div>
      ),
    },
    {
      key: 'emailStatus', label: 'Email Status', sortValue: (c) => c.emailStatus,
      render: (c) => (
        <InlineSelect
          ariaLabel={`Email status for ${c.fullName}`}
          value={c.emailStatus}
          options={EMAIL_STATUS_OPTIONS}
          tone={EMAIL_STATUS_TONE[c.emailStatus]}
          onChange={(next) => setEmailStatus({
            contactId: c._id,
            emailStatus: next as Doc<'crmContacts'>['emailStatus'],
          })}
        />
      ),
    },
    {
      key: 'lastEmailSent', label: 'Last Email', sortValue: (c) => c.lastEmailSentAt ?? 0,
      render: (c) => <span className="text-xs text-slate-500">{c.lastEmailSentAt ? formatDate(c.lastEmailSentAt) : '—'}</span>,
    },
    {
      key: 'nextEmail', label: 'Next Email', defaultOn: false, sortValue: (c) => c.nextEmailScheduledAt ?? 0,
      render: (c) => <span className="text-xs text-slate-500">{c.nextEmailScheduledAt ? formatDate(c.nextEmailScheduledAt) : '—'}</span>,
    },
    {
      key: 'replied', label: 'Replied', defaultOn: false, sortValue: (c) => (c.hasReplied ? 1 : 0),
      render: (c) => (
        <span className={`text-xs ${c.hasReplied ? 'text-green-700 font-medium' : 'text-slate-400'}`}>
          {c.hasReplied ? (c.repliedAt ? formatDate(c.repliedAt) : 'Yes') : 'No'}
        </span>
      ),
    },
    {
      key: 'lastOpened', label: 'Last Opened', defaultOn: false, sortValue: (c) => c.lastEmailOpenedAt ?? 0,
      render: (c) => <span className="text-xs text-slate-500">{c.lastEmailOpenedAt ? formatDate(c.lastEmailOpenedAt) : '—'}</span>,
    },
    {
      key: 'lastClicked', label: 'Last Clicked', defaultOn: false, sortValue: (c) => c.lastLinkClickedAt ?? 0,
      render: (c) => <span className="text-xs text-slate-500">{c.lastLinkClickedAt ? formatDate(c.lastLinkClickedAt) : '—'}</span>,
    },
    { key: 'lastContacted', label: 'Last Contacted', sortValue: (c) => c.lastContactedAt ?? 0, render: (c) => <span className="text-xs text-slate-500">{c.lastContactedAt ? formatDateTime(c.lastContactedAt) : 'Never'}</span> },
    {
      key: 'lastActivity', label: 'Last Activity', defaultOn: false, sortValue: (c) => c.lastActivityAt ?? 0,
      render: (c) => <span className="text-xs text-slate-500">{c.lastActivityAt ? formatDateTime(c.lastActivityAt) : '—'}</span>,
    },
    {
      key: 'dateAdded', label: 'Date Added', defaultOn: false, sortValue: (c) => c.createdAt,
      render: (c) => <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'source', label: 'Lead Source', defaultOn: false, sortValue: (c) => c.source,
      render: (c) => <span className="text-xs text-slate-500">{c.sourceDetail ? `${c.source} (${c.sourceDetail})` : c.source}</span>,
    },
    {
      key: 'notes', label: 'Notes', defaultOn: false, sortValue: (c) => (c.notes ?? '').toLowerCase(),
      // Read-only here, editable on the detail page: a full textarea in a
      // table cell fights the row-click target for very little gain.
      render: (c) => (
        <span className="text-xs text-slate-500 line-clamp-2 max-w-[16rem]" title={c.notes}>{c.notes ?? '—'}</span>
      ),
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCsv({ filters });
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (result.truncated) toast.info('Export capped', `Showing the first ${result.rowCount.toLocaleString()} rows — narrow your filters for a complete export.`);
    } catch (err) {
      toast.fromError(err, 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Contacts' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {count ? `${count.count.toLocaleString()}${count.truncated ? '+' : ''} matching` : '…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> New Contact
          </button>
        </div>
      </div>

      <SegmentBar filters={filters} onLoad={setFilters} />
      <ContactFilterRail filters={filters} onChange={setFilters} myClerkId={profile?.clerkUserId} />

      {results.length > 0 && (
        <button
          type="button"
          onClick={() => setSelected(allLoadedSelected ? new Set() : new Set(results.map((c) => c._id)))}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {allLoadedSelected ? 'Clear selection' : `Select all ${results.length} loaded`}
        </button>
      )}

      <BulkActionBar
        selected={selectedContacts}
        onClear={() => setSelected(new Set())}
        phaseCampaignId={filteredCampaignId}
      />

      <DataTable
        columns={columns}
        rows={results}
        getRowKey={(c) => c._id}
        // v2: the saved column set from v1 predates the outreach columns, and
        // a stale list would hide every one of them by default.
        storageKey="crmContactsVisibleColumns.v2"
        defaultSortKey="lastContacted"
        emptyMessage={status === 'LoadingFirstPage' ? 'Loading…' : 'No contacts match these filters.'}
        onRowClick={(c) => router.push(`/admin/crm/contacts/${c._id}`)}
      />
      <LoadMore status={status} loadMore={loadMore} pageSize={50} />

      <NewContactModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
