'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AlertCircle, Download } from 'lucide-react';
import { Breadcrumbs } from '@/components/admin/ui';
import { formatCurrency } from '@/lib/admin-format';

/**
 * COMMISSION REPORTING PAGE
 * 
 * Broker commission tracking and payroll export
 * NOTE: Depends on Agent 1 creating commissionRates/commissionPayables tables
 */

export default function CommissionsPage() {
  // Query real data from Convex (currently empty until commission tables are created)
  const commissions = useQuery(api.admin.commissions.getBrokerCommissions) || [];

  const totalPayout = commissions.reduce((sum: number, c: any) => sum + c.calculatedPayout, 0);
  const pendingAmount = commissions.filter((c: any) => c.status === 'pending').reduce(
    (sum: number, c: any) => sum + c.calculatedPayout,
    0
  );

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Commissions' }]} />
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Commission Reporting</h1>
        <p className="text-slate-600">Distribution chain commission tracking and payroll exports</p>
      </div>

      {/* Dependency Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
        <div>
          <p className="text-sm font-semibold text-blue-900">Commission Tracking — Coming Soon</p>
          <p className="text-sm text-blue-800 mt-1">
            Full distribution chain commission tracking (Program Manager overrides, FMO overrides, and agent street-level commissions) will be available in a future update.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total Partners</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{commissions.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Pending Payout</p>
          <p className="text-4xl font-bold text-amber-600 mt-2">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total {currentMonth}</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{formatCurrency(totalPayout)}</p>
        </div>
      </div>

      {/* Period & Export */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Month/Year</label>
          <input
            type="month"
            defaultValue={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
            className="px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Commission Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Distribution Chain Commissions ({currentMonth})</h2>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Partner / Agency</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Active Enrollments</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Rate</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Calculated Payout</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {commissions.map((commission: any) => (
              <tr key={commission.brokerId} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{commission.brokerName}</td>
                <td className="px-6 py-4 text-right">{commission.activeEnrollments}</td>
                <td className="px-6 py-4 text-right font-mono">
                  {formatCurrency(commission.commissionRate)}/member
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">
                  {formatCurrency(commission.calculatedPayout)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      commission.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {commission.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-6 py-4 font-semibold text-slate-900">
                Total
              </td>
              <td className="px-6 py-4 text-right font-bold text-lg text-slate-900">
                {formatCurrency(totalPayout)}
              </td>
              <td className="px-6 py-4"></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Notes on Tiered Commissions */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-900 mb-2">Tiered Commission Structures (Top-Down)</p>
        <p className="text-sm text-slate-600 mb-3">
          Carrier keeps the premium (Ryze Nexus) → Program Manager takes a management fee (Ideal Health) →
          FMO/Agency takes an override for managing agents → Broker/Agent earns the street-level commission
          tracked via Rep Codes.
        </p>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Program Manager override rates set at partner onboarding under Distribution</li>
          <li>• FMO/Agency override rates set per distribution partner</li>
          <li>• Agent (Rep) commission rates set when assigning Rep Codes</li>
          <li>• Commission calculations update in real-time as new enrollments complete</li>
          <li>• Export for payroll integration via CSV</li>
        </ul>
      </div>
    </div>
  );
}
