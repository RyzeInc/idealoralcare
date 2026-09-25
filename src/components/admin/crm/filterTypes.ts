import type { Id } from '@/convex/_generated/dataModel';

/**
 * Mirrors the FILTERS_VALIDATOR shape in convex/crm/contacts.ts and
 * convex/crm/segments.ts — kept as a single frontend type so the filter
 * rail, segment save/load, and CSV export always agree on the shape.
 */
export interface ContactListFilters {
  searchTerm?: string;
  statuses?: string[];
  dripStatuses?: string[];
  emailStatuses?: string[];
  nextActions?: string[];
  hasReplied?: boolean;
  dripCampaignIds?: Id<'crmDripCampaigns'>[];
  dripPhases?: number[];
  jobFunctions?: string[];
  seniorities?: string[];
  jobTitleContains?: string[];
  jobTitleExcludes?: string[];
  states?: string[];
  tagGroups?: { categoryId?: Id<'crmTagCategories'>; tagIds: Id<'crmTags'>[] }[];
  excludeTagIds?: Id<'crmTags'>[];
  ownerClerkUserIds?: string[];
  companyId?: Id<'crmCompanies'>;
  hasEmail?: boolean;
  hasMobile?: boolean;
  emailable?: boolean;
  callable?: boolean;
  neverContacted?: boolean;
  lastContactedBeforeDays?: number;
  createdAfter?: number;
  importBatchId?: Id<'crmImportBatches'>;
  isArchived?: boolean;
}
