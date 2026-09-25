'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  Search, CheckCircle2, XCircle, Clock, Eye, X,
  Loader2, Code2, FileSignature, UserPlus, Link2, Building2,
} from 'lucide-react';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import { formatDateTime, formatPhone } from '@/lib/admin-format';
import { buildUplineOptions } from '@/lib/partner-upline';

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
  const w9 = useQuery(api.legal.w9Forms.getW9ForSubmission, { repSubmissionId: sub._id });
  const matchedKit = useQuery(
    api.partnerKit.getById,
    sub.partnerKitSubmissionId ? { id: sub.partnerKitSubmissionId } : 'skip',
  );
  const logAdminAction = useMutation(api.admin.adminAudit.logAdminAction);

  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [parentPartnerId, setParentPartnerId] = useState('');
  const [agencyPartnerId, setAgencyPartnerId] = useState('');
  const [codeResult, setCodeResult] = useState<{agencyCode: string; codesCreated: number; codeRows: any[]} | null>(null);

  const wantsAgency = sub.submissionType === 'agency' || sub.submissionType === 'both';
  const wantsRep    = sub.submissionType === 'rep'    || sub.submissionType === 'both';

  // Any active partner can be an upline, not just Program Managers — an agency
  // that recruited this applicant is their upline and earns the override.
  const uplineOptions = buildUplineOptions(partners);
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

  async function handleViewW9() {
    if (!w9?.fileUrl) return;
    try {
      await logAdminAction({
        action: 'w9.viewed',
        targetType: 'w9Forms',
        targetId: w9._id,
        summary: `Viewed signed W-9 for ${sub.agencyName ?? sub.primaryContactEmail ?? sub.repEmail ?? 'submission'}`,
      });
    } catch {
      // Non-fatal — don't block viewing the document if the audit write fails
    }
    window.open(w9.fileUrl, '_blank', 'noopener,noreferrer');
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
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Form W-9</p>
                {w9 === undefined ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : w9 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-900">
                      Signed {formatDateTime(w9.signedAt)} · TIN {w9.maskedTin}
                    </span>
                    <button
                      type="button"
                      onClick={handleViewW9}
                      className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                    >
                      View PDF
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Not signed yet (status: {sub.w9Status ?? 'pending'})
                  </p>
                )}
              </div>
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

          {(sub.sourceLeadId || sub.partnerKitSubmissionId) && (
            <Section title="Pipeline">
              {sub.sourceLeadId && (
                <div className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <UserPlus size={15} className="text-blue-600" />
                  <span className="text-slate-700">Converted from a Partner Kit Lead</span>
                  <Link href="/admin/partnerkit" className="text-blue-700 hover:text-blue-900 underline">
                    View lead
                  </Link>
                </div>
              )}
              {sub.partnerKitSubmissionId && (
                <div className="sm:col-span-2 flex items-start gap-2 text-sm">
                  <FileSignature size={15} className="text-emerald-600 mt-0.5" />
                  <div>
                    <span className="text-slate-700">
                      Matched signed Partner Kit
                      {matchedKit ? ` — ${matchedKit.partnerAgencyName}` : ''}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Its W-9 will be linked to the partner automatically on approval.
                    </p>
                  </div>
                </div>
              )}
            </Section>
          )}

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Submitted {formatDateTime(sub.createdAt)}</p>
          </div>
        </div>

        {/* Action footer — pending records */}
        {sub.status !== 'approved' && sub.status !== 'rejected' && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 space-y-3">
            {/* Upline selector — who this partner sits under */}
            {wantsAgency && uplineOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Place under (upline partner, optional)
                </label>
                <select
                  value={parentPartnerId}
                  onChange={(e) => setParentPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="">Independent / assign later</option>
                  {uplineOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Whoever recruited them. They keep their own agency code and rep
                  codes — this only sets who sits above them for overrides.
                </p>
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

            {/* Attach the broker to an enrollment group (Part 4) */}
            {sub.approvedPartnerId && (
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Building2 size={13} /> Attach to enrollment hierarchy (optional)
                </p>
                <AttachToGroupControl partnerId={sub.approvedPartnerId} />
              </div>
            )}
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

      {/* Partner Kit submissions */}
      <PartnerKitSection partners={partners} applications={submissions} />
    </div>
  );
}

function PartnerKitSection({ partners, applications }: { partners: any[]; applications: any[] }) {
  const rows = useQuery(api.partnerKit.list, {});
  const [openId, setOpenId] = useState<Id<'partnerKitSubmissions'> | null>(null);
  const backfill = useAction(api.partnerKit.backfillExecutedAgreements);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);

  // Kits signed online before the executed copy was generated at signing time
  // have nothing to hand back to the partner until this is run.
  const pendingCopies = (rows ?? []).filter(
    (r) => r.method === 'online' && !r.executedAgreementFileId,
  ).length;

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillNote(null);
    try {
      const { scheduled } = await backfill({});
      setBackfillNote(
        scheduled === 0
          ? 'Every signed copy is already prepared.'
          : `Preparing ${scheduled} signed ${scheduled === 1 ? 'copy' : 'copies'} — refresh in a moment.`,
      );
    } catch {
      setBackfillNote('Could not start. Check the Convex logs.');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Partner Kit Submissions</h2>
          <p className="text-slate-600 text-sm">Signed Partner Agreements &amp; W-9s from the Partner Kit page</p>
        </div>
        {pendingCopies > 0 && (
          <div className="text-right">
            <button
              type="button"
              onClick={runBackfill}
              disabled={backfilling}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {backfilling ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />}
              Prepare {pendingCopies} signed {pendingCopies === 1 ? 'copy' : 'copies'}
            </button>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Renders the executed agreement so the partner can download it from their resources.
            </p>
          </div>
        )}
      </div>
      {backfillNote && (
        <p className="mb-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {backfillNote}
        </p>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {rows === undefined ? (
          <div className="py-12 text-center">
            <Loader2 className="animate-spin mx-auto text-slate-400" size={28} />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No Partner Kit submissions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Partner / Agency</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Contact</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Agreement</th>
                <th className="px-4 py-3 font-semibold text-slate-700">W-9</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Pipeline</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r: any) => (
                <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.partnerAgencyName}
                    {r.dba ? <span className="ml-1.5 text-xs text-slate-500">DBA: {r.dba}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{r.email}</p>
                    <p className="text-xs text-slate-400">{r.primaryContactName}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.method === 'online' ? 'Signed online' : 'Uploaded PDF'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.w9FormId ? 'E-signed' : r.w9FileId ? 'Uploaded' : '—'}
                  </td>
                  <td className="px-4 py-3"><KitPipelineBadge kit={r} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setOpenId(r._id)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {openId && (
        <PartnerKitDrawer
          id={openId}
          partners={partners}
          applications={applications}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function KitPipelineBadge({ kit }: { kit: any }) {
  if (kit.approvedPartnerId) {
    return (
      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">
        <Building2 size={11} /> Promoted
      </span>
    );
  }
  if (kit.matchedApplicationId) {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full">
        <Link2 size={11} /> Linked to application
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium px-2 py-0.5 rounded-full">
      Unmatched
    </span>
  );
}

/**
 * Optionally attach a newly-created broker to an enrollment group (Sites →
 * Accounts → Organizations). Writes the group's existing brokerTrackingCode
 * (stable join) + brokerId via hierarchy.updateGroup — no schema change.
 */
function AttachToGroupControl({ partnerId }: { partnerId: string }) {
  const toast = useToast();
  const codes = useQuery(api.admin.repCodes.getAll, {}) ?? [];
  const groups = useQuery(api.admin.hierarchy.getAllGroups) ?? [];
  const updateGroup = useMutation(api.admin.hierarchy.updateGroup);

  const partnerCodes = (codes as any[]).filter((c) => c.agencyId === partnerId && c.status === 'active');
  const [codeId, setCodeId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [attaching, setAttaching] = useState(false);

  const selectedCode = partnerCodes.find((c: any) => c._id === codeId) ?? partnerCodes[0];

  if (partnerCodes.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Provision rep codes first to attach this broker to an enrollment group.
      </p>
    );
  }

  async function handleAttach() {
    if (!groupId) {
      toast.warning('Select a group', 'Choose the enrollment group to attach this broker to.');
      return;
    }
    if (!selectedCode) return;
    setAttaching(true);
    try {
      await updateGroup({
        groupId: groupId as Id<'groups'>,
        brokerId: selectedCode.brokerId,
        brokerTrackingCode: selectedCode.code,
      });
      toast.success('Attached to group', `Rep code ${selectedCode.code} is now attributed to this group.`);
      setGroupId('');
    } catch (e: any) {
      toast.fromError(e, 'Attach failed');
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="space-y-2">
      {partnerCodes.length > 1 && (
        <select
          value={codeId || selectedCode?._id || ''}
          onChange={(e) => setCodeId(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
        >
          {partnerCodes.map((c: any) => (
            <option key={c._id} value={c._id}>Rep code {c.code}{c.slug ? ` (${c.slug})` : ''}</option>
          ))}
        </select>
      )}
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
      >
        <option value="">Select enrollment group…</option>
        {(groups as any[]).map((g) => (
          <option key={g._id} value={g._id}>{g.name}{g.groupCode ? ` · ${g.groupCode}` : ''}</option>
        ))}
      </select>
      <button
        onClick={handleAttach}
        disabled={attaching}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {attaching ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
        Attach to Enrollment Group
      </button>
    </div>
  );
}

function PartnerKitDrawer({
  id,
  partners,
  applications,
  onClose,
}: {
  id: Id<'partnerKitSubmissions'>;
  partners: any[];
  applications: any[];
  onClose: () => void;
}) {
  const toast = useToast();
  const data = useQuery(api.partnerKit.getWithFiles, { id });
  const logAdminAction = useMutation(api.admin.adminAudit.logAdminAction);
  const promote = useAction(api.partnerKit.approveAsPartner);
  const linkToApplication = useMutation(api.partnerKit.linkToApplication);

  const [acting, setActing] = useState<string | null>(null);
  const [parentPartnerId, setParentPartnerId] = useState('');
  const [linkAppId, setLinkAppId] = useState('');

  // Same rule as the application path: any active partner may be the upline.
  const uplineOptions = buildUplineOptions(partners);
  // Applications not already linked to a kit are candidates for manual linking.
  const linkableApps = applications.filter((a: any) => !a.partnerKitSubmissionId);

  async function handlePromote() {
    setActing('promote');
    try {
      const res: any = await promote({
        id,
        parentPartnerId: parentPartnerId ? (parentPartnerId as Id<'distributionPartners'>) : undefined,
      });
      toast.success(
        'Promoted to broker',
        `Partner + rep codes created.${res.inviteSent ? ' Invite email sent.' : ' Invite email failed — resend from Brokers.'}`,
      );
      onClose();
    } catch (e: any) {
      toast.fromError(e, 'Promotion failed');
    } finally {
      setActing(null);
    }
  }

  async function handleLink() {
    if (!linkAppId) {
      toast.warning('Select an application', 'Choose the application to link this signed kit to.');
      return;
    }
    setActing('link');
    try {
      await linkToApplication({ id, applicationId: linkAppId as Id<'repOnboardingSubmissions'> });
      toast.success('Linked to application', 'The application will carry this W-9 through on approval.');
      onClose();
    } catch (e: any) {
      toast.fromError(e, 'Linking failed');
    } finally {
      setActing(null);
    }
  }

  async function openDoc(url: string, label: string, targetId: string) {
    try {
      await logAdminAction({
        action: 'partnerKit.docViewed',
        targetType: 'partnerKitSubmissions',
        targetId,
        summary: `Viewed ${label} for ${data?.partnerAgencyName ?? 'partner kit submission'}`,
      });
    } catch {
      // Non-fatal
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {data?.partnerAgencyName ?? 'Partner Kit'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        {data === undefined ? (
          <div className="py-16 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" size={28} /></div>
        ) : data === null ? (
          <div className="py-16 text-center text-slate-500 text-sm">Not found.</div>
        ) : (
          <div className="p-6 space-y-5">
            <Section title="Partner Details">
              <Field label="Partner / Agency" value={data.partnerAgencyName} />
              <Field label="DBA" value={data.dba} />
              <Field label="Primary Contact" value={data.primaryContactName} />
              <Field label="Email" value={data.email} />
              <Field label="Phone" value={data.phone} />
              <Field label="NPN / License" value={data.npnLicenseInfo} />
              <Field label="Effective Date" value={data.effectiveDate} />
            </Section>

            <Section title="Agreement">
              <Field label="Method" value={data.method === 'online' ? 'Completed & signed online' : 'Uploaded completed PDF'} />
              <Field label="Acknowledged" value={data.acknowledged ? 'Yes' : 'No'} />
              {data.method === 'online' && (
                <>
                  <Field label="Printed Name" value={data.printedName} />
                  <Field label="Title" value={data.title} />
                  <Field label="Signed Date" value={data.signedDate} />
                  {data.signatureDataUrl && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Signature</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={data.signatureDataUrl} alt="Partner signature" className="border border-slate-200 rounded bg-white max-h-24" />
                    </div>
                  )}
                </>
              )}
              {data.partnerKitFileUrl && (
                <button
                  onClick={() => openDoc(data.partnerKitFileUrl!, 'uploaded Partner Kit', data._id)}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                >
                  View uploaded Partner Kit{data.partnerKitFileName ? ` (${data.partnerKitFileName})` : ''}
                </button>
              )}
            </Section>

            <Section title="Form W-9">
              {data.w9SignedUrl ? (
                <>
                  <Field label="TIN" value={data.w9MaskedTin} />
                  <button
                    onClick={() => openDoc(data.w9SignedUrl!, 'e-signed W-9', data._id)}
                    className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                  >
                    View e-signed W-9
                  </button>
                </>
              ) : data.w9UploadUrl ? (
                <button
                  onClick={() => openDoc(data.w9UploadUrl!, 'uploaded W-9', data._id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium"
                >
                  View uploaded W-9{data.w9FileName ? ` (${data.w9FileName})` : ''}
                </button>
              ) : (
                <p className="text-sm text-slate-500">No W-9 on file.</p>
              )}
            </Section>

            {/* Pipeline actions */}
            <Section title="Pipeline">
              {data.approvedPartnerId ? (
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Building2 size={15} /> Promoted to a broker.
                    <Link href="/admin/brokers" className="underline hover:text-green-900">View in Brokers</Link>
                  </div>
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                      <Building2 size={13} /> Attach to enrollment hierarchy (optional)
                    </p>
                    <AttachToGroupControl partnerId={data.approvedPartnerId} />
                  </div>
                </div>
              ) : data.matchedApplicationId ? (
                <div className="sm:col-span-2 text-sm">
                  <p className="flex items-center gap-2 text-blue-700">
                    <Link2 size={15} /> Linked to a Partner Application.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Approve it from the application above — the W-9 carries through automatically.
                  </p>
                </div>
              ) : (
                <div className="sm:col-span-2 space-y-4">
                  {/* Promote standalone */}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <UserPlus size={14} /> Promote to Broker
                    </p>
                    {uplineOptions.length > 0 && (
                      <select
                        value={parentPartnerId}
                        onChange={(e) => setParentPartnerId(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 mb-2"
                      >
                        <option value="">Upline partner — optional</option>
                        {uplineOptions.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handlePromote}
                      disabled={!!acting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acting === 'promote' ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
                      Promote to Broker + Rep Codes
                    </button>
                  </div>

                  {/* Or link to an existing application */}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Link2 size={14} /> Link to an existing application
                    </p>
                    <select
                      value={linkAppId}
                      onChange={(e) => setLinkAppId(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 mb-2"
                    >
                      <option value="">Select application…</option>
                      {linkableApps.map((a: any) => (
                        <option key={a._id} value={a._id}>
                          {a.agencyName ?? `${a.repFirstName ?? ''} ${a.repLastName ?? ''}`.trim()} · {a.primaryContactEmail ?? a.repEmail}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleLink}
                      disabled={!!acting}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {acting === 'link' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                      Link to Application
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
