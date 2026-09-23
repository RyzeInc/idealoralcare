'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Modal } from '@/components/admin/ui';
import { EmailSendDialog } from '@/components/admin/EmailSendDialog';
import { Mail, Send, Paperclip, RotateCcw, Eye } from 'lucide-react';

/** Colour for each delivery state, so a bounce is not just another grey row. */
const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  opened: 'bg-emerald-50 text-emerald-700',
  clicked: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  bounced: 'bg-red-50 text-red-700',
  complained: 'bg-amber-50 text-amber-800',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
        STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}

/**
 * Communications card on the member detail page: everything ever sent to this
 * member, with one-click re-send of any of it and a composer for anything new.
 */
export function MemberCommunications({
  memberProfileId,
  memberName,
}: {
  memberProfileId: Id<'memberProfiles'>;
  memberName: string;
}) {
  const history = useQuery(api.admin.memberEmail.memberEmailHistory, {
    memberProfileId,
    limit: 50,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewSendId, setViewSendId] = useState<Id<'emailSends'> | null>(null);
  const [resendPrefill, setResendPrefill] = useState<Id<'emailSends'> | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Communications
          </h2>
          {history && history.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 rounded">
              {history.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setResendPrefill(null);
            setDialogOpen(true);
          }}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          <Send size={12} /> Send email
        </button>
      </div>

      {history === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No email has been sent to this member from the admin console yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-5 py-2 font-medium">Sent</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">By</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={String(h.id)} className="hover:bg-slate-50">
                  <td className="px-5 py-2 whitespace-nowrap text-slate-600 text-xs">
                    {new Date(h.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">
                    <p className="text-slate-900 font-medium leading-tight">{h.subject}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      {h.templateLabel}
                      {h.hasAttachments && <Paperclip size={10} />}
                      {h.campaignId && <span className="text-slate-400">· campaign</span>}
                    </p>
                    {h.error && <p className="text-xs text-red-600 mt-0.5">{h.error}</p>}
                  </td>
                  <td className="px-2 py-2">
                    <StatusPill status={h.status} />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500">{h.sentByName}</td>
                  <td className="px-5 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setViewSendId(h.id as Id<'emailSends'>)}
                      className="text-slate-500 hover:text-slate-800 text-xs inline-flex items-center gap-1 mr-3"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResendPrefill(h.id as Id<'emailSends'>);
                        setDialogOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EmailSendDialog
        key={resendPrefill ? `resend-${resendPrefill}` : 'compose'}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        memberProfileId={memberProfileId}
        memberName={memberName}
        prefillResendId={resendPrefill ?? undefined}
      />

      <SentEmailViewer sendId={viewSendId} onClose={() => setViewSendId(null)} />
    </div>
  );
}

/** Read-only look at exactly what a member received. */
function SentEmailViewer({
  sendId,
  onClose,
}: {
  sendId: Id<'emailSends'> | null;
  onClose: () => void;
}) {
  const send = useQuery(api.admin.memberEmail.getSendBody, sendId ? { sendId } : 'skip');

  return (
    <Modal open={!!sendId} onClose={onClose} title="Sent email" size="max-w-3xl">
      {send === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : send === null ? (
        <p className="text-sm text-slate-500">This email is no longer available.</p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm space-y-1">
            <p>
              <span className="text-slate-500">To:</span> {send.to}
            </p>
            <p>
              <span className="text-slate-500">Subject:</span> {send.subject}
            </p>
            <p className="text-xs text-slate-500">
              {send.templateLabel} · sent {new Date(send.createdAt).toLocaleString()} by{' '}
              {send.sentByName} · <StatusPill status={send.status} />
            </p>
          </div>
          {send.html ? (
            <iframe
              title="Sent email"
              srcDoc={send.html}
              className="w-full h-96 border border-slate-200 rounded-lg bg-white"
              sandbox=""
            />
          ) : (
            <p className="text-sm text-slate-500 italic">
              The body of this email was not stored and cannot be re-rendered.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
