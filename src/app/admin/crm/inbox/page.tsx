'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Inbox as InboxIcon, Check, ShieldAlert } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, useToast } from '@/components/admin/ui';

type Source =
  | 'nexusLeads'
  | 'partnerRegistrations'
  | 'inquiries'
  | 'repOnboardingSubmissions'
  | 'partnerKitSubmissions';

const SOURCE_TABS: { key: Source; label: string; hint: string }[] = [
  { key: 'nexusLeads', label: 'Ideal Leads', hint: 'Marketing-site gated-content leads' },
  { key: 'partnerRegistrations', label: 'Partner Kit Leads', hint: 'Agencies that registered for the partner kit' },
  { key: 'inquiries', label: 'Inquiries', hint: 'Partnership & investment inquiries only — careers excluded' },
  {
    key: 'repOnboardingSubmissions',
    label: 'Rep Applications',
    hint: 'Approved & in-review rep/agency applications. Two people per application — pick which one to adopt. Only name, email, phone and agency name are copied.',
  },
  {
    key: 'partnerKitSubmissions',
    label: 'Signed Partner Kits',
    hint: 'Agencies that have already SIGNED a partner agreement — imported tagged “Broker Partner”, not as prospects, so they do not distort funnel metrics.',
  },
];

/** The two onboarding sources need a slot picker; the rest are one person per row. */
const SLOTTED_SOURCES: Source[] = ['repOnboardingSubmissions'];

/** Sources whose rows carry compliance data the CRM deliberately does not copy. */
const RESTRICTED_SOURCES: Source[] = ['repOnboardingSubmissions', 'partnerKitSubmissions'];

interface CandidateRow {
  _id: string;
  name?: string;
  email?: string;
  company?: string;
  business?: string;
  companyName?: string;
  // rep application projection
  availableSlots?: string[];
  agencyName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  repFirstName?: string;
  repLastName?: string;
  repEmail?: string;
  // partner kit projection
  partnerAgencyName?: string;
  phone?: string;
}

function rowDisplay(row: CandidateRow, slot?: string): { name: string; email: string; sub?: string } {
  if (row.availableSlots) {
    return slot === 'rep'
      ? {
          name: `${row.repFirstName ?? ''} ${row.repLastName ?? ''}`.trim(),
          email: row.repEmail ?? '',
          sub: row.agencyName,
        }
      : {
          name: row.primaryContactName ?? '',
          email: row.primaryContactEmail ?? '',
          sub: row.agencyName,
        };
  }
  if (row.partnerAgencyName) {
    return { name: row.primaryContactName ?? '', email: row.email ?? '', sub: row.partnerAgencyName };
  }
  return {
    name: row.name ?? '',
    email: row.email ?? '',
    sub: row.company ?? row.business ?? row.companyName,
  };
}

export default function IngestInboxPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Source>('nexusLeads');
  const [slot, setSlot] = useState<'primary' | 'rep'>('primary');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const candidates = useQuery(api.crm.ingest.listIngestCandidates, { source: tab });
  const bulkImport = useMutation(api.crm.ingest.bulkImportFromSource);
  const importOne = useMutation(api.crm.ingest.importFromSource);

  const isSlotted = SLOTTED_SOURCES.includes(tab);
  const activeSlot = isSlotted ? slot : undefined;

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleImportSelected = async () => {
    try {
      const results = await bulkImport({
        sourceTable: tab,
        sourceIds: Array.from(selected),
        sourceSlot: activeSlot,
      });
      // Per-row failures come back as skipped rather than aborting the batch,
      // so report both numbers instead of implying everything landed.
      const imported = results.filter((r) => r.action !== 'skipped').length;
      const skipped = results.length - imported;
      toast.success(`Imported ${imported}${skipped > 0 ? `, skipped ${skipped}` : ''}`);
      setSelected(new Set());
    } catch (err) {
      toast.fromError(err, 'Bulk import failed');
    }
  };

  const rows = (candidates ?? []) as unknown as CandidateRow[];
  const visibleRows = isSlotted ? rows.filter((r) => r.availableSlots?.includes(slot)) : rows;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Inbox' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ingest Inbox</h1>
        <p className="text-sm text-slate-500 mt-0.5">Adopt people from the rest of the platform into the CRM — a reviewed action, not a live sync.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {SOURCE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSelected(new Set()); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-4">{SOURCE_TABS.find((t) => t.key === tab)?.hint}</p>

      {RESTRICTED_SOURCES.includes(tab) && (
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <ShieldAlert size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600">
            These records also hold EIN, NPN, licence, W-9, banking and signature data. Only{' '}
            <span className="font-medium">name, email, phone and agency name</span> are copied into the CRM —
            everything else stays in the onboarding record.
          </p>
        </div>
      )}

      {isSlotted && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Import which person?</span>
          {(['primary', 'rep'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSlot(s); setSelected(new Set()); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${
                slot === s ? 'bg-slate-100 text-slate-900 border-slate-300' : 'text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
            >
              {s === 'primary' ? 'Agency contact' : 'Front-line rep'}
            </button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <button type="button" onClick={handleImportSelected} className="text-sm font-medium text-blue-700 hover:text-blue-900 ml-auto">
            Import selected
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {visibleRows.map((row) => {
          const display = rowDisplay(row, activeSlot);
          const isSelected = selected.has(row._id);
          return (
            <div key={row._id} className="flex items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={isSelected} onChange={() => toggle(row._id)} className="rounded border-slate-300" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{display.name || '(No name)'}</p>
                <p className="text-xs text-slate-500">{display.email}{display.sub ? ` · ${display.sub}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await importOne({ sourceTable: tab, sourceId: row._id, sourceSlot: activeSlot });
                    toast.success('Imported');
                  } catch (err) {
                    toast.fromError(err, 'Import failed');
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Check size={12} /> Import
              </button>
            </div>
          );
        })}
        {candidates && visibleRows.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400">
            <InboxIcon size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No new candidates — everything here has already been reviewed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
