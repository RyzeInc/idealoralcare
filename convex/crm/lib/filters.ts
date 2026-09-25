/**
 * CONTACT LIST FILTERING
 *
 * Two jobs, sharing one predicate so they can never drift apart:
 *   1. chooseDriverIndex — picks which Convex index a query should walk
 *      before the paginate() call. This is the one place in the CRM that
 *      decides whether a request is cheap (index range scan) or bounded-but-
 *      wide (search index, capped at 1024 results).
 *   2. buildContactPredicate — the in-memory filter applied to whatever the
 *      driver index returns, for every facet the index itself didn't cover.
 *
 * Both `crm.contacts.listContacts` (paginated) and campaign recipient build
 * (bounded to <=500) call buildContactPredicate. Recipient build must NEVER
 * choose the search-index driver — enforced by chooseDriverIndex returning a
 * discriminated union the caller has to check, not a bare string.
 */

import { isBlockingEmailStatus } from "./contactStatus";

export interface ContactFilters {
  searchTerm?: string;
  statuses?: string[];
  /** Drip/deliverability/next-action facets — see lib/contactStatus.ts. */
  dripStatuses?: string[];
  emailStatuses?: string[];
  nextActions?: string[];
  hasReplied?: boolean;
  /**
   * Campaign membership. Matched against the contact's cached dripCampaignIds
   * (source of truth: crmDripEnrollments) — OR across the list, so "on either
   * of these two campaigns" is one filter.
   */
  dripCampaignIds?: string[];
  /** Phase of the PRIMARY enrollment, i.e. the one dripStep mirrors. */
  dripPhases?: number[];
  jobFunctions?: string[];
  seniorities?: string[];
  /** OR across entries, case-insensitive substring match on jobTitle. */
  jobTitleContains?: string[];
  jobTitleExcludes?: string[];
  states?: string[];
  /** AND across groups; OR across tagIds within a group. */
  tagGroups?: { categoryId?: string; tagIds: string[] }[];
  excludeTagIds?: string[];
  ownerClerkUserIds?: string[];
  companyId?: string;
  hasEmail?: boolean;
  hasMobile?: boolean;
  emailable?: boolean;
  callable?: boolean;
  neverContacted?: boolean;
  lastContactedBeforeDays?: number;
  createdAfter?: number;
  importBatchId?: string;
  isArchived?: boolean;
}

export const FILTER_DEFAULTS: ContactFilters = {
  isArchived: false,
};

/** Minimal shape buildContactPredicate needs — matches Doc<"crmContacts"> structurally. */
export interface FilterableContact {
  status: string;
  dripStatus?: string;
  dripStep?: number;
  dripCampaignIds?: string[];
  nextAction?: string;
  hasReplied?: boolean;
  jobFunction?: string;
  seniority?: string;
  jobTitle?: string;
  state?: string;
  tagIds: string[];
  ownerClerkUserId?: string;
  companyId?: string;
  email?: string;
  mobilePhone?: string;
  emailOptOut: boolean;
  emailStatus: string;
  callOptOut: boolean;
  phoneStatus: string;
  lastContactedAt?: number;
  createdAt: number;
  importBatchId?: string;
  isArchived: boolean;
}

export type DriverIndex =
  | { kind: "search_contacts"; searchTerm: string }
  | { kind: "by_tag_contact"; tagId: string }
  | { kind: "by_company"; companyId: string }
  | { kind: "by_owner_status"; ownerClerkUserId: string; status: string }
  | { kind: "by_status"; status: string }
  | { kind: "by_last_contacted" }
  | { kind: "by_updated" };

/**
 * Picks the cheapest index that can serve this filter set. Order matters —
 * each branch below is checked only after the more selective ones above it
 * fail to apply.
 */
export function chooseDriverIndex(filters: ContactFilters): DriverIndex {
  const searchTerm = filters.searchTerm?.trim();
  if (searchTerm && searchTerm.length >= 2) {
    return { kind: "search_contacts", searchTerm };
  }

  if (filters.tagGroups?.length === 1 && filters.tagGroups[0].tagIds.length === 1) {
    return { kind: "by_tag_contact", tagId: filters.tagGroups[0].tagIds[0] };
  }

  if (filters.companyId) {
    return { kind: "by_company", companyId: filters.companyId };
  }

  if (filters.ownerClerkUserIds?.length === 1 && filters.statuses?.length === 1) {
    return {
      kind: "by_owner_status",
      ownerClerkUserId: filters.ownerClerkUserIds[0],
      status: filters.statuses[0],
    };
  }

  if (filters.statuses?.length === 1) {
    return { kind: "by_status", status: filters.statuses[0] };
  }

  if (filters.neverContacted) {
    return { kind: "by_last_contacted" };
  }

  return { kind: "by_updated" };
}

/**
 * HARD ASSERT for recipient build: a send must never be sourced from the
 * search index (Convex full-text search caps at 1024 results and is
 * relevance-ordered, not exhaustive — a segment silently truncated to "the
 * top 1024 relevance matches" is not the list a rep asked for).
 */
export function assertNotSearchDriven(driver: DriverIndex): void {
  if (driver.kind === "search_contacts") {
    throw new Error(
      "Recipient build cannot be sourced from a search-text query — search caps at 1024 " +
        "results and is relevance-ordered, not exhaustive. Narrow the segment to a filter " +
        "combination that resolves to an index scan instead."
    );
  }
}

function jobTitleMatches(jobTitle: string | undefined, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  if (!jobTitle) return false;
  const lower = jobTitle.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function jobTitleExcluded(jobTitle: string | undefined, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return false;
  if (!jobTitle) return false;
  const lower = jobTitle.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function tagGroupsMatch(
  tagIds: string[],
  tagGroups: { categoryId?: string; tagIds: string[] }[] | undefined,
): boolean {
  if (!tagGroups || tagGroups.length === 0) return true;
  // AND across groups; OR across tagIds within a group.
  return tagGroups.every((group) => group.tagIds.some((id) => tagIds.includes(id)));
}

/** True when the contact is currently eligible for outreach email. */
export function isEmailable(contact: Pick<FilterableContact, "email" | "emailOptOut" | "emailStatus">): boolean {
  if (!contact.email) return false;
  if (contact.emailOptOut) return false;
  // Shared with crm/lib/emailGate.ts so a "who would this reach" preview and
  // an actual send can never disagree about who is reachable.
  return !isBlockingEmailStatus(contact.emailStatus);
}

/** True when the contact is currently eligible for outbound calling. */
export function isCallable(contact: Pick<FilterableContact, "mobilePhone" | "callOptOut" | "phoneStatus">): boolean {
  if (!contact.mobilePhone) return false;
  if (contact.callOptOut) return false;
  return !["disconnected", "dnc"].includes(contact.phoneStatus);
}

/**
 * The single source of truth for "does this contact match these filters".
 * Applied in-memory after the driver index has narrowed the candidate set.
 * Every facet the driver index didn't already cover gets re-checked here too
 * (cheap, and keeps the predicate correct regardless of which driver ran).
 */
export function buildContactPredicate(filters: ContactFilters): (contact: FilterableContact) => boolean {
  const merged: ContactFilters = { ...FILTER_DEFAULTS, ...filters };

  return (contact: FilterableContact): boolean => {
    if (merged.isArchived !== undefined && contact.isArchived !== merged.isArchived) return false;
    if (merged.statuses?.length && !merged.statuses.includes(contact.status)) return false;
    // An unset dripStatus reads as "not_started" — the same contact either way,
    // so a "Not Started" filter must match rows written before the field existed.
    if (merged.dripStatuses?.length && !merged.dripStatuses.includes(contact.dripStatus ?? "not_started")) return false;
    if (merged.emailStatuses?.length && !merged.emailStatuses.includes(contact.emailStatus)) return false;
    if (merged.nextActions?.length && !(contact.nextAction && merged.nextActions.includes(contact.nextAction))) return false;
    if (merged.hasReplied !== undefined && (contact.hasReplied ?? false) !== merged.hasReplied) return false;
    if (merged.dripCampaignIds?.length) {
      const on = contact.dripCampaignIds ?? [];
      if (!merged.dripCampaignIds.some((id) => on.includes(id))) return false;
    }
    if (merged.dripPhases?.length && !merged.dripPhases.includes(contact.dripStep ?? 0)) return false;
    if (merged.jobFunctions?.length && !(contact.jobFunction && merged.jobFunctions.includes(contact.jobFunction))) return false;
    if (merged.seniorities?.length && !(contact.seniority && merged.seniorities.includes(contact.seniority))) return false;
    if (!jobTitleMatches(contact.jobTitle, merged.jobTitleContains)) return false;
    if (jobTitleExcluded(contact.jobTitle, merged.jobTitleExcludes)) return false;
    if (merged.states?.length && !(contact.state && merged.states.includes(contact.state))) return false;
    if (!tagGroupsMatch(contact.tagIds, merged.tagGroups)) return false;
    if (merged.excludeTagIds?.length && contact.tagIds.some((id) => merged.excludeTagIds!.includes(id))) return false;
    if (merged.ownerClerkUserIds?.length && !(contact.ownerClerkUserId && merged.ownerClerkUserIds.includes(contact.ownerClerkUserId))) return false;
    if (merged.companyId && contact.companyId !== merged.companyId) return false;
    if (merged.hasEmail && !contact.email) return false;
    if (merged.hasMobile && !contact.mobilePhone) return false;
    if (merged.emailable && !isEmailable(contact)) return false;
    if (merged.callable && !isCallable(contact)) return false;
    if (merged.neverContacted && contact.lastContactedAt !== undefined) return false;
    if (merged.lastContactedBeforeDays !== undefined) {
      const cutoff = Date.now() - merged.lastContactedBeforeDays * 24 * 60 * 60 * 1000;
      if (contact.lastContactedAt === undefined || contact.lastContactedAt >= cutoff) return false;
    }
    if (merged.createdAfter !== undefined && contact.createdAt < merged.createdAfter) return false;
    if (merged.importBatchId && contact.importBatchId !== merged.importBatchId) return false;

    return true;
  };
}
