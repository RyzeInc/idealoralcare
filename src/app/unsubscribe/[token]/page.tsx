'use client';

import { use, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

/**
 * PUBLIC unsubscribe page — outside /admin, no Clerk. The recipient of a CRM
 * email has no account here; the token in the URL (a campaign-recipient
 * nanoid, or a bare contact ID for a one-off send — see
 * convex/crm/suppressions.ts:resolveUnsubscribeTarget) is the only thing
 * that gates this.
 */
export default function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const context = useQuery(api.crm.suppressions.getUnsubscribeContext, { token });
  const unsubscribe = useMutation(api.crm.suppressions.unsubscribeByToken);
  const [domainWide, setDomainWide] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUnsubscribe = async () => {
    setSubmitting(true);
    try {
      await unsubscribe({ token, domainWide });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-w-md w-full p-8 text-center">
        {context === undefined && <p className="text-slate-400">Loading…</p>}

        {context === null && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Link not found</h1>
            <p className="text-sm text-slate-500">This unsubscribe link is invalid or has expired.</p>
          </>
        )}

        {context && (done || context.alreadyUnsubscribed) && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">You&apos;re unsubscribed</h1>
            <p className="text-sm text-slate-500">{context.maskedEmail} will not receive further emails from us.</p>
          </>
        )}

        {context && !done && !context.alreadyUnsubscribed && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Unsubscribe</h1>
            <p className="text-sm text-slate-500 mb-5">
              Stop emails to <span className="font-medium text-slate-700">{context.maskedEmail}</span>?
            </p>
            <label className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-5">
              <input type="checkbox" checked={domainWide} onChange={(e) => setDomainWide(e.target.checked)} className="rounded border-slate-300" />
              Also unsubscribe everyone at this company
            </label>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
              {submitting ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
