'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { FunctionReference } from 'convex/server';
import { Upload, FileUp, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronRight, Download } from 'lucide-react';

export default function EligibilityUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAction, setFileAction] = useState<'full_replace' | 'additions' | 'terminations' | 'delta'>('full_replace');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [uploading, setUploading] = useState(false);

  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const eligibilityFiles = useQuery(api.admin.eligibility.getAllEligibilityFiles) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];
  const sites = useQuery(api.admin.hierarchy.getSites) || [];

  const generateUploadUrl = useMutation(api.admin.eligibility.generateUploadUrl);
  const uploadEligibilityFile = useMutation(api.admin.eligibility.uploadEligibilityFile);
  const processFile = useAction(api.admin.eligibility.processEligibilityFile);
  const provisionFile = useAction(api.admin.eligibilityProvisioning.provisionEligibilityFile);
  const sendVendorFile = useAction(api.admin.sftpDelivery.generateAndSendVendorFile);
  const [provisioningFileId, setProvisioningFileId] = useState<string | null>(null);
  const [sendingFileId, setSendingFileId] = useState<string | null>(null);

  const downloadStringAsFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendToCareington = async (file: any) => {
    const ok = window.confirm(
      `Generate the Careington pipe-delimited eligibility file for "${file.fileName}" and push it via SFTP (or download if SFTP isn't configured)?`
    );
    if (!ok) return;
    setSendingFileId(file._id);
    try {
      const res: any = await sendVendorFile({
        groupId: file.groupId,
        vendor: 'careington',
        fileType: 'full',
        method: 'sftp',
        sourceEligibilityFileId: file._id,
      });
      if (res.method === 'manual_download') {
        if (res.content) downloadStringAsFile(res.filename, res.content);
        alert(
          `Generated ${res.filename}\nMembers: ${res.memberCount}\n` +
          (res.error ? `\n${res.error}\n` : '\nFile downloaded to your computer.\n') +
          `\nSHA-256: ${res.sha256}`
        );
        return;
      }
      // SFTP path: ask the Next.js route to do the actual push.
      const pushRes = await fetch('/api/admin/vendor-deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: res.deliveryId }),
      });
      const pushJson: any = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) {
        throw new Error(pushJson.error || `SFTP push failed (${pushRes.status})`);
      }
      alert(
        `SFTP push succeeded\n\nFile: ${res.filename}\n` +
        `Members: ${res.memberCount}\nRows: ${res.rowCount}\n` +
        `Host: ${pushJson.host}\nRemote path: ${pushJson.remotePath}\n` +
        `Bytes: ${res.bytes}\nSHA-256: ${res.sha256}`
      );
    } catch (err) {
      alert(`Send to Careington failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSendingFileId(null);
    }
  };

  const handlePreviewCareington = async (file: any) => {
    setSendingFileId(file._id);
    try {
      // Generate via the orchestrator with method="manual_download" so we get
      // the file content back without any SFTP push. This is exactly what
      // would be sent to Careington.
      const res: any = await sendVendorFile({
        groupId: file.groupId,
        vendor: 'careington',
        fileType: 'full',
        method: 'manual_download',
        sourceEligibilityFileId: file._id,
      });
      if (!res.content) {
        alert('No content was generated.');
        return;
      }
      // Always download so the team can open it and verify formatting
      // (matches Eligibility Guide Appendix A — pipe-delimited .txt).
      downloadStringAsFile(res.filename, res.content);

      const sample = res.content.split(/\r?\n/).filter((l: string) => l.trim()).slice(0, 2);
      const pipeCount = sample[0] ? (sample[0].match(/\|/g) ?? []).length : 0;
      const usesCRLF = res.content.includes('\r\n');
      alert(
        `Generated ${res.filename}\n\n` +
        `Members: ${res.memberCount}\n` +
        `Rows:    ${res.rowCount}\n` +
        `Bytes:   ${res.bytes}\n` +
        `SHA-256: ${res.sha256}\n\n` +
        `Format check:\n` +
        `  Pipes per row: ${pipeCount}  (Careington CI007 expects 27)\n` +
        `  Line endings:  ${usesCRLF ? 'CRLF ✓' : 'LF (will fail Careington parser)'}\n\n` +
        `First row preview:\n${sample[0] ?? '(empty)'}`
      );
    } catch (err) {
      alert(`Preview failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSendingFileId(null);
    }
  };

  const handleFile = (file: File) => {
    const n = file.name.toLowerCase();
    if (!n.endsWith('.csv') && !n.endsWith('.xlsx') && !n.endsWith('.txt') && !n.endsWith('.json')) {
      alert('Please upload a CSV, XLSX, TXT (Careington pipe-delimited), or JSON file.');
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
      const lower = selectedFile.name.toLowerCase();
      const fileExt: 'csv' | 'xlsx' | 'txt' | 'json' =
        lower.endsWith('.xlsx') ? 'xlsx'
        : lower.endsWith('.txt') ? 'txt'
        : lower.endsWith('.json') ? 'json'
        : 'csv';
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

  const handleDownloadTemplate = () => {
    const csv = [
      'first_name,last_name,email,date_of_birth,employee_id,group_code,action',
      'Jane,Smith,jane.smith@example.com,1985-03-15,EMP-001,ACME-2026,add',
      'John,Doe,john.doe@example.com,1990-07-22,EMP-002,ACME-2026,add',
      'Mary,Jones,mary.jones@example.com,1978-11-30,EMP-003,ACME-2026,terminate',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eligibility_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Eligibility Files</h1>
          <p className="text-slate-600">Upload CSV files to batch import or update member records</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 text-slate-700"
        >
          <Download size={16} />
          Download Template
        </button>
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
          <input type="file" accept=".csv,.xlsx,.txt,.json" onChange={handleFileSelect} className="hidden" />
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 w-6"></th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Uploaded</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Progress</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {eligibilityFiles.map((file: any) => {
                const hasErrors = (file.errors?.length ?? 0) > 0 || file.status === 'failed' || file.status === 'completed_with_errors';
                const isExpanded = expandedFile === file._id;
                return (
                  <React.Fragment key={file._id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        {hasErrors ? (
                          <button onClick={() => setExpandedFile(isExpanded ? null : file._id)} className="text-slate-400 hover:text-slate-600">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : null}
                      </td>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                            <button
                              disabled={provisioningFileId === file._id}
                              onClick={async () => {
                                const ok = window.confirm(
                                  `Send Clerk invitations and grant employer-paid access to all eligible members in "${file.fileName}"?`
                                );
                                if (!ok) return;
                                setProvisioningFileId(file._id);
                                try {
                                  const res: any = await provisionFile({ fileId: file._id, mode: 'invite' });
                                  alert(
                                    `Provisioning complete\n\n` +
                                    `Attempted: ${res.attempted}\n` +
                                    `Succeeded: ${res.succeeded}\n` +
                                    `Failed:    ${res.failed}\n` +
                                    `Already linked (skipped): ${res.alreadyLinked}` +
                                    (res.errors.length
                                      ? `\n\nErrors:\n` + res.errors.slice(0, 10).map((e: any) => `• ${e.email}: ${e.message}`).join('\n')
                                      : '')
                                  );
                                } catch (err) {
                                  alert(`Provisioning failed: ${err instanceof Error ? err.message : 'Unknown'}`);
                                } finally {
                                  setProvisioningFileId(null);
                                }
                              }}
                              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                              title="Create Clerk invitations and provision employer-paid plan access for every eligible member in this file."
                            >
                              {provisioningFileId === file._id ? 'Provisioning…' : 'Provision Access'}
                            </button>
                          )}
                          {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                            <button
                              disabled={sendingFileId === file._id}
                              onClick={() => handlePreviewCareington(file)}
                              className="text-xs px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                              title="Generate the Careington pipe-delimited file and download it locally so you can verify the format BEFORE sending. Does NOT push to SFTP."
                            >
                              {sendingFileId === file._id ? 'Generating…' : 'Preview / Download'}
                            </button>
                          )}
                          {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                            <button
                              disabled={sendingFileId === file._id}
                              onClick={() => handleSendToCareington(file)}
                              className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                              title="Generate the Careington pipe-delimited eligibility file and push it via SFTP (falls back to download if SFTP isn't configured)."
                            >
                              {sendingFileId === file._id ? 'Sending…' : 'Send to Careington'}
                            </button>
                          )}
                          {(file.status === 'failed' || file.status === 'completed_with_errors') && (
                            <button
                              onClick={async () => {
                                try { await processFile({ fileId: file._id }); }
                                catch (err) { alert(`Re-process failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
                              }}
                              className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
                            >
                              Re-process
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && hasErrors && (
                      <tr key={`${file._id}-errors`} className="bg-red-50">
                        <td colSpan={7} className="px-10 py-3">
                          <p className="text-xs font-semibold text-red-700 mb-2">
                            {file.status === 'completed_with_errors'
                              ? `Completed with ${file.errorRecords ?? 0} failed row(s) — ${file.errors?.length ?? 0} error detail(s):`
                              : `Errors (${file.errors?.length ?? 0}):`}
                          </p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {(file.errors ?? []).map((err: any, i: number) => (
                              <p key={i} className="text-xs text-red-600 font-mono bg-red-100 px-2 py-1 rounded">
                                {typeof err === 'string' ? err : `Row ${err.row ?? '?'}${err.field ? ` [${err.field}]` : ''}: ${err.message}`}
                              </p>
                            ))}
                            {(file.errors ?? []).length === 0 && file.errorRecords > 0 && (
                              <p className="text-xs text-slate-500 italic">
                                {file.errorRecords} row(s) failed — click Re-process to retry with updated code that will show details.
                              </p>
                            )}
                            {(file.errors ?? []).length === 0 && !file.errorRecords && (
                              <p className="text-xs text-red-600">Processing failed — no detailed errors recorded.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
