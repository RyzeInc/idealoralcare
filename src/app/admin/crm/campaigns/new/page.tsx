'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import { ContactFilterRail } from '@/components/admin/crm/ContactFilterRail';
import type { ContactListFilters } from '@/components/admin/crm/filterTypes';

export default function NewCampaignPage() {
  const router = useRouter();
  const toast = useToast();
  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile, {});
  const segments = useQuery(api.crm.segments.listSegments, {});
  const dripCampaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const createCampaign = useMutation(api.crm.campaigns.createCampaign);
  const buildRecipients = useMutation(api.crm.campaigns.buildRecipients);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [fromName, setFromName] = useState('Ideal Oral Health');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('support@getidealoh.com');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [dripCampaignId, setDripCampaignId] = useState('');
  const [dripPhase, setDripPhase] = useState('');
  const [filters, setFilters] = useState<ContactListFilters>({ emailable: true });
  const [saving, setSaving] = useState(false);

  const count = useQuery(api.crm.segments.countSegment, { filters });
  const selectedDripCampaign = (dripCampaigns ?? []).find((c) => c._id === dripCampaignId);

  const handleSegmentSelect = (segmentId: string) => {
    setSelectedSegmentId(segmentId);
    const segment = segments?.find((s) => s._id === segmentId);
    if (segment) setFilters(segment.filters as ContactListFilters);
  };

  const handleCreate = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim() || !fromEmail.trim()) return;
    setSaving(true);
    try {
      const campaignId = await createCampaign({
        name: name.trim(), subject: subject.trim(), bodyHtml: bodyHtml.trim(),
        fromName: fromName.trim(), fromEmail: fromEmail.trim(), replyTo: replyTo.trim(),
        dripCampaignId: (dripCampaignId || undefined) as Id<'crmDripCampaigns'> | undefined,
        dripPhase: dripPhase ? Number(dripPhase) : undefined,
      });
      await buildRecipients({ campaignId, filters });
      toast.success('Campaign created — review recipients before sending');
      router.push(`/admin/crm/campaigns/${campaignId}`);
    } catch (err) {
      toast.fromError(err, 'Could not create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Campaigns', href: '/admin/crm/campaigns' }, { label: 'New' }]} />
      <h1 className="text-2xl font-semibold text-slate-900">New Campaign</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (internal)" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="From name" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="From email" type="email" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
          <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="Reply-to" type="email" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={8}
          placeholder="Email body (HTML). {{firstName}}, {{lastName}}, {{fullName}}, {{companyName}}, {{jobTitle}} will be filled in per recipient."
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 font-mono"
        />
      </div>

      {/* Binding a blast to a phase is what makes sending it advance everyone's
          enrollment, so "Email 3 Sent" stays true without anyone moving people
          by hand. Optional — a standalone blast leaves this blank. */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Part of a drip campaign</h2>
        <p className="text-xs text-slate-500">
          Optional. Bind this send to one phase, and every recipient on that campaign advances to it automatically.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={dripCampaignId}
            onChange={(e) => { setDripCampaignId(e.target.value); setDripPhase(''); }}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5"
          >
            <option value="">— Standalone blast —</option>
            {(dripCampaigns ?? []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {selectedDripCampaign && (
            <select
              value={dripPhase}
              onChange={(e) => setDripPhase(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">— Which phase? —</option>
              {Array.from({ length: selectedDripCampaign.phaseCount }, (_, i) => i + 1).map((phase) => (
                <option key={phase} value={phase}>
                  {selectedDripCampaign.phaseLabels?.[phase - 1] ?? `Phase ${phase}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Recipients</h2>
        {segments && segments.length > 0 && (
          <select value={selectedSegmentId} onChange={(e) => handleSegmentSelect(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
            <option value="">— Start from a saved segment —</option>
            {segments.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        )}
        <ContactFilterRail filters={filters} onChange={setFilters} myClerkId={profile?.clerkUserId} />
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-800">{count ? `${count.count}${count.truncated ? '+' : ''}` : '…'}</span> contacts match
          {count && count.count > 500 && <span className="text-red-500 ml-2">Campaigns are capped at 500 recipients — narrow your filters.</span>}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !name.trim() || !subject.trim() || !bodyHtml.trim() || !fromEmail.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? 'Creating…' : 'Create & Build Recipients'}
        </button>
      </div>
    </div>
  );
}
