'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  Building2,
  Users,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Download,
  ChevronLeft,
  Receipt,
  UserX,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { useToast, Breadcrumbs, StatusBadge, SkeletonTable } from '@/components/admin/ui';

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-600" />
    : <ChevronDown size={12} className="text-blue-600" />;
}

export default function ListBillPage() {
  const toast = useToast();
  const today = new Date();
  const [billingPeriod, setBillingPeriod] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedGroupId, setSelectedGroupId] = useState<Id<'groups'> | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'termed'>('summary');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    if (!showPaymentModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPaymentModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showPaymentModal]);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'check' as 'check' | 'ach',
    paymentStatus: 'paid' as 'pending' | 'paid' | 'partial' | 'overdue',
    checkNumber: '',
    checkDate: '',
    achConfirmationNumber: '',
    amountReceivedCents: '',
    notes: '',
  });

  const summaryRaw = useQuery(api.admin.billing.getListBillMonthlySummary, { billingPeriod });
  const summary = summaryRaw ?? [];
  const isLoadingSummary = summaryRaw === undefined;

  // Sort state for the main groups summary table
  const [sortKey, setSortKey] = useState<'groupName' | 'memberCount' | 'ratePerMemberCents' | 'totalAmountCents' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (key: typeof sortKey) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortedSummary = sortKey
    ? [...summary].sort((a: any, b: any) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).toLowerCase() < String(bv).toLowerCase() ? -1 * dir : 1 * dir;
      })
    : summary;
  const termedMembers = useQuery(
    api.admin.members.getTermedListBillMembers,
    selectedGroupId ? { groupId: selectedGroupId } : 'skip'
  ) ?? [];
  const paymentHistory = useQuery(
    api.admin.billing.getListBillPaymentHistory,
    selectedGroupId ? { groupId: selectedGroupId } : 'skip'
  ) ?? [];

  const recordPayment = useMutation(api.admin.billing.recordListBillPayment);
  const sendReenrollLink = useAction((api as any).admin.members.sendReenrollmentLink);

  const selectedGroup = summary.find((g: any) => g.groupId === selectedGroupId);

  const totalMembers = summary.reduce((s: number, g: any) => s + g.memberCount, 0);
  const totalCents = summary.reduce((s: number, g: any) => s + g.totalCents, 0);
  const paidGroups = summary.filter((g: any) => g.payment?.paymentStatus === 'paid').length;

  // Export CSV
  const handleExportCsv = () => {
    const header = 'provider_group_code,organization_code,organization_name,billing_period,member_count,rate_per_member,total_amount,payment_method,payment_status\n';
    const rows = summary.map((g: any) => {
      const rate = (g.ratePerMemberCents / 100).toFixed(2);
      const total = (g.totalCents / 100).toFixed(2);
      return `"${g.providerGroupCode ?? g.groupCode}","${g.organizationCode ?? ''}","${g.organizationName ?? g.groupName}","${billingPeriod}",${g.memberCount},${rate},${total},"${g.listBillConfig?.paymentMethod ?? 'check'}","${g.payment?.paymentStatus ?? 'pending'}"`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `list_bill_invoice_${billingPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordPayment = async () => {
    if (!selectedGroup) return;
    try {
      await recordPayment({
        groupId: selectedGroup.groupId as Id<'groups'>,
        billingPeriod,
        paymentMethod: paymentForm.paymentMethod,
        paymentStatus: paymentForm.paymentStatus,
        memberCount: selectedGroup.memberCount,
        ratePerMemberCents: selectedGroup.ratePerMemberCents,
        totalCents: selectedGroup.totalCents,
        checkNumber: paymentForm.checkNumber || undefined,
        checkDate: paymentForm.checkDate || undefined,
        achConfirmationNumber: paymentForm.achConfirmationNumber || undefined,
        amountReceivedCents: paymentForm.amountReceivedCents
          ? Math.round(parseFloat(paymentForm.amountReceivedCents) * 100)
          : undefined,
        notes: paymentForm.notes || undefined,
      });
      setShowPaymentModal(false);
      toast.success('Payment recorded', `${selectedGroup.groupName} marked as ${paymentForm.paymentStatus}.`);
    } catch (e) {
      toast.fromError(e, 'Could not record payment');
    }
  };

  const handleSendReenrollmentLink = async (memberId: string) => {
    try {
      await sendReenrollLink({ memberId } as any);
      toast.success('Re-enrollment link sent', 'The member should receive an email shortly.');
    } catch (e) {
      toast.fromError(e, 'Could not send re-enrollment link');
    }
  };

  // ── Group drill-down ──
  if (selectedGroupId && selectedGroup) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedGroupId(null)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedGroup.organizationName ?? selectedGroup.groupName}</h1>
            <p className="text-slate-500 text-sm">
              Provider Group Code: <span className="font-mono">{selectedGroup.providerGroupCode ?? selectedGroup.groupCode}</span> ·
              Organization Code: <span className="font-mono">{selectedGroup.organizationCode ?? <span className="text-amber-600">not set</span>}</span> ·
              Payment Method: <span className="capitalize">{selectedGroup.listBillConfig?.paymentMethod ?? 'check'}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {(['summary', 'termed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'summary' ? 'Billing Summary' : `Termed Members (${termedMembers.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg"><Users size={20} className="text-blue-600" /></div>
                <div>
                  <p className="text-sm text-slate-500">Active FT Members</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedGroup.memberCount}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg"><Receipt size={20} className="text-green-600" /></div>
                <div>
                  <p className="text-sm text-slate-500">Monthly Invoice</p>
                  <p className="text-2xl font-bold text-green-700">{formatCents(selectedGroup.totalCents)}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  selectedGroup.payment?.paymentStatus === 'paid'
                    ? 'bg-green-100'
                    : selectedGroup.payment?.paymentStatus === 'overdue'
                    ? 'bg-red-100'
                    : 'bg-yellow-100'
                }`}>
                  <CheckCircle size={20} className={
                    selectedGroup.payment?.paymentStatus === 'paid'
                      ? 'text-green-600'
                      : selectedGroup.payment?.paymentStatus === 'overdue'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  } />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payment Status</p>
                  <p className="text-lg font-bold text-slate-900 capitalize">
                    {selectedGroup.payment?.paymentStatus ?? 'Pending'}
                  </p>
                </div>
              </div>
            </div>

            {/* Current period payment info */}
            {selectedGroup.payment && (
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Payment Record — {billingPeriod}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-slate-500">Method</p><p className="font-medium capitalize">{selectedGroup.payment.paymentMethod}</p></div>
                  {selectedGroup.payment.checkNumber && (
                    <div><p className="text-slate-500">Check #</p><p className="font-mono font-medium">{selectedGroup.payment.checkNumber}</p></div>
                  )}
                  {selectedGroup.payment.checkDate && (
                    <div><p className="text-slate-500">Check Date</p><p className="font-medium">{selectedGroup.payment.checkDate}</p></div>
                  )}
                  {selectedGroup.payment.achConfirmationNumber && (
                    <div><p className="text-slate-500">ACH Confirmation</p><p className="font-mono font-medium">{selectedGroup.payment.achConfirmationNumber}</p></div>
                  )}
                  {selectedGroup.payment.amountReceivedCents !== undefined && (
                    <div><p className="text-slate-500">Received</p><p className="font-medium text-green-700">{formatCents(selectedGroup.payment.amountReceivedCents)}</p></div>
                  )}
                  {selectedGroup.payment.notes && (
                    <div className="col-span-2"><p className="text-slate-500">Notes</p><p className="font-medium">{selectedGroup.payment.notes}</p></div>
                  )}
                </div>
              </div>
            )}

            {/* Record Payment button */}
            <button
              onClick={() => {
                setPaymentForm({
                  paymentMethod: selectedGroup.listBillConfig?.paymentMethod ?? 'check',
                  paymentStatus: 'paid',
                  checkNumber: selectedGroup.payment?.checkNumber ?? '',
                  checkDate: selectedGroup.payment?.checkDate ?? '',
                  achConfirmationNumber: selectedGroup.payment?.achConfirmationNumber ?? '',
                  amountReceivedCents: '',
                  notes: selectedGroup.payment?.notes ?? '',
                });
                setShowPaymentModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Receipt size={18} />
              {selectedGroup.payment ? 'Update Payment Record' : 'Record Payment'}
            </button>

            {/* Payment history */}
            {paymentHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Payment History</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 text-sm">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Period</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Members</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-700">Amount</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Method</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {paymentHistory.map((p: any) => (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono">{p.billingPeriod}</td>
                        <td className="px-6 py-3">{p.memberCount}</td>
                        <td className="px-6 py-3 text-right font-semibold">{formatCents(p.totalCents)}</td>
                        <td className="px-6 py-3 capitalize">{p.paymentMethod}</td>
                        <td className="px-6 py-3">
                          <StatusBadge status={p.paymentStatus} size="md" />
                        </td>
                        <td className="px-6 py-3 font-mono text-slate-500">
                          {p.checkNumber ?? p.achConfirmationNumber ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'termed' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>Termed Employees:</strong> These FT employees have left the payroll-deduction
              plan. Send them a re-enrollment link so they can continue coverage via credit card or
              ACH bank draft.
            </div>

            {termedMembers.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
                No termed list-bill members in this group
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 text-sm">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Name</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Email</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Member ID</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Termed</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {termedMembers.map((m: any) => (
                      <tr key={m._id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">
                          {m.firstName} {m.lastName}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{m.email ?? '—'}</td>
                        <td className="px-6 py-3 font-mono text-slate-600">{m.memberId}</td>
                        <td className="px-6 py-3 text-slate-500">
                          {m.listBillTermedAt
                            ? new Date(m.listBillTermedAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {m.email ? (
                            <button
                              onClick={() => handleSendReenrollmentLink(m._id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                            >
                              <Send size={12} />
                              Send Re-enrollment Link
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">No email</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowPaymentModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="list-bill-payment-modal-title"
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="list-bill-payment-modal-title" className="text-lg font-semibold text-slate-900 mb-4">
                Record List-Bill Payment — {billingPeriod}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="check">Check</option>
                    <option value="ach">ACH / Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                  <select
                    value={paymentForm.paymentStatus}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentStatus: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="paid">Paid in Full</option>
                    <option value="partial">Partial Payment</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                {paymentForm.paymentMethod === 'check' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check Number</label>
                      <input
                        type="text"
                        value={paymentForm.checkNumber}
                        onChange={(e) => setPaymentForm({ ...paymentForm, checkNumber: e.target.value })}
                        placeholder="e.g. 10042"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check Date</label>
                      <input
                        type="date"
                        value={paymentForm.checkDate}
                        onChange={(e) => setPaymentForm({ ...paymentForm, checkDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </>
                )}

                {paymentForm.paymentMethod === 'ach' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ACH Confirmation #</label>
                    <input
                      type="text"
                      value={paymentForm.achConfirmationNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, achConfirmationNumber: e.target.value })}
                      placeholder="e.g. ACH-2026-05-00123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                {paymentForm.paymentStatus === 'partial' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentForm.amountReceivedCents}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amountReceivedCents: e.target.value })}
                      placeholder="e.g. 500.00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Optional reconciliation notes"
                  />
                </div>

                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <p className="text-slate-600">
                    Invoice Total: <strong>{formatCents(selectedGroup.totalCents)}</strong>
                    {' '}({selectedGroup.memberCount} members × {formatCents(selectedGroup.ratePerMemberCents)}/mo)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRecordPayment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Save Payment Record
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main overview ──
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'List-Bill' }]} />
      <div>
        <h1 className="text-3xl font-bold text-slate-900">List-Bill Management</h1>
        <p className="text-slate-500">
          Payroll-deduction groups (Full-Time employees) — monthly employer remittance
        </p>
      </div>

      {/* Billing period selector */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Month</label>
          <input
            type="month"
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleExportCsv}
          disabled={summary.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Download size={18} />
          Export Invoice CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg"><Building2 size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-sm text-slate-500">List-Bill Groups</p>
            <p className="text-3xl font-bold text-slate-900">{summary.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-lg"><Users size={20} className="text-indigo-600" /></div>
          <div>
            <p className="text-sm text-slate-500">Total FT Members</p>
            <p className="text-3xl font-bold text-slate-900">{totalMembers}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg"><Receipt size={20} className="text-green-600" /></div>
          <div>
            <p className="text-sm text-slate-500">Total Invoice</p>
            <p className="text-3xl font-bold text-green-700">{formatCents(totalCents)}</p>
          </div>
        </div>
      </div>

      {/* Info box for eligibility workflow */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900 space-y-2">
        <p className="font-semibold text-base">How List-Bill & Eligibility Works</p>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>
            <strong>FT employees</strong> are enrolled through payroll deduction — no payment collected
            on the platform. Upload a monthly eligibility file (CSV or Careington .txt) in the
            <a href="/admin/eligibility" className="underline ml-1">Eligibility section</a> to add/remove members.
          </li>
          <li>
            <strong>Adds/Terms:</strong> Upload a delta file with action type "additions" or "terminations"
            each month to keep the roster current.
          </li>
          <li>
            <strong>Monthly payment</strong> from the employer is recorded here (check or ACH). The employer
            remits a single payment covering all enrolled FT members.
          </li>
          <li>
            <strong>Termed employees</strong> receive a re-enrollment link via email so they can continue
            coverage directly (CC or ACH) after leaving the group plan.
          </li>
        </ul>
      </div>

      {/* Groups table */}
      {isLoadingSummary ? (
        <SkeletonTable rows={6} cols={7} />
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center text-slate-500">
          <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No list-bill groups configured</p>
          <p className="text-sm mt-1">
            Enable list-bill on a group in the{' '}
            <a href="/admin/hierarchy" className="text-blue-600 underline">Hierarchy section</a>.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">List-Bill Groups — {billingPeriod}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {paidGroups} of {summary.length} groups paid · Click a row to manage
            </p>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 text-sm">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-700">
                  <button onClick={() => toggleSort('groupName')} className="inline-flex items-center gap-1 hover:text-blue-600">Organization <SortIcon active={sortKey === 'groupName'} dir={sortDir} /></button>
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-700">Provider Group Code</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-700">Organization Code</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-700">Pay Method</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-700">
                  <button onClick={() => toggleSort('memberCount')} className="inline-flex items-center gap-1 hover:text-blue-600">FT Members <SortIcon active={sortKey === 'memberCount'} dir={sortDir} /></button>
                </th>
                <th className="px-6 py-3 text-right font-semibold text-slate-700">
                  <button onClick={() => toggleSort('ratePerMemberCents')} className="inline-flex items-center gap-1 hover:text-blue-600">Rate / Member <SortIcon active={sortKey === 'ratePerMemberCents'} dir={sortDir} /></button>
                </th>
                <th className="px-6 py-3 text-right font-semibold text-slate-700">
                  <button onClick={() => toggleSort('totalAmountCents')} className="inline-flex items-center gap-1 hover:text-blue-600">Invoice Total <SortIcon active={sortKey === 'totalAmountCents'} dir={sortDir} /></button>
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedSummary.map((g: any) => (
                <tr
                  key={g.groupId}
                  onClick={() => setSelectedGroupId(g.groupId)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{g.organizationName ?? g.groupName}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{g.providerGroupCode ?? g.groupCode}</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-600">{g.organizationCode ?? <span className="text-amber-600">—</span>}</td>
                  <td className="px-6 py-4 capitalize text-slate-700">
                    {g.listBillConfig?.paymentMethod ?? 'check'}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">{g.memberCount}</td>
                  <td className="px-6 py-4 text-right text-slate-700">{formatCents(g.ratePerMemberCents)}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-700">{formatCents(g.totalCents)}</td>
                  <td className="px-6 py-4">
                    {g.payment ? (
                      <StatusBadge status={g.payment.paymentStatus} size="md" />
                    ) : (
                      <StatusBadge status="pending" size="md" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td colSpan={2} className="px-6 py-4 font-semibold text-slate-900">Total</td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">{totalMembers}</td>
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4 text-right font-bold text-lg text-green-700">{formatCents(totalCents)}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{paidGroups}/{summary.length} paid</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
