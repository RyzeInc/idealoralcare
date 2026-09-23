'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type { LucideIcon } from 'lucide-react';
import { Modal, useToast } from '@/components/admin/ui';
import { FileText, History, PenLine, Loader, Send, Paperclip, AlertTriangle } from 'lucide-react';

type Source = 'template' | 'previous' | 'custom';

export interface SendPayload {
  mode: 'template' | 'custom' | 'resend';
  templateId?: string;
  subject?: string;
  html?: string;
  sourceSendId?: Id<'emailSends'>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Single-member send. */
  memberProfileId?: Id<'memberProfiles'>;
  memberName?: string;
  /** Mass send. The dialog previews against the first id in the list. */
  recipientIds?: Id<'memberProfiles'>[];
  /** Open straight onto a prior email, ready to re-send (single-member only). */
  prefillResendId?: Id<'emailSends'>;
  onSent?: () => void;
}

const MERGE_TOKENS = [
  '{{firstName}}',
  '{{lastName}}',
  '{{memberName}}',
  '{{memberId}}',
  '{{planName}}',
  '{{effectiveDate}}',
  '{{groupName}}',
  '{{portalUrl}}',
];

const TAB: { id: Source; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'template', label: 'Template', icon: FileText, hint: 'A registered email, filled in with this member’s real data.' },
  { id: 'previous', label: 'Previous', icon: History, hint: 'Send again exactly what went out before.' },
  { id: 'custom', label: 'Compose', icon: PenLine, hint: 'Write a one-off message.' },
];

/**
 * The single place an admin chooses what to send — from a member's page or
 * from the mass-send screen. Bulk mode differs only in what "previous" means:
 * for one member it is one of their past emails, for a selection it is a past
 * campaign to run again.
 */
export function EmailSendDialog({
  open,
  onClose,
  memberProfileId,
  memberName,
  recipientIds,
  prefillResendId,
  onSent,
}: Props) {
  const toast = useToast();
  const isBulk = !memberProfileId;
  const ids = useMemo(() => recipientIds ?? [], [recipientIds]);
  const previewMemberId = memberProfileId ?? ids[0];

  const [source, setSource] = useState<Source>(prefillResendId ? 'previous' : 'template');
  const [templateId, setTemplateId] = useState<string>('');
  const [priorSendId, setPriorSendId] = useState<string>(
    prefillResendId ? String(prefillResendId) : '',
  );
  const [campaignId, setCampaignId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const templates = useQuery(api.admin.memberEmail.listSendableTemplates, open ? {} : 'skip');
  const history = useQuery(
    api.admin.memberEmail.memberEmailHistory,
    open && memberProfileId ? { memberProfileId, limit: 25 } : 'skip',
  );
  const campaigns = useQuery(
    api.admin.memberEmail.listCampaigns,
    open && isBulk ? { limit: 25 } : 'skip',
  );
  const preview = useQuery(
    api.admin.memberEmail.previewForMember,
    open && source === 'template' && templateId && previewMemberId
      ? { memberProfileId: previewMemberId, templateId }
      : 'skip',
  );

  const sendToMember = useAction(api.admin.memberEmail.sendToMember);
  const sendBulk = useAction(api.admin.memberEmail.sendBulk);

  useEffect(() => {
    if (!open) {
      setSource(prefillResendId ? 'previous' : 'template');
      setTemplateId('');
      setPriorSendId(prefillResendId ? String(prefillResendId) : '');
      setCampaignId('');
      setSubject('');
      setBody('');
      setCampaignName('');
      setConfirmBulk(false);
    }
  }, [open, prefillResendId]);

  useEffect(() => {
    if (templates && templates.length > 0 && !templateId) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  const selectedTemplate = templates?.find((t) => t.id === templateId);

  function buildPayload(): SendPayload | null {
    if (source === 'template') {
      if (!templateId) return null;
      return { mode: 'template', templateId };
    }
    if (source === 'custom') {
      if (!subject.trim() || !body.trim()) return null;
      return { mode: 'custom', subject: subject.trim(), html: body.trim() };
    }
    // Previous
    if (isBulk) {
      const campaign = campaigns?.find((c) => String(c.id) === campaignId);
      if (!campaign) return null;
      return campaign.mode === 'custom'
        ? { mode: 'custom', subject: campaign.subject, html: campaign.html ?? '' }
        : { mode: 'template', templateId: campaign.templateId };
    }
    if (!priorSendId) return null;
    return { mode: 'resend', sourceSendId: priorSendId as Id<'emailSends'> };
  }

  const payload = buildPayload();
  const canSend = !!payload && !sending && (isBulk ? ids.length > 0 : true);

  async function handleSend() {
    if (!payload) return;
    if (isBulk && !confirmBulk) {
      setConfirmBulk(true);
      return;
    }

    setSending(true);
    try {
      if (isBulk) {
        const res = await sendBulk({
          memberProfileIds: ids,
          payload,
          name: campaignName.trim() || undefined,
        });
        toast.success(
          `Campaign started — ${res.scheduled} email${res.scheduled === 1 ? '' : 's'} queued.`,
        );
      } else {
        const res = await sendToMember({ memberProfileId: memberProfileId!, payload });
        if (res.success) toast.success(`Email sent to ${res.to}`);
        else toast.error('Send failed', res.error ?? undefined);
      }
      onSent?.();
      onClose();
    } catch (err) {
      toast.fromError(err, 'Send failed');
    } finally {
      setSending(false);
      setConfirmBulk(false);
    }
  }

  // Campaign re-runs of a custom message need the stored body; a campaign row
  // created before that body was kept cannot be replayed.
  const selectedCampaign = campaigns?.find((c) => String(c.id) === campaignId);
  const campaignUnreplayable =
    isBulk && source === 'previous' && selectedCampaign?.mode === 'custom' && !selectedCampaign.html;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBulk ? 'Send to selected members' : `Send email to ${memberName ?? 'member'}`}
      description={
        isBulk
          ? `${ids.length} recipient${ids.length === 1 ? '' : 's'} selected.`
          : undefined
      }
      size="max-w-3xl"
      preventClose={sending}
    >
      <div className="space-y-4">
        {/* Source tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TAB.map((t) => {
            const Icon = t.icon;
            const active = source === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSource(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 -mt-2">{TAB.find((t) => t.id === source)?.hint}</p>

        {/* Template */}
        {source === 'template' && (
          <div className="space-y-3">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {selectedTemplate && (
              <div className="text-xs text-slate-600 space-y-1">
                <p>{selectedTemplate.description}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.hasAttachments && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                      <Paperclip size={10} /> PDFs attached
                    </span>
                  )}
                  {selectedTemplate.note && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                      {selectedTemplate.note}
                    </span>
                  )}
                </div>
              </div>
            )}

            <PreviewPane
              loading={preview === undefined && !!templateId}
              unavailable={preview && !preview.available ? preview.reason : null}
              approximate={!!preview?.approximate}
              subject={preview?.subject}
              html={preview?.html}
              to={preview?.to ?? undefined}
              isBulk={isBulk}
            />
          </div>
        )}

        {/* Previous */}
        {source === 'previous' && !isBulk && (
          <div className="space-y-3">
            {history === undefined ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Nothing has been sent to this member yet.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {history.map((h) => (
                  <label
                    key={String(h.id)}
                    className={`flex items-start gap-3 p-3 cursor-pointer text-sm ${
                      priorSendId === String(h.id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="prior"
                      className="mt-1"
                      checked={priorSendId === String(h.id)}
                      onChange={() => setPriorSendId(String(h.id))}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-slate-900 truncate">{h.subject}</span>
                      <span className="block text-xs text-slate-500">
                        {h.templateLabel} · {new Date(h.createdAt).toLocaleString()} · {h.status}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">
              A template email is re-rendered with current data before it goes out; a composed
              message is sent again word for word.
            </p>
          </div>
        )}

        {source === 'previous' && isBulk && (
          <div className="space-y-3">
            {campaigns === undefined ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No past campaigns yet.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {campaigns.map((c) => (
                  <label
                    key={String(c.id)}
                    className={`flex items-start gap-3 p-3 cursor-pointer text-sm ${
                      campaignId === String(c.id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="campaign"
                      className="mt-1"
                      checked={campaignId === String(c.id)}
                      onChange={() => setCampaignId(String(c.id))}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-slate-900 truncate">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.subject} · {c.recipientCount} recipient
                        {c.recipientCount === 1 ? '' : 's'} ·{' '}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {campaignUnreplayable && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle size={12} /> This campaign&apos;s message was not stored and cannot
                be re-run. Compose it again instead.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Re-runs the chosen campaign&apos;s message against the members selected now — not its
              original recipients.
            </p>
          </div>
        )}

        {/* Compose */}
        {source === 'custom' && (
          <div className="space-y-3">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="<p>Hi {{firstName}},</p>"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <div className="text-xs text-slate-500">
              <p className="mb-1">
                HTML is allowed; the message is wrapped in the standard Ideal Oral Health frame.
                Click a token to insert it:
              </p>
              <div className="flex flex-wrap gap-1">
                {MERGE_TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBody((b) => b + t)}
                    className="font-mono bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Campaign name for bulk */}
        {isBulk && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Campaign name (optional)
            </label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. October ID card re-send"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {isBulk
              ? `Sends to ${ids.length} member${ids.length === 1 ? '' : 's'}. Every send is logged.`
              : 'This send is logged on the member’s record.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || campaignUnreplayable}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                !canSend || campaignUnreplayable
                  ? 'bg-slate-300 cursor-not-allowed'
                  : confirmBulk
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
              {sending
                ? 'Sending…'
                : confirmBulk
                  ? `Yes — send to ${ids.length}`
                  : isBulk
                    ? 'Send campaign'
                    : 'Send email'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PreviewPane({
  loading,
  unavailable,
  approximate,
  subject,
  html,
  to,
  isBulk,
}: {
  loading: boolean;
  unavailable?: string | null;
  approximate: boolean;
  subject?: string;
  html?: string;
  to?: string | null;
  isBulk: boolean;
}) {
  if (loading) return <p className="text-sm text-slate-400">Rendering preview…</p>;
  if (unavailable) return <p className="text-sm text-red-600">{unavailable}</p>;
  if (!html) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-0.5">
        <p>
          <strong>Subject:</strong> {subject}
        </p>
        <p>
          <strong>Preview for:</strong> {to ?? 'no email on file'}
          {isBulk && ' (first selected member)'}
        </p>
        {approximate && (
          <p className="text-amber-700">
            Approximate — the real send generates fresh documents and links.
          </p>
        )}
      </div>
      <iframe
        title="Email preview"
        srcDoc={html}
        className="w-full h-72 bg-white"
        sandbox=""
      />
    </div>
  );
}
