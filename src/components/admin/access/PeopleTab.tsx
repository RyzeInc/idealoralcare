'use client';

import { useMemo, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { Copy, Mail, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ROLE_INFO, ROLE_TYPES, type RoleType } from '@/convex/lib/access/catalog';
import { Modal, SkeletonTable, StatusBadge, useToast } from '@/components/admin/ui';
import {
  RoleFields,
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
import { PersonDrawer } from './PersonDrawer';

export function PeopleTab({ packs, targets }: { packs: PackRow[] | undefined; targets: Targets | undefined }) {
  const people = useQuery(api.access.people.listPeople);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleType | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inviting, setInviting] = useState(false);
  const [openId, setOpenId] = useState<Id<'accessProfiles'> | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (people ?? []).filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term) || p.email.includes(term) || p.roles.some((r) => r.description.toLowerCase().includes(term))) &&
        (!roleFilter || p.roles.some((r) => r.role === roleFilter)) &&
        (!statusFilter || p.status === statusFilter),
    );
  }, [people, search, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-9`} placeholder="Search name, email, partner or organization" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputCls} w-auto`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleType | '')}>
          <option value="">All roles</option>
          {ROLE_TYPES.map((r) => (
            <option key={r} value={r}>
              {ROLE_INFO[r].label}
            </option>
          ))}
        </select>
        <select className={`${inputCls} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className={primaryCls} onClick={() => setInviting(true)}>
          <UserPlus size={16} /> Invite person
        </button>
      </div>

      {people === undefined ? (
        <SkeletonTable rows={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {people.length === 0
            ? 'Nobody has an access profile yet. Import existing accounts, or invite someone.'
            : 'No one matches these filters.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Person</th>
                <th className="px-4 py-2">Roles and packs</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(p._id)}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">
                      {p.name}
                      {p.isOwner && <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">OWNER</span>}
                    </div>
                    <div className="text-xs text-slate-500">{p.email}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {p.roles.length === 0 ? (
                      <span className="text-xs text-slate-400">No roles</span>
                    ) : (
                      <ul className="space-y-1">
                        {p.roles.map((r) => (
                          <li key={r._id} className={r.status === 'suspended' ? 'text-slate-400 line-through' : ''}>
                            <span className="font-medium text-slate-700">{r.description}</span>
                            <span className="text-xs text-slate-500"> · {r.packs.map((pk) => pk.name).join(', ') || 'no packs'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={p.status} />
                    {p.invite === 'expired' && <div className="mt-1 text-xs text-red-600">Link expired</div>}
                    {p.invite === 'not_sent' && <div className="mt-1 text-xs text-slate-500">Not signed in yet</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteDialog open={inviting} onClose={() => setInviting(false)} packs={packs} targets={targets} onOpenPerson={setOpenId} />
      {openId && <PersonDrawer profileId={openId} onClose={() => setOpenId(null)} packs={packs} targets={targets} />}
    </div>
  );
}

type InviteResult = {
  profileId: Id<'accessProfiles'>;
  invited: boolean;
  emailSent: boolean;
  emailError?: string;
  claimUrl?: string;
  warnings: string[];
};

function InviteDialog({
  open,
  onClose,
  packs,
  targets,
  onOpenPerson,
}: {
  open: boolean;
  onClose: () => void;
  packs: PackRow[] | undefined;
  targets: Targets | undefined;
  onOpenPerson: (id: Id<'accessProfiles'>) => void;
}) {
  const invite = useAction(api.access.invites.invitePerson);
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [roles, setRoles] = useState<RoleDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setSendEmail(true);
    setRoles([]);
    setError(null);
    setResult(null);
  };
  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!roles.length) return setError('Add at least one role.');
    setSaving(true);
    try {
      const res = await invite({
        email,
        name,
        phone: phone || undefined,
        sendEmail,
        roles: roles.map((r) => ({ ...r, label: r.label || undefined, title: r.title || undefined })),
      });
      setResult(res);
      toast.success(res.invited ? 'Invitation created' : 'Roles added');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Invite a person" description="Give them one or more roles. They accept by signing in with this email." size="max-w-2xl" preventClose={saving}>
      {result ? (
        <div className="space-y-4">
          {!result.invited ? (
            <p className="text-sm text-slate-700">This person already has an account, so the new roles are active now.</p>
          ) : result.emailSent ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <Mail size={16} /> Invitation emailed to {email}. The link expires in 14 days.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                {result.emailError ? `The email didn't send (${result.emailError}). ` : ''}Send them this single-use link. It only works for {email}.
              </p>
              <div className="flex gap-2">
                <input readOnly className={inputCls} value={result.claimUrl ?? ''} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className={secondaryCls}
                  onClick={() => {
                    void navigator.clipboard.writeText(result.claimUrl ?? '');
                    toast.success('Link copied');
                  }}
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>
          )}
          {result.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              {w}
            </p>
          ))}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={secondaryCls}
              onClick={() => {
                const id = result.profileId;
                close();
                onOpenPerson(id);
              }}
            >
              Open person
            </button>
            <button type="button" className={primaryCls} onClick={reset}>
              Invite another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Phone (optional)</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {roles.map((draft, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role {i + 1}</span>
                  <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setRoles(roles.filter((_, j) => j !== i))} aria-label="Remove role">
                    <Trash2 size={16} />
                  </button>
                </div>
                <RoleFields draft={draft} onChange={(next) => setRoles(roles.map((r, j) => (j === i ? next : r)))} packs={packs} targets={targets} />
              </div>
            ))}
            <button type="button" className={secondaryCls} onClick={() => setRoles([...roles, newRoleDraft(roles.length ? 'rep' : 'staff', packs)])}>
              <Plus size={16} /> Add a role
            </button>
            <p className="text-xs text-slate-500">
              One person can hold several roles — for example a broker who is also a rep and heads a Program Manager.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Email the invitation (otherwise you get a link to send yourself)
          </label>

          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryCls} onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={primaryCls} disabled={saving}>
              {saving ? 'Saving…' : sendEmail ? 'Send invitation' : 'Create invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
