'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Upload, FileUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function EligibilityUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAction, setFileAction] = useState<'full_replace' | 'additions' | 'terminations' | 'delta'>('full_replace');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [uploading, setUploading] = useState(false);

  const eligibilityFiles = useQuery(api.admin.eligibility.getAllEligibilityFiles) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];
  const sites = useQuery(api.admin.hierarchy.getSites) || [];

  const generateUploadUrl = useMutation(api.admin.eligibility.generateUploadUrl);
  const uploadEligibilityFile = useMutation(api.admin.eligibility.uploadEligibilityFile);
  const processFile = useAction(api.admin.eligibility.processEligibilityFile);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      alert('Please upload a CSV or XLSX file.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedGroupId) return;
    const group = groups.find((g: any) => g._id === selectedGroupId);
    if (!group) return;

    setUploading(true);
    try {
      // 1. Get upload URL from Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': selectedFile.type || 'text/csv' },
        body: selectedFile,
      });
      if (!result.ok) throw new Error('File upload failed');
      const { storageId } = await result.json();

      // 3. Create eligibility file record
      const fileExt = selectedFile.name.endsWith('.xlsx') ? 'xlsx' as const : 'csv' as const;
      const record = await uploadEligibilityFile({
        groupId: group._id as Id<'groups'>,
        siteId: group.siteId as Id<'sites'>,
        fileName: selectedFile.name,
        storageId,
        fileType: fileExt,
        fileAction,
      });

      // 4. Trigger processing
      if (record?._id) {
        await processFile({ fileId: record._id });
      }

      setSelectedFile(null);
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-green-600" size={20} />;
      case 'processing': case 'validating': return <Clock className="text-blue-600 animate-spin" size={20} />;
      case 'failed': case 'completed_with_errors': return <AlertCircle className="text-red-600" size={20} />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': case 'validating': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'completed_with_errors': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Eligibility Files</h1>
        <p className="text-slate-600">Upload CSV files to batch import or update member records</p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <Upload className="mx-auto mb-4 text-slate-400" size={40} />
        {selectedFile ? (
          <>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{selectedFile.name}</h3>
            <p className="text-slate-600 mb-4">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload CSV File</h3>
            <p className="text-slate-600 mb-4">Drag and drop your file here, or click to select</p>
          </>
        )}
        <label>
          <input type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" />
          <span className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer inline-block">
            {selectedFile ? 'Change File' : 'Choose File'}
          </span>
        </label>
        <p className="text-xs text-slate-500 mt-4">CSV or XLSX format required. Max 50MB.</p>
      </div>

      {/* File Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">File Action</p>
          <select value={fileAction} onChange={e => setFileAction(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded">
            <option value="full_replace">Full Replace</option>
            <option value="additions">Additions Only</option>
            <option value="terminations">Terminations</option>
            <option value="delta">Delta (Smart)</option>
          </select>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">Group</p>
          <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded">
            <option value="">Select Group...</option>
            {groups.map((g: any) => (
              <option key={g._id} value={g._id}>{g.groupCode} — {g.name || g.slug}</option>
            ))}
          </select>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg flex items-end">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedGroupId || uploading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      </div>

      {/* Uploaded Files List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Upload History</h2>
        </div>
        
        {eligibilityFiles.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No files uploaded yet</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Uploaded</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {eligibilityFiles.map((file: any) => (
                <tr key={file._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileUp size={18} className="text-slate-400" />
                      <span className="font-medium text-slate-900">{file.fileName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{file.fileAction?.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${file.totalRecords > 0 ? (file.processedRecords / file.totalRecords) * 100 : 0}%` }} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{file.processedRecords} / {file.totalRecords}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
