'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import {
  ArrowLeft,
  CalendarCheck,
  DollarSign,
  FileCheck2,
  Filter,
  History,
  ScrollText,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, SkeletonTable, Tooltip } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';

const VENDORS = [
  { id: 'toothlens', name: 'Toothlens' },
  { id: 'careington', name: 'Careington' },
  { id: 'ideal', name: 'Ideal Health' },
  { id: 'ryze', name: 'Ryze' },
] as const;

type VendorId = (typeof VENDORS)[number]['id'];

/**
 * Grouping the trail by what an entry actually affects, so "who changed what
 * a partner sees" is separable from routine statement traffic.
 */
const KINDS: Array<{
  id: string;
  label: string;
  help: string;
  icon: React.ReactNode;
  accent: string;
}> = [
  {
    id: 'contents',
    label: 'Contents',
    help: 'Changes to what a recipient is shown on their statement.',
    icon: <SlidersHorizontal size={13} />,
    accent: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    help: 'Statements generated, issued, reissued, voided, or edited.',
    icon: <FileCheck2 size={13} />,
    accent: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'money',
    label: 'Money',
    help: 'Remittances paid out and adjustments recorded against a closed month.',
    icon: <DollarSign size={13} />,
    accent: 'bg-green-100 text-green-700',
  },
  {
    id: 'data',
    label: 'Underlying data',
    help: 'Coverage months closed and member detail backfilled — the figures statements are drawn from.',
    icon: <CalendarCheck size={13} />,
    accent: 'bg-slate-200 text-slate-700',
  },
];

const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]));

export default function StatementActivityPage() {
  const [vendor, setVendor] = useState('');
  const [kind, setKind] = useState('');

  const entries = useQuery(api.admin.vendorStatements.listStatementActivity, {
    vendor: (vendor || undefined) as VendorId | undefined,
    kind: kind || undefined,
    limit: 300,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Vendor Statements', href: '/admin/vendor-statements' },
            { label: 'Activity' },
          ]}
        />
        <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
          <ScrollText size={22} className="text-blue-600" />
          Statement Activity
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every change to what partners are shown, sent, and paid — who made it and when
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Recipient</label>
            <select
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
            >
              <option value="">All Recipients</option>
              {VENDORS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kind</label>
            <select
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">Everything</option>
              {KINDS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          {(vendor || kind) && (
            <button
              onClick={() => { setVendor(''); setKind(''); }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 pb-1.5"
            >
              <Filter size={13} /> Clear filters
            </button>
          )}
          <Link
            href="/admin/vendor-statements"
            className="ml-auto flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 pb-1.5"
          >
            <ArrowLeft size={13} /> Back to statements
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Entries are appended by the system and cannot be edited or removed.{' '}
          {vendor === '' && kind === '' && 'Filtering by recipient hides entries that are not tied to one, such as a coverage month close.'}
        </p>
      </div>

      {/* Trail */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {entries === undefined ? (
          <SkeletonTable rows={10} cols={4} />
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <History size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nothing recorded for these filters yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const meta = KIND_BY_ID.get(entry.kind);
              return (
                <li key={String(entry.id)} className="px-6 py-3.5 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5 ${
                        meta?.accent ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {meta?.icon}
                      {meta?.label ?? entry.kind}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        {entry.label}
                        {entry.vendorName && (
                          <span className="text-slate-500"> · {entry.vendorName}</span>
                        )}
                        {entry.period && (
                          <span className="text-slate-400 font-mono"> · {entry.period}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{entry.summary}</p>
                      {entry.changes.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {entry.changes.map((change, index) => (
                            <li key={index} className="text-xs text-slate-500 font-mono">
                              {change}
                            </li>
                          ))}
                        </ul>
                      )}
                      {entry.statementId && entry.statementNumber && (
                        <Link
                          href={`/admin/vendor-statements/${entry.statementId}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-mono"
                        >
                          {entry.statementNumber}
                        </Link>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 text-right shrink-0">
                      <div>{formatDateTime(entry.createdAt)}</div>
                      <Tooltip text={entry.actorRole ? `Role: ${entry.actorRole}` : 'Acting admin'}>
                        <span className="cursor-help">{entry.actorName}</span>
                      </Tooltip>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
