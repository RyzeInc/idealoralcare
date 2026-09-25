'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { Plus } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { Breadcrumbs, DataTable, StatusBadge, type DataTableColumn } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending'> = {
  draft: 'neutral', ready: 'info', sending: 'pending', paused: 'warning',
  sent: 'success', cancelled: 'neutral', failed: 'danger',
};

export default function CampaignsListPage() {
  const router = useRouter();
  const campaigns = useQuery(api.crm.campaigns.listCampaigns, {});

  const columns: DataTableColumn<Doc<'crmCampaigns'>>[] = [
    { key: 'name', label: 'Campaign', fixed: true, sortValue: (c) => c.name.toLowerCase(), render: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
    { key: 'status', label: 'Status', sortValue: (c) => c.status, render: (c) => <StatusBadge status={c.status} tone={STATUS_TONE[c.status]} size="sm" /> },
    { key: 'recipients', label: 'Recipients', align: 'center', sortValue: (c) => c.totalRecipients, render: (c) => <span>{c.totalRecipients - c.skippedCount} / {c.totalRecipients}</span> },
    { key: 'sent', label: 'Sent', align: 'center', sortValue: (c) => c.sentCount, render: (c) => <span>{c.sentCount}</span> },
    { key: 'opened', label: 'Opened', align: 'center', sortValue: (c) => c.openedCount, render: (c) => <span>{c.openedCount}</span> },
    { key: 'created', label: 'Created', sortValue: (c) => c.createdAt, render: (c) => <span className="text-xs text-slate-500">{formatDateTime(c.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Campaigns' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
        <button
          type="button"
          onClick={() => router.push('/admin/crm/campaigns/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> New Campaign
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={campaigns ?? []}
        getRowKey={(c) => c._id}
        defaultSortKey="created"
        emptyMessage="No campaigns yet."
        onRowClick={(c) => router.push(`/admin/crm/campaigns/${c._id}`)}
      />
    </div>
  );
}
