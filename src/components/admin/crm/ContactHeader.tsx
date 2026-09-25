'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, ArrowLeft, Archive, ArchiveRestore } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { StatusBadge, useToast } from '@/components/admin/ui';
import { DialButton } from './DialButton';
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS, CONTACT_STATUS_TONE } from './constants';

/** The current spine only — a legacy value still renders (its label is in
 * CONTACT_STATUS_LABELS) but must never be offered as a new choice. */
const STATUS_OPTIONS: readonly string[] = CONTACT_STATUSES;

export function ContactHeader({ contact }: { contact: Doc<'crmContacts'> }) {
  const router = useRouter();
  const toast = useToast();
  const setStatus = useMutation(api.crm.contacts.setStatus);
  const archiveContacts = useMutation(api.crm.contacts.archiveContacts);
  const markConverted = useMutation(api.crm.contacts.markConverted);

  const handleArchive = async () => {
    try {
      await archiveContacts({ contactIds: [contact._id], archived: !contact.isArchived });
      toast.success(contact.isArchived ? 'Contact restored' : 'Contact archived');
    } catch (err) {
      toast.fromError(err, 'Could not update contact');
    }
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => router.push('/admin/crm/contacts')}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2"
        >
          <ArrowLeft size={12} /> Back to contacts
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900 truncate">{contact.fullName || '(No name)'}</h1>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button">
                <StatusBadge status={contact.status} tone={CONTACT_STATUS_TONE[contact.status]} label={CONTACT_STATUS_LABELS[contact.status]} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={4} className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenu.Item
                    key={s}
                    onSelect={() => setStatus({ contactId: contact._id, status: s as Doc<'crmContacts'>['status'] })}
                    className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none"
                  >
                    {CONTACT_STATUS_LABELS[s]}
                  </DropdownMenu.Item>
                ))}
                {!contact.convertedAt && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <DropdownMenu.Item
                      onSelect={() => markConverted({ contactId: contact._id })}
                      className="px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 cursor-pointer outline-none"
                    >
                      Mark as partner
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          {[contact.jobTitle, contact.companyName].filter(Boolean).join(' at ') || 'No title or company on file'}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <DialButton contact={contact} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" aria-label="More actions">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={4} align="end" className="z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
              <DropdownMenu.Item
                onSelect={handleArchive}
                className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none flex items-center gap-2"
              >
                {contact.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {contact.isArchived ? 'Restore' : 'Archive'}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
