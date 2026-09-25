'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs } from '@/components/admin/ui';
import {
  Terminal,
  Play,
  Loader,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  RefreshCw,
  Database,
  Zap,
  Users,
  IdCard,
  Fingerprint,
  UserX,
  GitMerge,
  Mail,
  Send,
  Eye,
  ShoppingBag,
} from 'lucide-react';

type ActionResult = { success: boolean; message: string; data?: unknown };

/**
 * Admin Dev Tools — Owner Only
 *
 * Provides quick-access buttons to run common Convex admin functions
 * (migrations, seeds, diagnostics) without needing the Convex Dashboard.
 */
export default function DevToolsPage() {
  const { user } = useUser();
  const clerkUserId = user?.id ?? '';

  // Check if current user is owner
  const adminProfile = useQuery(
    api.admin.adminUsers.getByClerkId,
    clerkUserId ? { clerkUserId } : 'skip'
  );
  const isOwner = adminProfile?.role === 'owner';

  // Actions & mutations
  const migrateAllToothlens = useAction(api.healthplans.toothlens.migrateAllUsers);
  const seedCatalog = useMutation(api.admin.devTools.seedCatalog);
  const seedShopCategories = useMutation(api.shop.seed.seedCategories);
  const linkAdminAsMember = useMutation(api.admin.devTools.linkAdminAsMember);
  const backfillSubscriberIds = useMutation(api.admin.devTools.backfillSubscriberIds);
  const backfillVendorIds = useMutation(api.admin.devTools.backfillVendorIds);
  const deduplicateMemberProfiles = useMutation(api.admin.devTools.deduplicateMemberProfiles);
  const backfillPipelineLinks = useMutation(api.partnerPipeline.backfillPipelineLinks);

  const [dedupeCustomerId, setDedupeCustomerId] = useState('');

  // State
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});

  // Used in the access-denied screen so non-owners know who to contact.
  const allAdmins = useQuery(api.admin.adminUsers.getAll) ?? [];
  const owners = allAdmins.filter((a: any) => a.role === 'owner');

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <ShieldAlert size={48} className="text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">Owner Access Required</h2>
        <p className="text-slate-500 text-sm max-w-md">
          Dev Tools is restricted to <strong>owner-level</strong> admins because it can run
          destructive migrations and seed data.
        </p>
        {owners.length > 0 ? (
          <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="font-semibold mb-1">Contact an owner to request access:</p>
            <ul className="space-y-0.5">
              {owners.map((o: any) => (
                <li key={o._id}>
                  {o.fullName ?? o.email ?? o.clerkUserId}
                  {o.email ? <span className="text-slate-500"> — {o.email}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No owners are configured. Contact your platform administrator.</p>
        )}
      </div>
    );
  }

  async function runAction(id: string, fn: () => Promise<unknown>) {
    setRunning(id);
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await fn();
      const msg =
        typeof result === 'object' && result !== null && 'message' in result
          ? (result as { message: string }).message
          : JSON.stringify(result, null, 2);
      setResults((prev) => ({
        ...prev,
        [id]: { success: true, message: msg, data: result },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResults((prev) => ({
        ...prev,
        [id]: { success: false, message },
      }));
    } finally {
      setRunning(null);
    }
  }

  const TOOLS: {
    id: string;
    label: string;
    description: string;
    icon: typeof Terminal;
    variant: 'default' | 'warning';
    fn: () => Promise<unknown>;
  }[] = [
    {
      id: 'migrate-toothlens',
      label: 'Migrate Toothlens Users',
      description:
        'Re-register all Toothlens users under the current RYZEHEALTH_COMPANY. Run after changing the company slug or access key.',
      icon: RefreshCw,
      variant: 'warning',
      fn: () => migrateAllToothlens({}),
    },
    {
      id: 'seed-catalog',
      label: 'Seed Catalog Products',
      description:
        'Populate the catalog with initial Ideal Oral Savings Plan products. Skips if products already exist.',
      icon: Database,
      variant: 'default',
      fn: () => seedCatalog({}),
    },
    {
      id: 'seed-shop-categories',
      label: 'Seed Shop Categories',
      description:
        'Create the seven preventative care shop categories (Daily Brushing, Interdental, Rinses, Tartar & Plaque, Dry Mouth, Kids, Whitening). All created hidden — add products in Shop, then make a category visible. Skips if any category exists.',
      icon: ShoppingBag,
      variant: 'default',
      fn: () => seedShopCategories({}),
    },
    {
      id: 'link-admin-member',
      label: 'Link My Admin as Member',
      description:
        'Create a member profile for your admin account so you can test member-facing flows (dashboard, scans, cards).',
      icon: Users,
      variant: 'default',
      fn: () => linkAdminAsMember({ clerkUserId }),
    },
    {
      id: 'backfill-subscriber-ids-dry',
      label: 'Backfill Subscriber IDs (Dry Run)',
      description:
        'Preview how many member records would receive a Subscriber ID populated from their organization code. No writes performed.',
      icon: IdCard,
      variant: 'default',
      fn: () => backfillSubscriberIds({ dryRun: true }),
    },
    {
      id: 'backfill-subscriber-ids',
      label: 'Backfill Subscriber IDs (Apply)',
      description:
        'Populate `subscriberId` on every member from their group\'s `organizationCode`. Skips members whose group has no organization code.',
      icon: IdCard,
      variant: 'warning',
      fn: () => backfillSubscriberIds({ dryRun: false }),
    },
    {
      id: 'backfill-vendor-ids-dry',
      label: 'Backfill Vendor IDs (Dry Run)',
      description:
        'Preview which members are missing Careington Unique IDs and Toothlens member IDs. Deterministic — re-runs produce the same IDs.',
      icon: Fingerprint,
      variant: 'default',
      fn: () => backfillVendorIds({ dryRun: true }),
    },
    {
      id: 'backfill-vendor-ids',
      label: 'Backfill Vendor IDs (Apply)',
      description:
        'Populate Careington Unique ID and Toothlens member ID on every member missing them; also fills dependent toothlensMemberId values.',
      icon: Fingerprint,
      variant: 'warning',
      fn: () => backfillVendorIds({ dryRun: false }),
    },
    {
      id: 'backfill-pipeline-links-dry',
      label: 'Backfill Partner Pipeline Links (Dry Run)',
      description:
        'Preview how many existing leads, applications, and signed Partner Kits would be cross-linked by email (lead ↔ application ↔ kit). No writes performed.',
      icon: GitMerge,
      variant: 'default',
      fn: () => backfillPipelineLinks({ dryRun: true }),
    },
    {
      id: 'backfill-pipeline-links',
      label: 'Backfill Partner Pipeline Links (Apply)',
      description:
        'Retroactively link historical Partner Kit Leads, Applications, and signed Kits by matching email — sets sourceLeadId, matched kit/application, and marks converted leads. Idempotent.',
      icon: GitMerge,
      variant: 'warning',
      fn: () => backfillPipelineLinks({ dryRun: false }),
    },
  ];

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Dev Tools' }]} />
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Dev Tools</h1>
        <p className="text-slate-500 text-sm">
          Owner-only utilities for managing migrations, seeding data, and running diagnostics.
        </p>
      </div>

      {/* Environment Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Zap size={14} />
          Environment
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-slate-400">Clerk User</span>
            <p className="font-mono text-xs text-slate-600 truncate">{clerkUserId}</p>
          </div>
          <div>
            <span className="text-slate-400">Role</span>
            <p className="font-medium text-amber-600">{adminProfile?.role}</p>
          </div>
          <div>
            <span className="text-slate-400">Admin Name</span>
            <p className="text-slate-600">{adminProfile?.name || '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Convex</span>
            <p className="font-mono text-xs text-slate-600 truncate">
              {process.env.NEXT_PUBLIC_CONVEX_URL || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isRunning = running === tool.id;
          const result = results[tool.id];

          return (
            <div
              key={tool.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 ${
                      tool.variant === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{tool.label}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{tool.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => runAction(tool.id, tool.fn)}
                  disabled={running !== null}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                    running !== null
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : tool.variant === 'warning'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Loader size={14} className="animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Run
                    </>
                  )}
                </button>
              </div>

              {/* Result */}
              {result && (
                <div
                  className={`mt-3 rounded-lg p-3 text-sm ${
                    result.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.success ? (
                      <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <pre className="whitespace-pre-wrap font-mono text-xs break-all">
                      {result.message}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deduplicate Member Profiles — requires a specific Clerk user ID */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg flex-shrink-0 bg-red-50 text-red-600">
            <UserX size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Deduplicate Member Profiles</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              When a user has multiple non-terminated memberProfile rows (e.g. a dev-tools test row alongside
              their real enrollment), their card shows inconsistent IDs. This tool keeps the profile linked to
              their active subscription and terminates the rest. Enter a Clerk User ID (starts with <code className="font-mono text-xs">user_</code>).
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user_2abc..."
            value={dedupeCustomerId}
            onChange={(e) => setDedupeCustomerId(e.target.value)}
          />
          <button
            onClick={() => runAction('dedupe-dry', () => deduplicateMemberProfiles({ customerId: dedupeCustomerId, dryRun: true }))}
            disabled={!dedupeCustomerId.trim() || running !== null}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running === 'dedupe-dry' ? <Loader size={14} className="animate-spin inline mr-1" /> : null}
            Dry Run
          </button>
          <button
            onClick={() => runAction('dedupe-apply', () => deduplicateMemberProfiles({ customerId: dedupeCustomerId, dryRun: false }))}
            disabled={!dedupeCustomerId.trim() || running !== null}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running === 'dedupe-apply' ? <Loader size={14} className="animate-spin inline mr-1" /> : null}
            Apply
          </button>
        </div>
        {(results['dedupe-dry'] || results['dedupe-apply']) && (() => {
          const result = results['dedupe-apply'] ?? results['dedupe-dry'];
          return (
            <div className={`mt-3 rounded-lg p-3 text-sm ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-2">
                {result.success
                  ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  : <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />}
                <pre className="whitespace-pre-wrap font-mono text-xs break-all">{result.message}</pre>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Partner Application invite — preview + test send */}
      <InviteEmailTester defaultEmail={adminProfile?.email ?? ''} />
    </div>
  );
}

/**
 * Preview the Partner Application invite email and send a test copy.
 * The preview renders the exact HTML recipients receive (the "debug view").
 */
function InviteEmailTester({ defaultEmail }: { defaultEmail: string }) {
  // `to` defaults to the admin's email once it loads, but the admin can override
  // it. Deriving from an override (rather than syncing via an effect) avoids
  // cascading re-renders when defaultEmail arrives asynchronously.
  const [toOverride, setToOverride] = useState<string | null>(null);
  const to = toOverride ?? defaultEmail;
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    error?: string;
    to: string;
    subject: string;
    html: string;
    baseUrl: string;
  } | null>(null);

  const sendTest = useAction(api.partnerPipeline.sendTestApplicationInvite);
  const preview = useQuery(api.partnerPipeline.previewApplicationInviteEmail, {
    name: name || undefined,
    business: business || undefined,
  });

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await sendTest({
        to,
        name: name || undefined,
        business: business || undefined,
      });
      setSendResult(res);
    } catch (err) {
      setSendResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        to,
        subject: '',
        html: preview?.html ?? '',
        baseUrl: '',
      });
    } finally {
      setSending(false);
    }
  }

  const renderedHtml = sendResult?.html || preview?.html || '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg flex-shrink-0 bg-blue-50 text-blue-600">
          <Mail size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Partner Application Invite — Preview &amp; Test Send</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Preview the exact invite email and send a test copy to any address. The email is also recorded in the
            audit log (action <code className="font-mono text-xs">partner_lead.invite_test</code>) with its full HTML.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <input
          type="email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Send test to…"
          value={to}
          onChange={(e) => setToOverride(e.target.value)}
        />
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Recipient name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Business (optional)"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5"
        >
          <Eye size={14} /> {showPreview ? 'Hide' : 'Show'} preview
        </button>
        <button
          onClick={handleSend}
          disabled={!to.trim() || sending}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          Send test
        </button>
      </div>

      {sendResult && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            sendResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {sendResult.ok ? (
              <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="font-mono text-xs break-all">
              {sendResult.ok
                ? `Sent to ${sendResult.to} via ${sendResult.baseUrl}`
                : `Delivery failed: ${sendResult.error ?? 'unknown error'}`}
              {sendResult.baseUrl && !sendResult.ok ? ` (attempted via Resend from ${sendResult.baseUrl})` : ''}
            </div>
          </div>
        </div>
      )}

      {(showPreview || sendResult) && renderedHtml && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Rendered email</p>
          <iframe
            title="invite-email-preview"
            srcDoc={renderedHtml}
            className="w-full h-80 border border-slate-200 rounded-lg bg-white"
          />
        </div>
      )}
    </div>
  );
}
