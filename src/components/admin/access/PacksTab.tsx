'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { Archive, Check, Copy, Lock, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import {
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_INFO,
  ROLE_TYPES,
  roleCanHold,
  type Permission,
  type PermissionInfo,
  type RoleType,
} from '@/convex/lib/access/catalog';
import { Modal, SkeletonTable, useToast } from '@/components/admin/ui';
import { errorText, inputCls, labelCls, primaryCls, secondaryCls, type PackRow } from './shared';

export function PacksTab({ packs }: { packs: PackRow[] | undefined }) {
  const [view, setView] = useState<'cards' | 'compare'>('cards');
  const [editing, setEditing] = useState<PackRow | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const toast = useToast();
  const duplicate = useMutation(api.access.packs.duplicatePack);
  const reset = useMutation(api.access.packs.resetPack);
  const archive = useMutation(api.access.packs.setPackArchived);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (packs === undefined) return <SkeletonTable rows={6} />;
  const visible = packs.filter((p) => showArchived || !p.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(['cards', 'compare'] as const).map((v) => (
            <button key={v} className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setView(v)}>
              {v === 'cards' ? 'Packs' : 'Compare'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <div className="flex-1" />
        <button className={primaryCls} onClick={() => setEditing('new')}>
          <Plus size={16} /> New pack
        </button>
      </div>

      {view === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((pack) => (
            <div key={pack._id} className={`flex flex-col rounded-xl border bg-white p-4 ${pack.archived ? 'border-dashed border-slate-300 opacity-70' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  {pack.name}
                  {pack.locked && <Lock size={12} className="ml-1 inline text-slate-400" />}
                </div>
                <div className="flex shrink-0 gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pack.builtIn ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                    {pack.builtIn ? 'BUILT-IN' : 'CUSTOM'}
                  </span>
                  {pack.modified && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">EDITED</span>}
                  {pack.archived && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">ARCHIVED</span>}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{pack.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {pack.roles.map((r) => (
                  <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {ROLE_INFO[r].label}
                  </span>
                ))}
              </div>
              <ul className="mt-3 flex-1 space-y-0.5 text-sm text-slate-700">
                {pack.locked ? (
                  <li>Whole admin console</li>
                ) : pack.permissions.length ? (
                  pack.permissions.map((p) => (
                    <li key={p} className="flex items-center gap-1.5">
                      <Check size={13} className="text-emerald-600" />
                      {(PERMISSIONS as Record<string, PermissionInfo>)[p]?.label ?? p}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400">No permissions</li>
                )}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {pack.activeRoles} active {pack.activeRoles === 1 ? 'role' : 'roles'}
                </span>
                <div className="flex gap-1">
                  <IconButton label="Edit" onClick={() => setEditing(pack)}>
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    label="Duplicate"
                    onClick={() => {
                      const name = prompt('Name for the copy', `${pack.name} (copy)`);
                      if (name) void act(() => duplicate({ packId: pack._id, name }), 'Pack copied');
                    }}
                  >
                    <Copy size={14} />
                  </IconButton>
                  {pack.builtIn && pack.modified && !pack.locked && (
                    <IconButton label="Reset to default" onClick={() => confirm(`Reset "${pack.name}" to its default permissions?`) && act(() => reset({ packId: pack._id }), 'Pack reset')}>
                      <RotateCcw size={14} />
                    </IconButton>
                  )}
                  {!pack.builtIn && (
                    <IconButton
                      label={pack.archived ? 'Restore' : 'Archive'}
                      onClick={() => act(() => archive({ packId: pack._id, archived: !pack.archived }), pack.archived ? 'Pack restored' : 'Pack archived')}
                    >
                      <Archive size={14} />
                    </IconButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CompareMatrix packs={visible} />
      )}

      {editing && <PackEditor pack={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
      {children}
    </button>
  );
}

/** Every pack against every permission, for comparing and demoing. */
function CompareMatrix({ packs }: { packs: PackRow[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="sticky left-0 z-10 min-w-[14rem] bg-slate-50 px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-500">Permission</th>
            {packs.map((pack) => (
              <th key={pack._id} className="min-w-[7rem] px-2 py-2 text-left align-bottom text-xs font-semibold text-slate-700">
                {pack.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {PERMISSION_KEYS.map((p) => {
            const info: PermissionInfo = PERMISSIONS[p];
            return (
              <tr key={p}>
                <td className="sticky left-0 bg-white px-3 py-1.5">
                  <span className="text-slate-800">{info.label}</span>
                  <span className="block text-[11px] text-slate-400">{info.group}</span>
                </td>
                {packs.map((pack) => {
                  const has = pack.locked ? info.portal === 'admin' : pack.permissions.includes(p);
                  return (
                    <td key={pack._id} className="px-2 py-1.5 text-center">
                      {has ? <Check size={15} className={`inline ${info.sensitive ? 'text-amber-600' : 'text-emerald-600'}`} /> : <span className="text-slate-200">·</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PackEditor({ pack, onClose }: { pack: PackRow | null; onClose: () => void }) {
  const create = useMutation(api.access.packs.createPack);
  const update = useMutation(api.access.packs.updatePack);
  const toast = useToast();
  const [name, setName] = useState(pack?.name ?? '');
  const [description, setDescription] = useState(pack?.description ?? '');
  const [roles, setRoles] = useState<RoleType[]>(pack?.roles ?? ['staff']);
  const [permissions, setPermissions] = useState<string[]>(pack?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!pack?.locked;

  const groups = new Map<string, Permission[]>();
  for (const p of PERMISSION_KEYS) {
    const key = `${PERMISSIONS[p].portal === 'admin' ? 'Admin console' : PERMISSIONS[p].portal === 'partner' ? 'Partner portal' : 'Employer portal'} · ${PERMISSIONS[p].group}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const holdable = permissions.filter((p) => roles.some((r) => roleCanHold(r, p as Permission)));
      if (pack) await update({ packId: pack._id as Id<'accessPacks'>, name, description, roles, permissions: holdable });
      else await create({ name, description, roles, permissions: holdable });
      toast.success(pack ? 'Pack saved' : 'Pack created');
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={pack ? `Edit ${pack.name}` : 'New access pack'} description="Changes apply immediately to everyone who has this pack." size="max-w-3xl" preventClose={saving}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <fieldset>
          <legend className={labelCls}>Meant for these roles</legend>
          <div className="flex flex-wrap gap-2">
            {ROLE_TYPES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={roles.includes(r)}
                  onChange={() => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])}
                />
                {ROLE_INFO[r].label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Admin-console permissions only work on staff roles; partner-portal ones on partner roles; uploads on organizations.</p>
        </fieldset>
        {locked ? (
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">The Owner pack always grants the whole admin console. You can rename it, but not narrow it.</p>
        ) : (
          <div className="grid max-h-[24rem] gap-3 overflow-auto md:grid-cols-2">
            {[...groups.entries()].map(([group, list]) => (
              <fieldset key={group} className="rounded-lg border border-slate-200 p-2">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</legend>
                {list.map((p) => {
                  const info: PermissionInfo = PERMISSIONS[p];
                  const holdable = roles.some((r) => roleCanHold(r, p));
                  return (
                    <label key={p} className={`flex items-start gap-2 rounded px-1 py-1 text-sm ${holdable ? '' : 'opacity-40'}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={!holdable}
                        checked={permissions.includes(p)}
                        onChange={() => setPermissions(permissions.includes(p) ? permissions.filter((x) => x !== p) : [...permissions, p])}
                      />
                      <span>
                        <span className="text-slate-800">{info.label}</span>
                        {info.sensitive && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">sensitive</span>}
                        <span className="block text-xs text-slate-500">{info.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className={secondaryCls} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={primaryCls} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save pack'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
