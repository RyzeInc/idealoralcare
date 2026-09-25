'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import * as Popover from '@radix-ui/react-popover';
import { X, Tag as TagIcon, Copy, Check } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useToast } from '@/components/admin/ui';
import {
  CONTACT_STATUSES, CONTACT_STATUS_LABELS,
  DRIP_STATUSES, DRIP_STATUS_LABELS,
  EMAIL_STATUSES, EMAIL_STATUS_LABELS,
  NEXT_ACTIONS, NEXT_ACTION_LABELS,
  tagColorClass,
} from './constants';

/**
 * Flat tag list, not TagPicker's per-category "already applied" toggle UI —
 * a mixed selection of contacts doesn't have one shared "applied" state per
 * tag, so this is apply-only against tags.bulkApplyTags.
 */
function BulkTagPopover({ contactIds }: { contactIds: Id<'crmContacts'>[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const bulkApplyTags = useMutation(api.crm.tags.bulkApplyTags);

  const handleApply = async (tagId: Id<'crmTags'>) => {
    try {
      await bulkApplyTags({ contactIds, tagIds: [tagId] });
      toast.success(`Tagged ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'}`);
      setOpen(false);
    } catch (err) {
      toast.fromError(err, 'Bulk tagging failed');
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium">
          <TagIcon size={13} /> Tag
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className="z-50 w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-3 space-y-3">
          {(tree ?? []).map(({ category, tags }) => (
            <div key={category._id}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{category.name}</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => handleApply(tag._id)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${tagColorClass(tag.color ?? category.color)} hover:brightness-95`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(tree ?? []).length === 0 && <p className="text-xs text-slate-400">No tags yet.</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BulkSelect({ label, options, onPick }: {
  label: string;
  options: readonly { value: string; label: string }[];
  onPick: (value: string) => Promise<void>;
}) {
  const [pending, setPending] = useState('');
  return (
    <select
      value={pending}
      onChange={async (e) => {
        const next = e.target.value;
        if (!next) return;
        setPending(next);
        await onPick(next);
        setPending('');
      }}
      className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white text-blue-800"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

/**
 * Takes the selected contact DOCUMENTS, not just their ids: "copy the email
 * addresses of everyone I just selected" is the single most-requested thing
 * this bar does, and re-querying for addresses the list already has in hand
 * would be a round trip for nothing.
 */
export function BulkActionBar({ selected, onClear, phaseCampaignId }: {
  selected: Doc<'crmContacts'>[];
  onClear: () => void;
  /**
   * The campaign the list is currently filtered to, if any. Phase and
   * remove-from-campaign only appear when it is set: a phase number is
   * meaningless across a mixed selection drawn from three different campaigns,
   * so the filter is what gives those actions a subject.
   */
  phaseCampaignId?: Id<'crmDripCampaigns'>;
}) {
  const toast = useToast();
  const archiveContacts = useMutation(api.crm.contacts.archiveContacts);
  const bulkUpdate = useMutation(api.crm.contacts.bulkUpdate);
  const dripCampaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const enrollContacts = useMutation(api.crm.dripCampaigns.enrollContacts);
  const moveToCampaign = useMutation(api.crm.dripCampaigns.moveToCampaign);
  const setPhase = useMutation(api.crm.dripCampaigns.setPhase);
  const removeFromCampaign = useMutation(api.crm.dripCampaigns.removeFromCampaign);
  const [copied, setCopied] = useState(false);

  if (selected.length === 0) return null;

  const selectedIds = selected.map((c) => c._id);
  const activeCampaign = (dripCampaigns ?? []).find((c) => c._id === phaseCampaignId);
  const emails = Array.from(new Set(selected.map((c) => c.email).filter((e): e is string => !!e)));
  const noun = `${selected.length} contact${selected.length === 1 ? '' : 's'}`;

  const handleArchive = async () => {
    try {
      await archiveContacts({ contactIds: selectedIds, archived: true });
      toast.success(`Archived ${noun}`);
      onClear();
    } catch (err) {
      toast.fromError(err, 'Bulk archive failed');
    }
  };

  /** Shared by every dropdown here — one mutation, one toast, one clear. */
  const applyUpdate = async (
    patch: Partial<Parameters<typeof bulkUpdate>[0]>,
    description: string,
  ) => {
    try {
      await bulkUpdate({ contactIds: selectedIds, ...patch });
      toast.success(`Updated ${description} for ${noun}`);
      onClear();
    } catch (err) {
      toast.fromError(err, 'Bulk update failed');
    }
  };

  const handleCopyEmails = () => {
    if (emails.length === 0) {
      toast.info('Nothing to copy', 'None of the selected contacts has an email address.');
      return;
    }
    navigator.clipboard?.writeText(emails.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex-wrap">
      <span className="text-sm font-medium text-blue-800">{selected.length} selected</span>

      <button
        type="button"
        onClick={handleCopyEmails}
        className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
        title={emails.length > 0 ? 'Copy as a comma-separated list' : 'No email addresses in this selection'}
      >
        {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
        {copied ? 'Copied' : `Copy ${emails.length} email${emails.length === 1 ? '' : 's'}`}
      </button>

      <BulkTagPopover contactIds={selectedIds} />

      <BulkSelect
        label="Set status…"
        options={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }))}
        onPick={(value) => applyUpdate({ status: value as Doc<'crmContacts'>['status'] }, 'status')}
      />

      <BulkSelect
        label="Set next action…"
        options={NEXT_ACTIONS.map((a) => ({ value: a, label: NEXT_ACTION_LABELS[a] }))}
        onPick={(value) => applyUpdate({ nextAction: value as Doc<'crmContacts'>['nextAction'] }, 'next action')}
      />

      <BulkSelect
        label="Set drip…"
        options={DRIP_STATUSES.map((s) => ({ value: s, label: DRIP_STATUS_LABELS[s] }))}
        onPick={(value) => applyUpdate({ dripStatus: value as NonNullable<Doc<'crmContacts'>['dripStatus']> }, 'drip progress')}
      />

      <BulkSelect
        label="Set email status…"
        options={EMAIL_STATUSES.map((s) => ({ value: s, label: EMAIL_STATUS_LABELS[s] }))}
        onPick={(value) => applyUpdate({ emailStatus: value as Doc<'crmContacts'>['emailStatus'] }, 'email status')}
      />

      <span className="h-4 w-px bg-blue-200" aria-hidden />

      <BulkSelect
        label="Add to campaign…"
        options={(dripCampaigns ?? []).map((c) => ({ value: c._id, label: c.name }))}
        onPick={async (value) => {
          try {
            const result = await enrollContacts({ contactIds: selectedIds, dripCampaignId: value as Id<'crmDripCampaigns'> });
            toast.success(`Added ${result.enrolled} to the campaign${result.reactivated ? `, re-activated ${result.reactivated}` : ''}`);
            onClear();
          } catch (err) {
            toast.fromError(err, 'Could not add those contacts');
          }
        }}
      />

      <BulkSelect
        label="Move to campaign…"
        options={(dripCampaigns ?? []).filter((c) => c._id !== phaseCampaignId).map((c) => ({ value: c._id, label: c.name }))}
        onPick={async (value) => {
          try {
            const result = await moveToCampaign({
              contactIds: selectedIds,
              // Only scope the move off a source campaign when the list is
              // filtered to one; otherwise this is an add, not a move.
              fromDripCampaignId: phaseCampaignId,
              toDripCampaignId: value as Id<'crmDripCampaigns'>,
            });
            toast.success(`Moved ${result.moved} contact${result.moved === 1 ? '' : 's'}`);
            onClear();
          } catch (err) {
            toast.fromError(err, 'Could not move those contacts');
          }
        }}
      />

      {phaseCampaignId && (
        <>
          <BulkSelect
            label="Set phase…"
            options={Array.from({ length: (activeCampaign?.phaseCount ?? 5) + 1 }, (_, phase) => ({
              value: String(phase),
              label: phase === 0 ? 'Not sent yet' : (activeCampaign?.phaseLabels?.[phase - 1] ?? `Phase ${phase}`),
            }))}
            onPick={async (value) => {
              try {
                const result = await setPhase({ contactIds: selectedIds, dripCampaignId: phaseCampaignId, phase: Number(value) });
                toast.success(`Moved ${result.updated} contact${result.updated === 1 ? '' : 's'} to that phase`);
                onClear();
              } catch (err) {
                toast.fromError(err, 'Could not set the phase');
              }
            }}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await removeFromCampaign({ contactIds: selectedIds, dripCampaignId: phaseCampaignId });
                toast.success(`Removed ${result.removed} from the campaign`);
                onClear();
              } catch (err) {
                toast.fromError(err, 'Could not remove those contacts');
              }
            }}
            className="text-sm text-blue-700 hover:text-blue-900 font-medium"
          >
            Remove from campaign
          </button>
        </>
      )}

      <span className="h-4 w-px bg-blue-200" aria-hidden />

      <button type="button" onClick={handleArchive} className="text-sm text-blue-700 hover:text-blue-900 font-medium">
        Archive
      </button>

      <button type="button" onClick={onClear} className="ml-auto text-blue-500 hover:text-blue-800" aria-label="Clear selection">
        <X size={16} />
      </button>
    </div>
  );
}
