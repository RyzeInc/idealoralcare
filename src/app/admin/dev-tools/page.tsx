'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
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
  const linkAdminAsMember = useMutation(api.admin.devTools.linkAdminAsMember);

  // State
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert size={48} className="text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">Owner Access Required</h2>
        <p className="text-slate-500 text-sm">This page is restricted to owner-level admins.</p>
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
        'Populate the catalog with initial Ideal Oral Health Plan products. Skips if products already exist.',
      icon: Database,
      variant: 'default',
      fn: () => seedCatalog({}),
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
  ];

  return (
    <div className="space-y-8">
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
    </div>
  );
}
