'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ArrowRight, Archive, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, StatusBadge, useToast, type DataTableColumn } from '@/components/admin/ui';
import { CopyButton, InlineSelect } from '@/components/admin/crm/InlineCells';
import { DripPhasePanel } from '@/components/admin/crm/DripPhasePanel';
import { formatDate, formatDateTime } from '@/lib/admin-format';

type MemberRow = { enrollment: Doc<'crmDripEnrollments'>; contact: Doc<'crmContacts'> };

const ENROLLMENT_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending'> = {
  active: 'info',
  completed: 'success',
  paused: 'warning',
  replied: 'pending',
  removed: 'neutral',
};

const ENROLLMENT_STATUSES = ['active', 'paused', 'completed', 'replied'] as const;

export default function DripCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dripCampaignId = id as Id<'crmDripCampaigns'>;
  const router = useRouter();
  const toast = useToast();

  const campaign = useQuery(api.crm.dripCampaigns.getDripCampaign, { dripCampaignId });
  const breakdown = useQuery(api.crm.dripCampaigns.phaseBreakdown, { dripCampaignId });
  const allCampaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const [phaseFilter, setPhaseFilter] = useState<number | undefined>(undefined);
  const members = useQuery(api.crm.dripCampaigns.listMembers, { dripCampaignId, phase: phaseFilter });

  const setPhase = useMutation(api.crm.dripCampaigns.setPhase);
  const advancePhase = useMutation(api.crm.dripCampaigns.advancePhase);
  const removeFromCampaign = useMutation(api.crm.dripCampaigns.removeFromCampaign);
  const setEnrollmentStatus = useMutation(api.crm.dripCampaigns.setEnrollmentStatus);
  const moveToCampaign = useMutation(api.crm.dripCampaigns.moveToCampaign);
  const archiveDripCampaign = useMutation(api.crm.dripCampaigns.archiveDripCampaign);

  const [selected, setSelected] = useState<Set<Id<'crmContacts'>>>(new Set());

  if (campaign === undefined) return <div className="py-16 text-center text-slate-400">Loading…</div>;
  if (campaign === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Drip campaign not found.</p>
        <Link href="/admin/crm/drip" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to drip campaigns</Link>
      </div>
    );
  }

  const rows: MemberRow[] = (members ?? []).filter((m) => m.enrollment.status !== 'removed');
  const selectedIds = Array.from(selected);
  const phaseLabel = (phase: number) =>
    phase === 0 ? 'Not sent yet' : (campaign.phaseLabels?.[phase - 1] ?? `Phase ${phase}`);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      setSelected(new Set());
    } catch (err) {
      toast.fromError(err, 'Could not update those contacts');
    }
  };

  const columns: DataTableColumn<MemberRow>[] = [
    {
      key: 'select', label: '', fixed: true,
      render: ({ contact }) => (
        <input
          type="checkbox"
          checked={selected.has(contact._id)}
          onChange={() => setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(contact._id)) next.delete(contact._id); else next.add(contact._id);
            return next;
          })}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-slate-300"
        />
      ),
    },
    {
      key: 'name', label: 'Contact', fixed: true, sortValue: ({ contact }) => contact.fullName.toLowerCase(),
      render: ({ contact }) => (
        <div>
          <p className="font-medium text-slate-900">{contact.fullName || '(No name)'}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-slate-500">{contact.email ?? '—'}</p>
            {contact.email && <CopyButton value={contact.email} label={`Copy ${contact.email}`} />}
          </div>
        </div>
      ),
    },
    { key: 'company', label: 'Company', sortValue: ({ contact }) => (contact.companyName ?? '').toLowerCase(), render: ({ contact }) => <span className="text-slate-700">{contact.companyName ?? '—'}</span> },
    {
      key: 'phase', label: 'Phase', sortValue: ({ enrollment }) => enrollment.phase,
      render: ({ enrollment, contact }) => (
        <InlineSelect
          ariaLabel={`Phase for ${contact.fullName}`}
          value={String(enrollment.phase)}
          options={Array.from({ length: campaign.phaseCount + 1 }, (_, phase) => ({
            value: String(phase),
            label: phaseLabel(phase),
          }))}
          tone={enrollment.phase === 0 ? 'neutral' : enrollment.phase >= campaign.phaseCount ? 'success' : 'info'}
          onChange={(next) => setPhase({ contactIds: [contact._id], dripCampaignId, phase: Number(next) })}
        />
      ),
    },
    {
      key: 'status', label: 'Status', sortValue: ({ enrollment }) => enrollment.status,
      render: ({ enrollment, contact }) => (
        <InlineSelect
          ariaLabel={`Enrollment status for ${contact.fullName}`}
          value={enrollment.status}
          options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          tone={ENROLLMENT_TONE[enrollment.status]}
          onChange={(next) => setEnrollmentStatus({
            contactIds: [contact._id],
            dripCampaignId,
            status: next as Doc<'crmDripEnrollments'>['status'],
          })}
        />
      ),
    },
    {
      key: 'lastSent', label: 'Last phase sent', sortValue: ({ enrollment }) => enrollment.lastPhaseSentAt ?? 0,
      render: ({ enrollment }) => <span className="text-xs text-slate-500">{enrollment.lastPhaseSentAt ? formatDate(enrollment.lastPhaseSentAt) : '—'}</span>,
    },
    {
      key: 'nextSend', label: 'Next send', sortValue: ({ enrollment }) => enrollment.nextPhaseDueAt ?? Number.MAX_SAFE_INTEGER,
      render: ({ enrollment }) => (
        <span className="text-xs text-slate-500">
          {enrollment.nextPhaseDueAt ? formatDateTime(enrollment.nextPhaseDueAt) : '—'}
        </span>
      ),
    },
    {
      key: 'sendError', label: 'Last error', defaultOn: false, sortValue: ({ enrollment }) => enrollment.lastSendError ?? '',
      render: ({ enrollment }) => (
        <span className="text-xs text-red-600" title={enrollment.lastSendError}>{enrollment.lastSendError ?? '—'}</span>
      ),
    },
    {
      key: 'enrolled', label: 'Added', sortValue: ({ enrollment }) => enrollment.enrolledAt,
      render: ({ enrollment }) => <span className="text-xs text-slate-500">{formatDate(enrollment.enrolledAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Drip Campaigns', href: '/admin/crm/drip' }, { label: campaign.name }]} />
      <Link href="/admin/crm/drip" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft size={12} /> Back to drip campaigns
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
            {campaign.isArchived && <StatusBadge status="archived" tone="neutral" />}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {campaign.description ?? `${campaign.phaseCount}-phase sequence`}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await archiveDripCampaign({ dripCampaignId, archived: !campaign.isArchived });
            toast.success(campaign.isArchived ? 'Campaign restored' : 'Campaign archived');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <Archive size={14} /> {campaign.isArchived ? 'Restore' : 'Archive'}
        </button>
      </div>

      {/* Where everyone is. Clicking a phase filters the table to it — the
          fastest path to "select everyone who got email 2 and move them on". */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phase breakdown</h2>
          {phaseFilter !== undefined && (
            <button type="button" onClick={() => setPhaseFilter(undefined)} className="text-xs text-blue-600 hover:text-blue-800">
              Clear phase filter
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(breakdown?.phases ?? []).map(({ phase, label, count }) => (
            <button
              key={phase}
              type="button"
              onClick={() => setPhaseFilter(phaseFilter === phase ? undefined : phase)}
              className={`px-3 py-2 rounded-lg border text-left min-w-[7rem] ${
                phaseFilter === phase ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="text-lg font-semibold text-slate-900">{count}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </button>
          ))}
        </div>
        {breakdown && (
          <p className="text-xs text-slate-400 mt-3">
            {breakdown.byStatus.active} active · {breakdown.byStatus.paused} paused · {breakdown.byStatus.completed} finished · {breakdown.byStatus.replied} replied
            {breakdown.removed > 0 && ` · ${breakdown.removed} removed`}
          </p>
        )}
      </div>

      <DripPhasePanel campaign={campaign} />

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex-wrap">
          <span className="text-sm font-medium text-blue-800">{selectedIds.length} selected</span>

          <button
            type="button"
            onClick={() => run(`Advanced ${selectedIds.length} contact(s) a phase`, () => advancePhase({ contactIds: selectedIds, dripCampaignId }))}
            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
          >
            <ArrowRight size={13} /> Advance one phase
          </button>

          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const phase = Number(e.target.value);
              void run(`Moved ${selectedIds.length} contact(s) to ${phaseLabel(phase)}`, () => setPhase({ contactIds: selectedIds, dripCampaignId, phase }));
            }}
            className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white text-blue-800"
          >
            <option value="">Set phase…</option>
            {Array.from({ length: campaign.phaseCount + 1 }, (_, phase) => (
              <option key={phase} value={phase}>{phaseLabel(phase)}</option>
            ))}
          </select>

          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const status = e.target.value as Doc<'crmDripEnrollments'>['status'];
              void run(`Updated ${selectedIds.length} enrollment(s)`, () => setEnrollmentStatus({ contactIds: selectedIds, dripCampaignId, status }));
            }}
            className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white text-blue-800"
          >
            <option value="">Set status…</option>
            {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const to = e.target.value as Id<'crmDripCampaigns'>;
              void run(`Moved ${selectedIds.length} contact(s) to another campaign`, () =>
                moveToCampaign({ contactIds: selectedIds, fromDripCampaignId: dripCampaignId, toDripCampaignId: to }));
            }}
            className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white text-blue-800"
          >
            <option value="">Move to campaign…</option>
            {(allCampaigns ?? []).filter((c) => c._id !== dripCampaignId).map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => run(`Removed ${selectedIds.length} contact(s)`, () => removeFromCampaign({ contactIds: selectedIds, dripCampaignId }))}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Remove from campaign
          </button>

          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-blue-500 hover:text-blue-800" aria-label="Clear selection">
            <X size={16} />
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <button
          type="button"
          onClick={() => setSelected(selectedIds.length === rows.length ? new Set() : new Set(rows.map((r) => r.contact._id)))}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {selectedIds.length === rows.length ? 'Clear selection' : `Select all ${rows.length} shown`}
        </button>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={({ contact }) => contact._id}
        storageKey="crmDripMembersColumns.v1"
        defaultSortKey="phase"
        emptyMessage={
          members === undefined
            ? 'Loading…'
            : 'Nobody is on this campaign yet. Add contacts from the Contacts list using "Add to campaign".'
        }
        onRowClick={({ contact }) => router.push(`/admin/crm/contacts/${contact._id}`)}
      />
    </div>
  );
}
