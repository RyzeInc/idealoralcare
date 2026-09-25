/**
 * Shared vocabulary for the admin broker screens (directory, onboarding,
 * workspace). The access roles are presets over two stored fields on
 * `partnerLeaders` — `portalAccess` and `reportScope` — which
 * `convex/insights/scope.ts` enforces.
 */

export type PartnerType = 'program_manager' | 'fmo' | 'agency';
export type PartnerStatus = 'active' | 'inactive' | 'suspended';
export type ReportScope = 'own' | 'agency' | 'downline';
export type AccessRole = ReportScope | 'none';

export const TYPE_LABEL: Record<PartnerType, string> = {
  program_manager: 'Program Manager',
  fmo: 'FMO',
  agency: 'Agency',
};

export const TYPE_BADGE: Record<PartnerType, string> = {
  program_manager: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  fmo: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  agency: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const ACCESS_ROLES: { value: AccessRole; label: string; description: string }[] = [
  {
    value: 'own',
    label: 'Producer',
    description: 'Portal access to the members and enrollments they wrote themselves.',
  },
  {
    value: 'agency',
    label: 'Agency manager',
    description: "Portal access to every producer's book in this organization.",
  },
  {
    value: 'downline',
    label: 'Upline leader',
    description: 'Portal access to this organization and every partner beneath it.',
  },
  {
    value: 'none',
    label: 'No portal access',
    description: 'Kept on file as a contact. Cannot sign in to the partner portal.',
  },
];

export function accessRoleOf(leader: { portalAccess?: boolean; reportScope?: ReportScope }): AccessRole {
  if (leader.portalAccess === false) return 'none';
  return leader.reportScope ?? 'own';
}

export function accessRoleFields(role: AccessRole): { portalAccess: boolean; reportScope?: ReportScope } {
  return role === 'none' ? { portalAccess: false } : { portalAccess: true, reportScope: role };
}

export function accessRoleLabel(role: AccessRole): string {
  return ACCESS_ROLES.find((r) => r.value === role)?.label ?? role;
}

export type AccountState = 'connected' | 'pending' | 'expired' | 'not_invited' | 'disabled';

export function accountStateOf(
  leader: { clerkUserId?: string; inviteStatus?: 'pending' | 'claimed'; inviteExpiry?: number; portalAccess?: boolean },
  now: number,
): AccountState {
  if (leader.portalAccess === false) return 'disabled';
  if (leader.clerkUserId || leader.inviteStatus === 'claimed') return 'connected';
  if (leader.inviteStatus === 'pending') {
    return leader.inviteExpiry && leader.inviteExpiry < now ? 'expired' : 'pending';
  }
  return 'not_invited';
}

export const ACCOUNT_STATE: Record<AccountState, { label: string; tone: 'success' | 'pending' | 'warning' | 'neutral' | 'danger' }> = {
  connected: { label: 'Connected', tone: 'success' },
  pending: { label: 'Invite pending', tone: 'pending' },
  expired: { label: 'Invite expired', tone: 'warning' },
  not_invited: { label: 'Not invited', tone: 'neutral' },
  disabled: { label: 'Access off', tone: 'danger' },
};

/** YYYY-MM-DD for today in the viewer's timezone — the value an <input type="date"> expects. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Render a stored YYYY-MM-DD without the UTC shift `new Date(str)` would apply. */
export function formatIsoDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface ChecklistInput {
  partner: { status: PartnerStatus; overrideRate?: number; agencyCode?: string; parentId?: string; type: PartnerType };
  leaders: { isPrimary: boolean; clerkUserId?: string; inviteStatus?: 'pending' | 'claimed'; portalAccess?: boolean; _id: string }[];
  codes: { brokerId: string; status: string }[];
  applications: { hasPartnerKit: boolean }[];
  activeMemberCount: number;
}

export interface ChecklistStep {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  /** Optional steps never block "ready to sell". */
  optional?: boolean;
}

/**
 * Onboarding progress, derived from live data rather than stored flags so
 * it can't drift from what the system actually has on file.
 */
export function buildChecklist(input: ChecklistInput): ChecklistStep[] {
  const { partner, leaders, codes, applications, activeMemberCount } = input;
  const primary = leaders.find((l) => l.isPrimary);
  const portalUsers = leaders.filter((l) => l.portalAccess !== false);
  const connected = portalUsers.filter((l) => l.clerkUserId || l.inviteStatus === 'claimed');
  const invited = portalUsers.filter((l) => l.inviteStatus || l.clerkUserId);
  const codeOwners = new Set(codes.filter((c) => c.status === 'active').map((c) => c.brokerId));
  const uncoded = leaders.filter((l) => !codeOwners.has(l._id));
  return [
    {
      key: 'profile',
      label: 'Organization profile',
      detail: partner.status === 'active' ? 'Active' : `Status is ${partner.status}`,
      done: partner.status === 'active',
    },
    {
      key: 'primary',
      label: 'Primary contact',
      detail: primary ? 'On file' : 'Add a team member and make them primary',
      done: !!primary,
    },
    {
      key: 'agreement',
      label: 'Agreement on file',
      detail: applications.some((a) => a.hasPartnerKit)
        ? 'Signed Partner Kit linked'
        : applications.length
          ? 'Application linked, no signed Partner Kit'
          : 'Added manually, no application linked',
      done: applications.some((a) => a.hasPartnerKit),
      optional: true,
    },
    {
      key: 'compensation',
      label: 'Override rate',
      detail: partner.overrideRate != null ? `${partner.overrideRate}%` : 'Not set',
      done: partner.overrideRate != null,
      optional: partner.type === 'agency' && !partner.parentId,
    },
    {
      key: 'invite',
      label: 'Portal invite sent',
      detail: invited.length ? `${invited.length} of ${portalUsers.length} invited` : 'No invites sent',
      done: portalUsers.length > 0 && invited.length > 0,
    },
    {
      key: 'connected',
      label: 'Portal account connected',
      detail: connected.length ? `${connected.length} connected` : 'Waiting for someone to accept an invite',
      done: connected.length > 0,
    },
    {
      key: 'agencyCode',
      label: 'Agency code assigned',
      detail: partner.agencyCode ?? 'Not assigned',
      done: !!partner.agencyCode,
    },
    {
      key: 'repCodes',
      label: 'Rep codes issued',
      detail: leaders.length === 0 ? 'No team members' : uncoded.length ? `${uncoded.length} team member${uncoded.length === 1 ? '' : 's'} without a code` : 'Every team member has a code',
      done: leaders.length > 0 && uncoded.length === 0,
    },
    {
      key: 'firstSale',
      label: 'First active member',
      detail: activeMemberCount ? `${activeMemberCount} active` : 'No attributed members yet',
      done: activeMemberCount > 0,
      optional: true,
    },
  ];
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-50 disabled:text-slate-500';
export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const dangerBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50';
export const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
export const cardCls = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
