'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CheckCircle, AlertCircle, Loader2, HeartPulse } from 'lucide-react';

// This page uses useSearchParams() which requires runtime data from query strings
// We must force dynamic rendering to prevent static prerendering errors
export const dynamic = 'force-dynamic';

type ClaimState = 'loading' | 'ready' | 'claiming' | 'success' | 'error' | 'invalid-token';

export default function ClaimInvitePage() {
  return (
    <Suspense fallback={<PageShell><div style={{ textAlign: 'center' }}><Loader2 size={40} color="#0066CC" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} /><p style={{ color: '#64748b' }}>Loading…</p></div></PageShell>}>
      <ClaimInviteContent />
    </Suspense>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '3rem 2.5rem', maxWidth: '480px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

// Inner component that uses useSearchParams - wrapped in Suspense to handle SSR
function ClaimInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const token = searchParams.get('token') ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convexApi = api as any;
  const invite = useQuery(
    convexApi.enrollment.dependents.getProfileByInviteToken,
    token ? { token } : 'skip'
  ) as any;
  const claimProfile = useMutation(convexApi.enrollment.dependents.claimDependentProfile);

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Resolve state once all async data is ready
  useEffect(() => {
    if (!isLoaded) return;

    if (!token) {
      setClaimState('invalid-token');
      return;
    }

    // Still waiting for invite lookup
    if (invite === undefined) return;

    if (invite === null) {
      setClaimState('invalid-token');
      return;
    }

    if (invite.inviteStatus === 'claimed') {
      setClaimState('success');
      return;
    }

    setClaimState('ready');
  }, [isLoaded, token, invite]);

  const handleClaim = async () => {
    if (!isSignedIn) return;
    setClaimState('claiming');
    try {
      await claimProfile({ inviteToken: token });
      setClaimState('success');
      // Redirect to dashboard after a short delay
      setTimeout(() => router.push('/health/dashboard'), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to claim invite. Please try again.');
      setClaimState('error');
    }
  };

  // Loading / ready / claiming states
  return (
    <PageShell>
      {(claimState === 'loading' || invite === undefined) ? (
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} color="#0066CC" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#64748b' }}>Loading your invite…</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <HeartPulse size={40} color="#0066CC" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
            Accept Family Invite
          </h1>
          <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>
            <strong>{invite?.primaryMemberName}</strong> has invited you to join their plan as a family member.
          </p>
          <button
            onClick={handleClaim}
            disabled={claimState === 'claiming'}
            style={{ padding: '0.75rem 2rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: claimState === 'claiming' ? 'not-allowed' : 'pointer', opacity: claimState === 'claiming' ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {claimState === 'claiming' && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {claimState === 'claiming' ? 'Claiming…' : 'Accept & Get Access'}
          </button>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '1.25rem', marginBottom: 0 }}>
            By accepting, you&apos;ll gain access to the plan benefits as a dependent member. This won&apos;t create a separate billing account.
          </p>
        </div>
      )}
    </PageShell>
  );
}

// Outer page component with Suspense boundary
export default function ClaimInvitePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={40} color="#0066CC" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b' }}>Loading…</p>
          </div>
        </PageShell>
      }
    >
      <ClaimInviteContent />
    </Suspense>
  );
}
