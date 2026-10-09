"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Eye, FileSignature, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ResourcePreviewModal } from "@/components/resources/ResourcePreview";
import { formatDate } from "@/lib/admin-format";

/**
 * The Master MGU Agreement for an agency principal: review, then e-sign.
 * Renders nothing for anyone who can't sign for an agency, or until staff
 * have uploaded the agreement (convex/legal/mguAgreement.ts).
 */
export function MguAgreementCard() {
  const mine = useQuery(api.legal.mguAgreement.getMine);
  const getUrl = useMutation(api.legal.mguAgreement.getMineDocumentUrl);
  const sign = useMutation(api.legal.mguAgreement.sign);

  const [preview, setPreview] = useState<{ url: string | null; loading: boolean } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mine) return null;

  const openAgreement = async () => {
    setPreview({ url: null, loading: true });
    try {
      const result = await getUrl({});
      setPreview({ url: result?.url ?? null, loading: false });
      setReviewed(true);
    } catch {
      setPreview({ url: null, loading: false });
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sign({ versionId: mine.versionId, signerName, signerTitle, acknowledged });
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Could not sign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border p-5 ${mine.signed ? "bg-white border-slate-200" : "bg-amber-50/60 border-amber-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg shrink-0 ${mine.signed ? "bg-emerald-50" : "bg-amber-100"}`}>
          {mine.signed ? <CheckCircle2 size={18} className="text-emerald-600" /> : <FileSignature size={18} className="text-amber-700" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{mine.title}</p>
          {mine.signed ? (
            <p className="text-sm text-slate-600 mt-0.5">
              Signed for {mine.partnerName} by {mine.signed.signerName}, {mine.signed.signerTitle}, on {formatDate(mine.signed.signedAt)} (version {mine.version}).
            </p>
          ) : (
            <p className="text-sm text-slate-700 mt-0.5">
              {mine.previousVersion
                ? `The agreement was updated since you signed version ${mine.previousVersion}. Please review and sign version ${mine.version}.`
                : `Please review and sign the agreement for ${mine.partnerName}.`}
            </p>
          )}
          <button type="button" onClick={openAgreement} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
            <Eye size={14} /> {mine.signed ? "View agreement" : "Review the agreement"}
          </button>

          {!mine.signed && (
            <div className="mt-4 space-y-3 max-w-xl">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Full name</span>
                  <input value={signerName} onChange={(e) => setSignerName(e.target.value)} autoComplete="name"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Title</span>
                  <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} autoComplete="organization-title"
                    placeholder="Principal" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white" />
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
                <span>{mine.acknowledgment}</span>
              </label>
              {!reviewed && <p className="text-xs text-slate-500">Open the agreement above before signing.</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !reviewed || !acknowledged || signerName.trim().length < 2 || !signerTitle.trim()}
                className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
                Sign agreement
              </button>
            </div>
          )}
        </div>
      </div>

      <ResourcePreviewModal
        target={preview ? { title: `${mine.title} — version ${mine.version}`, kind: "file", fileName: mine.fileName, contentType: "application/pdf" } : null}
        url={preview?.url ?? null}
        loading={preview?.loading ?? false}
        onClose={() => setPreview(null)}
        onDownload={() => preview?.url && window.open(preview.url, "_blank", "noopener,noreferrer")}
      />
    </div>
  );
}

/** A one-line nudge for the partner overview while the agreement is unsigned. */
export function MguAgreementBanner() {
  const mine = useQuery(api.legal.mguAgreement.getMine);
  if (!mine || mine.signed) return null;
  return (
    <Link
      href="/partner/resources"
      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
    >
      <FileSignature size={17} className="shrink-0" />
      <span className="flex-1">
        <strong>Action needed:</strong> review and sign the {mine.title}
        {mine.previousVersion ? ` (updated to version ${mine.version})` : ""} for {mine.partnerName}.
      </span>
      <span className="font-medium">Review →</span>
    </Link>
  );
}
