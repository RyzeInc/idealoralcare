'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Mail, Linkedin, Building2, MapPin, Info, Copy, Check, AlertTriangle, Send, StickyNote, Network } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { formatPhone, formatDate } from '@/lib/admin-format';
import { Card, SectionHeader, Field } from '../primitives';
import { CompanyPicker } from '../CompanyPicker';
import { OwnerPicker } from '../OwnerPicker';
import { ContactLinkedRecordsCard } from '../LinkedRecordsCard';
import { InlineSelect } from '../InlineCells';
import {
  STAGE_LABELS,
  DRIP_STATUSES, DRIP_STATUS_LABELS, DRIP_STATUS_TONE, dripLabel,
  EMAIL_STATUSES, EMAIL_STATUS_LABELS, EMAIL_STATUS_TONE,
  NEXT_ACTIONS, NEXT_ACTION_LABELS,
} from '../constants';
import { useToast } from '@/components/admin/ui';

function CopyableField({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <Field label={label} />;
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-slate-800 font-mono">{value}</p>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-slate-300 hover:text-slate-500"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

/**
 * Which campaigns this contact is on, and where in each. A contact can be on
 * several at once, so this lists every enrollment rather than the single
 * primary one the list column shows.
 */
function CampaignsCard({ contact }: { contact: Doc<'crmContacts'> }) {
  const toast = useToast();
  const enrollments = useQuery(api.crm.dripCampaigns.listEnrollmentsForContact, { contactId: contact._id });
  const campaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const enrollContacts = useMutation(api.crm.dripCampaigns.enrollContacts);
  const setPhase = useMutation(api.crm.dripCampaigns.setPhase);
  const removeFromCampaign = useMutation(api.crm.dripCampaigns.removeFromCampaign);

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.campaign._id));
  const available = (campaigns ?? []).filter((c) => !enrolledIds.has(c._id));

  return (
    <Card>
      <SectionHeader icon={Network} title="Campaigns" />
      <div className="space-y-3">
        {enrollments?.length === 0 && <p className="text-xs text-slate-400">Not on any campaign.</p>}

        {(enrollments ?? []).map(({ enrollment, campaign }) => (
          <div key={enrollment._id} className="border border-slate-100 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{campaign.name}</p>
                <p className="text-[11px] text-slate-400">
                  {enrollment.status} · added {formatDate(enrollment.enrolledAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await removeFromCampaign({ contactIds: [contact._id], dripCampaignId: campaign._id });
                  } catch (err) {
                    toast.fromError(err, 'Could not remove from the campaign');
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-red-600 flex-shrink-0"
              >
                Remove
              </button>
            </div>
            <div className="mt-2">
              <InlineSelect
                ariaLabel={`Phase on ${campaign.name}`}
                value={String(enrollment.phase)}
                options={Array.from({ length: campaign.phaseCount + 1 }, (_, phase) => ({
                  value: String(phase),
                  label: phase === 0 ? 'Not sent yet' : (campaign.phaseLabels?.[phase - 1] ?? `Phase ${phase}`),
                }))}
                tone={enrollment.phase === 0 ? 'neutral' : enrollment.phase >= campaign.phaseCount ? 'success' : 'info'}
                onChange={(next) => setPhase({ contactIds: [contact._id], dripCampaignId: campaign._id, phase: Number(next) })}
              />
            </div>
          </div>
        ))}

        {available.length > 0 && (
          <select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return;
              try {
                await enrollContacts({
                  contactIds: [contact._id],
                  dripCampaignId: e.target.value as Id<'crmDripCampaigns'>,
                });
              } catch (err) {
                toast.fromError(err, 'Could not add to the campaign');
              }
            }}
            className="w-full text-xs border border-dashed border-slate-300 rounded-lg px-2 py-1.5 text-slate-500"
          >
            <option value="">+ Add to a campaign…</option>
            {available.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>
    </Card>
  );
}

/**
 * Where the contact sits in the email sequence, and whether we may still mail
 * them. The same three controls the list offers inline — a rep who drilled
 * into a record shouldn't have to go back to the table to change them.
 */
function OutreachCard({ contact }: { contact: Doc<'crmContacts'> }) {
  const setDripProgress = useMutation(api.crm.contacts.setDripProgress);
  const setEmailStatus = useMutation(api.crm.contacts.setEmailStatus);
  const setNextAction = useMutation(api.crm.contacts.setNextAction);

  return (
    <Card>
      <SectionHeader icon={Send} title="Outreach" />
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">Next action</p>
          <InlineSelect
            ariaLabel="Next action"
            value={contact.nextAction}
            options={NEXT_ACTIONS.map((a) => ({ value: a, label: NEXT_ACTION_LABELS[a] }))}
            emptyLabel="Nothing scheduled"
            tone={contact.nextAction ? 'info' : 'neutral'}
            onChange={(next) => setNextAction({
              contactId: contact._id,
              nextAction: (next || undefined) as Doc<'crmContacts'>['nextAction'],
            })}
          />
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">Drip progress</p>
          <div className="flex items-center gap-2 flex-wrap">
            <InlineSelect
              ariaLabel="Drip progress"
              value={contact.dripStatus ?? 'not_started'}
              options={DRIP_STATUSES.map((s) => ({ value: s, label: DRIP_STATUS_LABELS[s] }))}
              tone={DRIP_STATUS_TONE[contact.dripStatus ?? 'not_started']}
              onChange={(next) => setDripProgress({
                contactId: contact._id,
                dripStatus: next as NonNullable<Doc<'crmContacts'>['dripStatus']>,
              })}
            />
            <span className="text-xs text-slate-500">{dripLabel(contact.dripStatus, contact.dripStep)}</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">Email status</p>
          <InlineSelect
            ariaLabel="Email status"
            value={contact.emailStatus}
            options={EMAIL_STATUSES.map((s) => ({ value: s, label: EMAIL_STATUS_LABELS[s] }))}
            tone={EMAIL_STATUS_TONE[contact.emailStatus]}
            onChange={(next) => setEmailStatus({
              contactId: contact._id,
              emailStatus: next as Doc<'crmContacts'>['emailStatus'],
            })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <Field label="Last email sent" value={contact.lastEmailSentAt ? formatDate(contact.lastEmailSentAt) : undefined} />
          <Field label="Next email" value={contact.nextEmailScheduledAt ? formatDate(contact.nextEmailScheduledAt) : undefined} />
          <Field label="Last opened" value={contact.lastEmailOpenedAt ? formatDate(contact.lastEmailOpenedAt) : undefined} />
          <Field label="Last clicked" value={contact.lastLinkClickedAt ? formatDate(contact.lastLinkClickedAt) : undefined} />
          <Field
            label="Replied"
            value={contact.hasReplied ? (contact.repliedAt ? formatDate(contact.repliedAt) : 'Yes') : 'No'}
          />
          <Field label="Emails sent" value={String(contact.emailsSentCount)} />
        </div>
      </div>
    </Card>
  );
}

/** Saves on blur rather than per keystroke — a mutation per character would be absurd, and a Save button for one textarea is friction nobody needs. */
function NotesCard({ contact }: { contact: Doc<'crmContacts'> }) {
  const toast = useToast();
  const setNotes = useMutation(api.crm.contacts.setNotes);
  const [draft, setDraft] = useState(contact.notes ?? '');

  const handleBlur = async () => {
    if (draft === (contact.notes ?? '')) return;
    try {
      await setNotes({ contactId: contact._id, notes: draft });
    } catch (err) {
      toast.fromError(err, 'Could not save notes');
    }
  };

  return (
    <Card>
      <SectionHeader icon={StickyNote} title="Notes" />
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="Quick notes on this contact…"
        className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400 resize-y"
      />
      <p className="text-[10px] text-slate-400 mt-1">Saved when you click away. Use the timeline for anything the team needs dated.</p>
    </Card>
  );
}

export function DetailsColumn({ contact, company }: { contact: Doc<'crmContacts'>; company: Doc<'crmCompanies'> | null }) {
  const updateContact = useMutation(api.crm.contacts.updateContact);
  const setOwner = useMutation(api.crm.contacts.setOwner);
  const duplicates = useQuery(api.crm.contacts.possibleDuplicates, { contactId: contact._id });

  const handleCompanyChange = async (selected: Doc<'crmCompanies'> | null) => {
    await updateContact({
      contactId: contact._id,
      fields: {
        firstName: contact.firstName, lastName: contact.lastName, jobTitle: contact.jobTitle,
        companyId: selected?._id, companyName: selected?.name ?? contact.companyName,
        email: contact.email, secondaryEmail: contact.secondaryEmail, mobilePhone: contact.mobilePhone,
        officePhone: contact.officePhone, officePhoneExt: contact.officePhoneExt, linkedinUrl: contact.linkedinUrl,
        city: contact.city, state: contact.state, postalCode: contact.postalCode,
      },
    });
  };

  return (
    <div className="space-y-4">
      {duplicates && duplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {duplicates.length} possible duplicate{duplicates.length === 1 ? '' : 's'} found by email, phone, or name+company.
          </p>
        </div>
      )}

      <Card>
        <SectionHeader icon={Mail} title="Contact" />
        <div className="space-y-3">
          <CopyableField label="Email" value={contact.email} />
          <CopyableField label="Mobile" value={contact.mobilePhone ? formatPhone(contact.mobilePhone) : undefined} />
          <CopyableField
            label="Office"
            value={contact.officePhone ? `${formatPhone(contact.officePhone)}${contact.officePhoneExt ? ` x${contact.officePhoneExt}` : ''}` : undefined}
          />
          {contact.linkedinUrl && (
            <div>
              <p className="text-xs text-slate-400">LinkedIn</p>
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Linkedin size={12} /> View profile
              </a>
            </div>
          )}
        </div>
      </Card>

      <CampaignsCard contact={contact} />

      <OutreachCard contact={contact} />

      <Card>
        <SectionHeader icon={Building2} title="Company" />
        <div className="space-y-3">
          <CompanyPicker value={company} onSelect={handleCompanyChange} />
          {!company && contact.companyName && <Field label="Company (unlinked)" value={contact.companyName} />}
          {company && (
            <Field label="Stage" value={STAGE_LABELS[company.stage] ?? company.stage} />
          )}
          <div>
            <p className="text-xs text-slate-400 mb-1">Owner</p>
            <OwnerPicker
              value={contact.ownerClerkUserId ?? null}
              valueName={contact.lastContactedByName}
              onSelect={(user) => user && setOwner({ contactId: contact._id, ownerClerkUserId: user.id })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={MapPin} title="Location" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={contact.city} />
          <Field label="State" value={contact.state} mono />
        </div>
      </Card>

      <NotesCard contact={contact} />

      <Card>
        <SectionHeader icon={Info} title="Provenance" />
        <div className="space-y-3">
          <Field label="Source" value={contact.sourceDetail ? `${contact.source} (${contact.sourceDetail})` : contact.source} />
          <Field label="Created" value={formatDate(contact.createdAt)} />
        </div>
      </Card>

      {(contact.linkedMemberProfileId || contact.linkedPartnerLeaderId || contact.linkedPartnerId) && (
        <ContactLinkedRecordsCard contactId={contact._id} />
      )}
    </div>
  );
}
