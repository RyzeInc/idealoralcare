'use client';

/**
 * BOOTSTRAP PAGE — One-time admin setup
 * Visit http://localhost:3000/bootstrap while signed in.
 * Creates admin access + subscription so you can access both dashboards.
 */

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function BootstrapPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const bootstrap = useMutation(api.admin.grantFreeAccess.bootstrapFirstAdmin);
  const [status, setStatus] = useState<null | { success: boolean; message: string; details?: any }>(null);
  const [running, setRunning] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Sign In Required</h1>
          <p className="text-slate-600">You need to sign in first before bootstrapping admin access.</p>
          <Link
            href="/health/sign-in?redirect_url=/bootstrap"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleBootstrap = async () => {
    setRunning(true);
    setStatus(null);
    try {
      const result = await bootstrap({ durationDays: 365 });
      setStatus({ success: true, message: result.message, details: result });
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : "Failed to bootstrap",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bootstrap Admin Access</h1>
          <p className="text-slate-500 mt-1">One-time setup to grant yourself admin + dashboard access</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 space-y-1 text-sm">
          <p><span className="font-medium text-slate-700">Signed in as:</span> {user?.primaryEmailAddress?.emailAddress}</p>
          <p><span className="font-medium text-slate-700">Clerk ID:</span> {user?.id}</p>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <p>This will:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Add you as an <strong>owner-level admin</strong></li>
            <li>Grant <strong>full subscription access</strong> to all products (365 days)</li>
            <li>Unlock both <code>/admin</code> and <code>/health/dashboard</code></li>
          </ul>
        </div>

        <button
          onClick={handleBootstrap}
          disabled={running}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {running ? "Setting up..." : "Grant Admin + Full Access"}
        </button>

        {status && (
          <div className={`rounded-lg p-4 text-sm ${status.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <p className="font-medium">{status.message}</p>
            {status.success && (
              <div className="mt-4 flex gap-3">
                <Link href="/admin" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                  Go to Admin →
                </Link>
                <Link href="/health/dashboard" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
                  Go to Dashboard →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
