'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { FunctionReference } from 'convex/server';
import { Download, BarChart3, AlertCircle, CheckCircle, WifiOff, History } from 'lucide-react';

export default function VendorFilesPage() {
  const [generatingVendor, setGeneratingVendor] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [fileType, setFileType] = useState<'full' | 'delta'>('full');
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const vendorConfigs = useQuery(api.admin.vendorFiles.getVendorConfigurations) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];

  const generateDDN = useAction(
    "admin/vendorFiles:generateDentalDiscountNetworkFile" as unknown as FunctionReference<"action", "public", { groupId: Id<'groups'>; fileType?: 'full' | 'delta' }, any>
  );
  const generateDialCare = useAction(
    "admin/vendorFiles:generateDialCareFile" as unknown as FunctionReference<"action", "public", { groupId: Id<'groups'> }, any>
  );
  const generateAggregated = useAction(
    "admin/vendorFiles:generateAggregatedDentalDiscountNetworkFile" as unknown as FunctionReference<"action", "public", { fileType?: 'full' | 'delta'; vendor?: 'careington' | 'dialcare' }, any>
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
    if (!selectedGroupId) { alert('Please select an organization first.'); return; }
    setGeneratingVendor(vendorName);
    try {
      const groupId = selectedGroupId as Id<'groups'>;
      let result: any;
      if (vendorName === 'Dental Discount Network') {
        result = await generateDDN({ groupId, fileType });
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

  const handleGenerateAggregated = async (vendor: 'careington' | 'dialcare') => {
    setGeneratingVendor(`AGG-${vendor}`);
    try {
      const result: any = await generateAggregated({ fileType, vendor });
      if (result?.content) {
        downloadFile(result.filename, result.content);
      }
      const orgs = result?.organizationCount ?? 0;
      const members = result?.memberCount ?? 0;
      alert(`Aggregated file ready: ${result.filename}\n${orgs} organizations, ${members} members.`);
    } catch (err) {
      alert(`Aggregated generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

      {/* Organization Selector + File Type Toggle */}
      <div className="bg-white rounded-lg shadow p-6 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Select Organization</label>
          <select
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="w-64 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Select Organization...</option>
            {groups.map((g: any) => (
              <option key={g._id} value={g._id}>{g.organizationCode ? `${g.organizationCode} — ` : ''}{g.name || g.slug}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">File Type</label>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setFileType('full')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${fileType === 'full' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Full
            </button>
            <button
              onClick={() => setFileType('delta')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${fileType === 'delta' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Delta
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">{fileType === 'full' ? 'All active members' : 'Changes since last export'}</p>
        </div>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vendorConfigs.map((vendor: any) => (
          <div key={vendor.vendor} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">{vendor.vendor}</h3>
              <div className="flex items-center gap-2">
                {vendor.status === 'ready'
                  ? <CheckCircle size={16} className="text-green-500" />
                  : <WifiOff size={16} className="text-red-400" />}
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${vendor.status === 'ready' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {vendor.status}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Last Generated:</span>
                <span className="font-medium">{vendor.lastGenerated ? new Date(vendor.lastGenerated).toLocaleString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Format:</span>
                <span className="font-medium font-mono text-xs">{vendor.format || 'CSV'}</span>
              </div>
              {vendor.sftpEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-500">SFTP:</span>
                  <span className="font-medium text-green-600 text-xs">Configured</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerate(vendor.vendor)}
                disabled={generatingVendor === vendor.vendor || !selectedGroupId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {generatingVendor === vendor.vendor ? 'Generating...' : (<><Download size={14} /> Generate & Download</>)}
              </button>
              <button
                onClick={() => setShowHistory(showHistory === vendor.vendor ? null : vendor.vendor)}
                className="p-2 border border-slate-300 rounded hover:bg-slate-50 text-slate-600"
                title="View history"
              >
                <History size={16} />
              </button>
            </div>
            {showHistory === vendor.vendor && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-2">Delivery History</p>
                <p className="text-xs text-slate-400 italic">No SFTP delivery records yet. Generate and download the file to deliver manually.</p>
              </div>
            )}
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

      {/* Aggregated Monthly File */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly Aggregated File (All Organizations)</h2>
            <p className="text-sm text-slate-600 mt-1">
              Compile a single eligibility file containing all members across every active organization.
              This is the file Ideal Health forwards to Careington each month.
              Each row carries its own Provider Group Code so the carrier can attribute members per organization.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleGenerateAggregated('careington')}
            disabled={generatingVendor === 'AGG-careington'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {generatingVendor === 'AGG-careington' ? 'Generating…' : (<><Download size={14} /> Generate Aggregated Careington File ({fileType})</>)}
          </button>
          <button
            onClick={() => handleGenerateAggregated('dialcare')}
            disabled={generatingVendor === 'AGG-dialcare'}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800 disabled:opacity-50 text-sm"
          >
            {generatingVendor === 'AGG-dialcare' ? 'Generating…' : (<><Download size={14} /> Generate Aggregated DialCare File ({fileType})</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
