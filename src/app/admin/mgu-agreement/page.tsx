"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CheckCircle2, Clock, Eye, FileSignature, Loader2, Upload } from "lucide-react";
import { ResourcePreviewModal } from "@/components/resources/ResourcePreview";
import { formatDate, humanize } from "@/lib/admin-format";

/**
 * MASTER MGU AGREEMENT — staff side.
 *
 * Upload the agreement PDF (each upload is a new version that replaces the
 * last), and see which agencies have signed the current one. Agency
 * principals sign it from the partner portal's Resources page.
 */
export default function MguAgreementPage() {
  const overview = useQuery(api.legal.mguAgreement.getAdminOverview);
  const generateUploadUrl = useMutation(api.legal.mguAgreement.generateUploadUrl);
  const publishVersion = useMutation(api.legal.mguAgreement.publishVersion);
  const getVersionUrl = useMutation(api.legal.mguAgreement.getVersionUrl);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ fileName: string; url: string | null; loading: boolean } | null>(null);

  const upload = async () => {
    if (!file) return;
    const replacing = overview?.current;
    if (replacing && !window.confirm(
      `Publish this as version ${replacing.version + 1}? Agencies will be asked to sign the new version; signatures on version ${replacing.version} are kept.`,
    )) return;
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/pdf" }, body: file });
      if (!res.ok) throw new Error("Upload failed. Please try again.");
      const { storageId } = await res.json();
      await publishVersion({ storageId: storageId as Id<"_storage">, fileName: file.name, notes: notes || undefined });
      setFile(null);
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openVersion = async (versionId: Id<"mguAgreementVersions">, fileName: string) => {
    setPreview({ fileName, url: null, loading: true });
    const result = await getVersionUrl({ versionId });
    setPreview({ fileName, url: result?.url ?? null, loading: false });
  };

  if (overview === undefined) {
    return <div className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  }

  const signedCount = overview.agencies.filter((a) => a.signed).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Master MGU Agreement</h1>
        <p className="text-slate-500 mt-1">
          The agreement agencies sign with Ideal Health. Agency principals review and e-sign the current version on
          their partner portal&apos;s Resources page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current version</h2>
          {overview.current ? (
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><FileSignature size={18} className="text-blue-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">Version {overview.current.version} · {overview.current.fileName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Published {formatDate(overview.current.createdAt)}{overview.current.uploadedByName ? ` by ${overview.current.uploadedByName}` : ""}
                </p>
                {overview.current.notes && <p className="text-sm text-slate-600 mt-2">{overview.current.notes}</p>}
                <button
                  type="button"
                  onClick={() => openVersion(overview.current!._id, overview.current!.fileName)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Eye size={14} /> View agreement
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No agreement uploaded yet. Agencies don&apos;t see anything until you upload the first version.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {overview.current ? "Upload a new version" : "Upload the agreement"}
          </h2>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What changed (optional, staff only)"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {overview.current ? `Publish as version ${overview.current.version + 1}` : "Publish"}
          </button>
        </section>
      </div>

      {overview.current && (
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Agencies</h2>
            <span className="text-sm text-slate-500">
              {signedCount} of {overview.agencies.length} signed version {overview.current.version}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Agency</th>
                  <th className="px-5 py-2 font-medium">Type</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Signed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.agencies.map((a) => (
                  <tr key={a.partnerId}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{a.name}</td>
                    <td className="px-5 py-2.5 text-slate-500">{a.type === "fmo" ? "FMO" : humanize(a.type)}</td>
                    <td className="px-5 py-2.5">
                      {a.signed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Signed {formatDate(a.signed.signedAt)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700"><Clock size={14} /> Not signed</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {a.signed ? `${a.signed.signerName}, ${a.signed.signerTitle}${a.signed.signerEmail ? ` · ${a.signed.signerEmail}` : ""}` : "—"}
                    </td>
                  </tr>
                ))}
                {overview.agencies.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">No active agencies yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {overview.versions.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Earlier versions</h2>
          <ul className="text-sm text-slate-600 space-y-1">
            {overview.versions.filter((v) => v.status === "retired").map((v) => (
              <li key={v._id}>
                <button type="button" onClick={() => openVersion(v._id, v.fileName)} className="text-blue-600 hover:underline">
                  Version {v.version}
                </button>{" "}
                · {v.fileName} · {formatDate(v.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResourcePreviewModal
        target={preview ? { title: preview.fileName, kind: "file", fileName: preview.fileName, contentType: "application/pdf" } : null}
        url={preview?.url ?? null}
        loading={preview?.loading ?? false}
        onClose={() => setPreview(null)}
        onDownload={() => preview?.url && window.open(preview.url, "_blank", "noopener,noreferrer")}
      />
    </div>
  );
}
