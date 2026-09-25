'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Send, Check, Pause, Play, X, FlaskConical } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, StatusBadge, useToast, type DataTableColumn } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending'> = {
  draft: 'neutral', ready: 'info', sending: 'pending', paused: 'warning',
  sent: 'success', cancelled: 'neutral', failed: 'danger',
};

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const campaignId = id as Id<'crmCampaigns'>;
  const toast = useToast();
  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile, {});
  const campaign = useQuery(api.crm.campaigns.getCampaign, { campaignId });
  const recipients = useQuery(api.crm.campaigns.listRecipients, { campaignId });

  const approveCampaign = useMutation(api.crm.campaigns.approveCampaign);
  const pauseCampaign = useMutation(api.crm.campaigns.pauseCampaign);
  const cancelCampaign = useMutation(api.crm.campaigns.cancelCampaign);
  const startCampaign = useAction(api.crm.campaigns.startCampaign);
  const resumeCampaign = useAction(api.crm.campaigns.resumeCampaign);
  const sendTestEmail = useAction(api.crm.email.sendTestEmail);
  const [sendingTest, setSendingTest] = useState(false);

  if (campaign === undefined) return <div className="py-16 text-center text-slate-400">Loading…</div>;
  if (campaign === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Campaign not found.</p>
        <Link href="/admin/crm/campaigns" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to campaigns</Link>
      </div>
    );
  }

  const handleApprove = async () => {
    try {
      await approveCampaign({ campaignId });
      toast.success('Campaign approved');
    } catch (err) {
      toast.fromError(err, 'Could not approve');
    }
  };

  const handleStart = async () => {
    try {
      const result = await startCampaign({ campaignId });
      if (result.started) toast.success('Sending started');
      else toast.error('Could not start', result.error);
    } catch (err) {
      toast.fromError(err, 'Could not start send');
    }
  };

  const handleSendTest = async () => {
    if (!profile?.email) {
      toast.error('No email on file', 'Your admin profile needs an email to receive a test send.');
      return;
    }
    setSendingTest(true);
    try {
      const result = await sendTestEmail({ to: profile.email, subject: campaign.subject, bodyHtml: campaign.bodyHtml });
      if (result.success) toast.success(`Test sent to ${profile.email}`);
      else toast.error('Test send failed', result.error);
    } finally {
      setSendingTest(false);
    }
  };

  const columns: DataTableColumn<Doc<'crmCampaignRecipients'>>[] = [
    { key: 'email', label: 'Email', fixed: true, sortValue: (r) => r.email, render: (r) => <span className="text-slate-800">{r.email}</span> },
    { key: 'status', label: 'Status', sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} size="sm" /> },
    { key: 'skipReason', label: 'Skip Reason', sortValue: (r) => r.skipReason ?? '', render: (r) => <span className="text-xs text-slate-500">{r.skipReason?.replace(/_/g, ' ') ?? '—'}</span> },
    { key: 'opens', label: 'Opens', align: 'center', sortValue: (r) => r.openCount, render: (r) => <span>{r.openCount}</span> },
    { key: 'sentAt', label: 'Sent', sortValue: (r) => r.sentAt ?? 0, render: (r) => <span className="text-xs text-slate-500">{r.sentAt ? formatDateTime(r.sentAt) : '—'}</span> },
  ];

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Campaigns', href: '/admin/crm/campaigns' }, { label: campaign.name }]} />
      <Link href="/admin/crm/campaigns" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft size={12} /> Back to campaigns
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} tone={STATUS_TONE[campaign.status]} />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{campaign.subject}</p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSendTest} disabled={sendingTest} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            <FlaskConical size={14} /> {sendingTest ? 'Sending…' : 'Send Test'}
          </button>
          {campaign.status === 'ready' && !campaign.approvedBy && (
            <button type="button" onClick={handleApprove} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900">
              <Check size={14} /> Approve
            </button>
          )}
          {campaign.status === 'ready' && campaign.approvedBy && (
            <button type="button" onClick={handleStart} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Send size={14} /> Send Now
            </button>
          )}
          {campaign.status === 'sending' && (
            <button type="button" onClick={() => pauseCampaign({ campaignId })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50">
              <Pause size={14} /> Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button type="button" onClick={() => resumeCampaign({ campaignId })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Play size={14} /> Resume
            </button>
          )}
          {['ready', 'sending', 'paused'].includes(campaign.status) && (
            <button type="button" onClick={() => cancelCampaign({ campaignId })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-4 sm:grid-cols-8 gap-3">
        <StatBox label="Recipients" value={campaign.totalRecipients} />
        <StatBox label="Skipped" value={campaign.skippedCount} />
        <StatBox label="Sent" value={campaign.sentCount} />
        <StatBox label="Delivered" value={campaign.deliveredCount} />
        <StatBox label="Opened" value={campaign.openedCount} />
        <StatBox label="Clicked" value={campaign.clickedCount} />
        <StatBox label="Bounced" value={campaign.bouncedCount} />
        <StatBox label="Unsubscribed" value={campaign.unsubscribedCount} />
      </div>

      <DataTable
        columns={columns}
        rows={recipients ?? []}
        getRowKey={(r) => r._id}
        storageKey="crmCampaignRecipientsColumns.v1"
        defaultSortKey="status"
        emptyMessage="No recipients built yet."
      />
    </div>
  );
}
