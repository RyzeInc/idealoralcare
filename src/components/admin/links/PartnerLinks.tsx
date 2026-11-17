'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Check, ClipboardList, Copy, Download, Loader2, Plus, Search } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Modal, StatusBadge, useToast } from '@/components/admin/ui';
import { cardCls, dangerBtn, inputCls, labelCls, primaryBtn, secondaryBtn } from '@/components/admin/brokers/shared';
import { HOLDER_LABEL, linksCsv, linksText, partnerLink, type LinkLanding } from '@/lib/partner-links';

type HolderType = 'broker' | 'rep' | 'organization' | 'partner' | 'other';

const EMPTY_FORM = {
  holderType: 'broker' as HolderType,
  name: '',
  contactName: '',
  email: '',
  phone: '',
  organizationId: '',
  ending: '',
  code: '',
  landing: '' as LinkLanding | '',
};

const ROW_COLS = 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_7rem_5rem_8.5rem]';
const isOrg = (type: HolderType) => type === 'organization' || type === 'partner';
const previewEnding = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '');

/**
 * Add and drop the people and organizations that sell, and hand out their
 * links. Deliberately shows nothing else: this is the whole screen for someone
 * whose only access is the Broker links pack.
 */
export function PartnerLinks() {
  const toast = useToast();
  const rows = useQuery(api.admin.partnerLinks.list);
  const organizations = useQuery(api.admin.partnerLinks.organizations);
  const add = useMutation(api.admin.partnerLinks.add);
  const setActive = useMutation(api.admin.partnerLinks.setActive);

  const [search, setSearch] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const offCount = (rows ?? []).filter((r) => !r.active).length;
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (showOff || r.active) &&
        (!q || [r.name, r.detail, r.email, r.ending, r.code].some((value) => value?.toLowerCase().includes(q))),
    );
  }, [rows, search, showOff]);

  const copy = async (text: string, done: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
      }
    } catch {
      toast.info('Copy this', text);
    }
  };

  const download = () => {
    const blob = new Blob([`﻿${linksCsv(visible)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assurevantage-links-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await add({
        holderType: form.holderType,
        name: form.name,
        contactName: isOrg(form.holderType) ? form.contactName || undefined : undefined,
        email: form.email,
        phone: form.phone || undefined,
        organizationId: !isOrg(form.holderType) && form.organizationId ? (form.organizationId as Id<'distributionPartners'>) : undefined,
        ending: form.ending || undefined,
        code: form.code || undefined,
        landing: form.landing || undefined,
      });
      const link = partnerLink(result.ending);
      setAdding(false);
      setForm(EMPTY_FORM);
      await copy(link, `Added. Link copied: ${link}`);
    } catch (error) {
      toast.fromError(error, 'Could not add');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: { id: Id<'brokerTrackingCodes'>; name: string; active: boolean }) => {
    if (row.active && !confirm(`Turn off ${row.name}'s link? It stops working for new visitors right away. Members they already signed up stay credited to them, and you can turn it back on later.`)) return;
    setBusyId(row.id);
    try {
      await setActive({ id: row.id, active: !row.active });
      toast.success(row.active ? `${row.name}'s link is off` : `${row.name}'s link is back on`);
    } catch (error) {
      toast.fromError(error, 'Could not update the link');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Broker Links</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Everyone who sells for us and their AssureVantage link. Members who join through a link are credited to its owner.
            Active members counts current memberships only, once per household.
          </p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setAdding(true)}>
          <Plus size={16} /> Add a broker or partner
        </button>
      </div>

      <div className={`${cardCls} flex flex-wrap items-center gap-3`}>
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search links"
            className={`${inputCls} pl-9`}
            placeholder="Search by name, email or link"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />
          Show turned off ({offCount})
        </label>
        <button type="button" className={secondaryBtn} disabled={!visible.length} onClick={() => copy(linksText(visible), `${visible.length} links copied`)}>
          <ClipboardList size={15} /> Copy all
        </button>
        <button type="button" className={secondaryBtn} disabled={!visible.length} onClick={download}>
          <Download size={15} /> Download spreadsheet
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows === undefined ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading links…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {rows.length === 0 ? 'No one has a link yet. Add your first broker or partner.' : 'Nothing matches. Clear the search or show turned-off links.'}
          </div>
        ) : (
          <div>
            <div className={`hidden gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid ${ROW_COLS}`}>
              <span>Name</span>
              <span>Link</span>
              <span className="text-right">Active members</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100">
              {visible.map((row) => {
                const link = partnerLink(row.ending);
                return (
                  <li key={row.id} className={`flex flex-col gap-3 px-4 py-4 md:grid md:items-center md:gap-4 ${ROW_COLS} ${row.active ? '' : 'bg-slate-50/60 text-slate-500'}`}>
                    <div className="min-w-0">
                      <div className="break-words font-medium text-slate-900">{row.name}</div>
                      <div className="break-words text-xs text-slate-500">
                        {[row.holderType ? HOLDER_LABEL[row.holderType] : null, row.detail, row.email].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <span className={`min-w-0 flex-1 break-all font-mono text-xs ${row.active ? 'text-slate-800' : 'line-through'}`}>{link}</span>
                        {row.active && (
                          <button
                            type="button"
                            aria-label={`Copy ${row.name}'s link`}
                            className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                            onClick={() => copy(link, 'Link copied', row.id)}
                          >
                            {copiedId === row.id ? <Check size={14} className="text-teal-700" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">Code {row.code}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 md:contents">
                      <div className="text-sm md:text-right">
                        <div className="tabular-nums text-slate-800">
                          {row.activeMembers}<span className="md:hidden"> active member{row.activeMembers === 1 ? '' : 's'}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.endedMembers > 0 && `${row.endedMembers} ended · `}{row.linkVisits} visit{row.linkVisits === 1 ? '' : 's'}
                        </div>
                      </div>
                      <StatusBadge status={row.active ? 'active' : 'inactive'} label={row.active ? 'Active' : 'Off'} tone={row.active ? 'success' : 'neutral'} />
                      <button type="button" disabled={busyId === row.id} className={`${row.active ? dangerBtn : secondaryBtn} md:justify-self-end`} onClick={() => toggle(row)}>
                        {row.active ? 'Turn off' : 'Turn back on'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a broker or partner"
        description="They get a link right away. No email is sent and no login is created."
        preventClose={saving}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="link-type">What are they?</label>
            <select id="link-type" className={inputCls} value={form.holderType} onChange={(e) => set('holderType', e.target.value as HolderType)}>
              {Object.entries(HOLDER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="link-name">{isOrg(form.holderType) ? 'Organization name' : 'Full name'}</label>
            <input id="link-name" required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          {isOrg(form.holderType) && (
            <div>
              <label className={labelCls} htmlFor="link-contact">Contact person (optional)</label>
              <input id="link-contact" className={inputCls} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="link-email">Email</label>
              <input id="link-email" type="email" required className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="link-phone">Phone (optional)</label>
              <input id="link-phone" type="tel" className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          {!isOrg(form.holderType) && (
            <div>
              <label className={labelCls} htmlFor="link-org">Part of (optional)</label>
              <select id="link-org" className={inputCls} value={form.organizationId} onChange={(e) => set('organizationId', e.target.value)}>
                <option value="">On their own</option>
                {(organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="link-ending">Link ending (optional)</label>
            <input id="link-ending" className={inputCls} placeholder="Leave blank to use their name" value={form.ending} onChange={(e) => set('ending', previewEnding(e.target.value))} />
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {partnerLink(form.ending || previewEnding(form.name.replace(/[^a-zA-Z0-9]/g, '')) || 'theirname')}
            </p>
          </div>
          <div>
            <label className={labelCls} htmlFor="link-code">Code (optional)</label>
            <input
              id="link-code"
              className={`${inputCls} uppercase placeholder:normal-case`}
              placeholder="Leave blank to number it for them"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            />
            <p className="mt-1 text-xs text-slate-500">What customers can type at checkout if they don&apos;t use the link. Also works as a link: {partnerLink(form.code || 'CODE')}</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="link-landing">Where the link opens</label>
            <select id="link-landing" className={inputCls} value={form.landing} onChange={(e) => set('landing', e.target.value as LinkLanding | '')}>
              <option value="">AssureVantage home page</option>
              <option value="oralcare">Oral care plans</option>
              <option value="essentials">Essentials</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={secondaryBtn} disabled={saving} onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add and copy link
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
