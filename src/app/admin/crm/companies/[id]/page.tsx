'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, TrendingUp, Users as UsersIcon, Target } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, LoadMore, useToast } from '@/components/admin/ui';
import { Card, SectionHeader, Field } from '@/components/admin/crm/primitives';
import { TagChip } from '@/components/admin/crm/TagChip';
import { TagPicker } from '@/components/admin/crm/TagPicker';
import { CompanyLinkedRecordsCard } from '@/components/admin/crm/LinkedRecordsCard';
import { STAGE_ORDER, STAGE_LABELS } from '@/components/admin/crm/constants';
import { formatCurrency } from '@/lib/admin-format';

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const companyId = id as Id<'crmCompanies'>;
  const toast = useToast();
  const company = useQuery(api.crm.companies.getCompany, { companyId });
  const setStage = useMutation(api.crm.companies.setStage);
  const removeTags = useMutation(api.crm.tags.removeTags);
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const { results: contacts } = usePaginatedQuery(api.crm.contacts.listContacts, { filters: { companyId } }, { initialNumItems: 25 });

  const [lives, setLives] = useState('');
  const [mrr, setMrr] = useState('');

  if (company === undefined) return <div className="py-16 text-center text-slate-400">Loading…</div>;
  if (company === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Company not found.</p>
        <Link href="/admin/crm/companies" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to companies</Link>
      </div>
    );
  }

  const handleStageChange = async (stage: string) => {
    try {
      await setStage({
        companyId,
        stage: stage as Parameters<typeof setStage>[0]['stage'],
        estimatedLives: lives ? Number(lives) : undefined,
        estimatedMrrCents: mrr ? Math.round(Number(mrr) * 100) : undefined,
      });
    } catch (err) {
      toast.fromError(err, 'Could not update stage');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Companies', href: '/admin/crm/companies' }, { label: company.name }]} />

      <div>
        <Link href="/admin/crm/companies" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2">
          <ArrowLeft size={12} /> Back to companies
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
        <p className="text-sm text-slate-500 capitalize">{company.companyType}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <SectionHeader icon={TrendingUp} title="Pipeline" />
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Stage</p>
                <select value={company.stage} onChange={(e) => handleStageChange(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5">
                  {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Est. Lives" value={company.estimatedLives} />
                <Field label="Est. MRR" value={company.estimatedMrrCents ? formatCurrency(company.estimatedMrrCents, { fromCents: true }) : undefined} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Update lives…" value={lives} onChange={(e) => setLives(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1" />
                <input type="number" placeholder="Update MRR $…" value={mrr} onChange={(e) => setMrr(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1" />
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Building2} title="Details" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry" value={company.industry} />
              <Field label="Employees" value={company.employeeCount} />
              <Field label="City" value={company.city} />
              <Field label="State" value={company.state} mono />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
              <TagPicker companyId={companyId} currentTagIds={company.tagIds} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(tree ?? []).flatMap((g) => g.tags.filter((t) => company.tagIds.includes(t._id)).map((t) => (
                <TagChip key={t._id} name={t.name} color={t.color ?? g.category.color} onRemove={() => removeTags({ companyId, tagIds: [t._id] })} />
              )))}
              {company.tagIds.length === 0 && <span className="text-xs text-slate-300">No tags</span>}
            </div>
          </Card>

          <Card>
            <SectionHeader icon={UsersIcon} title={`Contacts (${contacts.length})`} />
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <Link key={c._id} href={`/admin/crm/contacts/${c._id}`} className="block text-sm text-blue-600 hover:underline">
                  {c.fullName} {c.jobTitle && <span className="text-slate-400">— {c.jobTitle}</span>}
                </Link>
              ))}
              {contacts.length === 0 && <p className="text-xs text-slate-400">No contacts linked yet.</p>}
            </div>
          </Card>

          <CompanyDealsCard companyId={companyId} />
          <CompanyLinkedRecordsCard companyId={companyId} />
        </div>

        <div className="lg:col-span-8">
          <TimelineColumnForCompany companyId={companyId} />
        </div>
      </div>
    </div>
  );
}

/**
 * Every deal on this company, not just the primary one. The company's own
 * stage columns mirror the PRIMARY deal — this is where an upsell or renewal
 * running alongside it becomes visible.
 */
function CompanyDealsCard({ companyId }: { companyId: Id<'crmCompanies'> }) {
  const router = useRouter();
  const toast = useToast();
  const deals = useQuery(api.crm.deals.listDealsForCompany, { companyId });
  const createDeal = useMutation(api.crm.deals.createDeal);

  return (
    <Card>
      <SectionHeader
        icon={Target}
        title={`Deals (${deals?.length ?? 0})`}
        badge={
          <button
            type="button"
            onClick={async () => {
              try {
                const id = await createDeal({ companyId });
                router.push(`/admin/crm/deals/${id}`);
              } catch (err) {
                toast.fromError(err, 'Could not create deal');
              }
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            + New
          </button>
        }
      />
      <div className="space-y-1.5">
        {(deals ?? []).map((deal) => (
          <Link key={deal._id} href={`/admin/crm/deals/${deal._id}`} className="block group">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-blue-600 group-hover:underline truncate">
                {deal.name}
                {deal.isPrimary && <span className="text-amber-500 ml-1">★</span>}
              </span>
              <span className="text-xs text-slate-400 flex-shrink-0">{deal.stage?.name ?? '—'}</span>
            </div>
          </Link>
        ))}
        {deals && deals.length === 0 && <p className="text-xs text-slate-400">No deals yet.</p>}
      </div>
    </Card>
  );
}

/** Companies don't have call/draft mechanics, so this reuses the contact TimelineColumn's activity feed shape via a company-scoped query instead of duplicating the whole column. */
function TimelineColumnForCompany({ companyId }: { companyId: Id<'crmCompanies'> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.crm.activities.listByCompany,
    { companyId },
    { initialNumItems: 25 },
  );
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      {status === 'LoadingFirstPage' && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {status !== 'LoadingFirstPage' && results.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No activity yet.</p>}
      <div className="space-y-3">
        {results.map((a) => (
          <ActivityRow key={a._id} title={a.title} body={a.body} actor={a.actorName} occurredAt={a.occurredAt} />
        ))}
      </div>
      <LoadMore status={status} loadMore={loadMore} pageSize={25} label="Load older" />
    </div>
  );
}

function ActivityRow({ title, body, actor, occurredAt }: { title: string; body?: string; actor?: string; occurredAt: number }) {
  return (
    <div className="pb-3 border-b border-slate-100 last:border-0">
      <p className="text-sm text-slate-800 font-medium">{title}</p>
      {body && <p className="text-sm text-slate-600 mt-0.5">{body}</p>}
      <p className="text-xs text-slate-400 mt-1">{actor ?? 'System'} · {new Date(occurredAt).toLocaleString()}</p>
    </div>
  );
}
