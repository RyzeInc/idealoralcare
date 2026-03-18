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
    if (!token) { setClaimState('invalid-token'); return; }
    if (invite === undefined) return;
    if (invite === null) { setClaimState('invalid-token'); return; }
    if (invite.inviteStatus === 'claimed') { setClaimState('success'); return; }
    setClaimState('ready');
  }, [isLoaded, token, invite]);

  // Auto-claim as soon as the user is signed in and the invite is ready.
  // This fires after redirect back from sign-up/sign-in.
  useEffect(() => {
    if (claimState === 'ready' && isSignedIn) {
      handleClaim();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimState, isSignedIn]);

  const handleClaim = async () => {
    if (!isSignedIn) {
      // New dependent: send to sign-up so they create an account, then return here
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/health/sign-up?redirect_url=${returnUrl}`);
      return;
    }
    if (claimState === 'claiming' || claimState === 'success') return;
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
      ) : claimState === 'success' ? (
        <div style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>You&apos;re In!</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Your account is now linked to the plan. Redirecting to your dashboard…</p>
        </div>
      ) : claimState === 'invalid-token' ? (
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={40} color="#dc2626" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Invalid Invite</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>This invite link is invalid or has already been used.</p>
          <Link href="/health/sign-in" style={{ color: '#0066CC', fontSize: '0.9rem' }}>Sign in to your account</Link>
        </div>
      ) : claimState === 'error' ? (
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={40} color="#dc2626" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{errorMessage}</p>
          <button onClick={handleClaim} style={{ padding: '0.625rem 1.5rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Try Again</button>
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
          {claimState === 'claiming' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748b', margin: '1.5rem 0' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Activating your access…
            </div>
          ) : (
            <button
              onClick={handleClaim}
              style={{ padding: '0.75rem 2rem', background: '#0066CC', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isSignedIn ? 'Accept & Get Access' : 'Create Account & Accept'}
            </button>
          )}
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
