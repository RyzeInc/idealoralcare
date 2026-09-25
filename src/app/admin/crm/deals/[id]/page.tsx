'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { Building2, DollarSign, Users, Archive, Star, Target, User } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, LoadMore, useToast } from '@/components/admin/ui';
import { formatCurrency, formatDate } from '@/lib/admin-format';
import { Card, SectionHeader, Field } from '@/components/admin/crm/primitives';
import { ActivityItem } from '@/components/admin/crm/ActivityItem';
import { OwnerPicker } from '@/components/admin/crm/OwnerPicker';
import { tagColorClass } from '@/components/admin/crm/constants';

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dealId = id as Id<'crmDeals'>;
  const router = useRouter();
  const toast = useToast();

  const data = useQuery(api.crm.deals.getDeal, { dealId });
  const stages = useQuery(api.crm.pipelines.listStages, {});
  const { results: activities, status, loadMore } = usePaginatedQuery(
    api.crm.activities.listByDeal,
    { dealId },
    { initialNumItems: 25 },
  );

  const moveDealStage = useMutation(api.crm.deals.moveDealStage);
  const updateDeal = useMutation(api.crm.deals.updateDeal);
  const setDealOwner = useMutation(api.crm.deals.setDealOwner);
  const archiveDeal = useMutation(api.crm.deals.archiveDeal);
  const setPrimaryDeal = useMutation(api.crm.deals.setPrimaryDeal);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', mrr: '', lives: '', probability: '', closeDate: '', notes: '' });

  if (data === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (data === null) return <p className="text-sm text-slate-500">Deal not found.</p>;

  const { deal, company, stage, primaryContact } = data;
  const probability = deal.winProbability ?? stage?.probability ?? 0;
  const amount = deal.mrrCents ?? deal.amountCents ?? 0;

  const beginEdit = () => {
    setDraft({
      name: deal.name,
      mrr: deal.mrrCents ? String(deal.mrrCents / 100) : '',
      lives: deal.estimatedLives ? String(deal.estimatedLives) : '',
      probability: deal.winProbability !== undefined ? String(deal.winProbability) : '',
      closeDate: deal.expectedCloseDate ?? '',
      notes: deal.notes ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateDeal({
        dealId,
        fields: {
          name: draft.name.trim() || deal.name,
          mrrCents: draft.mrr ? Math.round(Number(draft.mrr) * 100) : undefined,
          estimatedLives: draft.lives ? Number(draft.lives) : undefined,
          winProbability: draft.probability ? Number(draft.probability) : undefined,
          expectedCloseDate: draft.closeDate || undefined,
          notes: draft.notes || undefined,
          primaryContactId: deal.primaryContactId,
        },
      });
      setEditing(false);
    } catch (err) {
      toast.fromError(err, 'Could not save deal');
    }
  };

  const handleStageChange = async (stageId: Id<'crmPipelineStages'>) => {
    try {
      await moveDealStage({ dealId, stageId });
    } catch (err) {
      toast.fromError(err, 'Could not change stage');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'CRM', href: '/admin/crm' },
          { label: 'Pipeline', href: '/admin/crm/deals' },
          { label: deal.name },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{deal.name}</h1>
            {deal.isPrimary && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <Star size={10} /> Primary
              </span>
            )}
            {deal.isArchived && (
              <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                Archived
              </span>
            )}
          </div>
          {company && (
            <Link href={`/admin/crm/companies/${company._id}`} className="text-sm text-blue-600 hover:underline">
              {company.name}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!deal.isPrimary && !deal.isArchived && (
            <button
              type="button"
              onClick={() => setPrimaryDeal({ dealId }).catch((e) => toast.fromError(e, 'Could not set primary'))}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Make primary
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                await archiveDeal({ dealId, archived: !deal.isArchived });
                if (!deal.isArchived) router.push('/admin/crm/deals');
              } catch (err) {
                toast.fromError(err, 'Could not archive deal');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Archive size={13} /> {deal.isArchived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </div>

      {/* Stage rail — the whole configured pipeline, current stage highlighted. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(stages ?? []).map((s) => {
          const isCurrent = s._id === deal.stageId;
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => handleStageChange(s._id)}
              disabled={isCurrent}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap ${
                isCurrent ? tagColorClass(s.color) : 'text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <SectionHeader
              icon={Target}
              title="Deal"
              badge={
                editing ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-800">Cancel</button>
                    <button type="button" onClick={saveEdit} className="text-xs font-medium text-blue-600 hover:text-blue-800">Save</button>
                  </div>
                ) : (
                  <button type="button" onClick={beginEdit} className="text-xs text-slate-500 hover:text-slate-800">Edit</button>
                )
              }
            />
            {editing ? (
              <div className="space-y-3">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Deal name" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={draft.mrr} onChange={(e) => setDraft({ ...draft, mrr: e.target.value })} placeholder="Monthly value ($)" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
                  <input type="number" value={draft.lives} onChange={(e) => setDraft({ ...draft, lives: e.target.value })} placeholder="Est. lives" className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
                  <input type="number" min={0} max={100} value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} placeholder={`Win % (stage: ${stage?.probability ?? 0})`} className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
                  <input type="date" value={draft.closeDate} onChange={(e) => setDraft({ ...draft, closeDate: e.target.value })} className="text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
                </div>
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" rows={3} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Monthly value" value={amount > 0 ? formatCurrency(amount / 100) : undefined} />
                <Field
                  label="Win probability"
                  value={
                    <>
                      {probability}%
                      {deal.winProbability === undefined && <span className="text-slate-300 text-xs"> (stage)</span>}
                    </>
                  }
                />
                <Field label="Est. lives" value={deal.estimatedLives} />
                <Field label="Expected close" value={deal.expectedCloseDate} />
              </div>
            )}
            {!editing && deal.notes && <p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">{deal.notes}</p>}
          </Card>

          <Card>
            <SectionHeader icon={DollarSign} title="Timeline" />
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))}
              {activities.length === 0 && status !== 'LoadingFirstPage' && (
                <p className="text-sm text-slate-400">No activity on this deal yet.</p>
              )}
            </div>
            <LoadMore status={status} loadMore={loadMore} pageSize={25} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader icon={Building2} title="Account" />
            <div className="space-y-3">
              <Field
                label="Company"
                value={company ? <Link href={`/admin/crm/companies/${company._id}`} className="text-blue-600 hover:underline">{company.name}</Link> : undefined}
              />
              <Field label="Stage" value={stage?.name} />
              <Field label="In stage since" value={formatDate(deal.stageChangedAt)} />
              {deal.lostReason && <Field label="Lost reason" value={deal.lostReason} />}
            </div>
          </Card>

          <Card>
            <SectionHeader icon={User} title="People" />
            <div className="space-y-3">
              <Field
                label="Champion"
                value={
                  primaryContact ? (
                    <Link href={`/admin/crm/contacts/${primaryContact._id}`} className="text-blue-600 hover:underline">
                      {primaryContact.fullName}
                    </Link>
                  ) : undefined
                }
              />
              <div>
                <p className="text-xs text-slate-400 mb-1">Owner</p>
                <OwnerPicker
                  value={deal.ownerClerkUserId ?? null}
                  onSelect={(user) => user && setDealOwner({ dealId, ownerClerkUserId: user.id })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Users} title="Record" />
            <div className="space-y-3">
              <Field label="Created" value={formatDate(deal.createdAt)} />
              {deal.closedAt && <Field label="Closed" value={formatDate(deal.closedAt)} />}
              {deal.source && <Field label="Source" value={deal.source} />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
