'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs } from '@/components/admin/ui';
import { ContactHeader } from '@/components/admin/crm/ContactHeader';
import { DetailsColumn } from '@/components/admin/crm/detail/DetailsColumn';
import { TimelineColumn } from '@/components/admin/crm/detail/TimelineColumn';
import { TagsColumn } from '@/components/admin/crm/detail/TagsColumn';
import { CallDraftRecovery } from '@/components/admin/crm/CallDraftRecovery';

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contactId = id as Id<'crmContacts'>;
  const data = useQuery(api.crm.contacts.getContactDetail, { contactId });

  if (data === undefined) {
    return <div className="py-16 text-center text-slate-400">Loading…</div>;
  }
  if (data === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Contact not found.</p>
        <Link href="/admin/crm/contacts" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to contacts</Link>
      </div>
    );
  }

  const { contact, company } = data;

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Contacts', href: '/admin/crm/contacts' }, { label: contact.fullName || 'Contact' }]} />
      <CallDraftRecovery contactId={contact._id} />
      <ContactHeader contact={contact} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3 lg:sticky lg:top-6 space-y-4">
          <DetailsColumn contact={contact} company={company} />
        </div>
        <div className="lg:col-span-6 space-y-4">
          <TimelineColumn contactId={contact._id} />
        </div>
        <div className="lg:col-span-3 lg:sticky lg:top-6 space-y-4">
          <TagsColumn contact={contact} />
        </div>
      </div>
    </div>
  );
}
