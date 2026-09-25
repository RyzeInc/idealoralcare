'use client';

import { useRef, useState } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  PenLine,
  Download,
  Upload,
  FileSignature,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { SignaturePad } from '@/components/legal';
import { W9SignModal, W9SignData } from './rep/W9SignModal';

type Method = 'online' | 'upload';
type W9Method = 'esign' | 'upload';

interface Fields {
  partnerAgencyName: string;
  dba: string;
  primaryContactName: string;
  email: string;
  phone: string;
  npnLicenseInfo: string;
  effectiveDate: string;
  printedName: string;
  title: string;
  signedDate: string;
}

function todayStr() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const emptyFields = (): Fields => ({
  partnerAgencyName: '',
  dba: '',
  primaryContactName: '',
  email: '',
  phone: '',
  npnLicenseInfo: '',
  effectiveDate: '',
  printedName: '',
  title: '',
  signedDate: todayStr(),
});

const PDF_TEMPLATE = '/Ideal_Oral_Health_Partner_Kit_Fillable.pdf';
// Full Partner Kit, page-1 (cover) … page-8 (the fillable Agreement).
const KIT_PAGES = Array.from({ length: 8 }, (_, i) => `/partnerkit/page-${i + 1}.jpg`);
const AGREEMENT_IDX = 7; // page-8 is the interactive "Partner Agreement & Acknowledgment"

// Line positions measured from the source PDF render (page 7), as % of the
// document image. y = the line's vertical position; x0/x1 = its horizontal span.
const LINE_H = 2.7; // input box height, % of doc height
const INFO_FIELDS: { key: keyof Fields; y: number; x0: number; x1: number }[] = [
  { key: 'partnerAgencyName', y: 24.81, x0: 30.6, x1: 91.0 },
  { key: 'dba', y: 27.9, x0: 30.6, x1: 91.0 },
  { key: 'primaryContactName', y: 31.06, x0: 30.6, x1: 91.0 },
  { key: 'email', y: 34.17, x0: 30.6, x1: 91.0 },
  { key: 'phone', y: 37.41, x0: 30.6, x1: 91.0 },
  { key: 'npnLicenseInfo', y: 40.67, x0: 30.6, x1: 91.0 },
  { key: 'effectiveDate', y: 43.83, x0: 30.6, x1: 91.0 },
];
const SIG_DATE = { y: 79.53, x0: 64.82, x1: 91.74 };
const PRINTED_NAME = { y: 82.4, x0: 18.67, x1: 55.12 };
const TITLE = { y: 82.4, x0: 65.99, x1: 91.64 };
const SIG_AREA = { yBottom: 79.53, yTop: 73.6, x0: 28.92, x1: 55.12 };

export default function PartnerKitClient() {
  const submit = useMutation(api.partnerKit.submit);
  const generateUploadUrl = useMutation(api.partnerKit.generateUploadUrl);
  const submitW9 = useAction(api.legal.w9Forms.submitW9);

  const [fields, setFields] = useState<Fields>(emptyFields);
  const [method, setMethod] = useState<Method>('online');
  const [acknowledged, setAcknowledged] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [sigDialogOpen, setSigDialogOpen] = useState(false);

  const [kitFile, setKitFile] = useState<File | null>(null);

  const [w9Method, setW9Method] = useState<W9Method>('esign');
  const [w9ModalOpen, setW9ModalOpen] = useState(false);
  const [w9Data, setW9Data] = useState<W9SignData | null>(null);
  const [w9File, setW9File] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const kitInputRef = useRef<HTMLInputElement>(null);
  const w9InputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function uploadToStorage(file: File): Promise<string> {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/pdf' },
      body: file,
    });
    if (!res.ok) throw new Error('File upload failed. Please try again.');
    const { storageId } = await res.json();
    return storageId as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fields.partnerAgencyName || !fields.primaryContactName || !fields.email) {
      setError('Please fill in Partner / Agency Name, Primary Contact Name, and Email.');
      return;
    }
    if (!acknowledged) {
      setError('Please check the acknowledgment box before submitting.');
      return;
    }
    if (method === 'online' && !hasSignature) {
      setError('Please add your signature on the agreement, or switch to “Download & upload”.');
      return;
    }
    if (method === 'upload' && !kitFile) {
      setError('Please attach your completed Partner Kit PDF, or switch to “Complete online”.');
      return;
    }
    if (w9Method === 'esign' && !w9Data) {
      setError('Please complete and sign the W-9, or switch to uploading a completed W-9.');
      return;
    }
    if (w9Method === 'upload' && !w9File) {
      setError('Please attach your completed W-9, or switch to signing it online.');
      return;
    }

    setSubmitting(true);
    try {
      let partnerKitFileId: string | undefined;
      let partnerKitFileName: string | undefined;
      if (method === 'upload' && kitFile) {
        partnerKitFileId = await uploadToStorage(kitFile);
        partnerKitFileName = kitFile.name;
      }

      let w9FormId: string | undefined;
      let w9FileId: string | undefined;
      let w9FileName: string | undefined;
      if (w9Method === 'esign' && w9Data) {
        const result = await submitW9({ ...w9Data });
        w9FormId = result?.w9FormId;
      } else if (w9Method === 'upload' && w9File) {
        w9FileId = await uploadToStorage(w9File);
        w9FileName = w9File.name;
      }

      await submit({
        partnerAgencyName: fields.partnerAgencyName,
        dba: fields.dba || undefined,
        primaryContactName: fields.primaryContactName,
        email: fields.email,
        phone: fields.phone || undefined,
        npnLicenseInfo: fields.npnLicenseInfo || undefined,
        effectiveDate: fields.effectiveDate || undefined,
        signatureDataUrl: method === 'online' ? signatureDataUrl : undefined,
        printedName: fields.printedName || undefined,
        title: fields.title || undefined,
        signedDate: fields.signedDate || undefined,
        acknowledged,
        method,
        partnerKitFileId,
        partnerKitFileName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        w9FormId: w9FormId as any,
        w9FileId,
        w9FileName,
      });

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 py-16 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={56} />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Partner Kit received</h1>
          <p className="text-slate-600 mb-6">
            Thank you. Your Partner Agreement and W-9 have been submitted securely. Our partnerships
            team will review and reach out within 1–2 business days.
          </p>
          <button
            onClick={() => {
              setFields(emptyFields());
              setAcknowledged(false);
              setSignatureDataUrl('');
              setHasSignature(false);
              setKitFile(null);
              setW9Data(null);
              setW9File(null);
              setSubmitted(false);
            }}
            className="px-5 py-2 bg-[#1567b8] text-white rounded-lg hover:bg-[#115a9f] text-sm font-medium"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  const online = method === 'online';

  return (
    <div className="min-h-screen bg-slate-300 py-8 px-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
        {/* Intro */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 px-5 py-4">
          <h1 className="text-xl font-bold text-[#123c7a]">Ideal Oral Health Partner Kit</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review the full Partner Kit below, then complete and sign the Partner Agreement on the last
            page. A W-9 is also required. Prefer paper? Switch to “Download &amp; upload”.
          </p>
        </div>

        {/* Method toggle */}
        <MethodToggle method={method} onChange={setMethod} />

        {/* ── The full Partner Kit — every page rendered in order ── */}
        <div className="space-y-4">
          {KIT_PAGES.map((src, idx) => {
            const isAgreement = idx === AGREEMENT_IDX;
            if (!isAgreement) {
              return (
                <div key={src} className="relative w-full bg-white rounded-xl shadow-lg overflow-hidden ring-1 ring-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Partner Kit page ${idx + 1}`} className="block w-full select-none" draggable={false} loading="lazy" />
                </div>
              );
            }
            return (
              <div key={src}>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[#123c7a]">
                  <PenLine size={16} />
                  {online ? 'Complete & sign the agreement below' : 'Agreement — download & upload below'}
                </div>
                <div
                  className="relative w-full bg-white rounded-xl shadow-2xl overflow-hidden ring-2 ring-[#1567b8]/40"
                  style={{ containerType: 'inline-size' } as React.CSSProperties}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Ideal Oral Health Partner Agreement & Acknowledgment" className="block w-full select-none" draggable={false} />

                  {online && (
                    <>
                      {INFO_FIELDS.map((f) => (
                        <OverlayInput
                          key={f.key}
                          y={f.y}
                          x0={f.x0}
                          x1={f.x1}
                          value={fields[f.key]}
                          onChange={(v) => set(f.key, v)}
                        />
                      ))}
                      <OverlayInput {...SIG_DATE} value={fields.signedDate} onChange={(v) => set('signedDate', v)} />
                      <OverlayInput {...PRINTED_NAME} value={fields.printedName} onChange={(v) => set('printedName', v)} />
                      <OverlayInput {...TITLE} value={fields.title} onChange={(v) => set('title', v)} />

                      {/* Signature area */}
                      <button
                        type="button"
                        onClick={() => setSigDialogOpen(true)}
                        title={hasSignature ? 'Click to change signature' : 'Click to sign'}
                        className="absolute group"
                        style={{
                          left: `${SIG_AREA.x0}%`,
                          width: `${SIG_AREA.x1 - SIG_AREA.x0}%`,
                          top: `${SIG_AREA.yTop}%`,
                          height: `${SIG_AREA.yBottom - SIG_AREA.yTop}%`,
                        }}
                      >
                        {hasSignature ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signatureDataUrl} alt="Signature" className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom" />
                        ) : (
                          <span
                            className="absolute bottom-[6%] left-0 w-full text-[#1567b8]/70 group-hover:text-[#1567b8] font-medium"
                            style={{ fontSize: '1.5cqw' }}
                          >
                            ✍ Tap to sign
                          </span>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload path */}
        {!online && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-5 space-y-4">
            <p className="text-sm text-slate-600">
              Download the Partner Kit, complete &amp; sign the agreement (page 8), then upload it back.
            </p>
            <a
              href={PDF_TEMPLATE}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium text-[#123c7a] hover:bg-slate-50"
            >
              <Download size={16} /> Download Partner Kit (PDF)
            </a>
            <FileDrop
              inputRef={kitInputRef}
              file={kitFile}
              onPick={setKitFile}
              label="Upload your completed & signed Partner Kit"
              accept="application/pdf,image/*"
            />
          </div>
        )}

        {/* Acknowledgment */}
        <label className="flex items-start gap-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 px-5 py-4 cursor-pointer">
          <span
            className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-colors ${
              acknowledged ? 'bg-[#1567b8] text-white' : 'bg-white ring-2 ring-slate-400 text-transparent'
            }`}
          >
            <Check size={15} strokeWidth={3} />
          </span>
          <input type="checkbox" className="sr-only" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span className="text-sm text-slate-700">
            I confirm the information above is accurate and I acknowledge receipt of the Partner Kit and
            agree to follow Ideal Oral Health program and branding requirements.
          </span>
        </label>

        {/* W-9 */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-[#123c7a] text-white">
              <FileSignature size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#123c7a]">Form W-9</h2>
              <p className="text-xs text-slate-500">Required for commission payments. Encrypted &amp; admin-only.</p>
            </div>
          </div>
          <W9MethodToggle method={w9Method} onChange={setW9Method} />
          {w9Method === 'esign' ? (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setW9ModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium text-[#123c7a] hover:bg-slate-50"
              >
                <FileSignature size={16} />
                {w9Data ? 'Re-sign W-9' : 'Complete & Sign W-9'}
              </button>
              {w9Data && <span className="text-sm text-emerald-700 font-medium">✓ W-9 signed</span>}
            </div>
          ) : (
            <div className="mt-4">
              <FileDrop
                inputRef={w9InputRef}
                file={w9File}
                onPick={setW9File}
                label="Upload your completed & signed W-9"
                accept="application/pdf,image/*"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{error}</div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#1567b8] text-white rounded-lg font-semibold hover:bg-[#115a9f] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
            {submitting ? 'Submitting…' : 'Submit Partner Kit'}
          </button>
        </div>
      </form>

      {/* Signature dialog */}
      <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Authorized Partner Signature</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onChange={(dataUrl, has) => {
              setSignatureDataUrl(dataUrl);
              setHasSignature(has);
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSigDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1567b8] hover:bg-[#115a9f]"
              disabled={!hasSignature}
              onClick={() => setSigDialogOpen(false)}
            >
              Apply signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <W9SignModal
        isOpen={w9ModalOpen}
        onClose={() => setW9ModalOpen(false)}
        onSigned={(data) => {
          setW9Data(data);
          setW9ModalOpen(false);
        }}
        defaultLegalName={fields.primaryContactName}
        defaultBusinessName={fields.partnerAgencyName}
      />
    </div>
  );
}

// ─── Overlay input positioned on a measured line ──────────────────────

function OverlayInput({
  y,
  x0,
  x1,
  value,
  onChange,
}: {
  y: number;
  x0: number;
  x1: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute bg-transparent outline-none text-slate-900 focus:bg-blue-50/40"
      style={{
        left: `${x0}%`,
        width: `${x1 - x0}%`,
        top: `${y - LINE_H}%`,
        height: `${LINE_H}%`,
        fontSize: '1.55cqw',
        paddingLeft: '0.4cqw',
        lineHeight: 1,
      }}
    />
  );
}

// ─── Presentational helpers ──────────────────────────────────────────

function MethodToggle({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-white/80 p-1 ring-1 ring-slate-300 shadow-sm">
      <ToggleButton active={method === 'online'} onClick={() => onChange('online')}>
        <PenLine size={16} /> Complete &amp; sign online
      </ToggleButton>
      <ToggleButton active={method === 'upload'} onClick={() => onChange('upload')}>
        <Upload size={16} /> Download &amp; upload
      </ToggleButton>
    </div>
  );
}

function W9MethodToggle({ method, onChange }: { method: W9Method; onChange: (m: W9Method) => void }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
      <ToggleButton active={method === 'esign'} onClick={() => onChange('esign')}>
        <FileSignature size={16} /> E-sign W-9
      </ToggleButton>
      <ToggleButton active={method === 'upload'} onClick={() => onChange('upload')}>
        <Upload size={16} /> Upload completed W-9
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-[#1567b8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function FileDrop({
  inputRef,
  file,
  onPick,
  label,
  accept,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  onPick: (f: File | null) => void;
  label: string;
  accept: string;
}) {
  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white ring-1 ring-emerald-300 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm text-emerald-800 truncate">
            <CheckCircle2 size={16} className="flex-shrink-0" /> {file.name}
          </span>
          <button type="button" onClick={() => onPick(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600 hover:border-[#1567b8] hover:text-[#123c7a] transition-colors"
        >
          <Upload size={20} />
          {label}
          <span className="text-xs text-slate-400">PDF or image</span>
        </button>
      )}
    </div>
  );
}
