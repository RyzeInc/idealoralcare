'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Download, BarChart3, AlertCircle, CheckCircle, WifiOff, History, Eye, EyeOff } from 'lucide-react';
import { useToast, Breadcrumbs, SkeletonCard } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';
import { PROVIDER_GROUP_CODE } from '@/lib/constants';
import IdMaintenancePanel from './IdMaintenancePanel';

export default function VendorFilesPage() {
  const toast = useToast();
  const [generatingVendor, setGeneratingVendor] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [fileType, setFileType] = useState<'full' | 'delta'>('full');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const vendorConfigsRaw = useQuery(api.admin.vendorFiles.getVendorConfigurations);
  const vendorConfigs = vendorConfigsRaw ?? [];
  const isLoadingVendorConfigs = vendorConfigsRaw === undefined;
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];
  const preview = useQuery(
    api.admin.vendorFiles.getVendorFilePreview,
    selectedOrganizationId ? { groupId: selectedOrganizationId as Id<'groups'> } : "skip"
  );

  const generateDDN = useAction(api.admin.vendorFiles.generateDentalDiscountNetworkFile);
  const generateDialCare = useAction(api.admin.vendorFiles.generateDialCareFile);
  const generateAggregated = useAction(api.admin.vendorFiles.generateAggregatedDentalDiscountNetworkFile);

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
    if (!selectedOrganizationId) {
      toast.warning('Select an organization', 'Pick an organization above before generating a vendor file.');
      return;
    }
    setGeneratingVendor(vendorName);
    try {
      const groupId = selectedOrganizationId as Id<'groups'>;
      let result: any;
      if (vendorName === 'Dental Discount Network') {
        result = await generateDDN({ groupId, fileType });
      } else {
        result = await generateDialCare({ groupId });
      }
      if (result?.content) {
        downloadFile(result.filename, result.content);
        toast.success(`${vendorName} file ready`, `Downloaded ${result.filename}.`);
      }
    } catch (err) {
      toast.fromError(err, `${vendorName} file generation failed`);
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
      toast.success(
        `Aggregated file ready: ${result.filename}`,
        `${orgs} organizations · ${members} members. All users use groupcode ${PROVIDER_GROUP_CODE}.`
      );
    } catch (err) {
      toast.fromError(err, 'Aggregated file generation failed');
    } finally {
      setGeneratingVendor(null);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Vendor Files' }]} />
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Vendor File Management</h1>
        <p className="text-slate-600">Generate and download eligibility files for vendors</p>
      </div>

      {/* Organization Selector + File Type Toggle */}
      <div className="bg-white rounded-lg shadow p-6 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Select Organization</label>
          <select
            value={selectedOrganizationId}
            onChange={e => setSelectedOrganizationId(e.target.value)}
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

      {/* Preview Section */}
      {selectedOrganizationId && preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 w-full text-left font-semibold text-blue-900 hover:text-blue-700"
          >
            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>
              Users to be added: {preview.totalMembers} members ({preview.totalRecords} records including dependents)
            </span>
          </button>
          {showPreview && (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-blue-800 bg-white rounded p-3 border border-blue-100">
                <p className="font-semibold mb-2">Organization: {preview.organizationName}</p>
                <p className="text-xs text-blue-700">GroupCode: <span className="font-mono font-semibold">{preview.groupCode}</span></p>
                <p className="text-xs text-blue-700 mt-1">Total Records: {preview.totalRecords}</p>
              </div>
              <div className="bg-white rounded border border-blue-100 overflow-hidden">
                <div className="text-xs font-semibold text-slate-700 bg-blue-100 px-3 py-2 border-b border-blue-200 grid grid-cols-12 gap-2">
                  <div className="col-span-3">Member</div>
                  <div className="col-span-4">Email</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Records</div>
                </div>
                <div className="divide-y divide-blue-100 max-h-96 overflow-y-auto">
                  {preview.members.map((member: any, idx: number) => (
                    <div key={idx}>
                      {/* Primary member row */}
                      <div className="px-3 py-2 text-xs grid grid-cols-12 gap-2 hover:bg-blue-50">
                        <div className="col-span-3 font-medium text-slate-900">{member.firstName} {member.lastName}</div>
                        <div className="col-span-4 text-slate-600 truncate">{member.email || '—'}</div>
                        <div className="col-span-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            member.memberType === 'active' ? 'bg-green-100 text-green-800' :
                            member.memberType === 'enrolling' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {member.memberType}
                          </span>
                        </div>
                        <div className="col-span-3 text-slate-500">
                          {member.dependentCount > 0 ? `+ ${member.dependentCount} dep${member.dependentCount !== 1 ? 's' : ''}` : 'member only'}
                        </div>
                      </div>
                      {/* Dependent rows */}
                      {member.dependents?.map((dep: any, dIdx: number) => (
                        <div key={dIdx} className="px-3 py-1.5 text-xs grid grid-cols-12 gap-2 bg-slate-50 border-t border-slate-100">
                          <div className="col-span-3 pl-4 text-slate-600 flex items-center gap-1">
                            <span className="text-slate-400">↳</span> {dep.firstName} {dep.lastName}
                          </div>
                          <div className="col-span-4 text-slate-400 italic">—</div>
                          <div className="col-span-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                              {dep.relationship?.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="col-span-3 text-slate-400">{dep.dateOfBirth || '—'}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ID Maintenance */}
      <IdMaintenancePanel />

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoadingVendorConfigs ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : vendorConfigs.map((vendor: any) => (
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
                <span className="font-medium">{formatDateTime(vendor.lastGenerated)}</span>
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
                disabled={generatingVendor === vendor.vendor || !selectedOrganizationId}
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
            </p>
            <p className="text-sm font-semibold text-blue-700 mt-2 flex items-center gap-1">
              <CheckCircle size={14} className="text-green-600" />
              All users ALWAYS use groupcode: <span className="font-mono bg-blue-50 px-2 py-1 rounded">{PROVIDER_GROUP_CODE}</span>
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
