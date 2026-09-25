'use client';

import { useConvexAuth } from 'convex/react';

/**
 * Holds off rendering an authenticated page tree until Convex actually holds
 * the Clerk JWT.
 *
 * Clerk's own signed-in state, and the server layout's `auth()` redirect, both
 * settle before the token has been exchanged with Convex. In that gap a
 * `useQuery` mounted by the page is sent over the socket with no identity, and
 * every query that calls `requireAuth` / `resolveViewerScope` throws
 * "Unauthorized: Authentication required". The subsequent authenticated re-run
 * succeeds, but React has already thrown the first result into the nearest
 * error boundary, which latches — so the page shows "Something went wrong"
 * while the data behind it is perfectly fine.
 *
 * Gating once at the layout gets every descendant's `useQuery` for free,
 * rather than repeating an `isAuthenticated ? {} : "skip"` guard on every call
 * site.
 */
export function ConvexAuthGate({
  children,
  label = 'Loading…',
}: {
  children: React.ReactNode;
  /** Shown while the token is in flight. */
  label?: string;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">{label}</div>;
  }
  if (!isAuthenticated) {
    // The server layout already redirected anyone who isn't signed in — this is
    // the moment between that decision and the client picking up the session,
    // not a real deny path.
    return null;
  }
  return <>{children}</>;
}
