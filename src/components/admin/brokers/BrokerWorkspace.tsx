'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  GitBranch,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Send,
  Star,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { Modal, RequiredMark, StatusBadge, useToast } from '@/components/admin/ui';
import { formatDate, formatDateTime, humanize } from '@/lib/admin-format';
import { buildUplineOptions } from '@/lib/partner-upline';
import {
  ACCESS_ROLES,
  ACCOUNT_STATE,
  TYPE_BADGE,
  TYPE_LABEL,
  accessRoleFields,
  accessRoleLabel,
  accessRoleOf,
  accountStateOf,
  buildChecklist,
  cardCls,
  dangerBtn,
  formatIsoDate,
  inputCls,
  labelCls,
  primaryBtn,
  secondaryBtn,
  type AccessRole,
  type PartnerStatus,
  type PartnerType,
} from './shared';

type Workspace = NonNullable<FunctionReturnType<typeof api.admin.distributionPartners.getWorkspace>>;
type Leader = Workspace['leaders'][number];
type Tab = 'overview' | 'team' | 'downline' | 'members' | 'codes' | 'activity';

const TABS: [Tab, string, typeof LayoutDashboard][] = [
  ['overview', 'Overview', LayoutDashboard],
  ['team', 'Team & access', UsersRound],
  ['downline', 'Downline', GitBranch],
  ['members', 'Members', Users],
  ['codes', 'Rep codes', KeyRound],
  ['activity', 'Activity', History],
];

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function BrokerWorkspace({ partnerId }: { partnerId: Id<'distributionPartners'> }) {
  const data = useQuery(api.admin.distributionPartners.getWorkspace, { partnerId });
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<'profile' | 'addMember' | null>(null);
  const requested = searchParams.get('tab') as Tab | null;
  const tab: Tab = TABS.some(([key]) => key === requested) ? (requested as Tab) : 'overview';
  const navigate = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.push(`${pathname}?${params}`, { scroll: false });
  };

  if (data === undefined) {
    return (
      <div role="status" className="flex min-h-80 items-center justify-center gap-3 text-slate-500">
        <Loader2 className="animate-spin" size={20} /> Loading broker workspace…
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="space-y-4 p-8">
        <Link href="/admin/brokers" className={secondaryBtn}><ArrowLeft size={16} /> Brokers</Link>
        <h1 className="text-xl font-semibold">Broker not found</h1>
        <p className="text-slate-500">This partner may have been deleted.</p>
      </div>
    );
  }

  const p = data.partner;
  const primary = data.leaders.find((l) => l.isPrimary);
  const counts: Partial<Record<Tab, number>> = {
    team: data.leaders.length,
    downline: data.downline.length,
    codes: data.codes.length,
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/brokers" className="inline-flex items-center gap-2 hover:text-teal-700">
          <ArrowLeft size={16} /> Brokers
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900">{p.name}</span>
      </div>

      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 bg-teal-700" />
        <div className="flex flex-wrap items-start gap-5 p-6">
          <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl font-semibold text-teal-800">
            {p.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.name}</h1>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[p.type]}`}>{TYPE_LABEL[p.type]}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {data.upline ? (
                <>Reports to <Link href={`/admin/brokers/${data.upline.id}`} className="text-teal-700 hover:underline">{data.upline.name}</Link></>
              ) : 'Independent — no upline'}
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <HeaderField label="Agency code" value={p.agencyCode ? <span className="font-mono">{p.agencyCode}</span> : 'Not assigned'} />
              <HeaderField label="Override" value={p.overrideRate != null ? `${p.overrideRate}%` : 'Not set'} />
              <HeaderField label="Effective" value={formatIsoDate(p.effectiveDate)} />
              <HeaderField label="Primary contact" value={primary?.name ?? p.contactName} />
              <HeaderField label="Active members" value={String(data.activeMemberCount)} />
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={secondaryBtn} onClick={() => setDialog('profile')}><Pencil size={15} /> Edit profile</button>
            <button className={primaryBtn} onClick={() => setDialog('addMember')}><UserPlus size={15} /> Add team member</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4" aria-label="Broker workspace sections">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${tab === key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Icon size={15} /> {label}
              {counts[key] !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{counts[key]}</span>}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'overview' && <OverviewTab data={data} onNavigate={navigate} />}
      {tab === 'team' && <TeamTab data={data} onAdd={() => setDialog('addMember')} />}
      {tab === 'downline' && <DownlineTab data={data} />}
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'codes' && <CodesTab data={data} />}
      {tab === 'activity' && <ActivityTab data={data} />}

      {dialog === 'profile' && <EditProfileModal data={data} onClose={() => setDialog(null)} />}
      {dialog === 'addMember' && <MemberModal data={data} onClose={() => setDialog(null)} />}
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value || <span className="text-slate-400">Not recorded</span>}</dd>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({ data, onNavigate }: { data: Workspace; onNavigate: (t: Tab) => void }) {
  const p = data.partner;
  const steps = buildChecklist({
    partner: { ...p, parentId: p.parentId ? String(p.parentId) : undefined },
    leaders: data.leaders.map((l) => ({ ...l, _id: String(l._id) })),
    codes: data.codes,
    applications: data.applications,
    activeMemberCount: data.activeMemberCount,
  });
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const stepTab: Record<string, Tab> = { primary: 'team', invite: 'team', connected: 'team', agencyCode: 'codes', repCodes: 'codes', firstSale: 'members' };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-slate-900">Organization</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Type" value={TYPE_LABEL[p.type]} />
            <Field label="NPN" value={p.npn} />
            <Field label="Upline" value={data.upline?.name ?? 'Independent'} />
            <Field label="Organization contact" value={p.contactName} />
            <Field label="Contact email" value={<a className="text-teal-700 hover:underline" href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a>} />
            <Field label="Contact phone" value={p.contactPhone} />
          </dl>
        </section>
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-slate-900">Agreement</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Status" value={<StatusBadge status={p.status} />} />
            <Field label="Effective date" value={p.effectiveDate && formatIsoDate(p.effectiveDate)} />
            <Field label="Termination date" value={p.terminationDate && formatIsoDate(p.terminationDate)} />
            <Field label="Override / fee" value={p.overrideRate != null ? `${p.overrideRate}%` : undefined} />
            <Field label="Created" value={formatDate(p.createdAt)} />
            <Field
              label="Application"
              value={data.applications.length ? (
                <Link href="/admin/partner-applications" className="text-teal-700 hover:underline">
                  {humanize(data.applications[0].status)}{data.applications[0].hasPartnerKit ? ' · Partner Kit signed' : ''}
                </Link>
              ) : 'Added manually'}
            />
          </dl>
        </section>
        <section className={cardCls}>
          <h2 className="text-base font-semibold text-slate-900">Profile notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{p.notes || <span className="text-slate-400">No notes.</span>}</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Team members" value={data.leaders.length} onClick={() => onNavigate('team')} />
          <Stat label="Downline partners" value={data.downline.length} onClick={() => onNavigate('downline')} />
          <Stat label="Active members" value={data.activeMemberCount} onClick={() => onNavigate('members')} />
          <Stat label="Rep codes" value={data.codes.filter((c) => c.status === 'active').length} onClick={() => onNavigate('codes')} />
        </div>
      </div>

      <section className={cardCls} aria-label="Onboarding checklist">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">Onboarding</h2>
          <span className="text-sm text-slate-500">{doneCount}/{required.length} required</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${(doneCount / required.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((s) => {
            const target = stepTab[s.key];
            return (
              <li key={s.key} className="flex gap-3">
                {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-600" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-300" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {s.label}
                    {s.optional && <span className="ml-1.5 text-xs font-normal text-slate-400">optional</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.detail}
                    {!s.done && target && (
                      <button className="ml-2 text-teal-700 hover:underline" onClick={() => onNavigate(target)}>Fix</button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-teal-300">
      <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </button>
  );
}

// ── Team & access ───────────────────────────────────────────────────────────

/** What a role can read, spelled out with the organizations it resolves to. */
function reachFor(role: AccessRole, data: Workspace): { summary: string; partners: string[] } {
  const self = data.partner.name;
  if (role === 'none') return { summary: 'Cannot sign in to the partner portal', partners: [] };
  if (role === 'own') return { summary: 'Only members and enrollments they wrote', partners: [] };
  if (role === 'agency') return { summary: `All of ${self}`, partners: [self] };
  return {
    summary: data.downline.length ? `${self} + ${data.downline.length} downline partner${data.downline.length === 1 ? '' : 's'}` : `${self} (no downline yet)`,
    partners: [self, ...data.downline.map((d) => d.name)],
  };
}

function TeamTab({ data, onAdd }: { data: Workspace; onAdd: () => void }) {
  const toast = useToast();
  const now = useNow();
  const updateLeader = useMutation(api.admin.distributionPartners.updateLeader);
  const removeLeader = useMutation(api.admin.distributionPartners.removeLeader);
  const setPrimary = useMutation(api.admin.distributionPartners.setPrimaryLeader);
  const sendInvite = useAction(api.admin.distributionPartners.sendLeaderInvite);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Leader | null>(null);
  const [previewRole, setPreviewRole] = useState<AccessRole>('downline');
  const reach = reachFor(previewRole, data);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.fromError(err, fail);
    } finally {
      setBusy(null);
    }
  };

  const changeRole = (leader: Leader, role: AccessRole) =>
    run(`role-${leader._id}`, () => updateLeader({ leaderId: leader._id, ...accessRoleFields(role) }), `${leader.name} is now: ${accessRoleLabel(role)}`, 'Could not change access');

  const invite = async (leader: Leader) => {
    setBusy(`invite-${leader._id}`);
    try {
      const result = await sendInvite({ leaderId: leader._id });
      if (result.success) toast.success('Invite sent', `${leader.name} will receive it at ${leader.email}.`);
      else toast.error('Invite email failed', result.error ?? 'Unknown error');
    } catch (err) {
      toast.fromError(err, 'Could not send invite');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Team</h2>
            <p className="text-sm text-slate-500">Everyone who represents {data.partner.name}. Each person gets their own invite, rep code and access role.</p>
          </div>
          <button className={primaryBtn} onClick={onAdd}><UserPlus size={15} /> Add team member</button>
        </div>
        {data.leaders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No team members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Access role</th>
                  <th className="px-4 py-3 font-medium">Report data access</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leaders.map((leader) => {
                  const role = accessRoleOf(leader);
                  const state = accountStateOf(leader, now);
                  const canInvite = state !== 'connected' && state !== 'disabled' && data.partner.status === 'active';
                  return (
                    <tr key={leader._id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          {leader.name}
                          {leader.isPrimary && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Primary</span>}
                        </div>
                        {leader.title && <div className="text-xs text-slate-500">{leader.title}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <a href={`mailto:${leader.email}`} className="flex items-center gap-1 hover:text-teal-700"><Mail size={12} />{leader.email}</a>
                        {leader.phone && <a href={`tel:${leader.phone}`} className="mt-0.5 flex items-center gap-1 hover:text-teal-700"><Phone size={12} />{leader.phone}</a>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={state} tone={ACCOUNT_STATE[state].tone} label={ACCOUNT_STATE[state].label} />
                        {state === 'pending' && leader.inviteExpiry && (
                          <div className="mt-1 text-xs text-slate-500">Expires {formatDate(leader.inviteExpiry)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Access role for ${leader.name}`}
                          className={`${inputCls} min-w-44`}
                          value={role}
                          disabled={busy === `role-${leader._id}`}
                          onChange={(e) => changeRole(leader, e.target.value as AccessRole)}
                        >
                          {ACCESS_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{reachFor(role, data).summary}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canInvite && (
                            <IconButton label={state === 'not_invited' ? 'Send invite' : 'Resend invite'} onClick={() => invite(leader)} busy={busy === `invite-${leader._id}`}>
                              <Send size={14} />
                            </IconButton>
                          )}
                          {!leader.isPrimary && (
                            <IconButton label="Make primary contact" busy={busy === `primary-${leader._id}`} onClick={() => run(`primary-${leader._id}`, () => setPrimary({ leaderId: leader._id }), `${leader.name} is now the primary contact`, 'Could not change primary contact')}>
                              <Star size={14} />
                            </IconButton>
                          )}
                          <IconButton label="Edit details" onClick={() => setEditing(leader)}><Pencil size={14} /></IconButton>
                          <IconButton
                            label="Remove from team"
                            danger
                            busy={busy === `remove-${leader._id}`}
                            onClick={() => {
                              const warning = leader.clerkUserId ? ' They will lose portal access immediately.' : '';
                              if (!confirm(`Remove ${leader.name} from ${data.partner.name}?${warning} Their rep codes stay on file.`)) return;
                              void run(`remove-${leader._id}`, () => removeLeader({ leaderId: leader._id }), `${leader.name} removed`, 'Could not remove team member');
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardCls} aria-label="Report data access">
        <h2 className="text-base font-semibold text-slate-900">Report data access</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          What each access role can read in the partner portal for this organization. Visibility follows the upline tree, so new downline partners are included automatically.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-1" role="radiogroup" aria-label="Access role to preview">
            {ACCESS_ROLES.map((r) => (
              <button
                key={r.value}
                role="radio"
                aria-checked={previewRole === r.value}
                onClick={() => setPreviewRole(r.value)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${previewRole === r.value ? 'bg-teal-50 font-medium text-teal-900' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {r.label}
                <span className="block text-xs font-normal text-slate-500">
                  {data.leaders.filter((l) => accessRoleOf(l) === r.value).length} on this team
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-800">{reach.summary}</div>
            <p className="mt-1 text-xs text-slate-500">{ACCESS_ROLES.find((r) => r.value === previewRole)?.description}</p>
            {reach.partners.length > 0 && (
              <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
                {reach.partners.map((name, i) => (
                  <li key={`${name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700">
                    <CheckCircle2 size={14} className="text-teal-600" /> {name}
                    {i === 0 && <span className="text-xs text-slate-400">this organization</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {editing && <MemberModal data={data} leader={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function IconButton({ label, onClick, children, busy, danger }: { label: string; onClick: () => void; children: ReactNode; busy?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`rounded-lg border border-slate-200 p-2 disabled:opacity-50 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}

// ── Downline ────────────────────────────────────────────────────────────────

function DownlineTab({ data }: { data: Workspace }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Downline</h2>
          <p className="text-sm text-slate-500">Partners beneath {data.partner.name} in the upline tree, at any depth.</p>
        </div>
        <Link href={`/admin/brokers/new?parent=${data.partner._id}`} className={primaryBtn}><Plus size={15} /> Onboard downline partner</Link>
      </div>
      {data.downline.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No downline partners.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.downline.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/brokers/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[d.type]}`}>{TYPE_LABEL[d.type]}</span>
                <span className="font-medium text-slate-900">{d.name}</span>
                {!d.direct && <span className="text-xs text-slate-400">indirect</span>}
                <span className="ml-auto font-mono text-xs text-slate-500">{d.agencyCode ?? ''}</span>
                <StatusBadge status={d.status} />
                <ChevronRight size={16} className="text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

function MembersTab({ data }: { data: Workspace }) {
  const repNames = new Map(data.leaders.map((l) => [String(l._id), l.name]));
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900">Members</h2>
        <p className="text-sm text-slate-500">
          Members attributed to {data.partner.name} ({data.activeMemberCount} active).{' '}
          {data.hasMoreMembers && 'Showing the 50 most recent.'}
        </p>
      </div>
      {data.members.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No members are attributed to this organization yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Member ID</th>
                <th className="px-4 py-3 font-medium">Written by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/admin/members/${m.id}`} className="font-medium text-slate-900 hover:text-teal-700">{m.name}</Link></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{m.memberId}</td>
                  <td className="px-4 py-3 text-slate-600">{m.repId ? repNames.get(m.repId) ?? 'Former team member' : <span className="text-slate-400">Organization</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.memberType} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Codes ───────────────────────────────────────────────────────────────────

function CodesTab({ data }: { data: Workspace }) {
  const toast = useToast();
  const provision = useAction(api.admin.repCodes.provisionCodesForPartner);
  const [busy, setBusy] = useState(false);
  const owners = new Map(data.leaders.map((l) => [String(l._id), l.name]));
  const coded = new Set(data.codes.filter((c) => c.status === 'active').map((c) => c.brokerId));
  const missing = data.leaders.filter((l) => !coded.has(String(l._id)));

  const provisionAll = async () => {
    setBusy(true);
    try {
      const result = await provision({ partnerId: data.partner._id });
      toast.success('Codes provisioned', `Agency code ${result.agencyCode}; ${result.codesCreated} new rep code${result.codesCreated === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.fromError(err, 'Could not provision codes');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (code: { code: string; slug?: string }) => {
    const url = code.slug ? `${window.location.origin}/${code.slug}` : `${window.location.origin}/health/plans?ref=${encodeURIComponent(code.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Referral link copied', url);
    } catch {
      toast.info('Referral link', url);
    }
  };

  return (
    <div className="space-y-5">
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Agency code {data.partner.agencyCode && <span className="font-mono text-teal-800">{data.partner.agencyCode}</span>}</h2>
            <p className="text-sm text-slate-500">
              {data.partner.agencyCode
                ? `Rep codes are numbered ${data.partner.agencyCode}01, ${data.partner.agencyCode}02, … in the order they are issued.`
                : 'Assign a 4-digit agency code so every rep code for this organization is numbered under it.'}
            </p>
          </div>
          {(!data.partner.agencyCode || missing.length > 0) && (
            <button className={primaryBtn} onClick={provisionAll} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {data.partner.agencyCode ? `Issue ${missing.length} missing rep code${missing.length === 1 ? '' : 's'}` : 'Assign agency code & issue rep codes'}
            </button>
          )}
        </div>
        {missing.length > 0 && (
          <p className="mt-3 text-sm text-amber-800">Without a code: {missing.map((l) => l.name).join(', ')}</p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900">Rep codes</h2>
          <Link href="/admin/rep-codes" className="text-sm text-teal-700 hover:underline">Manage in Rep Codes</Link>
        </div>
        {data.codes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No rep codes issued.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Vanity link</th>
                  <th className="px-4 py-3 text-right font-medium">Link visits</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.codes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-slate-900">{c.code}</td>
                    <td className="px-4 py-3 text-slate-700">{owners.get(c.brokerId) ?? <span className="text-slate-400">Unknown</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{c.slug ? `/${c.slug}` : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.usageCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} tone={c.status === 'revoked' ? 'danger' : undefined} /></td>
                    <td className="px-4 py-3 text-right">
                      <IconButton label="Copy referral link" onClick={() => copyLink(c)}><Copy size={14} /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: Workspace }) {
  return (
    <section className={cardCls}>
      <h2 className="text-base font-semibold text-slate-900">Activity</h2>
      <p className="text-sm text-slate-500">Admin changes to this broker, newest first. Changes made before this log existed are not shown.</p>
      {data.activity.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">No recorded activity yet.</p>
      ) : (
        <ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">
          {data.activity.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-teal-600" />
              <div className="text-sm text-slate-800">{a.summary}</div>
              <div className="text-xs text-slate-500">{a.actorName ?? 'Admin'} · {formatDateTime(a.createdAt)} · {humanize(a.action.replace('partner.', ''))}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────

function EditProfileModal({ data, onClose }: { data: Workspace; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const partners = useQuery(api.admin.distributionPartners.getAll);
  const update = useMutation(api.admin.distributionPartners.update);
  const remove = useMutation(api.admin.distributionPartners.remove);
  const p = data.partner;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: p.name,
    type: p.type as PartnerType,
    parentId: p.parentId ? String(p.parentId) : '',
    npn: p.npn ?? '',
    status: p.status as PartnerStatus,
    effectiveDate: p.effectiveDate ?? '',
    terminationDate: p.terminationDate ?? '',
    overrideRate: p.overrideRate != null ? String(p.overrideRate) : '',
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactPhone: p.contactPhone ?? '',
    notes: p.notes ?? '',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const rate = form.overrideRate.trim() === '' ? null : Number(form.overrideRate);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      toast.warning('Check the override rate', 'Enter a percentage between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      await update({
        id: p._id,
        name: form.name,
        type: form.type,
        parentId: form.parentId ? (form.parentId as Id<'distributionPartners'>) : null,
        npn: form.npn,
        status: form.status,
        effectiveDate: form.effectiveDate,
        terminationDate: form.terminationDate,
        overrideRate: rate,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        notes: form.notes,
      });
      toast.success('Profile saved', form.name);
      onClose();
    } catch (err) {
      toast.fromError(err, 'Could not save profile');
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!confirm(`Permanently delete ${p.name} and all ${data.leaders.length} team member records? This cannot be undone. To stop access but keep history, set the status to Inactive instead.`)) return;
    try {
      await remove({ id: p._id });
      toast.success('Broker deleted', p.name);
      router.push('/admin/brokers');
    } catch (err) {
      toast.fromError(err, 'Could not delete broker');
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit broker profile" size="max-w-3xl" preventClose={saving}>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="ep-name">Organization name<RequiredMark /></label>
            <input id="ep-name" className={inputCls} required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-type">Type</label>
            <select id="ep-type" className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value as PartnerType)}>
              {(Object.keys(TYPE_LABEL) as PartnerType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-upline">Upline partner</label>
            <select id="ep-upline" className={inputCls} value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">Independent (no upline)</option>
              {buildUplineOptions(partners ?? [], p._id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-npn">NPN</label>
            <input id="ep-npn" className={inputCls} value={form.npn} onChange={(e) => set('npn', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-status">Status</label>
            <select id="ep-status" className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as PartnerStatus)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            {form.status !== 'active' && <p className="mt-1 text-xs text-amber-700">Everyone on this team loses portal access while not active.</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-effective">Effective date</label>
            <input id="ep-effective" type="date" className={inputCls} value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-termination">Termination date</label>
            <input id="ep-termination" type="date" className={inputCls} value={form.terminationDate} onChange={(e) => set('terminationDate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ep-rate">Override / management fee (%)</label>
            <input id="ep-rate" type="number" min={0} max={100} step={0.1} className={inputCls} value={form.overrideRate} onChange={(e) => set('overrideRate', e.target.value)} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Organization contact</h3>
          <p className="text-xs text-slate-500">Used for notices. Making a team member primary replaces these.</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <input aria-label="Contact name" className={inputCls} required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Name" />
            <input aria-label="Contact email" type="email" className={inputCls} required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="Email" />
            <input aria-label="Contact phone" type="tel" className={inputCls} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="Phone" />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="ep-notes">Profile notes</label>
          <textarea id="ep-notes" rows={4} maxLength={4000} className={inputCls} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button type="button" className={dangerBtn} onClick={destroy} disabled={data.downline.some((d) => d.direct)} title={data.downline.some((d) => d.direct) ? 'Reassign its downline first' : undefined}>
            <Trash2 size={15} /> Delete broker
          </button>
          <div className="flex gap-2">
            <button type="button" className={secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save profile</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Add a team member (sends an invite) or edit an existing one's details. */
function MemberModal({ data, leader, onClose }: { data: Workspace; leader?: Leader; onClose: () => void }) {
  const toast = useToast();
  const addLeader = useAction(api.admin.distributionPartners.addLeader);
  const updateLeader = useMutation(api.admin.distributionPartners.updateLeader);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: leader?.name ?? '',
    email: leader?.email ?? '',
    phone: leader?.phone ?? '',
    title: leader?.title ?? '',
    role: (leader ? accessRoleOf(leader) : 'own') as AccessRole,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const inactive = data.partner.status !== 'active';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (leader) {
        await updateLeader({
          leaderId: leader._id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          title: form.title,
          ...accessRoleFields(form.role),
        });
        toast.success('Team member updated', form.name);
      } else {
        const result = await addLeader({
          partnerId: data.partner._id,
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          title: form.title || undefined,
          ...accessRoleFields(form.role),
        });
        if (result.inviteSent) toast.success('Team member added', `${form.name} was emailed a portal invite.`);
        else toast.warning('Added, but the invite email failed', `${result.inviteError ?? 'Unknown error'}. Resend it from the Team tab.`);
      }
      onClose();
    } catch (err) {
      toast.fromError(err, leader ? 'Could not update team member' : 'Could not add team member');
      setSaving(false);
    }
  };

  const blocked = !leader && (inactive || form.role === 'none');

  return (
    <Modal
      open
      onClose={onClose}
      title={leader ? `Edit ${leader.name}` : `Add a team member to ${data.partner.name}`}
      description={leader ? undefined : 'They receive a 30-day invite to the partner portal. Issue their rep code from the Rep codes tab.'}
      size="max-w-xl"
      preventClose={saving}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="tm-name">Full name<RequiredMark /></label>
            <input id="tm-name" className={inputCls} required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="tm-title">Title</label>
            <input id="tm-title" className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Account Executive" />
          </div>
          <div>
            <label className={labelCls} htmlFor="tm-email">Email<RequiredMark /></label>
            <input id="tm-email" type="email" className={inputCls} required value={form.email} disabled={!!leader?.clerkUserId} onChange={(e) => set('email', e.target.value)} />
            {leader?.clerkUserId && <p className="mt-1 text-xs text-slate-500">Locked: this person has connected their account.</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="tm-phone">Phone</label>
            <input id="tm-phone" type="tel" className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>
        <fieldset>
          <legend className={labelCls}>Access role</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACCESS_ROLES.filter((r) => leader || r.value !== 'none').map((r) => (
              <label key={r.value} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 ${form.role === r.value ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="tm-role" className="mt-0.5 accent-teal-700" checked={form.role === r.value} onChange={() => set('role', r.value)} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{r.label}</span>
                  <span className="block text-xs text-slate-500">{r.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!leader && inactive && <p className="text-sm text-amber-700">Activate {data.partner.name} before inviting team members.</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className={secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className={primaryBtn} disabled={saving || blocked}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : leader ? null : <Send size={15} />}
            {leader ? 'Save changes' : 'Add & send invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
