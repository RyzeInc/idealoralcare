'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useAction, useConvexAuth, useQuery } from 'convex/react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '@/convex/_generated/api';

/**
 * Accept an access invitation. The person signs in (or creates an account)
 * with the invited email, then accepts explicitly; the server checks the
 * account owns that verified email before turning any role on.
 */
export default function ClaimAccessPage() {
  return (
    <Suspense fallback={<Shell><p className="text-slate-500">Loading…</p></Shell>}>
      <Claim />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
    </main>
  );
}

function Claim() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const invitation = useQuery(api.access.invites.getInvitation, token ? { token } : 'skip');
  const claim = useAction(api.access.invites.claimInvitation);
  const [state, setState] = useState<'idle' | 'claiming' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const here = `/access/claim?token=${encodeURIComponent(token)}`;

  if (!token || invitation?.state === 'invalid') {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">This link isn&apos;t valid</h1>
        <p className="mt-2 text-sm text-slate-600">It may have been used already or replaced by a newer invitation. Ask the person who invited you to send a new link.</p>
      </Shell>
    );
  }
  if (invitation?.state === 'expired') {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">This invitation expired</h1>
        <p className="mt-2 text-sm text-slate-600">Ask the person who invited you to send a new link.</p>
      </Shell>
    );
  }
  if (invitation === undefined || !isLoaded) {
    return (
      <Shell>
        <p className="text-slate-500">Loading…</p>
      </Shell>
    );
  }

  const accept = async () => {
    setState('claiming');
    setError(null);
    try {
      const result = await claim({ token });
      setWarnings(result.warnings);
      setState('done');
      setTimeout(() => router.push(result.home), result.warnings.length ? 4000 : 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(raw.match(/Uncaught Error: ([\s\S]*?)(?:\n|$)/)?.[1] ?? raw);
      setState('idle');
    }
  };

  return (
    <Shell>
      <ShieldCheck className="mb-3 text-blue-600" size={28} />
      <h1 className="text-xl font-bold text-slate-900">You&apos;re invited, {invitation.name.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-slate-600">This invitation is for {invitation.email} and includes:</p>
      <ul className="mt-3 space-y-1">
        {invitation.roles.map((role) => (
          <li key={role} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {role}
          </li>
        ))}
      </ul>

      {state === 'done' ? (
        <div className="mt-6 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={18} /> Accepted. Taking you there…
          </p>
          {warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              {w}
            </p>
          ))}
        </div>
      ) : isSignedIn ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span>.
          </p>
          <button
            onClick={accept}
            disabled={state === 'claiming' || !isAuthenticated}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {state === 'claiming' ? 'Accepting…' : 'Accept invitation'}
          </button>
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <p className="text-xs text-slate-500">
            Wrong account? Sign out and sign in with the invited email, or{' '}
            <Link className="underline" href={`/health/sign-up?redirect_url=${encodeURIComponent(here)}`}>
              create a new account
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-slate-600">Sign in or create an account using the invited email address, then come back here to accept.</p>
          <Link
            href={`/health/sign-in?redirect_url=${encodeURIComponent(here)}`}
            className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
          <Link
            href={`/health/sign-up?redirect_url=${encodeURIComponent(here)}`}
            className="block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Create an account
          </Link>
        </div>
      )}
    </Shell>
  );
}
