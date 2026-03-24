'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Download, ArrowLeft, Users, CreditCard, Gift, Building2 } from 'lucide-react';

export default function BillingPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const billingGroups = useQuery(api.admin.billing.getAllGroupBillingSummaries) || [];
  const accounts = useQuery(api.admin.hierarchy.getAllAccounts) || [];
  const groupMembers = useQuery(
    api.admin.billing.getGroupMembersWithBillingStatus,
    selectedGroupId ? { groupId: selectedGroupId as Id<'groups'> } : 'skip'
  );
  const accountSummary = useQuery(
    api.admin.billing.getAccountBillingSummary,
    selectedAccountId ? { accountId: selectedAccountId as Id<'accounts'> } : 'skip'
  );

  const totalMembers = billingGroups.reduce((sum: number, g: any) => sum + g.memberCount, 0);
  const totalPaid = billingGroups.reduce((sum: number, g: any) => sum + g.paidCount, 0);
  const totalFree = billingGroups.reduce((sum: number, g: any) => sum + g.freeCount, 0);
  const totalAmount = billingGroups.reduce((sum: number, g: any) => sum + g.totalAmount, 0);

  // Derive billing period from the month picker
  const [year, month] = billingMonth.split('-').map(Number);
  const billingPeriodStart = new Date(year, month - 1, 1);
  const billingPeriodEnd = new Date(year, month, 0);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const selectedGroup = billingGroups.find((g: any) => g.groupId === selectedGroupId);

  const handleExportCsv = () => {
    const header = 'group_code,group_name,total_members,paid_members,free_members,rate_per_member,billable_amount,period_start,period_end\n';
    const rows = billingGroups.map((g: any) =>
      `"${g.groupCode}","${g.groupName}",${g.memberCount},${g.paidCount},${g.freeCount},${g.ratePerMember.toFixed(2)},${g.totalAmount.toFixed(2)},"${formatDate(billingPeriodStart)}","${formatDate(billingPeriodEnd)}"`
    ).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_${formatDate(billingPeriodStart)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Group member drill-down view ──
  if (selectedGroupId && selectedGroup) {
    const paidMembers = (groupMembers || []).filter((m: any) => m.billingType === 'paid');
    const freeMembers = (groupMembers || []).filter((m: any) => m.billingType === 'free');

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedGroupId(null)} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{selectedGroup.groupCode}</h1>
            <p className="text-slate-600">{selectedGroup.groupName} — {(groupMembers || []).length} active members</p>
          </div>
        </div>

        {/* Group summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg"><Users size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Active</p>
              <p className="text-2xl font-bold text-slate-900">{selectedGroup.memberCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg"><CreditCard size={20} className="text-green-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Paid Subscriptions</p>
              <p className="text-2xl font-bold text-green-600">{selectedGroup.paidCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg"><Gift size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Free / Comp Access</p>
              <p className="text-2xl font-bold text-purple-600">{selectedGroup.freeCount}</p>
            </div>
          </div>
        </div>

        {/* Paid members */}
        {paidMembers.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-green-50">
              <h2 className="text-base font-semibold text-green-800">Paid Members ({paidMembers.length})</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Member ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Cadence</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paidMembers.map((m: any) => (
                  <tr key={m._id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{m.firstName} {m.lastName}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{m.email || '—'}</td>
                    <td className="px-6 py-3 font-mono text-sm text-slate-600">{m.memberId}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{m.bundleInfo?.cadence || '—'}</td>
                    <td className="px-6 py-3 text-right font-semibold text-green-700">
                      ${((m.bundleInfo?.totalCents || 0) / 100).toFixed(2)}
                      {m.bundleInfo?.cadence === 'annual' ? '/yr' : '/mo'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Free members */}
        {freeMembers.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-purple-50">
              <h2 className="text-base font-semibold text-purple-800">Free / Comp Members ({freeMembers.length})</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Member ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Enrolled</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {freeMembers.map((m: any) => (
                  <tr key={m._id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{m.firstName} {m.lastName}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{m.email || '—'}</td>
                    <td className="px-6 py-3 font-mono text-sm text-slate-600">{m.memberId}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{m.enrolledAt ? new Date(m.enrolledAt).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Free</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(groupMembers || []).length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
            No active members in this group
          </div>
        )}
      </div>
    );
  }

  // ── Main billing overview ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Billing Summary</h1>
        <p className="text-slate-600">Monthly member counts and amounts for E123 import</p>
      </div>

      {/* Billing Period Selector + Account View */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Billing Month</label>
          <input
            type="month"
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Account View</label>
          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value || null)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">All Groups</option>
            {accounts.map((a: any) => (
              <option key={a._id} value={a._id}>{a.name || a.slug}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Account-level summary (when account filter is active) */}
      {selectedAccountId && accountSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={18} className="text-blue-600" />
            <h3 className="font-semibold text-blue-900">{accountSummary.accountName} — Account Summary</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-blue-900">{accountSummary.groupCount}</p><p className="text-sm text-blue-700">Groups</p></div>
            <div><p className="text-2xl font-bold text-blue-900">{accountSummary.totalMembers}</p><p className="text-sm text-blue-700">Active Members</p></div>
            <div><p className="text-2xl font-bold text-green-700">${accountSummary.totalAmount.toFixed(2)}</p><p className="text-sm text-blue-700">Billable Amount</p></div>
          </div>
        </div>
      )}

      {/* Billing Period */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900">Billing Period</p>
        <p className="text-lg font-bold text-blue-900 mt-1">
          {formatDate(billingPeriodStart)} to {formatDate(billingPeriodEnd)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total Active Members</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{totalMembers}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Paid Subscriptions</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{totalPaid}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Free / Comp Access</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{totalFree}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Billable Revenue</p>
          <p className="text-3xl font-bold text-green-600 mt-2">${totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExportCsv}
          disabled={billingGroups.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          <Download size={18} />
          Export CSV for E123
        </button>
      </div>

      {/* Billing Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Groups & Accounts</h2>
          <p className="text-sm text-slate-500 mt-1">Click a group to see its members</p>
        </div>
        
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Group Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Group Name</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Total</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Paid</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Free</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Billable Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {billingGroups.map((group: any) => (
              <tr
                key={group.groupId}
                onClick={() => setSelectedGroupId(group.groupId)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 font-medium font-mono text-sm text-blue-600">{group.groupCode}</td>
                <td className="px-6 py-4 text-slate-900">{group.groupName}</td>
                <td className="px-6 py-4 text-right">{group.memberCount}</td>
                <td className="px-6 py-4 text-right">
                  {group.paidCount > 0 ? (
                    <span className="text-green-700 font-medium">{group.paidCount}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {group.freeCount > 0 ? (
                    <span className="text-purple-700 font-medium">{group.freeCount}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">
                  ${group.totalAmount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={2} className="px-6 py-4 font-semibold text-slate-900">Total</td>
              <td className="px-6 py-4 text-right font-semibold text-slate-900">{totalMembers}</td>
              <td className="px-6 py-4 text-right font-semibold text-green-700">{totalPaid}</td>
              <td className="px-6 py-4 text-right font-semibold text-purple-700">{totalFree}</td>
              <td className="px-6 py-4 text-right font-bold text-lg text-green-600">
                ${totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-600">
          <strong>Note:</strong> Only members with active paid Stripe subscriptions are counted toward billable revenue.
          Free access members (admin/comp grants) are shown separately and do not generate billing charges.
        </p>
      </div>
    </div>
  );
}
