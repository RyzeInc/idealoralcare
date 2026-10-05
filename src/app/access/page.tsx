'use client';

import Link from 'next/link';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { api } from '@/convex/_generated/api';
import { PERMISSIONS, type Permission } from '@/convex/lib/access/catalog';

/** A signed-in person's own roles and the portals they can open. */
export default function MyAccessPage() {
  const { isSignedIn, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.access.me.getMyAccess, isAuthenticated ? {} : 'skip');
  const setActive = useMutation(api.access.me.setActivePartnerRole);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My access</h1>
        {!isLoaded || (isSignedIn && mine === undefined) ? (
          <p className="text-slate-500">Loading…</p>
        ) : !isSignedIn ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="mb-3 text-sm text-slate-600">Sign in to see your access.</p>
            <SignInButton mode="modal">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Sign in</button>
            </SignInButton>
          </div>
        ) : !mine ? null : mine.suspended ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Your access is suspended. Contact the person who invited you.</p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                { key: 'admin', label: 'Admin console', href: '/admin' },
                { key: 'partner', label: 'Partner portal', href: '/partner' },
                { key: 'employer', label: 'Eligibility uploads', href: '/employer/upload' },
              ].map((portal) => {
                const open = mine.portals[portal.key as keyof typeof mine.portals];
                return open ? (
                  <Link key={portal.key} href={portal.href} className="rounded-xl border border-blue-200 bg-white p-4 font-medium text-blue-700 hover:shadow-sm">
                    {portal.label} →
                  </Link>
                ) : (
                  <div key={portal.key} className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-400">
                    {portal.label}
                  </div>
                );
              })}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">Your roles</h2>
              {mine.roles.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  {mine.source === 'legacy' ? 'Your access predates roles; an administrator can import it.' : 'You have no active roles.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {mine.roles.map((role) => (
                    <li key={role.roleId} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-800">{role.description}</div>
                        <div className="text-xs text-slate-500">
                          {role.permissions.length ? role.permissions.map((p) => PERMISSIONS[p as Permission].label).join(', ') : 'No tools yet'}
                        </div>
                      </div>
                      {role.partnerPortal &&
                        (mine.activePartnerRoleId === role.roleId ? (
                          <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Partner portal shows this</span>
                        ) : (
                          <button className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => void setActive({ roleId: role.roleId })}>
                            Use in partner portal
                          </button>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
