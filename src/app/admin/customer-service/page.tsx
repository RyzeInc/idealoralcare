'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, useToast, SkeletonCard, SkeletonTable } from '@/components/admin/ui';
import {
  Search,
  User,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  X,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  number: string | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string;
  created: number;
  periodStart: number | null;
  periodEnd: number | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  chargeId?: string | null;
  paymentIntentId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(ms: number | null) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  cancel_at_period_end: 'bg-yellow-100 text-yellow-700',
  past_due: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  suspended: 'bg-orange-100 text-orange-700',
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  open: 'bg-blue-100 text-blue-700',
  void: 'bg-slate-100 text-slate-500',
  uncollectible: 'bg-red-100 text-red-700',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="opacity-80" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerServicePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const toast = useToast();

  // ── Convex queries ────────────────────────────────────────────────────────

  const financialSummary = useQuery(api.admin.customerService.getFinancialSummary);
  const searchResults = useQuery(
    api.admin.customerService.searchAllMembers,
    searchQuery.trim().length >= 2 ? { query: searchQuery.trim() } : 'skip'
  );
  const memberData = useQuery(
    api.admin.customerService.getMemberWithSubscription,
    selectedMemberId ? { memberProfileId: selectedMemberId as Id<'memberProfiles'> } : 'skip'
  );
  const addNote = useMutation(api.admin.members.addMemberNote);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setInvoices(null);
    setCancelResult(null);
    setShowInvoices(false);
    setShowCancelConfirm(false);
    setNoteContent('');
  };

  const handleLoadInvoices = useCallback(async () => {
    if (!selectedMemberId) return;
    setInvoicesLoading(true);
    try {
      const res = await fetch(
        `/api/stripe/member-invoices?memberProfileId=${encodeURIComponent(selectedMemberId)}`
      );
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [selectedMemberId]);

  const handleToggleInvoices = () => {
    if (!showInvoices && invoices === null) {
      handleLoadInvoices();
    }
    setShowInvoices((v) => !v);
  };

  const handleCancel = async () => {
    if (!selectedMemberId) return;
    setCancelLoading(true);
    setCancelResult(null);
    try {
      const res = await fetch('/api/stripe/admin-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberProfileId: selectedMemberId, cancelImmediately }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelResult({ error: data.error ?? 'Cancellation failed' });
      } else {
        const msg = cancelImmediately
          ? 'Subscription cancelled immediately. Access has been revoked.'
          : `Subscription scheduled for cancellation at end of billing period (${
              data.currentPeriodEnd
                ? new Date(data.currentPeriodEnd).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'period end'
            }). Cancellation email sent.`;
        setCancelResult({ success: true, message: msg });
        setShowCancelConfirm(false);
      }
    } catch {
      setCancelResult({ error: 'Network error. Please try again.' });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedMemberId || !noteContent.trim()) return;
    setNoteLoading(true);
    try {
      await addNote({
        memberId: selectedMemberId as Id<'memberProfiles'>,
        content: noteContent.trim(),
        noteType: 'support',
      });
      setNoteContent('');
    } finally {
      setNoteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const summary = financialSummary;
  const member = memberData?.member;
  const bundle = memberData?.bundle;
  const canCancel =
    bundle &&
    (bundle.status === 'active' ||
      bundle.status === 'past_due' ||
      bundle.status === 'cancel_at_period_end');

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Customer Service' }]} />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Customer Service</h1>
        <p className="text-slate-500 mt-1">
          Manage cancellations, review billing history, and track financial metrics.
        </p>
      </div>

      {/* Financial summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Monthly Recurring Revenue"
          value={summary ? formatCurrency(summary.totalMrrCents) : '—'}
          sub="Paid active subscriptions"
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Active Paid Members"
          value={summary?.activePaidCount ?? '—'}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Past Due"
          value={summary?.pastDueCount ?? '—'}
          sub="Payment failed"
          color="bg-orange-100 text-orange-600"
        />
        <StatCard
          icon={XCircle}
          label="Cancelled This Month"
          value={summary?.cancelledThisMonthCount ?? '—'}
          sub={`${summary?.cancelAtPeriodEndCount ?? 0} pending cancellation`}
          color="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Member search */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Search size={16} />
              Member Lookup
            </h2>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, email, or member ID…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Results */}
            {searchQuery.trim().length >= 2 && (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {searchResults === undefined && (
                  <p className="text-xs text-slate-400 text-center py-4">Searching…</p>
                )}
                {searchResults?.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No results found.</p>
                )}
                {(searchResults ?? []).map((m: any) => (
                  <button
                    key={m._id}
                    onClick={() => handleSelectMember(m._id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedMemberId === m._id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <p className="font-medium text-slate-800">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{m.email ?? '—'}</p>
                    <p className="text-xs text-slate-400 font-mono">{m.memberId}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Member detail */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedMemberId && (
            <div className="bg-white rounded-lg shadow p-10 text-center text-slate-400">
              <User size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Search for a member to view their details.</p>
            </div>
          )}

          {selectedMemberId && memberData === undefined && (
            <SkeletonCard />
          )}

          {selectedMemberId && memberData && (
            <>
              {/* Member identity */}
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {member?.firstName} {member?.lastName}
                    </h2>
                    <p className="text-sm text-slate-500">{member?.email ?? '—'}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {member?.memberId}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                      STATUS_STYLES[member?.memberType ?? ''] ?? 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {member?.memberType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-slate-400">Account / Group</span>
                    <p className="text-slate-700 font-medium">
                      {memberData.accountName ?? '—'} / {memberData.groupCode ?? '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Enrolled</span>
                    <p className="text-slate-700 font-medium">
                      {formatTimestamp(member?.enrolledAt ?? null)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone</span>
                    <p className="text-slate-700 font-medium">{member?.phone ?? '—'}</p>
                  </div>
                </div>
              </div>

              {/* Subscription / billing */}
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <CreditCard size={16} />
                  Subscription
                </h3>
                {!bundle ? (
                  <p className="text-sm text-slate-400">No subscription on file.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-slate-400">Status</span>
                      <p>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[bundle.status] ?? 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {bundle.status.replace(/_/g, ' ')}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Amount</span>
                      <p className="font-medium text-slate-700">
                        {formatCurrency(bundle.totalCents)} /{' '}
                        {bundle.cadence === 'annual' ? 'year' : 'month'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment method</span>
                      <p className="font-medium text-slate-700 capitalize">
                        {bundle.paymentMethod ?? '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Current period end</span>
                      <p className="font-medium text-slate-700">
                        {bundle.currentPeriodEnd
                          ? formatDate(bundle.currentPeriodEnd / 1000)
                          : '—'}
                      </p>
                    </div>
                    {bundle.cancelledAt && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Cancelled</span>
                        <p className="font-medium text-red-600">
                          {formatTimestamp(bundle.cancelledAt)}
                        </p>
                      </div>
                    )}
                    {bundle.pastDueAt && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Past due since</span>
                        <p className="font-medium text-orange-600">
                          {formatTimestamp(bundle.pastDueAt)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancellation result banner */}
                {cancelResult && (
                  <div
                    className={`mt-2 p-3 rounded-lg text-sm flex items-start gap-2 ${
                      cancelResult.error
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {cancelResult.error ? (
                      <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                    )}
                    <span>{cancelResult.error ?? cancelResult.message}</span>
                  </div>
                )}

                {/* Cancel controls */}
                {canCancel && !cancelResult?.success && (
                  <div className="pt-2">
                    {!showCancelConfirm ? (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        Cancel Subscription
                      </button>
                    ) : (
                      <div className="border border-red-200 rounded-lg p-4 space-y-3 bg-red-50">
                        <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                          <AlertTriangle size={15} />
                          Confirm cancellation for {member?.firstName} {member?.lastName}
                        </p>
                        <div className="space-y-2 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="cancelType"
                              checked={!cancelImmediately}
                              onChange={() => setCancelImmediately(false)}
                            />
                            <span>
                              <span className="font-medium">Cancel at period end</span> —
                              member keeps access until billing cycle ends
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="cancelType"
                              checked={cancelImmediately}
                              onChange={() => setCancelImmediately(true)}
                            />
                            <span>
                              <span className="font-medium text-red-600">
                                Cancel immediately
                              </span>{' '}
                              — access revoked now
                            </span>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancel}
                            disabled={cancelLoading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {cancelLoading && (
                              <Loader2 size={14} className="animate-spin" />
                            )}
                            Confirm Cancel
                          </button>
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                          >
                            <X size={14} className="inline mr-1" />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice history (collapsible) */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={handleToggleInvoices}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileText size={16} />
                    Invoice History
                  </h3>
                  {invoicesLoading ? (
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                  ) : showInvoices ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </button>

                {showInvoices && (
                  <div className="border-t border-slate-100">
                    {invoicesLoading && <SkeletonTable rows={4} cols={5} />}
                    {!invoicesLoading && invoices === null && (
                      <p className="text-sm text-slate-400 text-center py-6">
                        Loading invoices…
                      </p>
                    )}
                    {!invoicesLoading && invoices?.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-6">
                        No invoices found.
                      </p>
                    )}
                    {!invoicesLoading && (invoices?.length ?? 0) > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                            <th className="px-5 py-3 text-left font-medium">Invoice</th>
                            <th className="px-5 py-3 text-left font-medium">Period</th>
                            <th className="px-5 py-3 text-right font-medium">Amount</th>
                            <th className="px-5 py-3 text-center font-medium">Status</th>
                            <th className="px-5 py-3 text-right font-medium" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices!.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <p className="font-medium text-slate-700">
                                  {inv.number ?? inv.id.slice(-8)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(inv.created * 1000).toLocaleDateString()}
                                </p>
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {inv.periodStart && inv.periodEnd ? (
                                  <>
                                    {formatDate(inv.periodStart)} –{' '}
                                    {formatDate(inv.periodEnd)}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-5 py-3 text-right font-medium text-slate-800">
                                {formatCurrency(inv.amountPaid, inv.currency)}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                                    INVOICE_STATUS_STYLES[inv.status] ??
                                    'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="inline-flex items-center gap-3">
                                  {(inv.status === 'paid' && (inv.chargeId || inv.paymentIntentId) && inv.amountPaid > 0) && (
                                    <button
                                      onClick={() => setRefundTarget(inv)}
                                      className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                                      title="Issue a full or partial refund for this invoice."
                                    >
                                      Refund
                                    </button>
                                  )}
                                  {inv.hostedInvoiceUrl && (
                                    <a
                                      href={inv.hostedInvoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1 text-xs"
                                    >
                                      View
                                      <ExternalLink size={11} />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* CS Note */}
              <div className="bg-white rounded-lg shadow p-5 space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <DollarSign size={16} />
                  Add Support Note
                </h3>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Log a note about this member's account, cancellation reason, billing dispute, etc."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || noteLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
                >
                  {noteLoading && <Loader2 size={13} className="animate-spin" />}
                  Save Note
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Refund modal ───────────────────────────────────────────────── */}
      {refundTarget && (
        <RefundModal
          invoice={refundTarget}
          loading={refundLoading}
          amount={refundAmount}
          reason={refundReason}
          note={refundNote}
          onAmountChange={setRefundAmount}
          onReasonChange={setRefundReason}
          onNoteChange={setRefundNote}
          onClose={() => {
            if (refundLoading) return;
            setRefundTarget(null);
            setRefundAmount('');
            setRefundNote('');
            setRefundReason('requested_by_customer');
          }}
          onSubmit={async () => {
            if (!refundTarget || !selectedMemberId) return;
            const cents = refundAmount.trim()
              ? Math.round(parseFloat(refundAmount) * 100)
              : undefined;
            if (refundAmount.trim() && (!cents || cents <= 0 || cents > refundTarget.amountPaid)) {
              toast.error(`Amount must be between $0.01 and ${formatCurrency(refundTarget.amountPaid, refundTarget.currency)}.`);
              return;
            }
            setRefundLoading(true);
            try {
              const res = await fetch('/api/stripe/admin-refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  memberProfileId: selectedMemberId,
                  chargeId: refundTarget.chargeId ?? undefined,
                  paymentIntentId: refundTarget.paymentIntentId ?? undefined,
                  amountCents: cents,
                  reason: refundReason,
                  note: refundNote.trim() || undefined,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? 'Refund failed');
              toast.success(`Refund issued: ${formatCurrency(data.amount ?? 0, data.currency ?? refundTarget.currency)}`);
              setRefundTarget(null);
              setRefundAmount('');
              setRefundNote('');
              setRefundReason('requested_by_customer');
              // Refresh invoices to reflect refund status
              await handleLoadInvoices();
            } catch (err: any) {
              toast.error(err?.message ?? 'Refund failed');
            } finally {
              setRefundLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ── Refund modal ────────────────────────────────────────────────────────────

function RefundModal({
  invoice,
  loading,
  amount,
  reason,
  note,
  onAmountChange,
  onReasonChange,
  onNoteChange,
  onClose,
  onSubmit,
}: {
  invoice: Invoice;
  loading: boolean;
  amount: string;
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  note: string;
  onAmountChange: (v: string) => void;
  onReasonChange: (v: 'requested_by_customer' | 'duplicate' | 'fraudulent') => void;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Auto-focus first input
    dialogRef.current
      ?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close dialog"])')
      ?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-modal-title"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 id="refund-modal-title" className="font-semibold text-slate-900">Issue Refund</h3>
            <p className="text-xs text-slate-500 mt-1">
              Invoice {invoice.number ?? invoice.id.slice(-8)} — paid{' '}
              {formatCurrency(invoice.amountPaid, invoice.currency)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <label className="block text-sm">
          <span className="text-slate-700 font-medium">Amount (leave blank for full refund)</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-slate-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={(invoice.amountPaid / 100).toFixed(2)}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={(invoice.amountPaid / 100).toFixed(2)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </label>

        <label className="block text-sm">
          <span className="text-slate-700 font-medium">Reason</span>
          <select
            value={reason}
            onChange={(e) => onReasonChange(e.target.value as 'requested_by_customer' | 'duplicate' | 'fraudulent')}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="requested_by_customer">Requested by customer</option>
            <option value="duplicate">Duplicate charge</option>
            <option value="fraudulent">Fraudulent</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-700 font-medium">Internal note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder="Why is this refund being issued?"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Issue Refund
          </button>
        </div>
      </div>
    </div>
  );
}
