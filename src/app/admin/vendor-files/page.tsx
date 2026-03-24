'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { FunctionReference } from 'convex/server';
import { Download, BarChart3, AlertCircle } from 'lucide-react';

export default function VendorFilesPage() {
  const [generatingVendor, setGeneratingVendor] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const vendorConfigs = useQuery(api.admin.vendorFiles.getVendorConfigurations) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];

  const generateDDN = useAction(
    "admin/vendorFiles:generateDentalDiscountNetworkFile" as unknown as FunctionReference<"action", "public", { groupId: Id<'groups'>; fileType?: 'full' | 'delta' }, any>
  );
  const generateDialCare = useAction(
    "admin/vendorFiles:generateDialCareFile" as unknown as FunctionReference<"action", "public", { groupId: Id<'groups'> }, any>
  );

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async (vendorName: string) => {
    if (!selectedGroupId) { alert('Please select a group first.'); return; }
    setGeneratingVendor(vendorName);
    try {
      const groupId = selectedGroupId as Id<'groups'>;
      let result: any;
      if (vendorName === 'Dental Discount Network') {
        result = await generateDDN({ groupId, fileType: 'full' });
      } else {
        result = await generateDialCare({ groupId });
      }
      if (result?.content) {
        downloadFile(result.filename, result.content);
      }
    } catch (err) {
      alert(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingVendor(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Vendor File Management</h1>
        <p className="text-slate-600">Generate and download eligibility files for vendors</p>
      </div>

      {/* Group Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-semibold text-slate-900 mb-2">Select Group</label>
        <select
          value={selectedGroupId}
          onChange={e => setSelectedGroupId(e.target.value)}
          className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Group...</option>
          {groups.map((g: any) => (
            <option key={g._id} value={g._id}>{g.groupCode} — {g.name || g.slug}</option>
          ))}
        </select>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vendorConfigs.map((vendor: any) => (
          <div key={vendor.vendor} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{vendor.vendor}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${vendor.status === 'ready' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {vendor.status}
              </span>
            </div>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-slate-600">Last Generated:</span>
                <span className="font-medium">{vendor.lastGenerated ? new Date(vendor.lastGenerated).toLocaleString() : '—'}</span>
              </div>
            </div>
            <button
              onClick={() => handleGenerate(vendor.vendor)}
              disabled={generatingVendor === vendor.vendor || !selectedGroupId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingVendor === vendor.vendor ? (
                'Generating...'
              ) : (
                <>
                  <Download size={16} />
                  Generate & Download
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
        <div>
          <p className="text-sm font-semibold text-amber-900">Manual Delivery</p>
          <p className="text-sm text-amber-800 mt-1">
            Download the generated file and deliver it via your secure channel to the vendor.
          </p>
        </div>
      </div>
    </div>
  );
}
