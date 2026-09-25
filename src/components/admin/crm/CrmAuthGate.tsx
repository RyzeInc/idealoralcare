'use client';

import { ConvexAuthGate } from '@/components/auth/ConvexAuthGate';

/**
 * CRM's name for the shared Convex auth gate — see
 * `components/auth/ConvexAuthGate.tsx` for why the wait is necessary. Kept as
 * its own export because the CRM layout has referred to it by this name since
 * before the gate covered the rest of /admin.
 */
export function CrmAuthGate({ children }: { children: React.ReactNode }) {
  return <ConvexAuthGate>{children}</ConvexAuthGate>;
}
