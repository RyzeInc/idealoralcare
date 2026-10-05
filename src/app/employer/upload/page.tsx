"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery, useConvexAuth } from "convex/react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import {
  intakeErrorMessage,
  sendEligibilityFile,
} from "@/lib/eligibility-upload";

export default function EmployerUploadPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { userId } = useAuth();
  const claim = useAction(api.eligibilityIntake.claimBrowserAccess);
  const createSession = useAction(api.eligibilityIntake.createBrowserSession);
  const [verifiedUser, setVerifiedUser] = useState<string | null>(null);
  const ready = isAuthenticated && !!userId && verifiedUser === userId;
  const [claimError, setClaimError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceDate, setSourceDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    receiptId: string;
    duplicate: boolean;
  } | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let live = true;
    claim({})
      .then(() => {
        if (live) {
          setVerifiedUser(userId);
          setClaimError("");
        }
      })
      .catch((e) => {
        if (live) {
          setVerifiedUser(null);
          setClaimError(intakeErrorMessage(e));
        }
      });
    return () => {
      live = false;
    };
  }, [isAuthenticated, userId, claim, retry]);
  const organizations = useQuery(
    api.eligibilityIntake.myOrganizations,
    isAuthenticated && ready ? {} : "skip",
  );
  const group =
    organizations?.find((g) => g.groupId === selected) ?? organizations?.[0];
  const history = useQuery(
    api.eligibilityIntake.mySubmissions,
    isAuthenticated && ready && group ? { groupId: group.groupId } : "skip",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !group || busy) return;
    setError("");
    setReceipt(null);
    setBusy(true);
    try {
      if (file.size < 1 || file.size > 10 * 1024 * 1024)
        throw new Error("Choose a file between 1 byte and 10 MB.");
      const ticket = await createSession({
        groupId: group.groupId,
        fileName: file.name,
        fileBytes: file.size,
        sourceDate: sourceDate || undefined,
      });
      setReceipt(await sendEligibilityFile(file, ticket));
      setFile(null);
      (event.target as HTMLFormElement).reset();
      setSourceDate("");
    } catch (e) {
      setError(intakeErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <span className="font-semibold">
            Ideal Oral Health · Employer uploads
          </span>
          <UserButton />
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-bold">Submit an eligibility file</h1>
          <p className="mt-2 text-slate-600">
            Send your organization’s roster to Ideal for review. You’ll receive
            a submission receipt here.
          </p>
        </div>
        {(isLoading || (!ready && !claimError)) && (
          <p role="status">Verifying your upload access…</p>
        )}
        {claimError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4"
          >
            {claimError}{" "}
            <button
              onClick={() => setRetry((r) => r + 1)}
              className="ml-3 underline"
            >
              Try again
            </button>
          </div>
        )}
        {ready && organizations?.length === 0 && (
          <div className="rounded-xl border bg-white p-6">
            Your account doesn’t have upload access yet. Ask your Ideal contact
            to authorize your verified sign-in email for your organization, then{" "}
            <button
              className="text-blue-700 underline"
              onClick={() => {
                setVerifiedUser(null);
                setRetry((r) => r + 1);
              }}
            >
              check access again
            </button>
            .
          </div>
        )}
        {group && (
          <>
            <form
              onSubmit={submit}
              className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
            >
              <label className="block text-sm font-semibold">
                Organization
                <select
                  disabled={busy}
                  value={group.groupId}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setReceipt(null);
                  }}
                  className="mt-2 block w-full rounded-lg border p-3"
                >
                  {organizations?.map((g) => (
                    <option key={g.groupId} value={g.groupId}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Roster date{" "}
                <span className="font-normal text-slate-500">(optional)</span>
                <input
                  type="date"
                  disabled={busy}
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                  className="mt-2 block rounded-lg border p-3"
                />
              </label>
              <label className="block rounded-lg border-2 border-dashed bg-slate-50 p-6 text-sm font-semibold">
                Eligibility file
                <input
                  required
                  disabled={busy}
                  type="file"
                  accept=".csv,.xlsx,.txt,.json"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-3 block w-full font-normal"
                />
                <span className="mt-3 block font-normal text-slate-500">
                  CSV, XLSX, TXT, or JSON · up to 10 MB. Uploading does not
                  change member coverage.
                </span>
              </label>
              <a
                href="/eligibility-template.csv"
                download
                className="block text-sm text-blue-700 underline"
              >
                Download a blank CSV template
              </a>
              <p className="text-sm text-slate-500">
                For the template, use one row per covered person, with Employee,
                Spouse, or Child as the relationship. Repeat the employee’s name
                and birth date on each family row.
              </p>
              {error && (
                <p role="alert" className="text-red-700">
                  {error}
                </p>
              )}
              <button
                disabled={busy || !file}
                className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Submit for review"}
              </button>
            </form>
            {receipt && (
              <div
                role="status"
                className="rounded-lg border border-green-200 bg-green-50 p-4"
              >
                <p className="font-semibold">
                  {receipt.duplicate
                    ? "This file was already received."
                    : "Your file was received for review."}
                </p>
                <p className="mt-1 break-all text-sm">
                  Receipt: {receipt.receiptId}
                </p>
              </div>
            )}
            {group.emailAddress && (
              <section className="rounded-xl border bg-white p-6">
                <h2 className="font-semibold">Email submissions</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your approved sender address can also submit attachments to:
                </p>
                <p className="mt-2 break-all font-mono text-sm">
                  {group.emailAddress}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Only approved senders whose messages pass authentication and
                  attachment checks enter the review queue. If a receipt does
                  not appear here, use the upload form or contact Ideal.
                </p>
              </section>
            )}
            <section className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold">Recent submissions</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">File / receipt</th>
                      <th className="p-2">Received</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history?.map((r) => (
                      <tr key={r.receiptId} className="border-b">
                        <td className="p-2">
                          <p>{r.fileName}</p>
                          <p className="break-all text-xs text-slate-500">
                            {r.receiptId} · {r.source}
                          </p>
                        </td>
                        <td className="p-2">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <p>
                            {r.status === "approved" && r.processingStatus
                              ? r.processingStatus === "uploaded"
                                ? "Approved; awaiting processing"
                                : r.processingStatus.replaceAll("_", " ")
                              : r.status}
                          </p>
                          {r.reviewNote && (
                            <p className="mt-1 text-slate-500">
                              {r.reviewNote}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history?.length === 0 && (
                  <p className="mt-4 text-slate-500">No submissions yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
