'use client';

import { useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery } from 'convex/react';
import { Phone, ChevronDown } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { formatPhone } from '@/lib/admin-format';
import { CallLogComposer } from './CallLogComposer';
import { useTwilioCall } from './useTwilioCall';
import { useToast } from '@/components/admin/ui';

interface DialButtonProps {
  contact: Doc<'crmContacts'>;
}

/**
 * "Mobile number top-right, dropdown → hit call → automatically opens a call
 * log to save on the timeline" — Jon's spec, verbatim.
 *
 * startCall fires BEFORE navigating to the dial URI (a tel:/rcmobile:/etc.
 * link can hand the browser to another app), and the composer opens
 * regardless of whether that navigation worked — see
 * convex/crm/activities.ts:startCall for why.
 */
export function DialButton({ contact }: DialButtonProps) {
  const toast = useToast();
  const settings = useQuery(api.crm.settings.getMySettings, {});
  const startCall = useMutation(api.crm.activities.startCall);
  const attachTwilioCallId = useMutation(api.crm.telephony.attachTwilioCallId);
  const [draftId, setDraftId] = useState<Id<'crmActivities'> | null>(null);
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const dialAnchorRef = useRef<HTMLAnchorElement>(null);
  const { placeCall } = useTwilioCall();

  const numbers = [
    { label: 'Mobile', value: contact.mobilePhone, e164: contact.mobilePhoneE164 },
    { label: 'Office', value: contact.officePhone ? `${contact.officePhone}${contact.officePhoneExt ? ` x${contact.officePhoneExt}` : ''}` : undefined, e164: contact.officePhoneE164 },
  ].filter((n) => n.value);

  const disabled = contact.callOptOut || contact.phoneStatus === 'dnc';
  const primary = numbers[0];

  const dial = async (number: { value?: string; e164?: string }) => {
    if (!number.value) return;
    // startCall fires before ANY dial mechanism below — a tel:/rcmobile:/
    // Twilio connection attempt can all fail or hand off elsewhere, and the
    // draft is what makes that safe to recover from. See activities.ts.
    const activityId = await startCall({ contactId: contact._id, numberDialed: number.e164 ?? number.value });
    setDraftId(activityId);
    setDialedNumber(number.value);

    if (settings?.dialProvider === 'twilio' && number.e164) {
      try {
        const call = await placeCall(number.e164);
        call.on('accept', () => {
          const callSid = call.parameters.CallSid;
          if (callSid) attachTwilioCallId({ activityId, externalCallId: callSid });
        });
        call.on('error', (err) => toast.error('Call failed', err.message));
      } catch (err) {
        toast.fromError(err, 'Could not place Twilio call');
      }
      return;
    }

    const template = settings && !('_isDefault' in settings && settings._isDefault) ? settings.dialUrlTemplate : '';
    if (template && number.e164) {
      const href = template.replace('{e164}', number.e164).replace('{digits}', number.e164.replace(/\D/g, ''));
      if (dialAnchorRef.current) {
        dialAnchorRef.current.href = href;
        // A programmatic click on a hidden <a>, not window.location.href — Safari
        // treats direct location assignment to a custom scheme as navigation
        // and can unload the page before the mutation above finishes.
        dialAnchorRef.current.click();
      }
    } else if (number.e164) {
      await navigator.clipboard?.writeText(number.e164).catch(() => {});
    }
  };

  if (numbers.length === 0) {
    return <span className="text-sm text-slate-400">No phone on file</span>;
  }

  return (
    <>
      <a ref={dialAnchorRef} href="#" className="hidden" aria-hidden />
      <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
        <button
          type="button"
          disabled={disabled}
          onClick={() => primary && dial(primary)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={disabled ? `On the do-not-call list${contact.phoneStatus === 'dnc' ? '' : ' (opted out)'}` : undefined}
        >
          <Phone size={14} />
          {primary?.value ? formatPhone(primary.value) : 'No number'}
        </button>
        {numbers.length > 1 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="px-2 border-l border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Choose a number to dial"
              >
                <ChevronDown size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={4} align="end" className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                {numbers.map((n) => (
                  <DropdownMenu.Item
                    key={n.label}
                    onSelect={() => dial(n)}
                    className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none flex justify-between"
                  >
                    <span>{n.label}</span>
                    <span className="text-slate-400 font-mono text-xs">{formatPhone(n.value)}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {draftId && (
        <CallLogComposer
          activityId={draftId}
          contactId={contact._id}
          numberDialed={dialedNumber}
          onClose={() => setDraftId(null)}
        />
      )}
    </>
  );
}
