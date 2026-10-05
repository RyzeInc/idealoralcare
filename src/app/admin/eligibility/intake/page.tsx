"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { intakeErrorMessage } from "@/lib/eligibility-upload";

type Preview = {
  primaryCount: number;
  dependentCount: number;
  errorCount: number;
  validationErrorCount: number;
  tooLarge: boolean;
  errors: { row: number; message: string }[];
  validationErrors: { row: number; field: string; message: string }[];
  sampleRecords: { firstName: string; lastName: string }[];
};
const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50";

export default function EmployerIntakeAdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const { getToken } = useAuth();
  const [queueFilter, setQueueFilter] = useState<"submitted" | "all">(
    "submitted",
  );
  const groups = useQuery(
    api.admin.hierarchy.getAllGroups,
    isAuthenticated ? {} : "skip",
  );
  const config = useQuery(
    api.eligibilityIntake.adminConfiguration,
    isAuthenticated ? {} : "skip",
  );
  const inbox = useQuery(
    api.eligibilityIntake.adminInbox,
    isAuthenticated ? { pendingOnly: queueFilter === "submitted" } : "skip",
  );
  const saveAccess = useAction(api.eligibilityIntake.saveAccess);
  const revokeAccess = useMutation(api.eligibilityIntake.revokeAccess);
  const issueKey = useAction(api.eligibilityIntake.issueKey);
  const revokeKey = useMutation(api.eligibilityIntake.revokeKey);
  const previewSubmission = useAction(api.eligibilityIntake.previewSubmission);
  const approve = useAction(api.eligibilityIntake.approveSubmission);
  const process = useAction(api.eligibilityIntake.processApproved);
  const reject = useMutation(api.eligibilityIntake.rejectSubmission);
  const [tab, setTab] = useState<"queue" | "access">("queue");
  const [groupId, setGroupId] = useState("");
  const [email, setEmail] = useState("");
  const [browserEnabled, setBrowser] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresInDays, setDays] = useState(90);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{
    receiptId: Id<"eligibilitySubmissions">;
    data: Preview;
  } | null>(null);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [rejecting, setRejecting] =
    useState<Id<"eligibilitySubmissions"> | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const activeGroups = groups?.filter((g) => g.status === "active") ?? [];
  const groupName = (id: string) =>
    groups?.find((g) => g._id === id)?.name ?? id;
  const run = async (
    name: string,
    task: () => Promise<unknown>,
    message?: string,
  ) => {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await task();
      if (message) setNotice(message);
    } catch (e) {
      setError(intakeErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const download = async (receiptId: Id<"eligibilitySubmissions">) => {
    if (!config?.apiBase)
      throw new Error("The intake endpoint is not configured.");
    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Sign in again to download this file.");
    const response = await fetch(`${config.apiBase}/eligibility/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ receiptId }),
    });
    if (!response.ok) throw new Error("The file could not be downloaded.");
    const row = inbox?.find((r) => r._id === receiptId);
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = row?.fileName ?? "eligibility-file";
    a.click();
    URL.revokeObjectURL(url);
  };
  const rows = inbox?.filter(
    (r) => queueFilter === "all" || r.status === "submitted",
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Employer intake</h1>
          <p className="mt-2 text-slate-600">
            Review submissions from employers, brokers, and approved automated
            systems.
          </p>
        </div>
        <Link
          href="/employer/upload"
          target="_blank"
          rel="noreferrer"
          className={buttonClass}
        >
          Open employer upload page
        </Link>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setTab("queue")}
          aria-pressed={tab === "queue"}
          className={`${buttonClass} ${tab === "queue" ? "border-blue-700 text-blue-700" : ""}`}
        >
          Review queue
        </button>
        <button
          onClick={() => setTab("access")}
          aria-pressed={tab === "access"}
          className={`${buttonClass} ${tab === "access" ? "border-blue-700 text-blue-700" : ""}`}
        >
          Upload access
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
        >
          {notice}
        </p>
      )}
      {tab === "queue" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Approval checks validation again. Processing updates/adds matching
              members; it does not terminate omitted members.
            </p>
            <label className="ml-4 text-sm">
              Show
              <select
                className={inputClass}
                value={queueFilter}
                onChange={(e) =>
                  setQueueFilter(e.target.value as "submitted" | "all")
                }
              >
                <option value="submitted">Awaiting review</option>
                <option value="all">Latest 100 submissions</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4">Organization / file</th>
                  <th className="p-4">Submitted by</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((row) => (
                  <tr key={row._id} className="border-t">
                    <td className="p-4">
                      <p className="font-semibold">{row.groupName}</p>
                      <p className="mt-1">{row.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleString()} ·{" "}
                        {(row.fileBytes / 1024).toFixed(0)} KB
                        {row.sourceDate ? ` · roster ${row.sourceDate}` : ""}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {row._id}
                      </p>
                    </td>
                    <td className="p-4">
                      {row.submittedBy}
                      <span className="mt-1 block text-xs text-slate-500">
                        {row.source}
                      </span>
                    </td>
                    <td className="p-4">
                      <p>{row.status}</p>
                      {row.processingStatus && (
                        <p className="mt-1 text-xs">
                          Processing: {row.processingStatus}
                        </p>
                      )}
                      {row.reviewNote && (
                        <p className="mt-1 text-xs text-slate-500">
                          {row.reviewNote}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {row.storageId && (
                          <button
                            disabled={!!busy}
                            className={buttonClass}
                            onClick={() =>
                              run(`download-${row._id}`, () =>
                                download(row._id),
                              )
                            }
                          >
                            Download
                          </button>
                        )}
                        {row.status === "submitted" && (
                          <>
                            <button
                              disabled={!!busy}
                              className={buttonClass}
                              onClick={() =>
                                run(`preview-${row._id}`, async () => {
                                  setAcknowledgeWarnings(false);
                                  setPreview({
                                    receiptId: row._id,
                                    data: await previewSubmission({
                                      receiptId: row._id,
                                    }),
                                  });
                                })
                              }
                            >
                              Preview
                            </button>
                            <button
                              disabled={!!busy}
                              className={buttonClass}
                              onClick={() => {
                                setRejecting(row._id);
                                setRejectNote("");
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {row.status === "approved" &&
                          ["uploaded", "failed"].includes(
                            row.processingStatus ?? "",
                          ) && (
                            <button
                              disabled={!!busy}
                              className={buttonClass}
                              onClick={() =>
                                run(
                                  `process-${row._id}`,
                                  () => process({ receiptId: row._id }),
                                  "Processing started. Monitor the processing status or Eligibility Files.",
                                )
                              }
                            >
                              {row.processingStatus === "failed"
                                ? "Retry processing"
                                : "Process approved file"}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows?.length === 0 && (
              <p className="p-6 text-slate-500">No submissions in this view.</p>
            )}
            {!inbox && <p className="p-6">Loading submissions…</p>}
          </div>
          <p className="text-sm text-slate-500">
            Rejected files are deleted. Unreviewed files expire after 30 days.
            Approved files follow the existing eligibility file retention
            policy.
          </p>
          <Link
            href="/admin/eligibility"
            className="text-sm text-blue-700 underline"
          >
            Open Eligibility Files for member provisioning and vendor delivery
          </Link>
        </>
      )}
      {tab === "access" && (
        <>
          <div className="rounded-xl border bg-slate-50 p-4 text-sm">
            <p>
              Employer page: <strong>/employer/upload</strong>. Authorize the
              contact’s email below, then share this page with them. They
              create/sign into a Clerk account and verify that email.
            </p>
            <p className="mt-2">
              Browser verification:{" "}
              {config?.browserConfigured
                ? "configured"
                : "CLERK_SECRET_KEY needed on Convex"}
              . Email adapter:{" "}
              {config?.emailConfigured
                ? "settings present; the Gmail intake script must also be running"
                : "not configured"}
              .
            </p>
            <p className="mt-2 break-all">
              API base: {config?.apiBase ?? "not configured"}
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              className="space-y-4 rounded-xl border bg-white p-6"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "access",
                  async () => {
                    await saveAccess({
                      groupId: groupId as Id<"groups">,
                      email,
                      browserEnabled,
                      emailEnabled,
                    });
                    setEmail("");
                  },
                  "Upload access saved.",
                );
              }}
            >
              <h2 className="text-lg font-semibold">Authorize a contact</h2>
              <label className="block text-sm">
                Organization
                <select
                  required
                  className={inputClass}
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Choose an organization</option>
                  {activeGroups.map((g) => (
                    <option value={g._id} key={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Email
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={browserEnabled}
                  onChange={(e) => setBrowser(e.target.checked)}
                />
                Browser uploads
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                />
                Email attachments from this exact address
              </label>
              <p className="text-xs text-slate-500">
                Saving an existing email/organization updates and reactivates
                its permissions. Save separately for each organization the
                contact manages.
              </p>
              <button disabled={!!busy || !groupId} className={buttonClass}>
                Save upload access
              </button>
            </form>
            <form
              className="space-y-4 rounded-xl border bg-white p-6"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "key",
                  async () => {
                    setNewKey(
                      (
                        await issueKey({
                          groupId: groupId as Id<"groups">,
                          label,
                          expiresInDays,
                        })
                      ).token,
                    );
                  },
                  "Upload credential created. Copy it now; it is shown only once.",
                );
              }}
            >
              <h2 className="text-lg font-semibold">
                Create an automated upload credential
              </h2>
              <label className="block text-sm">
                Organization
                <select
                  required
                  className={inputClass}
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Choose an organization</option>
                  {activeGroups.map((g) => (
                    <option value={g._id} key={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                System label
                <input
                  required
                  maxLength={100}
                  className={inputClass}
                  placeholder="Payroll export"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Expires in days
                <input
                  required
                  type="number"
                  min={1}
                  max={365}
                  className={inputClass}
                  value={expiresInDays}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <button disabled={!!busy || !groupId} className={buttonClass}>
                Create credential
              </button>
              {newKey && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="text-sm font-semibold">
                    Share through an approved secure channel.
                  </p>
                  <code className="mt-2 block break-all text-xs">{newKey}</code>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() =>
                        run(
                          "copy",
                          () => navigator.clipboard.writeText(newKey),
                          "Credential copied.",
                        )
                      }
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => setNewKey(null)}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
          <section className="overflow-x-auto rounded-xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Approved contacts</h2>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Contact / organization</th>
                  <th className="p-2">Methods</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {config?.access.map((a) => (
                  <tr className="border-t" key={a._id}>
                    <td className="p-2">
                      {a.email}
                      <p className="text-xs text-slate-500">
                        {groupName(a.groupId)}
                      </p>
                      {a.emailEnabled && (
                        <p className="mt-1 break-all font-mono text-xs">
                          {config.routes.find((r) => r.groupId === a.groupId)
                            ?.address ?? "Email intake not configured"}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {[
                        a.browserEnabled ? "Browser" : "",
                        a.emailEnabled ? "Email" : "",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="p-2">
                      {a.active ? "Active" : "Revoked"}
                      {a.active && a.browserEnabled && !a.clerkUserId && (
                        <p className="text-xs text-slate-500">
                          Awaiting first verified sign-in
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {a.active && (
                        <button
                          disabled={!!busy}
                          className={buttonClass}
                          onClick={() =>
                            run(
                              `revoke-${a._id}`,
                              () => revokeAccess({ accessId: a._id }),
                              "Contact access revoked, including unfinished uploads.",
                            )
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="overflow-x-auto rounded-xl border bg-white p-6">
            <h2 className="text-lg font-semibold">
              Automated upload credentials
            </h2>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">System / organization</th>
                  <th className="p-2">Credential prefix</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {config?.keys.map((k) => (
                  <tr key={k._id} className="border-t">
                    <td className="p-2">
                      {k.label}
                      <p className="text-xs text-slate-500">
                        {groupName(k.groupId)}
                      </p>
                    </td>
                    <td className="p-2 font-mono">{k.prefix}…</td>
                    <td className="p-2">
                      {new Date(k.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      {!k.active ? "Revoked" : k.expired ? "Expired" : "Active"}
                    </td>
                    <td className="p-2">
                      {k.active && (
                        <button
                          disabled={!!busy}
                          className={buttonClass}
                          onClick={() =>
                            run(
                              `key-${k._id}`,
                              () => revokeKey({ keyId: k._id }),
                              "Credential revoked, including unfinished uploads.",
                            )
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-sm text-slate-500">
            Each credential can submit files and check receipts for one
            organization. Rotate by creating a replacement, updating the
            employer’s export job, then revoking the old credential.
          </p>
        </>
      )}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6">
            <h2 id="preview-title" className="text-xl font-bold">
              Review eligibility file
            </h2>
            <p>
              {preview.data.primaryCount} primary members ·{" "}
              {preview.data.dependentCount} dependents
            </p>
            <p>
              {preview.data.errorCount} parsing issues ·{" "}
              {preview.data.validationErrorCount} validation issues
            </p>
            {preview.data.tooLarge && (
              <p className="text-red-700">
                This file exceeds the importer’s member limit.
              </p>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-semibold">Sample members</p>
              {preview.data.sampleRecords.map((r, i) => (
                <p key={i} className="text-sm">
                  {r.firstName} {r.lastName}
                </p>
              ))}
            </div>
            {[...preview.data.errors, ...preview.data.validationErrors]
              .slice(0, 20)
              .map((e, i) => (
                <p key={i} className="text-sm text-red-700">
                  Row {e.row}: {e.message}
                </p>
              ))}
            {!!preview.data.validationErrorCount && (
              <label className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledgeWarnings}
                  onChange={(e) => setAcknowledgeWarnings(e.target.checked)}
                />
                I reviewed the missing-field warnings and authorize importing
                this file. Missing fields may prevent provisioning or vendor
                fulfillment.
              </label>
            )}
            <p className="text-sm text-slate-600">
              Approval adds the file to Eligibility Files. Start processing
              separately after approval. Matching members are updated; omitted
              members are not terminated.
            </p>
            <div className="flex gap-3">
              <button
                disabled={
                  !!busy ||
                  !preview.data.primaryCount ||
                  preview.data.tooLarge ||
                  !!preview.data.errorCount ||
                  (!!preview.data.validationErrorCount && !acknowledgeWarnings)
                }
                className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
                onClick={() =>
                  run(
                    "approve",
                    async () => {
                      await approve({
                        receiptId: preview.receiptId,
                        acknowledgeValidationWarnings: acknowledgeWarnings,
                      });
                      setPreview(null);
                    },
                    "Approved. Choose Process approved file to start the import.",
                  )
                }
              >
                Approve file
              </button>
              <button
                disabled={!!busy}
                className={buttonClass}
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {rejecting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                "reject",
                async () => {
                  await reject({ receiptId: rejecting, note: rejectNote });
                  setRejecting(null);
                },
                "Submission rejected. The source attachment is scheduled for deletion.",
              );
            }}
          >
            <h2 id="reject-title" className="text-xl font-bold">
              Reject submission
            </h2>
            <label className="block text-sm">
              Reason visible to the organization
              <textarea
                required
                maxLength={500}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className={inputClass}
              />
            </label>
            <p className="text-sm text-slate-500">
              Explain what needs correcting. Do not include member names, birth
              dates, or other personal details.
            </p>
            <div className="flex gap-3">
              <button disabled={!!busy} className={buttonClass}>
                Reject and delete attachment
              </button>
              <button
                type="button"
                disabled={!!busy}
                className={buttonClass}
                onClick={() => setRejecting(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
