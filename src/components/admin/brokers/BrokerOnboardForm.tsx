'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ArrowLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { RequiredMark, useToast } from '@/components/admin/ui';
import { buildUplineOptions } from '@/lib/partner-upline';
import {
  ACCESS_ROLES,
  TYPE_LABEL,
  accessRoleFields,
  cardCls,
  inputCls,
  labelCls,
  primaryBtn,
  secondaryBtn,
  todayIso,
  type AccessRole,
  type PartnerStatus,
  type PartnerType,
} from './shared';

const NOTES_MAX = 4000;

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function BrokerOnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const partners = useQuery(api.admin.distributionPartners.getAll);
  const addPartner = useAction(api.admin.distributionPartners.add);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'agency' as PartnerType,
    parentId: searchParams.get('parent') ?? '',
    npn: '',
    effectiveDate: todayIso(),
    overrideRate: '',
    status: 'active' as PartnerStatus,
    contactName: '',
    contactTitle: '',
    contactEmail: '',
    contactPhone: '',
    role: 'agency' as AccessRole,
    sendInvite: true,
    notes: '',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const canInvite = form.status === 'active' && form.role !== 'none';
  const willInvite = canInvite && form.sendInvite;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const rate = form.overrideRate.trim() === '' ? undefined : Number(form.overrideRate);
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      toast.warning('Check the override rate', 'Enter a percentage between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      const result = await addPartner({
        name: form.name,
        type: form.type,
        parentId: form.parentId ? (form.parentId as Id<'distributionPartners'>) : undefined,
        npn: form.npn || undefined,
        effectiveDate: form.effectiveDate || undefined,
        overrideRate: rate,
        status: form.status,
        contactName: form.contactName,
        contactTitle: form.contactTitle || undefined,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        notes: form.notes || undefined,
        ...accessRoleFields(form.role),
        sendInvite: willInvite,
      });
      if (!willInvite) toast.success('Broker onboarded', `${form.name} was saved. No invite was sent.`);
      else if (result.inviteSent) toast.success('Broker onboarded', `${form.contactName} was emailed a portal invite.`);
      else toast.warning('Broker saved, invite email failed', `${result.inviteError ?? 'Unknown error'}. Resend it from the Team tab.`);
      router.push(`/admin/brokers/${result.partnerId}`);
    } catch (err) {
      toast.fromError(err, 'Could not onboard broker');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/brokers" className="inline-flex items-center gap-2 hover:text-teal-700">
          <ArrowLeft size={16} /> Brokers
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900">Onboard broker</span>
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Onboard a broker</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creates the organization and its primary contact together. Rep codes and more team members are added from the broker&apos;s workspace afterwards.
        </p>
      </header>

      <Section title="Organization">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="ob-name">Organization name<RequiredMark /></label>
          <input id="ob-name" className={inputCls} required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Coastal Benefits Group" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>Type<RequiredMark /></legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TYPE_LABEL) as PartnerType[]).map((t) => (
              <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.type === t ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <input type="radio" name="ob-type" value={t} checked={form.type === t} onChange={() => set('type', t)} className="accent-teal-700" />
                {TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className={labelCls} htmlFor="ob-upline">Upline partner</label>
          <select id="ob-upline" className={inputCls} value={form.parentId} onChange={(e) => set('parentId', e.target.value)} disabled={partners === undefined}>
            <option value="">Independent (no upline)</option>
            {buildUplineOptions(partners ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">The upline earns an override on this partner&apos;s book and can be granted visibility into it.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-npn">NPN</label>
          <input id="ob-npn" className={inputCls} inputMode="numeric" value={form.npn} onChange={(e) => set('npn', e.target.value)} placeholder="National Producer Number" />
        </div>
      </Section>

      <Section title="Agreement" description="Terms that apply to this organization.">
        <div>
          <label className={labelCls} htmlFor="ob-effective">Effective date</label>
          <input id="ob-effective" type="date" className={inputCls} value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-rate">Override / management fee (%)</label>
          <input id="ob-rate" type="number" min={0} max={100} step={0.1} className={inputCls} value={form.overrideRate} onChange={(e) => set('overrideRate', e.target.value)} placeholder="5.0" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-status">Status</label>
          <select id="ob-status" className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as PartnerStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (set up now, activate later)</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </Section>

      <Section title="Primary contact" description="The person who runs this relationship. They become the first member of the broker's team.">
        <div>
          <label className={labelCls} htmlFor="ob-contact">Full name<RequiredMark /></label>
          <input id="ob-contact" className={inputCls} required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-title">Title</label>
          <input id="ob-title" className={inputCls} value={form.contactTitle} onChange={(e) => set('contactTitle', e.target.value)} placeholder="Principal" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-email">Email<RequiredMark /></label>
          <input id="ob-email" type="email" className={inputCls} required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="jane@coastalbenefits.com" />
        </div>
        <div>
          <label className={labelCls} htmlFor="ob-phone">Phone</label>
          <input id="ob-phone" type="tel" className={inputCls} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="(555) 123-4567" />
        </div>
      </Section>

      <section className={cardCls}>
        <h2 className="text-base font-semibold text-slate-900">Portal access</h2>
        <p className="mt-0.5 text-sm text-slate-500">What the primary contact can see in the partner portal. You can change this later from the Team tab.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {ACCESS_ROLES.map((r) => (
            <label key={r.value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.role === r.value ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="ob-role" className="mt-1 accent-teal-700" checked={form.role === r.value} onChange={() => set('role', r.value)} />
              <span>
                <span className="block text-sm font-medium text-slate-900">{r.label}</span>
                <span className="block text-xs text-slate-500">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
        <label className={`mt-4 flex items-center gap-2 text-sm ${canInvite ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" className="accent-teal-700" checked={willInvite} disabled={!canInvite} onChange={(e) => set('sendInvite', e.target.checked)} />
          Email a 30-day portal invite now
          {!canInvite && <span className="text-xs">(needs an active status and portal access)</span>}
        </label>
      </section>

      <section className={cardCls}>
        <label className="text-base font-semibold text-slate-900" htmlFor="ob-notes">Profile notes</label>
        <p className="mt-0.5 text-sm text-slate-500">Internal only. Never shown to the broker.</p>
        <textarea id="ob-notes" rows={5} maxLength={NOTES_MAX} className={`${inputCls} mt-3`} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Territory, carrier appointments, how they found us…" />
        <p className="mt-1 text-right text-xs text-slate-400">{form.notes.length}/{NOTES_MAX}</p>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/admin/brokers" className={secondaryBtn}>Cancel</Link>
        <button type="submit" className={primaryBtn} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : willInvite ? <Send size={15} /> : null}
          {saving ? 'Saving…' : willInvite ? 'Onboard & send invite' : 'Onboard broker'}
        </button>
      </div>
    </form>
  );
}
