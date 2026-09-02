'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  Search, CheckCircle2, XCircle, Clock, Eye, X,
  Loader2, Code2,
} from 'lucide-react';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import { formatDateTime, formatPhone } from '@/lib/admin-format';

type Status = 'new' | 'reviewing' | 'approved' | 'rejected';

const STATUS_META: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  new:       { label: 'New',       color: 'bg-blue-100 text-blue-800',    icon: <Clock size={12} /> },
  reviewing: { label: 'Reviewing', color: 'bg-yellow-100 text-yellow-800', icon: <Eye size={12} /> },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-800',  icon: <CheckCircle2 size={12} /> },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-800',      icon: <XCircle size={12} /> },
};

function Badge({ status }: { status: Status }) {
  const m = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${m.color}`}>
      {m.icon}{m.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-slate-100 first:border-0 first:pt-0">
      <p className="text-sm font-bold text-slate-700 mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function typeLabel(t: string) {
  if (t === 'agency') return 'Agency Only';
  if (t === 'rep') return 'Rep Only';
  if (t === 'both') return 'Agency + Rep';
  return t;
}

// ─── Drawer ────────────────────────────────────────────────────────────

function Drawer({
  sub,
  partners,
  onClose,
}: {
  sub: any;
  partners: any[];
  onClose: () => void;
}) {
  const toast = useToast();
  const markReviewing = useMutation(api.repOnboarding.markReviewing);
  const reject = useMutation(api.repOnboarding.reject);
  const approve = useAction(api.repOnboarding.approve);
  const provisionCodes = useAction(api.admin.repCodes.provisionCodesForPartner);

  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [parentPartnerId, setParentPartnerId] = useState('');
  const [agencyPartnerId, setAgencyPartnerId] = useState('');
  const [codeResult, setCodeResult] = useState<{agencyCode: string; codesCreated: number; codeRows: any[]} | null>(null);

  const wantsAgency = sub.submissionType === 'agency' || sub.submissionType === 'both';
  const wantsRep    = sub.submissionType === 'rep'    || sub.submissionType === 'both';

  const pmOptions = partners.filter((p: any) => p.type === 'program_manager');
  const agencyOptions = partners.filter((p: any) => p.type === 'agency');

  async function handleReview() {
    setActing('review');
    try {
      await markReviewing({ id: sub._id });
      toast.success('Marked as reviewing');
    } catch (e: any) {
      toast.fromError(e, 'Failed to update status');
    } finally { setActing(null); }
  }

  async function handleReject() {
    if (!showRejectInput) { setShowRejectInput(true); return; }
    setActing('reject');
    try {
      await reject({ id: sub._id, reason: rejectReason || undefined });
      toast.success('Submission rejected');
      onClose();
    } catch (e: any) {
      toast.fromError(e, 'Rejection failed');
    } finally { setActing(null); }
  }

  async function handleApprove() {
    if (wantsRep && !wantsAgency && !agencyPartnerId) {
      toast.warning('Select agency', 'You must select an agency to attach the rep to.');
      return;
    }
    setActing('approve');
    try {
      const result: any = await approve({
        id: sub._id,
        parentPartnerId: parentPartnerId ? parentPartnerId as Id<'distributionPartners'> : undefined,
        agencyPartnerId: agencyPartnerId ? agencyPartnerId as Id<'distributionPartners'> : undefined,
      });
      toast.success(
        'Approved',
        `Partner records created.${result.inviteSent ? ' Invite email sent.' : ' Invite email failed — resend manually.'}`
      );
      onClose();
    } catch (e: any) {
      toast.fromError(e, 'Approval failed');
    } finally { setActing(null); }
  }

  async function handleProvisionCodes(partnerId: string) {
    setActing('provision');
    try {
      const result: any = await provisionCodes({ partnerId: partnerId as Id<'distributionPartners'> });
      setCodeResult(result);
      toast.success(
        `Agency code: ${result.agencyCode}`,
        `${result.codesCreated} new tracking code(s) created.`
      );
    } catch (e: any) {
      toast.fromError(e, 'Code provisioning failed');
    } finally { setActing(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500 mb-1">{typeLabel(sub.submissionType)}</p>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {sub.agencyName ?? `${sub.repFirstName} ${sub.repLastName}`}
            </h2>
            <div className="mt-1"><Badge status={sub.status} /></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {wantsAgency && (
            <Section title="Agency / Broker">
              <Field label="Agency Name" value={sub.agencyName} />
              <Field label="DBA" value={sub.dba} />
              <Field label="EIN" value={sub.ein} />
              <Field label="Agency NPN" value={sub.agencyNpn} />
              <Field label="Primary Contact" value={sub.primaryContactName} />
              <Field label="Contact Email" value={sub.primaryContactEmail} />
              <Field label="Contact Phone" value={sub.primaryContactPhone ? formatPhone(sub.primaryContactPhone) : undefined} />
              <Field label="Physical Address" value={sub.physicalAddress} />
              <Field label="Mailing Address" value={sub.mailingAddress} />
              <Field label="Agency Licenses" value={sub.agencyLicenses} />
              <Field label="E&O Carrier" value={sub.eoCarrier} />
              <Field label="E&O Expiration" value={sub.eoExpiration} />
              <Field label="Commission Tier" value={sub.commissionTier} />
              <Field label="Effective Date" value={sub.agencyEffectiveDate} />
              <Field label="Status" value={sub.agencyStatus} />
              <Field label="W-9 Status" value={sub.w9Status} />
              <Field label="W-9 Received Date" value={sub.w9ReceivedDate} />
              <Field label="Payment Method" value={sub.paymentMethod} />
              <Field label="ACH Auth Status" value={sub.achAuthorizationStatus} />
              <Field label="Program Manager (submitted)" value={sub.programManager} />
            </Section>
          )}
          {wantsRep && (
            <Section title="Front-Line Rep">
              <Field label="First Name" value={sub.repFirstName} />
              <Field label="Last Name" value={sub.repLastName} />
              <Field label="Email" value={sub.repEmail} />
              <Field label="Phone" value={sub.repPhone ? formatPhone(sub.repPhone) : undefined} />
              <Field label="Rep NPN" value={sub.repNpn} />
              <Field label="Assigned Agency (submitted)" value={sub.assignedAgency} />
              <Field label="Rep Licenses" value={sub.repLicenses} />
              <Field label="Effective Date" value={sub.repEffectiveDate} />
              <Field label="Status" value={sub.repStatus} />
              <Field label="Writing Number" value={sub.writingNumber} />
            </Section>
          )}
          {sub.notes && (
            <Section title="Admin Notes">
              <div className="sm:col-span-2 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded p-3">{sub.notes}</div>
            </Section>
          )}

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Submitted {formatDateTime(sub.createdAt)}</p>
          </div>
        </div>

        {/* Action footer — pending records */}
        {sub.status !== 'approved' && sub.status !== 'rejected' && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 space-y-3">
            {/* PM selector for agency */}
            {wantsAgency && pmOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Assign Program Manager (optional)
                </label>
                <select
                  value={parentPartnerId}
                  onChange={(e) => setParentPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="">None / assign later</option>
                  {pmOptions.map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Agency selector for rep-only */}
            {wantsRep && !wantsAgency && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Attach Rep to Agency <span className="text-red-500">*</span>
                </label>
                <select
                  value={agencyPartnerId}
                  onChange={(e) => setAgencyPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="">Select agency…</option>
                  {agencyOptions.map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Reject reason */}
            {showRejectInput && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rejection reason</label>
                <textarea
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 h-20"
                  placeholder="Optional note visible to the admin team…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              {sub.status === 'new' && (
                <button
                  onClick={handleReview}
                  disabled={!!acting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                >
                  {acting === 'review' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  Mark Reviewing
                </button>
              )}
              <button
                onClick={handleReject}
                disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {acting === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                {showRejectInput ? 'Confirm Reject' : 'Reject'}
              </button>
              <button
                onClick={handleApprove}
                disabled={!!acting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {acting === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approve
              </button>
            </div>
          </div>
        )}

        {/* Approved-record code management */}
        {sub.status === 'approved' && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 space-y-3">
            {codeResult ? (
              <div className="text-sm space-y-1">
                <p className="font-semibold text-emerald-700">Agency Code: <span className="font-mono">{codeResult.agencyCode}</span></p>
                {codeResult.codeRows.map((r: any) => (
                  <p key={r.leaderId} className="text-slate-600 text-xs">
                    Code: <span className="font-mono font-semibold">{r.code}</span>
                    {r.slug ? <> · Slug: <span className="font-mono">{r.slug}</span></> : null}
                  </p>
                ))}
              </div>
            ) : !sub.approvedPartnerId ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  No partner ID linked — approved before tracking was added. Select the matching partner record:
                </p>
                <select
                  value={agencyPartnerId}
                  onChange={(e) => setAgencyPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="">Select partner record…</option>
                  {partners.filter((p: any) => p.type === 'agency').map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Partner: <span className="font-mono">{sub.approvedPartnerId}</span></p>
            )}
            <button
              onClick={() => {
                const pid = sub.approvedPartnerId || agencyPartnerId;
                if (!pid) { toast.warning('Select partner', 'Choose the partner record to provision codes for.'); return; }
                handleProvisionCodes(pid);
              }}
              disabled={!!acting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {acting === 'provision' ? <Loader2 size={14} className="animate-spin" /> : <Code2 size={14} />}
              {acting === 'provision' ? 'Provisioning…' : 'Provision Agency Code + Rep Codes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────

const ALL_STATUSES: (Status | 'all')[] = ['all', 'new', 'reviewing', 'approved', 'rejected'];

export default function PartnerApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const submissionsRaw = useQuery(api.repOnboarding.listForAdmin, {});
  const submissions = submissionsRaw ?? [];
  const partners = useQuery(api.admin.distributionPartners.getAll, {}) ?? [];

  const filtered = useMemo(() => {
    let rows = submissions as any[];
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.agencyName, r.primaryContactEmail, r.repFirstName, r.repLastName, r.repEmail, r.ein, r.agencyNpn, r.repNpn]
          .some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [submissions, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: submissions.length };
    for (const r of submissions as any[]) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [submissions]);

  return (
    <div className="space-y-6">
      {selected && (
        <Drawer
          sub={selected}
          partners={partners}
          onClose={() => setSelected(null)}
        />
      )}

      <Breadcrumbs items={[{ label: 'Partner Applications' }]} />

      <div>
        <h1 className="text-3xl font-bold text-slate-900">Partner Applications</h1>
        <p className="text-slate-600">Review broker, agency, and rep onboarding submissions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap gap-4 items-center">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
              {counts[s] != null ? (
                <span className={`ml-1.5 text-xs ${statusFilter === s ? 'text-blue-100' : 'text-slate-500'}`}>
                  {counts[s]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search agency, email, NPN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {submissionsRaw === undefined ? (
          <div className="py-16 text-center">
            <Loader2 className="animate-spin mx-auto text-slate-400" size={32} />
            <p className="text-slate-500 mt-2 text-sm">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No submissions match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Name / Agency</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Contact</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row: any) => (
                <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.agencyName ?? `${row.repFirstName ?? ''} ${row.repLastName ?? ''}`.trim()}
                    {row.dba ? <span className="ml-1.5 text-xs text-slate-500">DBA: {row.dba}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{typeLabel(row.submissionType)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.primaryContactEmail ?? row.repEmail ?? '—'}</p>
                    {(row.primaryContactPhone ?? row.repPhone) && (
                      <p className="text-xs text-slate-400">
                        {formatPhone(row.primaryContactPhone ?? row.repPhone)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge status={row.status} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(row)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
