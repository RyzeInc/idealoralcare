"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Modal } from "@/components/admin/ui";

/**
 * "Email members" on the partner Members page. Renders nothing unless the
 * viewer holds `partner.email` (see convex/insights/brokerEmail.ts). The
 * audience is whatever the page's status/group filters select; the server
 * rebuilds it from the broker's own book.
 */
export function BrokerEmailComposer({
  memberType, groupId, filterLabel,
}: {
  memberType?: string;
  groupId?: Id<"groups">;
  filterLabel: string;
}) {
  const composer = useQuery(api.insights.brokerEmail.getComposer, { memberType, groupId });
  const send = useAction(api.insights.brokerEmail.send);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  if (!composer) return null;

  const close = () => {
    if (sending) return;
    setOpen(false);
    setError(null);
    if (sent !== null) {
      setSent(null);
      setSubject("");
      setMessage("");
    }
  };

  const blocked =
    composer.recipients === 0 ? "No members in this view have an email address we can use."
    : composer.overLimit ? `That's ${composer.recipients} members — use the filters to get to ${composer.limits.recipients} or fewer.`
    : composer.sendsLeftToday === 0 ? `You've sent ${composer.limits.perDay} member emails today. You can send again tomorrow.`
    : null;

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await send({ subject, message, memberType, groupId });
      setSent(result.scheduled);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        <Mail size={15} /> Email members
      </button>

      <Modal
        open={open}
        onClose={close}
        preventClose={sending}
        title="Email your members"
        description={`From ${composer.senderName}. Replies go to ${composer.replyTo}.`}
        size="max-w-2xl"
      >
        {sent !== null ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={32} className="text-green-600" />
            <p className="text-sm text-slate-700">
              Sending to {sent} member{sent === 1 ? "" : "s"}. It goes out over the next few minutes, and each
              send shows on that member&apos;s record.
            </p>
            <button type="button" onClick={close} className="px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <strong>{composer.recipients}</strong> member{composer.recipients === 1 ? "" : "s"} · {filterLabel}
              {(composer.skippedNoEmail > 0 || composer.skippedOptedOut > 0) && (
                <span className="block text-xs text-slate-500 mt-0.5">
                  Skipping {[
                    composer.skippedNoEmail > 0 && `${composer.skippedNoEmail} with no email`,
                    composer.skippedOptedOut > 0 && `${composer.skippedOptedOut} who opted out of email`,
                  ].filter(Boolean).join(" and ")}.
                </span>
              )}
            </div>

            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Subject</span>
              <input
                value={subject}
                maxLength={composer.limits.subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A quick note about your dental benefits"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Message</span>
              <textarea
                value={message}
                maxLength={composer.limits.message}
                onChange={(e) => setMessage(e.target.value)}
                rows={9}
                placeholder={"Hi {{firstName}},\n\n…"}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-y"
              />
              <span className="block text-xs text-slate-400 mt-1">
                Plain text. {"{{firstName}}"}, {"{{memberId}}"} and {"{{planName}}"} are filled in for each member. Your
                name, email and an opt-out link are added at the bottom.
              </span>
            </label>

            {(error || blocked) && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error ?? blocked}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {composer.sendsLeftToday} of {composer.limits.perDay} sends left today
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={close} disabled={sending} className="px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={sending || !!blocked || !subject.trim() || !message.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send to {composer.recipients}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
