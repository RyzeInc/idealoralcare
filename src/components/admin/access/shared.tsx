'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { AlertTriangle, Check, Lock, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  PAGES,
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_INFO,
  ROLE_TYPES,
  canSee,
  type Permission,
  type PermissionInfo,
  type Portal,
  type RoleType,
} from '@/convex/lib/access/catalog';
import { Combobox } from '@/components/admin/ui';

export type PackRow = FunctionReturnType<typeof api.access.packs.listPacks>[number];
export type Targets = FunctionReturnType<typeof api.access.people.linkTargets>;

export interface RoleDraft {
  role: RoleType;
  partnerId?: Id<'distributionPartners'>;
  leaderId?: Id<'partnerLeaders'>;
  groupId?: Id<'groups'>;
  label?: string;
  title?: string;
  packIds: Id<'accessPacks'>[];
}

/** A conservative starting pack for each role; staff start with none so the choice is deliberate. */
const DEFAULT_PACK: Partial<Record<RoleType, string>> = {
  program_manager: 'partner_leadership',
  fmo: 'partner_leadership',
  agency: 'partner_agent',
  broker: 'partner_agent',
  rep: 'partner_agent',
  organization: 'organization_uploads',
  carrier: 'carrier_signin',
};

export function newRoleDraft(role: RoleType, packs: PackRow[] | undefined): RoleDraft {
  const pack = packs?.find((p) => p.key === DEFAULT_PACK[role] && !p.archived);
  return { role, packIds: pack ? [pack._id] : [] };
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';
export const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
export const buttonCls =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
export const primaryCls = `${buttonCls} bg-blue-600 text-white hover:bg-blue-700`;
export const secondaryCls = `${buttonCls} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const dangerCls = `${buttonCls} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

export function roleLabel(role: RoleType) {
  return ROLE_INFO[role].label;
}

const PARTNER_TYPE_LABEL: Record<string, string> = { program_manager: 'Program Manager', fmo: 'FMO', agency: 'Agency' };

/** Pick the role type, what it links to, and its packs. */
export function RoleFields({
  draft,
  onChange,
  packs,
  targets,
  lockRole = false,
}: {
  draft: RoleDraft;
  onChange: (next: RoleDraft) => void;
  packs: PackRow[] | undefined;
  targets: Targets | undefined;
  lockRole?: boolean;
}) {
  const info = ROLE_INFO[draft.role];
  const partners = useMemo(() => {
    const all = targets?.partners ?? [];
    return info.link === 'partner' ? all.filter((p) => p.type === draft.role) : all;
  }, [targets, info.link, draft.role]);
  const selectedPartner = partners.find((p) => p._id === draft.partnerId) ?? null;
  const selectedGroup = targets?.groups.find((g) => g._id === draft.groupId) ?? null;
  const people = useQuery(
    api.access.people.partnerPeople,
    info.link === 'agency' && draft.partnerId ? { partnerId: draft.partnerId } : 'skip',
  );
  const available = (packs ?? []).filter((p) => !p.archived && p.roles.includes(draft.role));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Role</label>
          <select
            className={inputCls}
            value={draft.role}
            disabled={lockRole}
            onChange={(e) => onChange(newRoleDraft(e.target.value as RoleType, packs))}
          >
            {ROLE_TYPES.map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{info.description}</p>
        </div>

        {(info.link === 'partner' || info.link === 'agency') && (
          <Combobox
            label={info.link === 'partner' ? `${info.label} partner` : 'Agency they work under'}
            value={selectedPartner}
            onSelect={(p) => onChange({ ...draft, partnerId: p?._id, leaderId: undefined })}
            loadItems={async (q) => partners.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50)}
            getKey={(p) => p._id}
            getLabel={(p) => p.name}
            getSecondaryLabel={(p) => `${PARTNER_TYPE_LABEL[p.type] ?? p.type}${p.status !== 'active' ? ` · ${p.status}` : ''}`}
            placeholder="Search partners…"
            disabled={lockRole}
          />
        )}
        {info.link === 'group' && (
          <Combobox
            label="Organization"
            value={selectedGroup}
            onSelect={(g) => onChange({ ...draft, groupId: g?._id })}
            loadItems={async (q) => (targets?.groups ?? []).filter((g) => g.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50)}
            getKey={(g) => g._id}
            getLabel={(g) => g.name}
            getSecondaryLabel={(g) => (g.status !== 'active' ? g.status : undefined)}
            placeholder="Search organizations…"
            disabled={lockRole}
          />
        )}
        {info.link === 'label' && (
          <div>
            <label className={labelCls}>Carrier name</label>
            <input className={inputCls} value={draft.label ?? ''} onChange={(e) => onChange({ ...draft, label: e.target.value })} placeholder="e.g. Careington" />
          </div>
        )}
      </div>

      {info.link === 'agency' && draft.partnerId && !lockRole && (
        <div>
          <label className={labelCls}>Their person record at this agency</label>
          <select
            className={inputCls}
            value={draft.leaderId ?? ''}
            onChange={(e) => onChange({ ...draft, leaderId: (e.target.value || undefined) as Id<'partnerLeaders'> | undefined })}
          >
            <option value="">Create one when they accept</option>
            {(people ?? []).map((p) => (
              <option key={p._id} value={p._id} disabled={p.linked}>
                {p.name} · {p.email}
                {p.linked ? ' (already linked)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Pick their existing record to keep their rep codes and book.</p>
        </div>
      )}

      {draft.role !== 'staff' && (
        <div>
          <label className={labelCls}>Title (optional)</label>
          <input className={inputCls} value={draft.title ?? ''} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder="e.g. Head of Sales" />
        </div>
      )}

      <PackPicker
        packs={available}
        selected={draft.packIds}
        onChange={(packIds) => onChange({ ...draft, packIds })}
      />
    </div>
  );
}

export function PackPicker({
  packs,
  selected,
  onChange,
  disabled = false,
}: {
  packs: PackRow[];
  selected: Id<'accessPacks'>[];
  onChange: (next: Id<'accessPacks'>[]) => void;
  disabled?: boolean;
}) {
  if (!packs.length) return <p className="text-xs text-slate-500">No access packs are available for this role.</p>;
  return (
    <fieldset>
      <legend className={labelCls}>Access packs</legend>
      <div className="space-y-1.5">
        {packs.map((pack) => {
          const checked = selected.includes(pack._id);
          const sensitive = pack.permissions.some((p) => (PERMISSIONS as Record<string, PermissionInfo>)[p]?.sensitive);
          return (
            <label key={pack._id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? selected.filter((id) => id !== pack._id) : [...selected, pack._id])}
              />
              <span>
                <span className="font-medium text-slate-800">{pack.name}</span>
                {sensitive && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">sensitive</span>}
                {pack.key === 'owner' && <Lock size={12} className="ml-1 inline text-slate-400" />}
                <span className="block text-xs text-slate-500">{pack.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const PORTAL_LABEL: Record<Portal, string> = {
  admin: 'Admin console',
  partner: 'Partner portal',
  employer: 'Employer portal',
};

/**
 * What a set of permissions opens: each portal's pages as that person would
 * see them, then the permissions themselves with sensitive ones flagged.
 */
export function AccessPreview({ permissions, isOwner, compact = false }: { permissions: readonly string[]; isOwner?: boolean; compact?: boolean }) {
  const held = new Set(permissions);
  const portals: Portal[] = ['admin', 'partner', 'employer'];
  const sensitive = PERMISSION_KEYS.filter((p) => held.has(p) && (PERMISSIONS[p] as PermissionInfo).sensitive);
  const groups = new Map<string, Permission[]>();
  for (const p of PERMISSION_KEYS) {
    if (!held.has(p)) continue;
    const group = `${PORTAL_LABEL[PERMISSIONS[p].portal]} · ${PERMISSIONS[p].group}`;
    groups.set(group, [...(groups.get(group) ?? []), p]);
  }

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
          Owner: the whole admin console, including managing access and developer tools.
        </div>
      )}
      {sensitive.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Sensitive: {sensitive.map((p) => PERMISSIONS[p].label).join(', ')}.</span>
        </div>
      )}
      {!permissions.length && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No access. They can sign in but every portal is closed to them.</div>
      )}

      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-3'}`}>
        {portals.map((portal) => {
          const pages = PAGES.filter((page) => page.portal === portal);
          const open = pages.filter((page) => canSee(permissions, page.href));
          return (
            <div key={portal} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{PORTAL_LABEL[portal]}</span>
                <span className={`text-xs ${open.length ? 'text-emerald-700' : 'text-slate-400'}`}>{open.length ? `${open.length} of ${pages.length} pages` : 'No access'}</span>
              </div>
              <ul className="max-h-72 space-y-0.5 overflow-auto p-2 text-sm">
                {pages.map((page) => {
                  const ok = canSee(permissions, page.href);
                  return (
                    <li key={page.href} className={`flex items-center gap-2 rounded px-2 py-1 ${ok ? 'text-slate-800' : 'text-slate-300'}`}>
                      {ok ? <Check size={14} className="text-emerald-600" /> : <X size={14} />}
                      {page.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {!compact && groups.size > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-slate-800">Permissions</div>
          <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {[...groups.entries()].map(([group, list]) => (
              <div key={group}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{group}</dt>
                {list.map((p) => (
                  <dd key={p} className="text-slate-700">
                    {PERMISSIONS[p].label}
                    <span className="text-slate-400"> — {PERMISSIONS[p].description}</span>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Convex wraps server errors as "[CONVEX ...] Uncaught Error: message at handler ..."
  const match = raw.match(/(?:Uncaught (?:Convex)?Error: )([\s\S]*?)(?:\n\s+at |$)/);
  return (match?.[1] ?? raw).trim();
}
