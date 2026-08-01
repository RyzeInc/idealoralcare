'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Columns3,
  Eye,
  History,
  Lock,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, SkeletonCard, Tooltip, useToast } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

type GroupVisibility = 'none' | 'listBillOnly' | 'all';

interface StatementColumn {
  key: string;
  enabled: boolean;
}

interface Disclosure {
  memberDetail: boolean;
  groupVisibility: GroupVisibility;
  adjustmentDetail: boolean;
  columns: StatementColumn[];
}

/**
 * Mirrors STATEMENT_COLUMN_REGISTRY on the server. Kept in sync by the
 * `columns` array the server hands back — unknown keys here simply render
 * with their raw key, and the server is the one that enforces the rules.
 */
const COLUMN_META: Record<
  string,
  { label: string; group: string; fixed?: boolean; internalOnly?: boolean }
> = {
  memberId: { label: 'Member ID', group: 'Member', fixed: true },
  memberName: { label: 'Member Name', group: 'Member', fixed: true },
  rateClass: { label: 'Rate Class (Individual / Family)', group: 'Member' },
  firstName: { label: 'First Name', group: 'Member' },
  lastName: { label: 'Last Name', group: 'Member' },
  memberEmail: { label: 'Member Email', group: 'Member' },
  phone: { label: 'Phone', group: 'Member' },
  dob: { label: 'DOB', group: 'Member' },
  ssn: { label: 'SSN', group: 'Member' },
  gender: { label: 'Gender', group: 'Member' },
  memberRole: { label: 'Role', group: 'Member' },
  relationship: { label: 'Relationship', group: 'Member' },
  primaryMember: { label: 'Primary Member', group: 'Member' },
  dependentCount: { label: 'Dependents', group: 'Member' },
  memberType: { label: 'Status', group: 'Member' },
  effectiveDate: { label: 'Effective Date', group: 'Member' },
  createdAt: { label: 'Created', group: 'Member' },
  censusMissing: { label: 'Missing Census Fields', group: 'Member' },

  addressLine1: { label: 'Address Line 1', group: 'Address' },
  city: { label: 'City', group: 'Address' },
  state: { label: 'State', group: 'Address' },
  postalCode: { label: 'Zip', group: 'Address' },

  organization: { label: 'Organization', group: 'Organization' },
  orgCode: { label: 'Org Code', group: 'Organization' },
  groupCode: { label: 'Group Code', group: 'Organization' },
  employeeType: { label: 'Employee Type', group: 'Organization' },
  location: { label: 'Location', group: 'Organization' },
  department: { label: 'Department', group: 'Organization' },
  groupMemberId: { label: 'Employee #', group: 'Organization' },
  listBillStatus: { label: 'List Bill Status', group: 'Organization' },

  repName: { label: 'Rep / Broker', group: 'Attribution' },
  repCode: { label: 'Rep Code', group: 'Attribution' },
  repEmail: { label: 'Rep Email', group: 'Attribution' },
  agencyName: { label: 'Agency', group: 'Attribution' },

  careingtonId: { label: 'Careington ID', group: 'Systems' },
  careingtonSeq: { label: 'Seq #', group: 'Systems' },
  toothlensId: { label: 'Toothlens ID', group: 'Systems' },
  clerkId: { label: 'Clerk ID', group: 'Systems' },
  systemPresence: { label: 'System Presence', group: 'Systems' },
  subscriptionStatus: { label: 'Subscription', group: 'Systems' },
  entitlementCount: { label: 'Entitlements', group: 'Systems' },
  barcode: { label: 'Barcode', group: 'Systems' },
  subscriberId: { label: 'Subscriber ID', group: 'Systems' },

  amount: { label: 'Amount', group: 'Money', fixed: true },
  grossCents: { label: 'Retail Gross', group: 'Money', internalOnly: true },
  toothlensCents: { label: 'Toothlens Share', group: 'Money', internalOnly: true },
  careingtonCents: { label: 'Careington Share', group: 'Money', internalOnly: true },
  processingCents: { label: 'Processing', group: 'Money', internalOnly: true },
  partnerVendorCents: { label: 'Ideal Health Share', group: 'Money', internalOnly: true },
  ryzeKeepCents: { label: 'Ryze Keep', group: 'Money', internalOnly: true },
};

const COLUMN_GROUPS = [
  'Member',
  'Address',
  'Organization',
  'Attribution',
  'Systems',
  'Money',
];

type VendorId = 'toothlens' | 'careington' | 'ideal' | 'ryze';

const GROUP_OPTIONS: Array<{
  value: GroupVisibility;
  label: string;
  help: string;
}> = [
  {
    value: 'none',
    label: 'Never',
    help: 'No employer is named anywhere on the statement.',
  },
  {
    value: 'listBillOnly',
    label: 'List-bill employers only',
    help: 'Names the employer for members who came in through an employer group. Everyone else reads as "Direct enrollment", so the self-pay book stays private.',
  },
  {
    value: 'all',
    label: 'Every group',
    help: 'Names the internal group for every member, including self-pay. Internal use.',
  },
];

const TOGGLES: Array<{
  key: 'memberDetail' | 'adjustmentDetail';
  label: string;
  help: string;
}> = [
  {
    key: 'memberDetail',
    label: 'Covered primary detail',
    help: 'The member-by-member table. Turn off for a totals-only statement.',
  },
  {
    key: 'adjustmentDetail',
    label: 'Itemized adjustments',
    help: 'Each correction with its reason and notes. When off, only the net adjustment shows in the totals.',
  },
];

function sameDisclosure(a: Disclosure, b: Disclosure): boolean {
  return (
    a.memberDetail === b.memberDetail &&
    a.groupVisibility === b.groupVisibility &&
    a.adjustmentDetail === b.adjustmentDetail &&
    JSON.stringify(a.columns) === JSON.stringify(b.columns)
  );
}

// ---------------------------------------------------------------------------
// Column picker — which data points land in the generated file
// ---------------------------------------------------------------------------

function ColumnPicker({
  columns,
  defaults,
  isInternal,
  onChange,
}: {
  columns: StatementColumn[];
  defaults: StatementColumn[];
  isInternal: boolean;
  onChange: (next: StatementColumn[]) => void;
}) {
  const shown = columns.filter((c) => c.enabled).length;

  function setAll(pick: (key: string) => boolean) {
    onChange(
      columns.map((c) => ({
        key: c.key,
        enabled: COLUMN_META[c.key]?.fixed
          ? true
          : COLUMN_META[c.key]?.internalOnly && !isInternal
            ? false
            : pick(c.key),
      })),
    );
  }

  return (
    <div className="rounded-md border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center gap-2">
          <Columns3 size={14} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-800">
            Columns in the generated file
          </span>
          <span className="ml-auto text-xs text-slate-500">
            {shown} column{shown === 1 ? '' : 's'} shown
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Choose which data points appear in this recipient&apos;s PDF, CSV, and
          XLSX. Saved for this recipient — not just for you.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="text-xs font-semibold text-slate-500">Presets:</span>
          <button
            type="button"
            onClick={() => onChange(defaults)}
            className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setAll(() => true)}
            className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={() => setAll(() => false)}
            className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
          >
            Minimal
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {COLUMN_GROUPS.map((groupName) => {
          const inGroup = columns.filter(
            (c) => (COLUMN_META[c.key]?.group ?? 'Member') === groupName,
          );
          if (inGroup.length === 0) return null;
          return (
            <div key={groupName} className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {groupName}
              </p>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {inGroup.map((column) => {
                  const meta = COLUMN_META[column.key];
                  const blocked = Boolean(meta?.internalOnly) && !isInternal;
                  const locked = Boolean(meta?.fixed) || blocked;
                  return (
                    <label
                      key={column.key}
                      className={`flex items-start gap-2 text-sm ${
                        locked ? 'text-slate-400' : 'text-slate-800 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={column.enabled}
                        disabled={locked}
                        onChange={(event) =>
                          onChange(
                            columns.map((c) =>
                              c.key === column.key
                                ? { ...c, enabled: event.target.checked }
                                : c,
                            ),
                          )
                        }
                      />
                      <span>
                        {meta?.label ?? column.key}
                        {meta?.fixed && (
                          <span className="text-xs text-slate-400"> (always)</span>
                        )}
                        {blocked && (
                          <span className="block text-xs text-slate-400">
                            Internal only — would expose other partners&apos; pay
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live preview of the resulting statement columns
// ---------------------------------------------------------------------------

function ColumnPreview({ disclosure }: { disclosure: Disclosure }) {
  const columns = useMemo(() => {
    if (!disclosure.memberDetail) return [];
    return disclosure.columns
      .filter((c) => c.enabled)
      .filter(
        (c) =>
          disclosure.groupVisibility !== 'none' ||
          COLUMN_META[c.key]?.group !== 'Organization',
      )
      .map((c) => COLUMN_META[c.key]?.label ?? c.key);
  }, [disclosure]);

  const sampleGroup =
    disclosure.groupVisibility === 'all'
      ? 'ACMEMFG'
      : disclosure.groupVisibility === 'listBillOnly'
        ? 'BIGCORP'
        : null;

  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Eye size={13} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">
          What the recipient&apos;s statement will contain
        </span>
      </div>
      {columns.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">
          Totals only — group summary and statement totals, with no per-member lines.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold text-slate-500 uppercase whitespace-nowrap border-b border-slate-200"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-600">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap">
                    {col === 'Member ID'
                      ? 'MEM-10432'
                      : col === 'Member'
                        ? 'Lovelace, Ada'
                        : col === 'Group'
                          ? sampleGroup
                          : col === 'Rate Class'
                            ? 'Family'
                            : col === 'Rep / Broker'
                              ? 'Dana Reyes'
                              : col === 'Rep Code'
                                ? 'BRK-REYES-01'
                                : col === 'Agency'
                                  ? 'Southeast Benefits'
                                  : col === 'Amount'
                                    ? '$1.00'
                                    : '…'}
                  </td>
                ))}
              </tr>
              {disclosure.groupVisibility === 'listBillOnly' && (
                <tr className="text-slate-600 bg-slate-50/60">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap">
                      {col === 'Member ID'
                        ? 'MEM-10433'
                        : col === 'Member'
                          ? 'Turing, Alan'
                          : col === 'Group'
                            ? <span className="text-slate-400 italic">Direct enrollment</span>
                            : col === 'Rate Class'
                              ? 'Individual'
                              : col === 'Rep / Broker'
                                ? 'Dana Reyes'
                                : col === 'Rep Code'
                                  ? 'BRK-REYES-01'
                                  : col === 'Agency'
                                    ? 'Southeast Benefits'
                                    : '$1.00'}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change history for one recipient
// ---------------------------------------------------------------------------

function ContentsHistory({ vendor }: { vendor: VendorId }) {
  const entries = useQuery(api.admin.vendorStatements.listStatementActivity, {
    vendor,
    kind: 'contents',
    limit: 25,
  });

  return (
    <div className="rounded-md border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <History size={13} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">
          Change history
        </span>
        {entries && (
          <span className="ml-auto text-xs text-slate-400">
            {entries.length} change{entries.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {entries === undefined ? (
        <p className="px-4 py-4 text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">
          Never changed — this recipient is on the built-in default.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {entries.map((entry) => (
            <li key={String(entry.id)} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-800">{entry.label}</p>
                <div className="text-xs text-slate-400 text-right shrink-0">
                  <div>{formatDateTime(entry.createdAt)}</div>
                  <div>{entry.actorName}</div>
                </div>
              </div>
              {entry.changes.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {entry.changes.map((change, index) => (
                    <li key={index} className="text-xs text-slate-500 font-mono">
                      {change}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">{entry.summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One recipient's editor
// ---------------------------------------------------------------------------

function RecipientEditor({
  profile,
  returnTo,
  returnLabel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  returnTo: string | null;
  returnLabel: string | null;
}) {
  const toast = useToast();
  const update = useMutation(api.admin.vendorStatements.updateDisclosureProfile);
  const reset = useMutation(api.admin.vendorStatements.resetDisclosureProfile);
  const counts = useQuery(api.admin.vendorStatements.countStatementsForVendor, {
    vendor: profile.vendor as VendorId,
  });

  // Seeded from the server row. The parent remounts this component whenever
  // that row changes (see the `key` it passes), so a save by another admin or
  // a reset re-seeds the draft without an effect reaching in to overwrite it.
  const [draft, setDraft] = useState<Disclosure>(profile.current);
  const [note, setNote] = useState<string>(profile.note ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = !sameDisclosure(draft, profile.current) || note !== (profile.note ?? '');
  const isInternal: boolean = profile.internalRecipient;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await update({
        vendor: profile.vendor,
        disclosure: draft,
        note: note.trim() || undefined,
      });
      toast.success(
        result.changes.length > 0
          ? `Saved — ${result.changes.length} change(s) apply to future statements`
          : 'Saved',
      );
    } catch (error) {
      toast.error((error as Error).message ?? 'Could not save these settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await reset({ vendor: profile.vendor });
      toast.success('Restored the default for this recipient');
    } catch (error) {
      toast.error((error as Error).message ?? 'Could not reset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            {profile.vendorName}
            {isInternal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                <Lock size={11} /> Internal
              </span>
            )}
            {profile.customised && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Customised
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{profile.basis}</p>
        </div>
        {profile.updatedAt && (
          <p className="text-xs text-slate-400">
            Last changed {formatDateTime(profile.updatedAt)}
          </p>
        )}
      </div>

      {/* Already-issued statements are unaffected */}
      {counts && counts.issued > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 flex gap-2.5 text-sm text-blue-950">
          <Lock size={16} className="shrink-0 mt-0.5 text-blue-700" />
          <p>
            {profile.vendorName} has {counts.issued} statement
            {counts.issued !== 1 ? 's' : ''} already issued. Saving will change how
            those reprint too — a partner comparing a fresh download against the copy
            you sent them will see different columns.
          </p>
        </div>
      )}

      {/* Employer group */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
          Employer group
          {draft.groupVisibility !== 'none' && (
            <ShieldAlert size={13} className="text-amber-500" />
          )}
        </legend>
        <div className="grid gap-2">
          {GROUP_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex gap-3 rounded-md border p-3 cursor-pointer ${
                draft.groupVisibility === option.value
                  ? 'border-blue-400 bg-blue-50/60'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`group-${profile.vendor}`}
                className="mt-1"
                checked={draft.groupVisibility === option.value}
                onChange={() =>
                  setDraft((d) => ({ ...d, groupVisibility: option.value }))
                }
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{option.label}</p>
                <p className="text-xs text-slate-500">{option.help}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Sections */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">Sections</legend>
        <div className="grid gap-2">
          {TOGGLES.map((toggle) => (
            <label
              key={toggle.key}
              className="flex gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={draft[toggle.key]}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, [toggle.key]: event.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{toggle.label}</p>
                <p className="text-xs text-slate-500">{toggle.help}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.memberDetail && (
        <ColumnPicker
          columns={draft.columns}
          defaults={profile.defaults.columns}
          isInternal={isInternal}
          onChange={(columns) => setDraft((d) => ({ ...d, columns }))}
        />
      )}

      <ColumnPreview disclosure={draft} />

      <ContentsHistory vendor={profile.vendor as VendorId} />

      {/* Rationale */}
      <div>
        <label className="block text-sm font-medium text-slate-800 mb-1">
          Why these settings{' '}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="e.g. Ideal pays downstream reps and needs the employer for list-bill members."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 mt-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving…' : dirty ? 'Save as the default' : 'Saved'}
        </button>
        {profile.customised && (
          <Tooltip
            text="Drops the override so this recipient goes back to the built-in default."
            width="lg"
          >
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 mt-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Restore default
            </button>
          </Tooltip>
        )}
        {returnTo && !dirty && (
          <Link
            href={`/admin/vendor-statements/${returnTo}`}
            className="flex items-center gap-2 px-4 py-2 mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft size={14} /> Back to {returnLabel ?? 'the statement'}
          </Link>
        )}
        {dirty && (
          <span className="mt-3 text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle size={12} /> Unsaved changes
          </span>
        )}
        {!dirty && !profile.customised && (
          <span className="mt-3 text-xs text-slate-400 flex items-center gap-1">
            <Check size={12} /> Using the built-in default
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisclosureSettingsPage() {
  const profiles = useQuery(api.admin.vendorStatements.listDisclosureProfiles, {});
  const params = useSearchParams();

  // Arriving from a statement: open that recipient and keep a way back to the
  // document being worked on, so changing a column isn't a one-way trip.
  const returnTo = params.get('return');
  const returnLabel = params.get('label');
  const initialVendor = (params.get('vendor') as VendorId | null) ?? 'toothlens';
  const [selected, setSelected] = useState<VendorId>(initialVendor);

  const active = profiles?.find((p) => p.vendor === selected);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {returnTo && (
        <Link
          href={`/admin/vendor-statements/${returnTo}`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
        >
          <ArrowLeft size={14} />
          Back to {returnLabel ?? 'the statement'}
        </Link>
      )}

      <div>
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Vendor Statements', href: '/admin/vendor-statements' },
            { label: 'Statement Contents' },
          ]}
        />
        <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
          <SlidersHorizontal size={22} className="text-blue-600" />
          Statement Contents
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          What each recipient is shown on their statement, and in every export of it
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <Lock className="text-blue-700 shrink-0" size={20} />
        <div className="text-sm text-blue-950">
          <p className="font-semibold">Changes apply immediately, everywhere</p>
          <p>
            Saving here re-shapes every document for that recipient the next time it
            is opened or downloaded — existing statements included, no reissue
            needed. Only the columns change: amounts, the member list, and
            adjustments stay pinned to the closed month and cannot move. Where a
            statement now differs from the copy the recipient was originally sent,
            that difference is called out on the statement itself.
          </p>
        </div>
      </div>

      {!profiles ? (
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Recipient picker */}
          <nav className="bg-white rounded-lg shadow p-2 h-fit">
            {profiles.map((profile) => (
              <button
                key={profile.vendor}
                onClick={() => setSelected(profile.vendor as VendorId)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm ${
                  selected === profile.vendor
                    ? 'bg-blue-50 text-blue-800 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  {profile.vendorName}
                  {profile.customised && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {profile.internalRecipient ? 'Internal' : 'External partner'}
                </span>
              </button>
            ))}
            <Link
              href="/admin/vendor-statements"
              className="mt-2 flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={12} /> Back to statements
            </Link>
          </nav>

          <div className="bg-white rounded-lg shadow p-6">
            {active ? (
              <RecipientEditor
                key={`${active.vendor}-${active.updatedAt ?? 'default'}`}
                profile={active}
                returnTo={returnTo}
                returnLabel={returnLabel}
              />
            ) : (
              <p className="text-sm text-slate-500">Select a recipient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
