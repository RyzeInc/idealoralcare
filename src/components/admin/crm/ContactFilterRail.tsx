'use client';

import { Search, Eye, EyeOff } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { FilterChip } from '@/components/admin/ui';
import {
  CONTACT_STATUSES, CONTACT_STATUS_LABELS,
  DRIP_STATUSES, DRIP_STATUS_LABELS,
  EMAIL_STATUSES, EMAIL_STATUS_LABELS,
  tagColorClass,
} from './constants';
import type { ContactListFilters } from './filterTypes';

export function ContactFilterRail({ filters, onChange, myClerkId }: {
  filters: ContactListFilters;
  onChange: (next: ContactListFilters) => void;
  myClerkId?: string;
}) {
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const dripCampaigns = useQuery(api.crm.dripCampaigns.listDripCampaigns, {});
  const primaryCategories = (tree ?? []).filter((g) => g.category.isPrimaryFilter);
  const selectedCampaignId = filters.dripCampaignIds?.[0];
  const selectedCampaign = (dripCampaigns ?? []).find((c) => c._id === selectedCampaignId);

  const toggleTag = (categoryId: Id<'crmTagCategories'>, tagId: Id<'crmTags'>) => {
    const groups = filters.tagGroups ?? [];
    const existingGroup = groups.find((g) => g.categoryId === categoryId);
    if (!existingGroup) {
      onChange({ ...filters, tagGroups: [...groups, { categoryId, tagIds: [tagId] }] });
      return;
    }
    const has = existingGroup.tagIds.includes(tagId);
    const nextTagIds = has ? existingGroup.tagIds.filter((t) => t !== tagId) : [...existingGroup.tagIds, tagId];
    const nextGroups = nextTagIds.length === 0
      ? groups.filter((g) => g.categoryId !== categoryId)
      : groups.map((g) => (g.categoryId === categoryId ? { ...g, tagIds: nextTagIds } : g));
    onChange({ ...filters, tagGroups: nextGroups });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.searchTerm ?? ''}
            onChange={(e) => onChange({ ...filters, searchTerm: e.target.value || undefined })}
            placeholder="Search name, email, company, title…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-400"
          />
        </div>

        <select
          value={filters.statuses?.[0] ?? ''}
          onChange={(e) => onChange({ ...filters, statuses: e.target.value ? [e.target.value] : undefined })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2"
        >
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((value) => (
            <option key={value} value={value}>{CONTACT_STATUS_LABELS[value]}</option>
          ))}
        </select>

        <select
          value={filters.dripStatuses?.[0] ?? ''}
          onChange={(e) => onChange({ ...filters, dripStatuses: e.target.value ? [e.target.value] : undefined })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2"
        >
          <option value="">All drip states</option>
          {DRIP_STATUSES.map((value) => (
            <option key={value} value={value}>{DRIP_STATUS_LABELS[value]}</option>
          ))}
        </select>

        <select
          value={filters.emailStatuses?.[0] ?? ''}
          onChange={(e) => onChange({ ...filters, emailStatuses: e.target.value ? [e.target.value] : undefined })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2"
        >
          <option value="">All email states</option>
          {EMAIL_STATUSES.map((value) => (
            <option key={value} value={value}>{EMAIL_STATUS_LABELS[value]}</option>
          ))}
        </select>

        {/* "Show me everyone on the broker drip" — and then, which phase. */}
        <select
          value={filters.dripCampaignIds?.[0] ?? ''}
          onChange={(e) => onChange({
            ...filters,
            dripCampaignIds: e.target.value ? [e.target.value as Id<'crmDripCampaigns'>] : undefined,
            // A phase number only means something within one campaign.
            dripPhases: undefined,
          })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2"
        >
          <option value="">All campaigns</option>
          {(dripCampaigns ?? []).map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        {selectedCampaign && (
          <select
            value={filters.dripPhases?.[0] ?? ''}
            onChange={(e) => onChange({ ...filters, dripPhases: e.target.value === '' ? undefined : [Number(e.target.value)] })}
            className="text-sm border border-slate-300 rounded-lg px-2 py-2"
          >
            <option value="">All phases</option>
            {Array.from({ length: selectedCampaign.phaseCount + 1 }, (_, phase) => (
              <option key={phase} value={phase}>
                {phase === 0 ? 'Not sent yet' : (selectedCampaign.phaseLabels?.[phase - 1] ?? `Phase ${phase}`)}
              </option>
            ))}
          </select>
        )}

        {/* The broker-campaign question: who can we actually still mail? */}
        <button
          type="button"
          onClick={() => onChange({ ...filters, emailable: filters.emailable ? undefined : true })}
          className={`text-sm font-medium px-3 py-2 rounded-lg border ${
            filters.emailable ? 'bg-green-50 border-green-300 text-green-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
          title="Has an address, has not opted out, and is not bounced, blocked or suppressed"
        >
          Emailable
        </button>

        {myClerkId && (
          <button
            type="button"
            onClick={() => onChange({
              ...filters,
              ownerClerkUserIds: filters.ownerClerkUserIds?.includes(myClerkId) ? undefined : [myClerkId],
            })}
            className={`text-sm font-medium px-3 py-2 rounded-lg border ${
              filters.ownerClerkUserIds?.includes(myClerkId) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Mine only
          </button>
        )}

        <button
          type="button"
          onClick={() => onChange({ ...filters, isArchived: filters.isArchived ? undefined : true })}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-2 py-2"
          title={filters.isArchived ? 'Showing archived — click to hide' : 'Show archived'}
        >
          {filters.isArchived ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>

      {primaryCategories.length > 0 && (
        <div className="space-y-1.5">
          {primaryCategories.map(({ category, tags }) => (
            <div key={category._id} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 w-20 flex-shrink-0">{category.name}</span>
              {tags.map((tag) => {
                const group = filters.tagGroups?.find((g) => g.categoryId === category._id);
                const active = !!group?.tagIds.includes(tag._id);
                return (
                  <FilterChip
                    key={tag._id}
                    label={tag.name}
                    count={tag.contactCount}
                    active={active}
                    tone={tagColorClass(tag.color ?? category.color)}
                    onClick={() => toggleTag(category._id, tag._id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
