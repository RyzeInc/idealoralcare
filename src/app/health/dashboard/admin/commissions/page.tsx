'use client';

import { AlertCircle, Download } from 'lucide-react';

/**
 * COMMISSION REPORTING PAGE
 * 
 * Broker commission tracking and payroll export
 * NOTE: Depends on Agent 1 creating commissionRates/commissionPayables tables
 */

interface CommissionRecord {
  brokerId: string;
  brokerName: string;
  activeEnrollments: number;
  commissionRate: number;
  calculatedPayout: number;
  status: 'pending' | 'paid';
}

// Mock data - will be real Convex queries once commission tables exist
const MOCK_COMMISSIONS: CommissionRecord[] = [
  {
    brokerId: 'broker_001',
    brokerName: 'John Smith (American Fidelity)',
    activeEnrollments: 45,
    commissionRate: 2.5, // $2.50 per member per month
    calculatedPayout: 112.5, // 45 * 2.50
    status: 'pending',
  },
  {
    brokerId: 'broker_002',
    brokerName: 'Sarah Johnson (Independent)',
    activeEnrollments: 28,
    commissionRate: 2.0,
    calculatedPayout: 56.0,
    status: 'paid',
  },
  {
    brokerId: 'broker_003',
    brokerName: 'Agency XYZ (Group)',
    activeEnrollments: 67,
    commissionRate: 1.5, // Agency override rate
    calculatedPayout: 100.5,
    status: 'pending',
  },
];

export default function CommissionsPage() {
  const totalPayout = MOCK_COMMISSIONS.reduce((sum, c) => sum + c.calculatedPayout, 0);
  const pendingAmount = MOCK_COMMISSIONS.filter((c) => c.status === 'pending').reduce(
    (sum, c) => sum + c.calculatedPayout,
    0
  );

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Commission Reporting</h1>
        <p className="text-slate-600">Broker commission tracking and payroll exports</p>
      </div>

      {/* Dependency Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
        <div>
          <p className="text-sm font-semibold text-amber-900">Commission Tables Required</p>
          <p className="text-sm text-amber-800 mt-1">
            Real commission data requires Agent 1 to create commissionRates and commissionPayables tables in the schema.
            The page below shows mock data for demonstration.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total Brokers</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{MOCK_COMMISSIONS.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Pending Payout</p>
          <p className="text-4xl font-bold text-amber-600 mt-2">${pendingAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-slate-600 text-sm">Total {currentMonth}</p>
          <p className="text-4xl font-bold text-green-600 mt-2">${totalPayout.toFixed(2)}</p>
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
          <h2 className="text-lg font-semibold text-slate-900">Broker Commissions ({currentMonth})</h2>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Broker / Agency</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Active Enrollments</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Rate</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Calculated Payout</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MOCK_COMMISSIONS.map((commission) => (
              <tr key={commission.brokerId} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{commission.brokerName}</td>
                <td className="px-6 py-4 text-right">{commission.activeEnrollments}</td>
                <td className="px-6 py-4 text-right font-mono">
                  ${commission.commissionRate.toFixed(2)}/member
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">
                  ${commission.calculatedPayout.toFixed(2)}
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
                ${totalPayout.toFixed(2)}
              </td>
              <td className="px-6 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes on Tiered Commissions */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-900 mb-2">Tiered Commission Structures</p>
        <p className="text-sm text-slate-600 mb-3">
          The system supports tiered commission rates (agent rate + agency override), per the Feb 27 meeting discussion 
          on American Fidelity commission requirements.
        </p>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Agent commission rates set at broker onboarding</li>
          <li>• Agency-level overrides override agent rates when configured</li>
          <li>• Commission calculations update in real-time as new enrollments complete</li>
          <li>• Export for payroll integration via CSV</li>
        </ul>
      </div>
    </div>
  );
}
