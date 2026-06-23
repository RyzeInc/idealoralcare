'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Upload, FileUp, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronRight, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import { useToast, Breadcrumbs, RequiredMark } from '@/components/admin/ui';

type FileAction = 'full_replace' | 'additions' | 'terminations' | 'delta';
type FileExt = 'csv' | 'xlsx' | 'txt' | 'json';

const LS_GROUP_KEY = 'eligibility:lastGroupId';
const LS_ACTION_KEY = 'eligibility:lastFileAction';

function extractSourceDateFromFilename(fileName: string): string {
  const match = fileName.match(/(\d{8})/);
  if (match) return match[1];
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export default function EligibilityUploadPage() {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAction, setFileAction] = useState<FileAction>('full_replace');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [pendingStorageId, setPendingStorageId] = useState<string | null>(null);
  const [pendingFileType, setPendingFileType] = useState<FileExt | null>(null);

  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const eligibilityFiles = useQuery(api.admin.eligibility.getAllEligibilityFiles) || [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) || [];
  const sites = useQuery(api.admin.hierarchy.getSites) || [];

  const generateUploadUrl = useMutation(api.admin.eligibility.generateUploadUrl);
  const uploadEligibilityFile = useMutation(api.admin.eligibility.uploadEligibilityFile);
  const processFile = useAction(api.admin.eligibility.processEligibilityFile);
  const previewEligibilityFile = useAction(api.admin.eligibility.previewEligibilityFile);
  const provisionFile = useAction(api.admin.eligibilityProvisioning.provisionEligibilityFile);
  const resendInvite = useAction(api.admin.eligibilityProvisioning.resendInvite);
  const backfillDependents = useAction(api.admin.eligibilityProvisioning.backfillDependentsForFile);
  const sendVendorFile = useAction(api.admin.sftpDelivery.generateAndSendVendorFile);
  const [provisioningFileId, setProvisioningFileId] = useState<string | null>(null);
  const [sendingFileId, setSendingFileId] = useState<string | null>(null);
  const [resendingMemberId, setResendingMemberId] = useState<string | null>(null);
  const [backfillingFileId, setBackfillingFileId] = useState<string | null>(null);

  // Grant Access modal state
  const [grantAccessFileId, setGrantAccessFileId] = useState<Id<'eligibilityFiles'> | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const allFileMembers = useQuery(
    api.admin.eligibilityProvisioning.getAllMembersForFile,
    grantAccessFileId ? { fileId: grantAccessFileId } : 'skip'
  );

  // Restore last-used group + action from localStorage
  useEffect(() => {
    try {
      const g = localStorage.getItem(LS_GROUP_KEY);
      const a = localStorage.getItem(LS_ACTION_KEY) as FileAction | null;
      if (g) setSelectedOrganizationId(g);
      if (a) setFileAction(a);
    } catch {}
  }, []);
  useEffect(() => {
    if (selectedOrganizationId) {
      try { localStorage.setItem(LS_GROUP_KEY, selectedOrganizationId); } catch {}
    }
  }, [selectedOrganizationId]);
  useEffect(() => {
    try { localStorage.setItem(LS_ACTION_KEY, fileAction); } catch {}
  }, [fileAction]);

  const selectedGroup: any = groups.find((g: any) => g._id === selectedOrganizationId);
  const selectedSite: any = selectedGroup ? sites.find((s: any) => s._id === selectedGroup.siteId) : null;

  const resetWizard = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewResult(null);
    setPendingStorageId(null);
    setPendingFileType(null);
  };

  const detectFileExt = (name: string): FileExt => {
    const lower = name.toLowerCase();
    return lower.endsWith('.xlsx') ? 'xlsx'
      : lower.endsWith('.txt') ? 'txt'
      : lower.endsWith('.json') ? 'json'
      : 'csv';
  };

  // Step 2 → upload file to Convex storage and run preview
  const handlePreview = async (file: File) => {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'text/csv' },
        body: file,
      });
      if (!result.ok) throw new Error('File upload failed');
      const { storageId } = await result.json();
      const fileType = detectFileExt(file.name);
      setPendingStorageId(storageId);
      setPendingFileType(fileType);

      const preview: any = await previewEligibilityFile({
        storageId,
        fileType,
        fileName: file.name,
      });
      setPreviewResult(preview);
      setStep(3);
    } catch (err) {
      toast.fromError(err, 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  // Step 3 → commit: create eligibilityFiles record + dispatch processing
  const handleCommit = async () => {
    if (!selectedFile || !selectedGroup || !pendingStorageId || !pendingFileType) return;
    setUploading(true);
    try {
      const record = await uploadEligibilityFile({
        groupId: selectedGroup._id as Id<'groups'>,
        siteId: selectedGroup.siteId as Id<'sites'>,
        fileName: selectedFile.name,
        storageId: pendingStorageId,
        fileType: pendingFileType,
        fileAction,
        sourceDate: extractSourceDateFromFilename(selectedFile.name),
      });
      if (record?._id) {
        await processFile({ fileId: record._id });
        toast.success('Upload submitted', 'Processing has started — watch the file list below for status.');
      }
      resetWizard();
    } catch (err) {
      toast.fromError(err, 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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

  // Convert error array → CSV (escapes quotes and wraps fields)
  const errorsToCsv = (errors: any[]): string => {
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = 'row,field,message,severity';
    const lines = errors.map((e) => {
      if (typeof e === 'string') return `,,${escape(e)},error`;
      return [escape(e.row ?? ''), escape(e.field ?? ''), escape(e.message ?? ''), escape(e.severity ?? 'error')].join(',');
    });
    return [header, ...lines].join('\n');
  };

  const downloadErrorReport = (baseName: string, parsing: any[] = [], validation: any[] = []) => {
    const all = [
      ...parsing.map((e) => ({ ...e, severity: 'parsing' })),
      ...validation.map((e) => ({ ...e, severity: 'validation' })),
    ];
    if (all.length === 0) {
      toast.info('No errors to export', 'This file has no recorded issues.');
      return;
    }
    const safeName = baseName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '_');
    downloadStringAsFile(`${safeName}_errors.csv`, errorsToCsv(all));
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
        toast.success(
          `Generated ${res.filename}`,
          `${res.memberCount} members. ${res.error ? res.error : 'File downloaded to your computer.'} (SHA-256: ${res.sha256.slice(0, 12)}…)`
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
      toast.success(
        'SFTP push succeeded',
        `${res.filename} — ${res.memberCount} members → ${pushJson.host}:${pushJson.remotePath}`
      );
    } catch (err) {
      toast.fromError(err, 'Send to Careington failed');
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
        toast.warning('Nothing to preview', 'No content was generated.');
        return;
      }
      // Always download so the team can open it and verify formatting
      // (matches Eligibility Guide Appendix A — pipe-delimited .txt).
      downloadStringAsFile(res.filename, res.content);

      const sample = res.content.split(/\r?\n/).filter((l: string) => l.trim()).slice(0, 2);
      const pipeCount = sample[0] ? (sample[0].match(/\|/g) ?? []).length : 0;
      const usesCRLF = res.content.includes('\r\n');
      const formatOk = pipeCount === 27 && usesCRLF;
      (formatOk ? toast.success : toast.warning)(
        `Generated ${res.filename}`,
        `${res.memberCount} members · ${res.rowCount} rows · ${pipeCount}/27 pipes · ${usesCRLF ? 'CRLF✓' : 'LF (Careington requires CRLF)'}`
      );
    } catch (err) {
      toast.fromError(err, 'Preview failed');
    } finally {
      setSendingFileId(null);
    }
  };

  const handleFile = (file: File) => {
    const n = file.name.toLowerCase();
    if (!n.endsWith('.csv') && !n.endsWith('.xlsx') && !n.endsWith('.txt') && !n.endsWith('.json')) {
      toast.warning('Unsupported file type', 'Please upload a CSV, XLSX, TXT (Careington pipe-delimited), or JSON file.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.warning('File too large', 'File is larger than 50MB. Please split it into smaller batches.');
      return;
    }
    setSelectedFile(file);
    setPreviewResult(null);
    setPendingStorageId(null);
    setPendingFileType(null);
    // auto-run preview as soon as a file is selected in step 2
    handlePreview(file);
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
    // Legacy single-shot path retained for backwards compatibility.
    // Wizard now uses handlePreview → handleCommit instead.
    if (!selectedFile || !selectedOrganizationId) return;
    const group = groups.find((g: any) => g._id === selectedOrganizationId);
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
        sourceDate: extractSourceDateFromFilename(selectedFile.name),
      });

      // 4. Trigger processing
      if (record?._id) {
        await processFile({ fileId: record._id });
      }

      setSelectedFile(null);
    } catch (err) {
      toast.fromError(err, 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // 26-column Careington Census Template — exact column names and order.
    // Employers fill this in and upload via this page (CSV or XLSX accepted).
    // Column spec: Title | First Name | Middle Name | Last Name | Post Name |
    //   Unique ID | Sequence Number | Address Line 1 | Address Line 2 | City |
    //   State | Zip | Plus 4 | Home Phone | Work Phone | Coverage | Group Code |
    //   Termination Date | Effective Date | Date of Birth | Relation |
    //   Student Status | Gender | Email Address | Reporting Segment | Guardian
    //
    // Field notes:
    //   Unique ID    — assigned by employer; numeric, max 12 digits, no SSNs
    //   Sequence No  — "00" = primary; "01","02"... = dependents (per family)
    //   Coverage     — MF=Family, MO=Member Only, MS=Member+Spouse, MD=Member+Child
    //   Relation     — blank=primary, S=Spouse, C=Child, O=Other
    //   Student Stat — Y/N for dependents only
    //   Guardian     — 1=primary/guardian, 0=dependent
    const csv = [
      'Title,First Name,Middle Name,Last Name,Post Name,Unique ID,Sequence Number,Address Line 1,Address Line 2,City,State,Zip,Plus 4,Home Phone,Work Phone,Coverage,Group Code,Termination Date,Effective Date,Date of Birth,Relation,Student Status,Gender,Email Address,Reporting Segment,Guardian',
      ',Jane,,Smith,,0000000001,00,123 Main St,,Dallas,TX,75001,,8175551234,,MF,IDEALDO,,01/01/2026,03/15/1985,,,F,jane.smith@example.com,,1',
      ',John,,Smith,,0000000001,01,123 Main St,,Dallas,TX,75001,,8175551234,,MF,IDEALDO,,01/01/2026,07/22/1987,S,N,M,jane.smith@example.com,,0',
      ',Sam,,Smith,,0000000001,02,123 Main St,,Dallas,TX,75001,,8175551234,,MF,IDEALDO,,01/01/2026,11/30/2010,C,N,M,jane.smith@example.com,,0',
      ',Mary,,Jones,,0000000002,00,456 Oak Ave,,Austin,TX,78701,,5125559876,,MO,IDEALDO,,01/01/2026,06/14/1978,,,F,mary.jones@example.com,,1',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ideal_census_template.csv';
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
    <>
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Eligibility Files' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Eligibility Files</h1>
          <p className="text-slate-600">Upload eligibility files to provision and sync members. Preview before committing.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 text-slate-700"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>

      {/* ─── 3-Step Wizard ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow border border-slate-200">
        {/* Stepper */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          {[
            { n: 1, label: 'Choose Group' },
            { n: 2, label: 'Upload File' },
            { n: 3, label: 'Review & Confirm' },
          ].map((s, idx, arr) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? 'bg-green-600 text-white'
                        : active ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? <CheckCircle size={14} /> : s.n}
                  </div>
                  <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${step > s.n ? 'bg-green-600' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Sticky group banner — visible from Step 2 onward */}
        {step > 1 && selectedGroup && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <div className="text-sm text-blue-900">
              Uploading to:{' '}
              {selectedGroup.organizationCode && (
                <span className="font-mono font-semibold">[{selectedGroup.organizationCode}]</span>
              )}{' '}
              <span className="font-semibold">{selectedGroup.name || selectedGroup.slug}</span>
              {selectedSite && <span className="text-blue-700"> — {selectedSite.name || selectedSite.slug}</span>}
              <span className="ml-3 text-xs text-blue-700">
                Action: <span className="font-semibold">{fileAction.replace('_', ' ')}</span>
              </span>
            </div>
            <button
              onClick={resetWizard}
              className="text-xs text-blue-700 hover:text-blue-900 underline"
              title="Cancel and start over"
            >
              Start over
            </button>
          </div>
        )}

        {/* ─── STEP 1: Organization + Action ───────────────── */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Organization<RequiredMark />
              </label>
              <select
                value={selectedOrganizationId}
                onChange={(e) => setSelectedOrganizationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              >
                <option value="">Select an organization…</option>
                {groups.map((g: any) => (
                  <option key={g._id} value={g._id}>
                    {g.organizationCode ? `[${g.organizationCode}] ` : ''}{g.name || g.slug}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                All members in this file will be assigned to this organization. Their Subscriber ID will be the organization code.
                You can upload eligibility files for multiple organizations; they will be aggregated into the monthly outbound file to Careington.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">File Action</label>
              <select
                value={fileAction}
                onChange={(e) => setFileAction(e.target.value as FileAction)}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              >
                <option value="full_replace">Full Replace — replace all current eligibility</option>
                <option value="additions">Additions Only — add new members, leave existing alone</option>
                <option value="terminations">Terminations — mark members as terminated</option>
                <option value="delta">Delta (Smart) — auto-detect adds, updates, terms</option>
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedOrganizationId}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                Next: Upload File <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Upload + Auto-Preview ───────── */}
        {step === 2 && (
          <div className="p-6 space-y-4">
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
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Eligibility File</h3>
                  <p className="text-slate-600 mb-4">Drag and drop your file here, or click to select</p>
                </>
              )}
              <label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.txt,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={previewing}
                />
                <span className={`px-6 py-2 text-white rounded inline-block ${previewing ? 'bg-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
                  {previewing ? 'Previewing…' : selectedFile ? 'Change File' : 'Choose File'}
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-4">
                CSV, XLSX, TXT (pipe-delimited), or JSON. Max 50MB / {(10000).toLocaleString()} primary members.
              </p>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => { setStep(1); setSelectedFile(null); setPreviewResult(null); }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"
              >
                <Download size={16} /> Download Template
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Review + Confirm ─────────────── */}
        {step === 3 && previewResult && selectedFile && (
          <div className="p-6 space-y-4">
            {previewResult.tooLarge && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  This file has <strong>{previewResult.primaryCount.toLocaleString()}</strong> primary members,
                  which exceeds the {previewResult.maxRecords.toLocaleString()} per-upload limit. Please split it.
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Primary Members" value={previewResult.primaryCount.toLocaleString()} tone="blue" />
              <SummaryCard label="Dependents" value={previewResult.dependentCount.toLocaleString()} tone="slate" />
              <SummaryCard label="Total Lives" value={(previewResult.primaryCount + previewResult.dependentCount).toLocaleString()} tone="green" />
              <SummaryCard label="Parsing Issues" value={previewResult.errorCount.toLocaleString()} tone={previewResult.errorCount > 0 ? 'amber' : 'slate'} />
              <SummaryCard label="Missing Fields" value={previewResult.recordsWithValidationIssues.toLocaleString()} tone={previewResult.recordsWithValidationIssues > 0 ? 'red' : 'slate'} />
            </div>

            {/* Detected columns */}
            {previewResult.detectedColumns?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Detected columns ({previewResult.detectedColumns.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {previewResult.detectedColumns.slice(0, 30).map((c: string, i: number) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                      {c}
                    </span>
                  ))}
                  {previewResult.detectedColumns.length > 30 && (
                    <span className="text-xs text-slate-500">+{previewResult.detectedColumns.length - 30} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Sample preview */}
            {previewResult.sampleRecords?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Preview (first {previewResult.sampleRecords.length} of {previewResult.primaryCount.toLocaleString()})</p>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">DOB</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Effective</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-700">Deps</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-700">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewResult.sampleRecords.map((r: any, i: number) => (
                        <tr key={i} className={r.validationIssues ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 text-slate-900">{r.firstName} {r.lastName}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{r.email || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{r.dateOfBirth || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{r.effectiveDate || '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{r.dependentCount}</td>
                          <td className="px-3 py-2 text-center">
                            {r.validationIssues ? (
                              <span className="inline-block px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-semibold">
                                {r.validationIssues}
                              </span>
                            ) : (
                              <span className="text-slate-400">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Issues panel */}
            {previewResult.errors?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  {previewResult.errorCount} parsing issue(s){previewResult.errorCount > previewResult.errors.length ? ` (showing first ${previewResult.errors.length})` : ''}
                </p>
                <div className="border border-amber-200 bg-amber-50 rounded p-2 max-h-40 overflow-y-auto space-y-1">
                  {previewResult.errors.map((e: any, i: number) => (
                    <p key={i} className="text-xs text-amber-900 font-mono">
                      Row {e.row}{e.field ? ` [${e.field}]` : ''}: {e.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Validation errors panel — Census Template required fields */}
            {previewResult.validationErrors?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-800 mb-1">
                  ⚠️ {previewResult.recordsWithValidationIssues} member(s) missing required fields ({previewResult.validationErrorCount} field issues){previewResult.validationErrorCount > previewResult.validationErrors.length ? ` — showing first ${previewResult.validationErrors.length}` : ''}
                </p>
                <div className="border border-red-300 bg-red-50 rounded p-3 max-h-48 overflow-y-auto space-y-2">
                  <div className="text-xs text-red-900 space-y-1">
                    {previewResult.validationErrors.map((e: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-mono text-red-700 flex-shrink-0 min-w-fit">Row {e.row}:</span>
                        <div className="flex-1">
                          <span className="font-semibold text-red-800">{e.field}</span>
                          <span className="text-red-700"> — {e.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewResult.validationErrorCount > previewResult.validationErrors.length && (
                    <p className="text-xs text-red-700 pt-1 border-t border-red-200">
                      ... and {previewResult.validationErrorCount - previewResult.validationErrors.length} more issues
                    </p>
                  )}
                </div>
              </div>
            )}

            {previewResult.primaryCount === 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                No valid member records were found in this file.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={() => { setStep(2); setPreviewResult(null); }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <div className="flex items-center gap-2">
                {((previewResult.errors?.length ?? 0) > 0 || (previewResult.validationErrors?.length ?? 0) > 0) && (
                  <button
                    onClick={() => downloadErrorReport(
                      selectedFile.name,
                      previewResult.errors ?? [],
                      previewResult.validationErrors ?? [],
                    )}
                    className="flex items-center gap-2 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded hover:bg-amber-100 text-sm"
                    title="Download all parsing and validation errors as a CSV file you can fix and re-upload."
                  >
                    <Download size={14} /> Download Errors (CSV)
                  </button>
                )}
                <button
                  onClick={handleCommit}
                  disabled={uploading || previewResult.tooLarge || previewResult.primaryCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >
                  {uploading ? 'Processing…' : `Process ${previewResult.primaryCount.toLocaleString()} Members`}
                </button>
              </div>
            </div>
          </div>
        )}
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
                      <td className="px-6 py-4 text-sm min-w-max">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${file.totalRecords > 0 ? (file.processedRecords / file.totalRecords) * 100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{file.processedRecords} / {file.totalRecords} members</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col gap-1 items-end">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                              <button
                                disabled={provisioningFileId === file._id}
                                onClick={() => {
                                  setGrantAccessFileId(file._id as Id<'eligibilityFiles'>);
                                  setSelectedMemberIds(new Set());
                                }}
                                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                                title="Preview and select members before granting access."
                              >
                                {provisioningFileId === file._id ? 'Granting…' : 'Grant Access'}
                              </button>
                            )}
                            {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                              <button
                                disabled={backfillingFileId === file._id}
                                onClick={async () => {
                                  setBackfillingFileId(file._id);
                                  try {
                                    const res: any = await backfillDependents({ fileId: file._id });
                                    if (res.errors?.length > 0) {
                                      toast.warning(
                                        `Backfill partial: ${res.created} created, ${res.skipped} skipped`,
                                        res.errors.slice(0, 3).join(' • ')
                                      );
                                    } else {
                                      toast.success(
                                        'Dependents backfilled',
                                        `${res.created} dependent profile${res.created !== 1 ? 's' : ''} created, ${res.skipped} already existed`
                                      );
                                    }
                                  } catch (err) {
                                    toast.fromError(err, 'Backfill failed');
                                  } finally {
                                    setBackfillingFileId(null);
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-50 whitespace-nowrap"
                                title="Create missing dependent profiles from the embedded dependents array on primary profiles."
                              >
                                {backfillingFileId === file._id ? 'Backfilling…' : 'Backfill Deps'}
                              </button>
                            )}
                            {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                              <button
                                disabled={sendingFileId === file._id}
                                onClick={() => handlePreviewCareington(file)}
                                className="text-xs px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                                title="Download and inspect the Careington pipe-delimited file format before sending."
                              >
                                {sendingFileId === file._id ? 'Previewing…' : 'Preview File'}
                              </button>
                            )}
                            {(file.status === 'completed' || file.status === 'completed_with_errors') && (
                              <button
                                disabled={sendingFileId === file._id}
                                onClick={() => handleSendToCareington(file)}
                                className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
                                title="Push the Careington pipe-delimited file via SFTP to Careington."
                              >
                                {sendingFileId === file._id ? 'Sending…' : 'Send to Careington'}
                              </button>
                            )}
                            {(file.status === 'failed' || file.status === 'completed_with_errors') && (
                              <button
                                onClick={async () => {
                                  try { await processFile({ fileId: file._id }); toast.success('Re-processing started'); }
                                  catch (err) { toast.fromError(err, 'Re-process failed'); }
                                }}
                                className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 whitespace-nowrap"
                                title="Retry processing the file with the latest code."
                              >
                                Retry Processing
                              </button>
                            )}
                          </div>
                          {(file.errors ?? []).length > 0 && (
                            <button
                              onClick={() => setExpandedFile(expandedFile === file._id ? null : file._id)}
                              className="text-xs text-orange-600 hover:text-orange-700 underline"
                            >
                              {expandedFile === file._id ? 'Hide' : `Show ${file.errors.length} issue(s)`}
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
                          {(file.errors ?? []).length > 0 && (
                            <button
                              onClick={() => downloadErrorReport(file.fileName, file.errors ?? [], [])}
                              className="mb-2 inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-100"
                              title="Download all errors for this file as CSV."
                            >
                              <Download size={12} /> Download Errors (CSV)
                            </button>
                          )}
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

    {/* ── Grant Access preview/selection modal ── */}
    {grantAccessFileId && (() => {
      const members = allFileMembers ?? [];

      // "Ready to invite" = eligible/lead, has email, not yet linked to Clerk
      const PROVISIONABLE_STATUSES = new Set(['eligible', 'lead']);
      const provisionable = members.filter((m: any) => !!m.email && !m.customerId && PROVISIONABLE_STATUSES.has(m.memberType));
      const provisionableIds = new Set(provisionable.map((m: any) => m._id));

      // "Invited, pending acceptance" = enrolling + no customerId
      const pendingMembers = members.filter((m: any) => m.memberType === 'enrolling' && !m.customerId);

      const STATUS_META: Record<string, { label: string; bg: string; text: string; description: string }> = {
        active:     { label: 'Active',           bg: 'bg-green-50',  text: 'text-green-700',  description: 'Clerk account + Toothlens registered' },
        enrolling:  { label: 'Invited — Pending', bg: 'bg-blue-50',   text: 'text-blue-700',   description: 'Invite sent, awaiting acceptance' },
        eligible:   { label: 'Ready to Invite',  bg: 'bg-amber-50',  text: 'text-amber-700',  description: 'Can receive invite now' },
        lead:       { label: 'Ready to Invite',  bg: 'bg-amber-50',  text: 'text-amber-700',  description: 'Can receive invite now' },
        inactive:   { label: 'Inactive',         bg: 'bg-slate-100', text: 'text-slate-500',  description: 'Not currently eligible' },
        terminated: { label: 'Terminated',       bg: 'bg-red-50',    text: 'text-red-600',    description: 'Removed from eligibility' },
        declined:   { label: 'Declined',         bg: 'bg-orange-50', text: 'text-orange-600', description: 'Member declined enrollment' },
      };

      const statusCounts: Record<string, number> = {};
      for (const m of members) statusCounts[m.memberType] = (statusCounts[m.memberType] ?? 0) + 1;

      function timeAgo(ts: number | null): string | null {
        if (!ts) return null;
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      }

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="px-6 py-4 border-b">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Grant Access — Member Review</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Sends a <strong>set-password email</strong> to selected members. When they accept,
                    their <strong>Clerk account</strong> is created, employer-paid plan is activated,
                    and <strong>Toothlens AI scan</strong> is registered automatically.
                  </p>
                </div>
                <button
                  onClick={() => { setGrantAccessFileId(null); setSelectedMemberIds(new Set()); }}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5"
                  aria-label="Close"
                >✕</button>
              </div>

              {/* Status summary pills */}
              {members.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const meta = STATUS_META[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600', description: '' };
                    return (
                      <span key={status} title={meta.description} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-default ${meta.bg} ${meta.text}`}>
                        {meta.label} <span className="font-bold">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto">
              {!allFileMembers ? (
                <div className="px-6 py-8 text-center text-slate-400 text-sm">Loading members…</div>
              ) : members.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">No members found in this file.</div>
              ) : (
                <>
                  {/* Select-all bar — only shown when there are provisionable members */}
                  {provisionable.length > 0 && (
                    <div className="px-6 py-2 border-b bg-amber-50 flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="select-all-members"
                        className="h-4 w-4 rounded border-amber-300 text-amber-600 cursor-pointer"
                        checked={provisionable.every((m: any) => selectedMemberIds.has(m._id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds(new Set(provisionable.map((m: any) => m._id)));
                          } else {
                            setSelectedMemberIds(new Set());
                          }
                        }}
                      />
                      <label htmlFor="select-all-members" className="text-xs font-medium text-amber-800 cursor-pointer select-none">
                        Select all {provisionable.length} ready-to-invite member{provisionable.length !== 1 ? 's' : ''}
                      </label>
                    </div>
                  )}

                  <ul className="divide-y divide-slate-100">
                    {members.map((m: any) => {
                      const isProvisionable = provisionableIds.has(m._id);
                      const isPending = m.memberType === 'enrolling' && !m.customerId;
                      const checked = selectedMemberIds.has(m._id);
                      const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || '(No name)';
                      const isDependent = m.memberRole === 'dependent';
                      const meta = STATUS_META[m.memberType] ?? { label: m.memberType, bg: 'bg-slate-100', text: 'text-slate-600', description: '' };
                      const isResending = resendingMemberId === m._id;

                      return (
                        <li
                          key={m._id}
                          className={`flex items-center gap-3 px-6 py-3 ${isProvisionable ? 'cursor-pointer hover:bg-slate-50' : 'opacity-70'} ${checked ? 'bg-amber-50/50' : ''}`}
                          onClick={() => {
                            if (!isProvisionable) return;
                            setSelectedMemberIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(m._id)) next.delete(m._id); else next.add(m._id);
                              return next;
                            });
                          }}
                        >
                          {/* Checkbox or status indicator */}
                          <div className="w-4 flex-shrink-0">
                            {isProvisionable ? (
                              <input type="checkbox" readOnly checked={checked} className="h-4 w-4 rounded border-slate-300 text-blue-600 pointer-events-none" />
                            ) : (
                              <span className={`block h-2 w-2 rounded-full ml-1 ${m.memberType === 'active' ? 'bg-green-400' : m.memberType === 'enrolling' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                            )}
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {m.email ?? <span className="italic text-red-400">No email — cannot invite</span>}
                              {isPending && m.lastInvitedAt && (
                                <span className="ml-2 text-blue-400">· invited {timeAgo(m.lastInvitedAt)}</span>
                              )}
                            </p>
                          </div>

                          {/* Role badge */}
                          <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${isDependent ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {isDependent ? `Dep${m.relationship ? ` · ${m.relationship}` : ''}` : 'Primary'}
                          </span>

                          {/* Status badge or Resend button */}
                          {isPending ? (
                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                              <button
                                disabled={isResending}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setResendingMemberId(m._id);
                                  try {
                                    await resendInvite({ memberProfileId: m._id });
                                    toast.success('Invite resent', `Set-password email resent to ${m.email}`);
                                  } catch (err) {
                                    toast.fromError(err, 'Resend failed');
                                  } finally {
                                    setResendingMemberId(null);
                                  }
                                }}
                                className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 disabled:opacity-50 whitespace-nowrap"
                              >
                                {isResending ? 'Sending…' : 'Resend'}
                              </button>
                              {(m as any).emailEvent && (m as any).emailEvent !== 'email.sent' && (m as any).emailEvent !== 'email.delivered' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${
                                  (m as any).emailEvent === 'email.bounced' ? 'bg-red-100 text-red-700' :
                                  (m as any).emailEvent === 'email.complained' ? 'bg-orange-100 text-orange-700' :
                                  (m as any).emailEvent === 'email.failed' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {(m as any).emailEvent === 'email.bounced' ? '⚠ Bounced' :
                                   (m as any).emailEvent === 'email.complained' ? '⚠ Complaint' :
                                   (m as any).emailEvent === 'email.failed' ? '⚠ Failed' :
                                   (m as any).emailEvent.replace('email.', '')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span title={meta.description} className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${meta.bg} ${meta.text}`}>
                              {meta.label}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {selectedMemberIds.size > 0
                  ? `${selectedMemberIds.size} of ${provisionable.length} ready member${provisionable.length !== 1 ? 's' : ''} selected`
                  : provisionable.length === 0
                    ? pendingMembers.length > 0
                      ? `${pendingMembers.length} member${pendingMembers.length !== 1 ? 's' : ''} awaiting acceptance — use Resend`
                      : 'No members are ready to invite'
                    : `${provisionable.length} ready to invite — select to continue`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setGrantAccessFileId(null); setSelectedMemberIds(new Set()); }}
                  className="text-xs px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  disabled={selectedMemberIds.size === 0 || provisioningFileId === grantAccessFileId}
                  onClick={async () => {
                    if (selectedMemberIds.size === 0) return;
                    const fileId = grantAccessFileId!;
                    setGrantAccessFileId(null);
                    setProvisioningFileId(fileId);
                    try {
                      const res: any = await provisionFile({
                        fileId,
                        mode: 'invite',
                        memberIds: Array.from(selectedMemberIds) as any[],
                      });
                      const summary = `Attempted ${res.attempted} · Succeeded ${res.succeeded} · Failed ${res.failed} · Skipped ${res.alreadyLinked}`;
                      if (res.failed === 0) {
                        toast.success('Invites sent', summary);
                      } else {
                        const firstErrors = res.errors.slice(0, 3).map((e: any) => `${e.email}: ${e.message}`).join(' • ');
                        toast.warning('Provisioning partial', `${summary}${firstErrors ? ` — ${firstErrors}` : ''}`);
                      }
                    } catch (err) {
                      toast.fromError(err, 'Provisioning failed');
                    } finally {
                      setProvisioningFileId(null);
                      setSelectedMemberIds(new Set());
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {provisioningFileId === grantAccessFileId
                    ? 'Sending invites…'
                    : `Send invite to ${selectedMemberIds.size} member${selectedMemberIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'slate' | 'green' | 'amber' | 'red' }) {
  const toneClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }[tone];
  return (
    <div className={`border rounded-lg p-3 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
