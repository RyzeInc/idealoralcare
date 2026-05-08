'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import { use } from 'react';
import {
  ArrowLeft,
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Breadcrumbs, SkeletonTable, SkeletonCard } from '@/components/admin/ui';
import { formatCurrency, formatDateTime } from '@/lib/admin-format';

// ---------------------------------------------------------------------------
// Types / helpers
// ---------------------------------------------------------------------------

type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'voided'
  | 'disputed';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  voided: 'Voided',
  disputed: 'Disputed',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-slate-200 text-slate-500',
  disputed: 'bg-orange-100 text-orange-700',
};

// ---------------------------------------------------------------------------
// Aging Summary Panel
// ---------------------------------------------------------------------------

function AgingPanel({
  groupId,
}: {
  groupId: Id<'groups'>;
}) {
  const aging = useQuery(api.admin.listBillInvoices.getGroupAgingSummary, { groupId });

  const rows: { label: string; key: 'current' | 'upTo30Days' | 'days31To60' | 'days61To90' | 'days91Plus' | 'totalDue'; color: string }[] = [
    { label: 'Current', key: 'current', color: 'text-green-600' },
    { label: '1–30 Days', key: 'upTo30Days', color: 'text-yellow-600' },
    { label: '31–60 Days', key: 'days31To60', color: 'text-orange-600' },
    { label: '61–90 Days', key: 'days61To90', color: 'text-red-500' },
    { label: '91+ Days', key: 'days91Plus', color: 'text-red-700' },
    { label: 'Total Due', key: 'totalDue', color: 'text-slate-900' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-500" />
        Aging Summary
      </h2>
      {!aging ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="h-4 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map(({ label, key, color }) => {
              const val = aging[key as keyof typeof aging] as number;
              const isTotalDue = key === 'totalDue';
              return (
                <tr
                  key={key}
                  className={isTotalDue ? 'border-t border-slate-200 font-semibold' : ''}
                >
                  <td className="py-1 text-slate-500">{label}</td>
                  <td className={`py-1 text-right font-mono ${color}`}>
                    {val > 0
                      ? formatCurrency(val, { fromCents: true })
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GroupInvoiceHistoryPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const gId = groupId as Id<'groups'>;

  const invoices = useQuery(api.admin.listBillInvoices.getGroupInvoiceHistory, {
    groupId: gId,
    limit: 36,
  });

  const groupName = invoices?.[0]?.groupName ?? groupId;
  const groupCode = invoices?.[0]?.groupCode;

  const stats = useMemo(() => {
    if (!invoices) return null;
    const active = invoices.filter((i) => i.status !== 'voided');
    const totalBilled = active.reduce((s, i) => s + i.totalCents, 0);
    const totalCollected = active.reduce((s, i) => s + i.amountPaidCents, 0);
    const outstanding = totalBilled - totalCollected;
    return { totalBilled, totalCollected, outstanding };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'List-Bill Invoices', href: '/admin/list-bill-invoices' },
            { label: groupName },
          ]}
        />
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/admin/list-bill-invoices"
            className="p-2 text-slate-400 hover:text-slate-700 rounded"
            title="Back to all invoices"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{groupName}</h1>
            {groupCode && (
              <p className="text-sm text-slate-500">Group Code: {groupCode}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {!invoices ? (
          [0, 1, 2].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-50">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Invoices</p>
                <p className="text-2xl font-bold text-slate-900">
                  {invoices.filter((i) => i.status !== 'voided').length}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Collected</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.totalCollected ?? 0, { fromCents: true })}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-50">
                <Clock size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.outstanding ?? 0, { fromCents: true })}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two-column layout: table + aging panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice history table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Invoice History</h2>
          </div>
          {!invoices ? (
            <SkeletonTable rows={6} cols={7} />
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No invoices for this group yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Coverage
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Billing Date
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                        #{inv.invoiceNumberDisplay}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {inv.coveragePeriod}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {formatDateTime(inv.billingDate).split(',')[0]}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700">
                        {inv.memberCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formatCurrency(inv.totalCents, { fromCents: true })}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${
                          inv.balanceCents > 0 ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {inv.balanceCents > 0
                          ? formatCurrency(inv.balanceCents, { fromCents: true })
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status as InvoiceStatus]}`}
                        >
                          {STATUS_LABELS[inv.status as InvoiceStatus] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Link
                          href={`/admin/list-bill-invoices/invoice/${inv._id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Aging panel */}
        <div>
          <AgingPanel groupId={gId} />
        </div>
      </div>
    </div>
  );
}
