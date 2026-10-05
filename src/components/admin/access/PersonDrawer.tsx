'use client';

import { useState } from 'react';
import type { FunctionReturnType } from 'convex/server';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Copy, Mail, Plus, Trash2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ROLE_INFO } from '@/convex/lib/access/catalog';
import { Drawer, StatusBadge, useToast } from '@/components/admin/ui';
import {
  AccessPreview,
  PackPicker,
  RoleFields,
  dangerCls,
  errorText,
  inputCls,
  labelCls,
  newRoleDraft,
  primaryCls,
  secondaryCls,
  type PackRow,
  type RoleDraft,
  type Targets,
} from './shared';

export function PersonDrawer({
  profileId,
  onClose,
  packs,
  targets,
}: {
  profileId: Id<'accessProfiles'>;
  onClose: () => void;
  packs: PackRow[] | undefined;
  targets: Targets | undefined;
}) {
  const person = useQuery(api.access.people.getPerson, { profileId });
  const toast = useToast();
  const setStatus = useMutation(api.access.people.setPersonStatus);
  const resend = useAction(api.access.invites.resendInvite);
  const revoke = useMutation(api.access.invites.revokeInvite);
  const deleteInvitation = useMutation(api.access.people.deleteInvitation);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [adding, setAdding] = useState<RoleDraft | null>(null);
  const addRole = useMutation(api.access.people.addRole);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      const result = (await fn()) as { warnings?: string[]; warning?: string | null } | null;
      for (const w of [...(result?.warnings ?? []), ...(result?.warning ? [result.warning] : [])]) toast.warning(w);
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const p = person?.profile;
  const locked = !!person?.isSelf;
  return (
    <Drawer open onClose={onClose} title={p?.name ?? 'Person'} description={p?.email} width="w-[32rem]" preventClose={busy}>
      {person === undefined ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : person === null || !p ? (
        <p className="text-sm text-slate-500">This person no longer exists.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} size="md" />
            {person.isOwner && <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">Owner</span>}
            <span className="text-xs text-slate-500">{p.signedIn ? 'Signed in with Clerk' : 'Has not signed in'}</span>
          </div>
          {locked && <p className="rounded-lg bg-slate-100 p-2 text-sm text-slate-600">This is you. Another admin has to change your access.</p>}

          {p.status === 'invited' && (
            <section className="space-y-2 rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">Invitation</h3>
              <p className="text-sm text-slate-600">
                {p.invite === 'pending'
                  ? `Link sent ${p.invitedAt ? new Date(p.invitedAt).toLocaleDateString() : ''}; expires ${p.inviteExpiry ? new Date(p.inviteExpiry).toLocaleDateString() : ''}.`
                  : p.invite === 'expired'
                    ? 'The link expired. Send a new one.'
                    : 'No link has been sent.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={secondaryCls} disabled={busy || locked} onClick={() => run(() => resend({ profileId, sendEmail: true }), 'New invitation emailed')}>
                  <Mail size={14} /> Email a new link
                </button>
                <button
                  className={secondaryCls}
                  disabled={busy || locked}
                  onClick={() =>
                    run(async () => {
                      const r = await resend({ profileId, sendEmail: false });
                      setLink(r.claimUrl ?? null);
                      return null;
                    })
                  }
                >
                  <Copy size={14} /> Get a new link to send
                </button>
                {p.invite === 'pending' && (
                  <button className={secondaryCls} disabled={busy || locked} onClick={() => run(() => revoke({ profileId }), 'Link cancelled')}>
                    Cancel link
                  </button>
                )}
                <button
                  className={dangerCls}
                  disabled={busy || locked}
                  onClick={async () => {
                    if (!confirm(`Withdraw the invitation for ${p.email}? Their roles are removed.`)) return;
                    if (await run(() => deleteInvitation({ profileId }), 'Invitation withdrawn')) onClose();
                  }}
                >
                  <Trash2 size={14} /> Withdraw
                </button>
              </div>
              {link && (
                <div className="flex gap-2">
                  <input readOnly className={inputCls} value={link} onFocus={(e) => e.target.select()} />
                  <button
                    className={secondaryCls}
                    onClick={() => {
                      void navigator.clipboard.writeText(link);
                      toast.success('Link copied');
                    }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </section>
          )}

          <DetailsForm key={`${p._id}-${p.name}-${p.phone}-${p.notes}`} profile={p} disabled={locked} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Roles</h3>
              {!adding && !locked && p.status !== 'suspended' && (
                <button className={secondaryCls} onClick={() => setAdding(newRoleDraft('rep', packs))}>
                  <Plus size={14} /> Add role
                </button>
              )}
            </div>
            {person.roles.length === 0 && <p className="text-sm text-slate-500">No roles.</p>}
            {person.roles.map((role) => (
              <RoleEditor key={`${role._id}-${role.status}-${role.packs.map((x) => x._id).join()}`} role={role} packs={packs} disabled={locked || busy} run={run} />
            ))}
            {adding && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                <RoleFields draft={adding} onChange={setAdding} packs={packs} targets={targets} />
                <div className="flex justify-end gap-2">
                  <button className={secondaryCls} onClick={() => setAdding(null)}>
                    Cancel
                  </button>
                  <button
                    className={primaryCls}
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(() => addRole({ profileId, role: { ...adding, label: adding.label || undefined, title: adding.title || undefined } }), 'Role added');
                      if (ok) setAdding(null);
                    }}
                  >
                    Add role
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">What they can open</h3>
            <AccessPreview permissions={person.permissions} isOwner={person.isOwner} compact />
          </section>

          {p.signedIn && (
            <section className="border-t border-slate-200 pt-4">
              {p.status === 'suspended' ? (
                <button className={primaryCls} disabled={busy || locked} onClick={() => run(() => setStatus({ profileId, status: 'active' }), 'Reactivated')}>
                  Reactivate everywhere
                </button>
              ) : (
                <button
                  className={dangerCls}
                  disabled={busy || locked}
                  onClick={() => {
                    if (confirm(`Suspend ${p.name}? They lose every role at once until reactivated.`)) void run(() => setStatus({ profileId, status: 'suspended' }), 'Suspended');
                  }}
                >
                  Suspend everywhere
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function DetailsForm({
  profile,
  disabled,
}: {
  profile: { _id: Id<'accessProfiles'>; name: string; phone: string | null; notes: string | null };
  disabled: boolean;
}) {
  const update = useMutation(api.access.people.updateProfile);
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [notes, setNotes] = useState(profile.notes ?? '');
  const dirty = name !== profile.name || phone !== (profile.phone ?? '') || notes !== (profile.notes ?? '');
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Details</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={phone} disabled={disabled} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={inputCls} rows={2} value={notes} disabled={disabled} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {dirty && (
        <button
          className={primaryCls}
          onClick={async () => {
            try {
              await update({ profileId: profile._id, name, phone: phone || undefined, notes: notes || undefined });
              toast.success('Saved');
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          Save details
        </button>
      )}
    </section>
  );
}

type PersonRole = NonNullable<FunctionReturnType<typeof api.access.people.getPerson>>['roles'][number];

function RoleEditor({
  role,
  packs,
  disabled,
  run,
}: {
  role: PersonRole;
  packs: PackRow[] | undefined;
  disabled: boolean;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
}) {
  const update = useMutation(api.access.people.updateRole);
  const remove = useMutation(api.access.people.removeRole);
  const [packIds, setPackIds] = useState<Id<'accessPacks'>[]>(role.packs.map((p) => p._id));
  const [title, setTitle] = useState(role.title ?? '');
  const [label, setLabel] = useState(role.label ?? '');
  const available = (packs ?? []).filter((p) => p.roles.includes(role.role) && (!p.archived || packIds.includes(p._id)));
  const dirty =
    title !== (role.title ?? '') || label !== (role.label ?? '') || packIds.length !== role.packs.length || packIds.some((id) => !role.packs.some((p) => p._id === id));
  const save = (status: 'active' | 'suspended') =>
    run(() => update({ roleId: role._id, packIds, status, title: title || undefined, label: label || undefined }), status === role.status ? 'Role saved' : status === 'active' ? 'Role turned on' : 'Role suspended');

  return (
    <div className={`space-y-3 rounded-xl border p-3 ${role.status === 'suspended' ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800">{role.description}</div>
          <div className="text-xs text-slate-500">{ROLE_INFO[role.role].description}</div>
        </div>
        <StatusBadge status={role.status} />
      </div>
      {role.role === 'carrier' ? (
        <div>
          <label className={labelCls}>Carrier name</label>
          <input className={inputCls} value={label} disabled={disabled} onChange={(e) => setLabel(e.target.value)} />
        </div>
      ) : role.role !== 'staff' ? (
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={title} disabled={disabled} onChange={(e) => setTitle(e.target.value)} />
        </div>
      ) : null}
      <PackPicker packs={available} selected={packIds} onChange={setPackIds} disabled={disabled} />
      <div className="flex flex-wrap gap-2">
        {dirty && (
          <button className={primaryCls} disabled={disabled} onClick={() => save(role.status)}>
            Save changes
          </button>
        )}
        {role.status === 'active' ? (
          <button className={secondaryCls} disabled={disabled} onClick={() => save('suspended')}>
            Suspend role
          </button>
        ) : (
          <button className={secondaryCls} disabled={disabled} onClick={() => save('active')}>
            Turn role on
          </button>
        )}
        <button
          className={dangerCls}
          disabled={disabled}
          onClick={() => {
            if (confirm(`Remove the ${role.description} role?`)) void run(() => remove({ roleId: role._id }), 'Role removed');
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
