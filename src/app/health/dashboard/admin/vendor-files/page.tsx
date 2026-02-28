'use client';

import { useState } from 'react';
import { Download, Send, BarChart3, AlertCircle } from 'lucide-react';

/**
 * VENDOR FILE MANAGEMENT PAGE
 * 
 * Generate and deliver vendor eligibility files (Careington, Dial Care)
 */

interface VendorFile {
  vendor: string;
  lastGenerated?: string;
  lastDelivered?: string;
  memberCount?: number;
  status: 'ready' | 'generating' | 'error';
}

const VENDORS: VendorFile[] = [
  {
    vendor: 'Careington',
    lastGenerated: '2026-02-20 10:30 AM',
    lastDelivered: '2026-02-20 11:00 AM',
    memberCount: 150,
    status: 'ready',
  },
  {
    vendor: 'Dial Care',
    lastGenerated: '2026-02-20 10:35 AM',
    lastDelivered: 'Pending',
    memberCount: 150,
    status: 'ready',
  },
];

export default function VendorFilesPage() {
  const [vendors, setVendors] = useState(VENDORS);
  const [generatingVendor, setGeneratingVendor] = useState<string | null>(null);

  const handleGenerate = (vendorName: string) => {
    setGeneratingVendor(vendorName);
    // Simulate generation
    setTimeout(() => {
      setGeneratingVendor(null);
      alert(`${vendorName} file generated successfully`);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Vendor File Management</h1>
        <p className="text-slate-600">Generate and deliver eligibility files to vendors</p>
      </div>

      {/* Group Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-semibold text-slate-900 mb-2">Select Group</label>
        <select className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500">
          <option>DTC-DEFAULT-2026</option>
          <option>ACME-GROUP-2026</option>
          <option>EMPLOYER-BENEFIT-2026</option>
        </select>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vendors.map((vendor) => (
          <div key={vendor.vendor} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{vendor.vendor}</h3>
                <p className="text-sm text-slate-600">{vendor.memberCount || 0} active members</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                vendor.status === 'ready'
                  ? 'bg-green-100 text-green-800'
                  : vendor.status === 'generating'
                  ? 'bg-blue-100 text-blue-800 animate-pulse'
                  : 'bg-red-100 text-red-800'
              }`}>
                {vendor.status === 'generating' ? 'Generating...' : vendor.status}
              </div>
            </div>

            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-slate-600">Last Generated:</span>
                <span className="font-medium">{vendor.lastGenerated || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Last Delivered:</span>
                <span className="font-medium text-slate-900">{vendor.lastDelivered || '—'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleGenerate(vendor.vendor)}
                disabled={generatingVendor === vendor.vendor}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 size={16} />
                Generate
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50">
                <Download size={16} />
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50">
                <Send size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
        <div>
          <p className="text-sm font-semibold text-amber-900">Manual Delivery Available</p>
          <p className="text-sm text-amber-800 mt-1">
            SFTP delivery is configured for Careington. For other vendors or manual uploads, download the file and send via your secure channel.
          </p>
        </div>
      </div>

      {/* Delivery History */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Delivery History</h2>
        </div>
        
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Vendor</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium">Careington</td>
              <td className="px-6 py-4 text-slate-600">2026-02-20 11:00 AM</td>
              <td className="px-6 py-4">
                <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">Success</span>
              </td>
              <td className="px-6 py-4 text-right text-slate-600">150</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-6 py-4 font-medium">Dial Care</td>
              <td className="px-6 py-4 text-slate-600">2026-02-19 2:30 PM</td>
              <td className="px-6 py-4">
                <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">Success</span>
              </td>
              <td className="px-6 py-4 text-right text-slate-600">150</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
