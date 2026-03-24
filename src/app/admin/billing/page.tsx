'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Download } from 'lucide-react';

export default function BillingPage() {
  const billingGroups = useQuery(api.admin.billing.getAllGroupBillingSummaries) || [];

  const totalMembers = billingGroups.reduce((sum: number, g: any) => sum + g.memberCount, 0);
  const totalAmount = billingGroups.reduce((sum: number, g: any) => sum + g.totalAmount, 0);
  const avgRate = totalMembers > 0 ? totalAmount / totalMembers : 0;

  const currentDate = new Date();
  const billingPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const billingPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const handleExportCsv = () => {
    const header = 'group_code,group_name,member_count,rate_per_member,total_amount,period_start,period_end\n';
    const rows = billingGroups.map((g: any) =>
      `"${g.groupCode}","${g.groupName}",${g.memberCount},${g.ratePerMember.toFixed(2)},${g.totalAmount.toFixed(2)},"${formatDate(billingPeriodStart)}","${formatDate(billingPeriodEnd)}"`
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Billing Summary</h1>
        <p className="text-slate-600">Monthly member counts and amounts for E123 import</p>
      </div>

      {/* Billing Period */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900">Billing Period</p>
        <p className="text-lg font-bold text-blue-900 mt-1">
          {formatDate(billingPeriodStart)} to {formatDate(billingPeriodEnd)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total Members</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{totalMembers}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Average Rate</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">${avgRate.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total Amount Due</p>
          <p className="text-4xl font-bold text-green-600 mt-2">${totalAmount.toFixed(2)}</p>
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
        </div>
        
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Group Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Group Name</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Members</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Rate/Member</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {billingGroups.map((group: any) => (
              <tr key={group.groupCode} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium font-mono text-sm">{group.groupCode}</td>
                <td className="px-6 py-4 text-slate-900">{group.groupName}</td>
                <td className="px-6 py-4 text-right">{group.memberCount}</td>
                <td className="px-6 py-4 text-right">${group.ratePerMember.toFixed(2)}</td>
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
              <td className="px-6 py-4 text-right">—</td>
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
          <strong>Note:</strong> This table shows the monthly billing summary that can be imported into E123. 
          All rates are standard ($15/month). Custom pricing per group (if configured) is reflected in the exported CSV.
        </p>
      </div>
    </div>
  );
}
