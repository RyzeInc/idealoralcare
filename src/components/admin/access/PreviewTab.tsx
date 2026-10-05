'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ROLE_INFO, ROLE_TYPES, type RoleType } from '@/convex/lib/access/catalog';
import { computeAccess } from '@/convex/lib/access/resolve';
import { Combobox } from '@/components/admin/ui';
import { AccessPreview, PackPicker, inputCls, labelCls, newRoleDraft, primaryCls, secondaryCls, type PackRow, type RoleDraft } from './shared';

/**
 * See access the way a person experiences it — either a real person, or a
 * what-if mix of roles and packs before granting anything. Uses the same
 * resolution as the server, so what this shows is what the guards enforce.
 */
export function PreviewTab({ packs }: { packs: PackRow[] | undefined }) {
  const [mode, setMode] = useState<'scenario' | 'person'>('scenario');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
        <button className={`rounded-md px-3 py-1.5 ${mode === 'scenario' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setMode('scenario')}>
          Try roles and packs
        </button>
        <button className={`rounded-md px-3 py-1.5 ${mode === 'person' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setMode('person')}>
          A real person
        </button>
      </div>
      {mode === 'scenario' ? <Scenario packs={packs} /> : <PersonPreview />}
      <Walkthrough />
    </div>
  );
}

const PRESETS: Array<{ label: string; roles: Array<{ role: RoleType; packKeys: string[] }> }> = [
  { label: 'Customer support', roles: [{ role: 'staff', packKeys: ['staff_support'] }] },
  { label: 'Finance', roles: [{ role: 'staff', packKeys: ['staff_finance'] }] },
  { label: 'Eligibility operations', roles: [{ role: 'staff', packKeys: ['staff_eligibility'] }] },
  { label: 'Rep', roles: [{ role: 'rep', packKeys: ['partner_agent'] }] },
  {
    label: 'Broker + rep + Program Manager head',
    roles: [
      { role: 'program_manager', packKeys: ['partner_leadership'] },
      { role: 'broker', packKeys: ['partner_agent'] },
      { role: 'rep', packKeys: ['partner_agent'] },
    ],
  },
  { label: 'Organization contact', roles: [{ role: 'organization', packKeys: ['organization_uploads'] }] },
  { label: 'Carrier contact', roles: [{ role: 'carrier', packKeys: ['carrier_signin'] }] },
];

function Scenario({ packs }: { packs: PackRow[] | undefined }) {
  const [roles, setRoles] = useState<RoleDraft[]>([{ role: 'staff', packIds: [] }]);
  const byId = useMemo(() => new Map((packs ?? []).map((p) => [String(p._id), p])), [packs]);
  const result = computeAccess(
    roles.map((r) => ({
      role: r.role,
      status: 'active' as const,
      packs: r.packIds.map((id) => byId.get(String(id))).filter((p): p is PackRow => !!p),
    })),
  );
  const applyPreset = (preset: (typeof PRESETS)[number]) =>
    setRoles(
      preset.roles.map(({ role, packKeys }) => ({
        role,
        packIds: (packs ?? []).filter((p) => packKeys.includes(p.key)).map((p) => p._id),
      })),
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-3">
        <div>
          <div className={labelCls}>Start from an example</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button key={preset.label} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        {roles.map((draft, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <select
                className={inputCls}
                value={draft.role}
                onChange={(e) => setRoles(roles.map((r, j) => (j === i ? newRoleDraft(e.target.value as RoleType, packs) : r)))}
              >
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </option>
                ))}
              </select>
              {roles.length > 1 && (
                <button className="text-xs text-slate-500 hover:text-red-600" onClick={() => setRoles(roles.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
            <PackPicker
              packs={(packs ?? []).filter((p) => !p.archived && p.roles.includes(draft.role))}
              selected={draft.packIds}
              onChange={(packIds) => setRoles(roles.map((r, j) => (j === i ? { ...r, packIds } : r)))}
            />
          </div>
        ))}
        <button className={secondaryCls} onClick={() => setRoles([...roles, newRoleDraft('rep', packs)])}>
          Add another role
        </button>
      </div>
      <AccessPreview permissions={result.permissions} isOwner={result.isOwner} />
    </div>
  );
}

function PersonPreview() {
  const people = useQuery(api.access.people.listPeople);
  const [profileId, setProfileId] = useState<Id<'accessProfiles'> | null>(null);
  const person = useQuery(api.access.people.getPerson, profileId ? { profileId } : 'skip');
  const selected = people?.find((p) => p._id === profileId) ?? null;
  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Combobox
          label="Person"
          value={selected}
          onSelect={(p) => setProfileId(p?._id ?? null)}
          loadItems={async (q) => (people ?? []).filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50)}
          getKey={(p) => p._id}
          getLabel={(p) => p.name}
          getSecondaryLabel={(p) => p.email}
          placeholder="Search people…"
        />
      </div>
      {person && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {person.roles.map((r) => (
              <span key={r._id} className={`rounded-full px-2.5 py-1 ${r.status === 'active' ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-400 line-through'}`}>
                {r.description}: {r.packs.map((p) => p.name).join(', ')}
              </span>
            ))}
          </div>
          <AccessPreview permissions={person.permissions} isOwner={person.isOwner} />
        </>
      )}
    </div>
  );
}

function Walkthrough() {
  const steps = [
    ['Invite', 'An admin invites them by email with one or more roles, each with access packs.'],
    ['Accept', 'They open the emailed link, sign in or create an account with that same email, and accept.'],
    ['Land', 'Staff land in the admin console, partners in the partner portal, organizations on eligibility uploads.'],
    ['Switch', 'Someone with several partner roles picks which one the partner portal shows from the sidebar.'],
    ['Change', 'Editing a pack or a role takes effect immediately; suspending a person closes every portal at once.'],
  ];
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">How someone experiences this</summary>
      <ol className="mt-3 grid gap-3 md:grid-cols-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="mb-1 font-semibold text-slate-800">
              {i + 1}. {title}
            </div>
            <div className="text-slate-600">{body}</div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Try it end to end: invite yourself at a second email address with the &quot;Create invitation&quot; option, open the link in a private window, and accept.
      </p>
      <Link className={`${primaryCls} mt-3`} href="/access">
        Open my access page
      </Link>
    </details>
  );
}
