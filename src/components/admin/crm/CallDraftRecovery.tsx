'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { CallLogComposer } from './CallLogComposer';

/**
 * Reopens an abandoned call-log draft on mount. This is the recovery half of
 * DialButton's "startCall fires before the dial navigation" design — a
 * tel:/rcmobile:/etc. URI can hand the browser to another app before a rep
 * gets back to close out the composer, so this is what stops those notes
 * from being lost for good.
 */
export function CallDraftRecovery({ contactId }: { contactId: Id<'crmContacts'> }) {
  const draft = useQuery(api.crm.activities.getOpenCallDraft, { contactId });
  if (!draft) return null;
  return (
    <CallLogComposer
      activityId={draft._id}
      contactId={contactId}
      numberDialed={draft.callNumberDialed ?? ''}
      onClose={() => {}}
    />
  );
}
