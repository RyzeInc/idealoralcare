'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  ArrowLeft, User, MapPin, CreditCard, ScanLine, Building2,
  CheckCircle, AlertCircle, Clock, ExternalLink, ShieldCheck,
  Phone, Mail, Calendar, Activity, FileText, Users, Tag, Hash,
  Loader, BarChart3, Eye, Globe,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────

function fmt(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
function fmtFull(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
import { StatusBadge } from '@/components/admin/ui';

function cents(c: number | null | undefined) {
  if (!c) return '—';
  return `$${(c / 100).toFixed(2)}`;
}

function SectionHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-slate-500 flex-shrink-0" />
      <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{title}</h2>
      {badge}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Clerk section (fetches from /api/clerk/users/[id]) ───────────────────

interface ClerkUserData {
  id: string;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastSignInAt: number | null;
  lastActiveAt: number | null;
  banned: boolean;
  emailAddresses: { id: string; email: string; verified: boolean; isPrimary: boolean }[];
  phoneNumbers: { id: string; phone: string; verified: boolean; isPrimary: boolean }[];
  externalAccounts: { provider: string; username: string | null; email: string | null }[];
  publicMetadata: Record<string, any>;
  activeSessions: number;
}

function ClerkSection({ clerkUserId }: { clerkUserId: string | null | undefined }) {
  const [data, setData] = useState<ClerkUserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clerkUserId) return;
    setLoading(true);
    fetch(`/api/clerk/users/${clerkUserId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load Clerk data'); setLoading(false); });
  }, [clerkUserId]);

  if (!clerkUserId) {
    return (
      <Card>
        <SectionHeader icon={ShieldCheck} title="Clerk Account" />
        <p className="text-sm text-slate-500 italic">No Clerk account linked to this member.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <SectionHeader icon={ShieldCheck} title="Clerk Account" />
        <div className="flex items-center gap-2 text-slate-500">
          <Loader size={14} className="animate-spin" /> Loading Clerk data…
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <SectionHeader icon={ShieldCheck} title="Clerk Account" />
        <p className="text-sm text-red-600">{error ?? 'No data'}</p>
      </Card>
    );
  }

  const primary = data.emailAddresses.find((e) => e.isPrimary) ?? data.emailAddresses[0];
  const primaryPhone = data.phoneNumbers.find((p) => p.isPrimary) ?? data.phoneNumbers[0];

  return (
    <Card>
      <SectionHeader
        icon={ShieldCheck}
        title="Clerk Account"
        badge={
          data.banned
            ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">BANNED</span>
            : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">Active</span>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Clerk User ID" value={data.id} mono />
        <Field label="Active Sessions" value={data.activeSessions} />
        <Field label="Last Sign-In" value={fmtFull(data.lastSignInAt)} />
        <Field label="Last Active" value={fmtFull(data.lastActiveAt)} />
        <Field label="Account Created" value={fmt(data.createdAt)} />
        <Field label="Profile Updated" value={fmt(data.updatedAt)} />
      </div>

      {/* Email addresses */}
      {data.emailAddresses.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Mail size={11} /> Email Addresses</p>
          <div className="space-y-1">
            {data.emailAddresses.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-slate-900">{e.email}</span>
                {e.isPrimary && <span className="text-xs text-blue-600 font-medium">primary</span>}
                {e.verified
                  ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle size={11} /> verified</span>
                  : <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertCircle size={11} /> unverified</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phone numbers */}
      {data.phoneNumbers.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Phone size={11} /> Phone Numbers</p>
          <div className="space-y-1">
            {data.phoneNumbers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-slate-900">{p.phone}</span>
                {p.isPrimary && <span className="text-xs text-blue-600 font-medium">primary</span>}
                {p.verified
                  ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle size={11} /> verified</span>
                  : <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertCircle size={11} /> unverified</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External accounts (OAuth) */}
      {data.externalAccounts.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Globe size={11} /> Connected Accounts</p>
          <div className="flex flex-wrap gap-2">
            {data.externalAccounts.map((ea, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono capitalize">
                {ea.provider}{ea.email ? ` — ${ea.email}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function MemberInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const data = useQuery(
    api.admin.userAudit.getMemberInspectorData,
    { memberProfileId: id as Id<'memberProfiles'> }
  );

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="p-8">
        <Link href="/admin/members" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft size={14} /> Back to Members
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
          Member not found.
        </div>
      </div>
    );
  }

  const { member, dependents, hierarchy, subscription, entitlements, toothlens, notes, activities, validation } = data;
  const fullName = `${member.title ? member.title + ' ' : ''}${member.firstName} ${member.lastName}${member.suffix ? ' ' + member.suffix : ''}`;

  return (
    <div className="space-y-6 pb-16">
      {/* Back + title */}
      <div className="flex items-start gap-4">
        <Link
          href="/admin/members"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mt-1"
        >
          <ArrowLeft size={14} /> Members
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
            <StatusBadge status={member.memberType} />
            {!validation.isComplete && (
              <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded">
                <AlertCircle size={11} /> {validation.missingFields.length} missing field(s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-slate-500 font-mono">{member.memberId}</span>
            {hierarchy.groupName && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Building2 size={12} /> {hierarchy.groupName}
                {hierarchy.groupCode && <span className="font-mono text-xs text-slate-400">({hierarchy.groupCode})</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Missing fields banner */}
      {!validation.isComplete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Missing Required Census Template Fields</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {validation.missingFields.map((f) => (
                  <span key={f} className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* IdealOH Profile */}
          <Card>
            <SectionHeader icon={User} title="IdealOH Profile" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="First Name" value={member.firstName} />
              <Field label="Middle Name" value={member.middleName} />
              <Field label="Last Name" value={member.lastName} />
              <Field label="Suffix (Post Name)" value={member.suffix} />
              <Field label="Title" value={member.title} />
              <Field label="Gender" value={member.gender} />
              <Field label="Date of Birth" value={member.dateOfBirth ?? '—'} />
              <Field label="Effective Date" value={member.effectiveDate ?? '—'} />
              <Field label="Signup Source" value={member.signupSource} />
              <Field label="Member Role" value={member.memberRole} />
              <Field label="Employee Type" value={member.employeeType} />
              <Field label="Status" value={<StatusBadge status={member.status} />} />
            </div>

            {/* Contact */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Email" value={member.email} mono />
                <Field label="Home Phone" value={member.phone} mono />
                <Field label="Work Phone" value={member.workPhone} mono />
              </div>
            </div>

            {/* Address */}
            {member.address && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <MapPin size={11} /> Address
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Address Line 1" value={member.address.line1} />
                  <Field label="Address Line 2" value={member.address.line2} />
                  <Field label="City" value={member.address.city} />
                  <Field label="State" value={member.address.state} />
                  <Field label="Zip" value={member.address.postalCode} mono />
                  <Field label="Country" value={member.address.country} />
                </div>
              </div>
            )}

            {/* Hierarchy */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                <Building2 size={11} /> Group / Account
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Site" value={hierarchy.siteName} />
                <Field label="Account" value={hierarchy.accountName} />
                <Field label="Group" value={hierarchy.groupName} />
                <Field label="Group Code" value={hierarchy.groupCode} mono />
              </div>
            </div>
          </Card>

          {/* Vendor IDs */}
          <Card>
            <SectionHeader icon={Hash} title="Vendor Identity IDs" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Field
                  label="Careington / DialCare Unique ID"
                  value={member.careingtonUniqueId ?? <span className="text-red-500">Missing</span>}
                  mono
                />
                <p className="text-xs text-slate-400 mt-0.5">Shared across whole family</p>
              </div>
              <div>
                <Field
                  label="Careington Sequence #"
                  value={member.careingtonSeqNum ?? <span className="text-red-500">Missing</span>}
                  mono
                />
                <p className="text-xs text-slate-400 mt-0.5">00 = primary, 01/02… = dependents</p>
              </div>
              <div>
                <Field
                  label="Toothlens Member ID"
                  value={member.toothlensMemberId ?? <span className="text-amber-600">Not assigned</span>}
                  mono
                />
                <p className="text-xs text-slate-400 mt-0.5">UniqueID + SeqNum</p>
              </div>
              <Field label="Internal Member ID" value={member.memberId} mono />
              <Field label="Barcode" value={member.barcode} mono />
              <Field label="Subscriber ID" value={member.subscriberId} mono />
            </div>

            {/* Dependents with their own IDs */}
            {dependents.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Users size={11} /> Dependents &amp; Their IDs
                </p>
                <div className="space-y-3">
                  {dependents.map((d, i) => (
                    <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <Field label="Name" value={`${d.firstName} ${d.lastName}`} />
                      <Field label="Relationship" value={d.relationship} />
                      <Field label="Sequence #" value={d.seqNum ?? '—'} mono />
                      <Field
                        label="Toothlens ID"
                        value={d.toothlensMemberId ?? <span className="text-amber-600">—</span>}
                        mono
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Subscription & Plans */}
          <Card>
            <SectionHeader
              icon={CreditCard}
              title="Subscription & Plans"
              badge={subscription ? <StatusBadge status={subscription.status} /> : undefined}
            />
            {subscription ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <Field label="Cadence" value={subscription.cadence} />
                  <Field label="Payment Method" value={subscription.paymentMethod} />
                  <Field label="Amount" value={cents(subscription.totalCents)} />
                  <Field label="Period Start" value={fmt(subscription.currentPeriodStart)} />
                  <Field label="Period End" value={fmt(subscription.currentPeriodEnd)} />
                  <Field label="Activated" value={fmt(subscription.activatedAt)} />
                  <Field label="Stripe Customer ID" value={subscription.stripeCustomerId} mono />
                  <Field label="Stripe Subscription ID" value={subscription.stripeSubscriptionId} mono />
                </div>
                {entitlements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Entitlements</p>
                    <div className="space-y-2">
                      {entitlements.map((e) => (
                        <div key={String(e._id)} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{e.productName}</p>
                            <p className="text-xs text-slate-500">{e.productCategory} · via {e.createdVia.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="text-right space-y-0.5">
                            <StatusBadge status={e.status} />
                            <p className="text-xs text-slate-400">
                              {fmt(e.periodStart)} – {fmt(e.periodEnd)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 italic">No active subscription.</p>
            )}
          </Card>

          {/* Toothlens */}
          <Card>
            <SectionHeader icon={ScanLine} title="Toothlens (AI Dental Scans)" />
            {toothlens ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <Field label="Toothlens UID" value={toothlens.toothlensUid} mono />
                  <Field label="Company" value={toothlens.company} mono />
                  <Field label="Total Scans" value={toothlens.scanCount} />
                  <Field label="Last Scan" value={fmtFull(toothlens.lastScanAt)} />
                  <Field label="Account Created" value={fmt(toothlens.createdAt)} />
                </div>
                {toothlens.scans.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Scan History</p>
                    <div className="space-y-2">
                      {toothlens.scans.map((s) => (
                        <div key={s.sessionId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <p className="text-xs font-mono text-slate-700">{s.sessionId}</p>
                            <p className="text-xs text-slate-500">Started {fmtFull(s.startedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={s.status} />
                            {s.reportUrl && (
                              <a
                                href={s.reportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                Report <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 italic">No Toothlens account registered for this member.</p>
            )}
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Clerk Account */}
          <ClerkSection clerkUserId={member.customerId} />

          {/* Quick metadata */}
          <Card>
            <SectionHeader icon={Calendar} title="Timestamps" />
            <div className="space-y-3">
              <Field label="Member Since" value={fmt(member.createdAt)} />
              <Field label="Last Updated" value={fmt(member.updatedAt)} />
              <Field label="Last Activity" value={fmtFull(member.lastActivityAt)} />
              <Field label="Enrolled At" value={fmtFull(member.enrolledAt)} />
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <SectionHeader
              icon={FileText}
              title="Notes"
              badge={notes.length > 0 ? <span className="text-xs bg-slate-100 text-slate-600 px-1.5 rounded">{notes.length}</span> : undefined}
            />
            {notes.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {notes.map((n) => (
                  <div key={String(n._id)} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <p className="text-slate-800">{n.content}</p>
                    <p className="text-xs text-slate-400 mt-1">{n.createdByName} · {fmtFull(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No notes.</p>
            )}
          </Card>

          {/* Activity timeline */}
          <Card>
            <SectionHeader
              icon={Activity}
              title="Activity"
              badge={activities.length > 0 ? <span className="text-xs bg-slate-100 text-slate-600 px-1.5 rounded">{activities.length}</span> : undefined}
            />
            {activities.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activities.map((a) => (
                  <div key={String(a._id)} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-slate-900 font-medium leading-tight">{a.title}</p>
                      {a.description && <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{fmtFull(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No activity yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
