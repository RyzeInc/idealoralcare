'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import { use } from 'react';
import {
  ArrowLeft,
  Send,
  CreditCard,
  Pencil,
  Trash2,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Breadcrumbs, SkeletonCard, Modal, useToast } from '@/components/admin/ui';
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
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-slate-200 text-slate-500',
  disputed: 'bg-orange-100 text-orange-700',
};

const TIER_LABELS: Record<string, string> = {
  MO: 'Member Only',
  MS: 'Member + Spouse',
  MF: 'Member + Family',
};

// ---------------------------------------------------------------------------
// CSV Export helper
// ---------------------------------------------------------------------------

function exportCsv(
  inv: NonNullable<ReturnType<typeof useInvoice>>,
) {
  const header = ['Invoice #', 'Group', 'Coverage', 'Member ID', 'Last Name', 'First Name', 'Tier', 'Dependents', 'Rate'];
  const rows = inv.lines.map((l: { memberId: string; lastName: string; firstName: string; tier: string; dependentCount: number; rateCents: number }) => [
    inv.invoiceNumberDisplay,
    inv.groupName,
    inv.coveragePeriod,
    l.memberId,
    l.lastName,
    l.firstName,
    l.tier,
    l.dependentCount,
    (l.rateCents / 100).toFixed(2),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${inv.invoiceNumberDisplay}-${inv.coveragePeriod}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Custom hook
// ---------------------------------------------------------------------------

function useInvoice(invoiceId: Id<'listBillInvoices'>) {
  return useQuery(api.admin.listBillInvoices.getInvoice, { invoiceId });
}

// ---------------------------------------------------------------------------
// Issue Modal
// ---------------------------------------------------------------------------

function IssueModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const issue = useMutation(api.admin.listBillInvoices.issueInvoice);
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await issue({ invoiceId: inv._id });
      toast.success(`Invoice #${inv.invoiceNumberDisplay} issued`);
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Issue Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600">
          This will mark the invoice as <strong>Issued</strong> and make it visible to the
          billing contact. The invoice will become overdue if not paid by the due date.
        </p>
        <p className="text-sm">
          Total:{' '}
          <strong>{formatCurrency(inv.totalCents, { fromCents: true })}</strong>
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Issuing…' : 'Issue Invoice'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Record Payment Modal
// ---------------------------------------------------------------------------

function PaymentModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const record = useMutation(api.admin.listBillInvoices.recordPayment);
  const [amount, setAmount] = useState(
    ((inv.balanceCents) / 100).toFixed(2),
  );
  const [method, setMethod] = useState<'check' | 'ach' | 'wire'>('check');
  const [checkNumber, setCheckNumber] = useState('');
  const [achConf, setAchConf] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await record({
        invoiceId: inv._id,
        amountCents: cents,
        paymentMethod: method,
        ...(method === 'check' && checkNumber ? { checkNumber } : {}),
        ...(method === 'ach' && achConf ? { achConfirmationNumber: achConf } : {}),
      });
      toast.success('Payment recorded');
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Record Payment — #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Balance: {formatCurrency(inv.balanceCents, { fromCents: true })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'check' | 'ach' | 'wire')}
          >
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="wire">Wire</option>
          </select>
        </div>
        {method === 'check' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Check Number</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="e.g. 4421"
            />
          </div>
        )}
        {method === 'ach' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ACH Confirmation #</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={achConf}
              onChange={(e) => setAchConf(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Adjustment Modal
// ---------------------------------------------------------------------------

function AdjustModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const adjust = useMutation(api.admin.listBillInvoices.applyAdjustment);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents)) {
      toast.error('Enter a valid adjustment amount');
      return;
    }
    if (!notes.trim()) {
      toast.error('Notes are required');
      return;
    }
    setLoading(true);
    try {
      await adjust({ invoiceId: inv._id, adjustmentCents: cents, notes });
      toast.success('Adjustment applied');
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Adjust Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Adjustment Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. -10.00 for a credit"
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Positive = charge more. Negative = credit/discount.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (required)</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Void Modal
// ---------------------------------------------------------------------------

function VoidModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const voidInv = useMutation(api.admin.listBillInvoices.voidInvoice);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setLoading(true);
    try {
      await voidInv({ invoiceId: inv._id, reason });
      toast.success(`Invoice #${inv.invoiceNumberDisplay} voided`);
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Void Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <p className="text-sm text-red-600 font-medium">
          This action is irreversible. The invoice will be permanently marked as Voided.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Void Reason</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Voiding…' : 'Void Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  const invId = invoiceId as Id<'listBillInvoices'>;

  const inv = useInvoice(invId);

  const [showIssue, setShowIssue] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshLines = useMutation(api.admin.listBillInvoices.refreshInvoiceLines);
  const toast = useToast();

  async function handleRefreshLines() {
    setIsRefreshing(true);
    try {
      await refreshLines({ invoiceId: invId });
      toast.success('Lines refreshed', 'Member list updated to current enrollment.');
    } catch (err) {
      toast.fromError(err, 'Failed to refresh lines');
    } finally {
      setIsRefreshing(false);
    }
  }

  if (inv === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'List-Bill Invoices', href: '/admin/list-bill-invoices' },
            { label: 'Loading…' },
          ]}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (inv === null) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <p className="text-slate-500">Invoice not found.</p>
      </div>
    );
  }

  const status = inv.status as InvoiceStatus;
  const isDraft = status === 'draft';
  const isVoided = status === 'voided';
  const isPaid = status === 'paid';
  const canIssue = isDraft;
  const canPay = !isDraft && !isVoided && !isPaid;
  const canAdjust = !isVoided && !isPaid;
  const canVoid = !isVoided;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'List-Bill Invoices', href: '/admin/list-bill-invoices' },
              { label: inv.groupName, href: `/admin/list-bill-invoices/${inv.groupId}` },
              { label: `#${inv.invoiceNumberDisplay}` },
            ]}
          />
          <div className="flex items-center gap-3 mt-2">
            <Link
              href={`/admin/list-bill-invoices/${inv.groupId}`}
              className="p-2 text-slate-400 hover:text-slate-700 rounded"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Invoice #{inv.invoiceNumberDisplay}
            </h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap gap-2">
          {canIssue && (
            <button
              onClick={handleRefreshLines}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh Lines
            </button>
          )}
          {canIssue && (
            <button
              onClick={() => setShowIssue(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Send size={14} />
              Issue
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              <CreditCard size={14} />
              Record Payment
            </button>
          )}
          {canAdjust && (
            <button
              onClick={() => setShowAdjust(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Pencil size={14} />
              Adjust
            </button>
          )}
          <button
            onClick={() => exportCsv(inv)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Download size={14} />
            Export CSV
          </button>
          {canVoid && (
            <button
              onClick={() => setShowVoid(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              <Trash2 size={14} />
              Void
            </button>
          )}
        </div>
      </div>

      {/* Cover card (page 1 info) */}
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Group / billing info */}
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Building2 size={13} /> Employer
          </h2>
          <p className="font-semibold text-slate-800">{inv.groupName}</p>
          <p className="text-sm text-slate-500">Group Code: {inv.groupCode}</p>
          {inv.organizationCode && (
            <p className="text-sm text-slate-500">Org Code: {inv.organizationCode}</p>
          )}
          <p className="text-sm text-slate-500">{inv.accountName}</p>
          {inv.billingContactEmail && (
            <p className="text-sm text-blue-600">{inv.billingContactEmail}</p>
          )}
        </div>

        {/* Coverage / dates */}
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar size={13} /> Coverage &amp; Dates
          </h2>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Period:</span>{' '}
            <strong className="font-mono">{inv.coveragePeriod}</strong>
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Billing Date:</span>{' '}
            {formatDateTime(inv.billingDate).split(',')[0]}
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Due Date:</span>{' '}
            {formatDateTime(inv.paymentDueDate).split(',')[0]}
          </p>
          {inv.issuedAt && (
            <p className="text-sm text-slate-700">
              <span className="text-slate-400">Issued:</span>{' '}
              {formatDateTime(inv.issuedAt).split(',')[0]}
            </p>
          )}
          {inv.paidAt && (
            <p className="text-sm text-slate-700">
              <span className="text-slate-400">Paid:</span>{' '}
              {formatDateTime(inv.paidAt).split(',')[0]}
            </p>
          )}
        </div>

        {/* Financials */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <FileText size={13} /> Financials
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono">{formatCurrency(inv.subtotalCents, { fromCents: true })}</span>
            </div>
            {inv.adjustmentCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Adjustment</span>
                <span className={`font-mono ${inv.adjustmentCents < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.adjustmentCents > 0 ? '+' : ''}
                  {formatCurrency(Math.abs(inv.adjustmentCents), { fromCents: true })}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(inv.totalCents, { fromCents: true })}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Paid</span>
              <span className="font-mono">{formatCurrency(inv.amountPaidCents, { fromCents: true })}</span>
            </div>
            <div className={`flex justify-between font-semibold ${inv.balanceCents > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              <span>Balance</span>
              <span className="font-mono">{formatCurrency(inv.balanceCents, { fromCents: true })}</span>
            </div>
          </div>
          {inv.adjustmentNotes && (
            <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
              Adj. note: {inv.adjustmentNotes}
            </p>
          )}
        </div>
      </div>

      {/* Rate summary bar */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Rates — {inv.rateLabel}
          </div>
          <div className="flex gap-6 text-sm">
            <span>
              <span className="text-slate-400">MO:</span>{' '}
              <strong>{formatCurrency(inv.moCents, { fromCents: true })}</strong>
            </span>
            <span>
              <span className="text-slate-400">MS:</span>{' '}
              <strong>{formatCurrency(inv.msCents, { fromCents: true })}</strong>
            </span>
            <span>
              <span className="text-slate-400">MF:</span>{' '}
              <strong>{formatCurrency(inv.mfCents, { fromCents: true })}</strong>
            </span>
          </div>
          <div className="ml-auto flex gap-5 text-sm text-slate-600">
            <span>
              <Users size={13} className="inline mr-1" />
              <strong>{inv.memberCount}</strong> members
            </span>
            <span>MO: <strong>{inv.moCount}</strong></span>
            <span>MS: <strong>{inv.msCount}</strong></span>
            <span>MF: <strong>{inv.mfCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Member detail table (page 2 format) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            Member Detail
          </h2>
          <span className="text-xs text-slate-400">{inv.lines.length} line(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Member ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">First Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Deps</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.lines.map((line: {
                memberProfileId: string;
                memberId: string;
                lastName: string;
                firstName: string;
                tier: string;
                dependentCount: number;
                rateCents: number;
                productLabel: string;
              }) => (
                <tr key={line.memberProfileId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{line.memberId}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{line.lastName}</td>
                  <td className="px-4 py-2.5 text-slate-700">{line.firstName}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                      {line.tier}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{TIER_LABELS[line.tier]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{line.dependentCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">
                    {formatCurrency(line.rateCents, { fromCents: true })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate" title={line.productLabel}>
                    {line.productLabel}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-700">
                  Subtotal
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                  {formatCurrency(inv.subtotalCents, { fromCents: true })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Void notice */}
      {isVoided && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Voided</strong> on {formatDateTime(inv.voidedAt!)} by {inv.voidedBy}.
          {inv.voidReason && <> Reason: {inv.voidReason}</>}
          {inv.supersededById && (
            <> —{' '}
              <Link
                href={`/admin/list-bill-invoices/invoice/${inv.supersededById}`}
                className="underline"
              >
                View replacement invoice
              </Link>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showIssue && inv && (
        <IssueModal inv={inv} onClose={() => setShowIssue(false)} />
      )}
      {showPayment && inv && (
        <PaymentModal inv={inv} onClose={() => setShowPayment(false)} />
      )}
      {showAdjust && inv && (
        <AdjustModal inv={inv} onClose={() => setShowAdjust(false)} />
      )}
      {showVoid && inv && (
        <VoidModal inv={inv} onClose={() => setShowVoid(false)} />
      )}
    </div>
  );
}
