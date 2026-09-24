'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { EmailSendDialog } from '@/components/admin/EmailSendDialog';
import { StatusPill } from '@/components/admin/MemberCommunications';
import {
  Mail,
  Send,
  Search,
  Users,
  ListChecks,
  History,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

type Tab = 'send' | 'log' | 'campaigns';

const MEMBER_TYPES = [
  'lead',
  'eligible',
  'enrolling',
  'active',
  'inactive',
  'terminated',
  'declined',
];

const LOG_STATUSES = [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced',
  'complained',
];

export default function CommunicationsPage() {
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Mail size={20} className="text-slate-500" /> Member Communications
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Send a template, a past message, or something new — to one member or to a whole
          selection. Every send is recorded here and on the member&apos;s own record.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { id: 'send', label: 'Mass send', icon: Users },
            { id: 'log', label: 'Send log', icon: History },
            { id: 'campaigns', label: 'Campaigns', icon: ListChecks },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'send' && <MassSend />}
      {tab === 'log' && <SendLog />}
      {tab === 'campaigns' && <Campaigns onOpenLog={() => setTab('log')} />}
    </div>
  );
}

// ─── Mass send ────────────────────────────────────────────────────────────

function MassSend() {
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [memberType, setMemberType] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const groups = useQuery(api.admin.memberEmail.listGroupsForFilter, {});
  const recipients = useQuery(api.admin.memberEmail.listRecipients, {
    search: search || undefined,
    groupId: groupId ? (groupId as Id<'groups'>) : undefined,
    memberType: memberType || undefined,
    limit: 1000,
  });

  const emailable = useMemo(
    () => (recipients ?? []).filter((r) => r.emailable),
    [recipients],
  );
  const allShownSelected =
    emailable.length > 0 && emailable.every((r) => selected.has(String(r.id)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) emailable.forEach((r) => next.delete(String(r.id)));
      else emailable.forEach((r) => next.add(String(r.id)));
      return next;
    });
  }

  const selectedIds = Array.from(selected) as unknown as Id<'memberProfiles'>[];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Search
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or member ID"
              className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Organization
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">All organizations</option>
            {(groups ?? []).map((g) => (
              <option key={String(g.id)} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Status
          </label>
          <select
            value={memberType}
            onChange={(e) => setMemberType(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any status</option>
            {MEMBER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selection bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
        <div className="text-sm text-slate-600">
          <strong className="text-slate-900">{selected.size}</strong> selected
          {recipients && (
            <span className="text-slate-400">
              {' '}
              · {emailable.length} of {recipients.length} shown can receive email
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAllShown}
            disabled={emailable.length === 0}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-300"
          >
            {allShownSelected ? 'Deselect all shown' : 'Select all shown'}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Send size={14} /> Compose &amp; send
          </button>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {recipients === undefined ? (
          <p className="p-4 text-sm text-slate-400">Loading members…</p>
        ) : recipients.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 italic">No members match these filters.</p>
        ) : (
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-2 w-10" />
                  <th className="px-2 py-2 font-medium">Member</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Organization</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((r) => {
                  const id = String(r.id);
                  const checked = selected.has(id);
                  return (
                    <tr
                      key={id}
                      className={`${checked ? 'bg-blue-50' : 'hover:bg-slate-50'} ${
                        r.emailable ? '' : 'opacity-60'
                      }`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!r.emailable}
                          onChange={() => toggle(id)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <p className="text-slate-900 font-medium leading-tight">{r.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{r.memberIdCode}</p>
                      </td>
                      <td className="px-2 py-2 text-slate-600">
                        {r.email ?? (
                          <span className="text-amber-700 text-xs">No email on file</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{r.groupName}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">{r.memberType}</td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/admin/members/${id}`}
                          className="text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 text-xs"
                        >
                          Open <ExternalLink size={10} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmailSendDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        recipientIds={selectedIds}
        onSent={() => setSelected(new Set())}
      />
    </div>
  );
}

// ─── Send log ─────────────────────────────────────────────────────────────

function SendLog({ campaignId }: { campaignId?: Id<'emailCampaigns'> }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const stats = useQuery(api.admin.memberEmail.sendStats, {});
  const sends = useQuery(api.admin.memberEmail.recentSends, {
    limit: 300,
    status: status || undefined,
    campaignId,
    search: search || undefined,
  });

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Last 24 hours" value={stats.last24h} />
          <Stat label="Sent" value={stats.sent} tone="text-blue-700" />
          <Stat label="Delivered" value={stats.delivered} tone="text-emerald-700" />
          <Stat label="Failed / bounced" value={stats.failed} tone="text-red-700" />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Search
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Member, address, or subject"
              className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Delivery status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Any status</option>
            {LOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {sends === undefined ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : sends.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 italic">Nothing matches these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Member</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Sent by</th>
                  <th className="px-4 py-2 font-medium text-right">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sends.map((s) => (
                  <tr key={String(s.id)} className="hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-600">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-slate-900 leading-tight">{s.memberName}</p>
                      <p className="text-xs text-slate-400">{s.to}</p>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-slate-900 leading-tight">{s.subject}</p>
                      <p className="text-xs text-slate-500">
                        {s.templateLabel}
                        {s.campaignId && <span className="text-slate-400"> · campaign</span>}
                      </p>
                      {s.error && <p className="text-xs text-red-600">{s.error}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{s.sentByName}</td>
                    <td className="px-4 py-2 text-right">
                      {s.memberProfileId && (
                        <Link
                          href={`/admin/members/${String(s.memberProfileId)}`}
                          className="text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 text-xs"
                        >
                          Open <ExternalLink size={10} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

// ─── Campaigns ────────────────────────────────────────────────────────────

function Campaigns({ onOpenLog }: { onOpenLog: () => void }) {
  const campaigns = useQuery(api.admin.memberEmail.listCampaigns, { limit: 100 });
  const [openCampaign, setOpenCampaign] = useState<Id<'emailCampaigns'> | null>(null);
  const [retryCampaign, setRetryCampaign] = useState<Id<'emailCampaigns'> | null>(null);

  if (openCampaign) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setOpenCampaign(null)}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← All campaigns
        </button>
        <SendLog campaignId={openCampaign} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {campaigns === undefined ? (
        <p className="p-4 text-sm text-slate-400">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">No campaigns yet.</p>
          <button
            type="button"
            onClick={onOpenLog}
            className="text-sm text-blue-600 hover:text-blue-800 mt-1"
          >
            View individual sends instead
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-4 py-2 font-medium">Campaign</th>
                <th className="px-2 py-2 font-medium">Progress</th>
                <th className="px-2 py-2 font-medium">Started by</th>
                <th className="px-4 py-2 font-medium text-right">Recipients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => {
                const done = c.sentCount + c.failedCount;
                const pct = c.recipientCount ? Math.round((done / c.recipientCount) * 100) : 0;
                return (
                  <tr key={String(c.id)} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-slate-900 font-medium leading-tight">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.subject} · {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-2 py-3 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        {c.status === 'sending' && (
                          <RefreshCw size={12} className="animate-spin text-blue-600" />
                        )}
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              c.failedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {c.sentCount} sent
                        {c.failedCount > 0 && (
                          <span className="text-red-600"> · {c.failedCount} failed</span>
                        )}{' '}
                        of {c.recipientCount}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-500">{c.createdByName}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {c.failedCount > 0 && c.status !== 'sending' && (
                        <button
                          type="button"
                          onClick={() => setRetryCampaign(c.id as Id<'emailCampaigns'>)}
                          className="text-amber-700 hover:text-amber-900 text-xs mr-3"
                        >
                          Retry {c.failedCount} failed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenCampaign(c.id as Id<'emailCampaigns'>)}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        View sends
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RetryFailed
        campaignId={retryCampaign}
        onClose={() => setRetryCampaign(null)}
      />
    </div>
  );
}

/**
 * Re-send to exactly the recipients a campaign could not reach — the common
 * case after fixing whatever caused the failures.
 */
function RetryFailed({
  campaignId,
  onClose,
}: {
  campaignId: Id<'emailCampaigns'> | null;
  onClose: () => void;
}) {
  const failed = useQuery(
    api.admin.memberEmail.campaignFailedRecipients,
    campaignId ? { campaignId } : 'skip',
  );

  if (!campaignId || failed === undefined || failed.length === 0) {
    return (
      <EmailSendDialog open={false} onClose={onClose} recipientIds={[]} />
    );
  }

  return (
    <EmailSendDialog
      open
      onClose={onClose}
      recipientIds={failed.map((f) => f.memberProfileId as Id<'memberProfiles'>)}
      onSent={onClose}
    />
  );
}
