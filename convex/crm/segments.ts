/**
 * SAVED SEGMENTS — a typed filter set a rep can name, share, and reuse for
 * call lists, CSV export, or (phase 3) an email campaign's recipient list.
 *
 * countSegment/previewSegment intentionally do NOT share listContacts'
 * paginate()-based driver — they need a single bounded read capped well
 * below "the whole table," reported honestly as "N+" when the cap is hit,
 * rather than an infinite-scroll list.
 */

import { action, internalQuery, mutation, query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser } from "./guards";
import { internal } from "../_generated/api";
import { chooseDriverIndex, buildContactPredicate, type ContactFilters } from "./lib/filters";
import { dripLabel, EMAIL_STATUS_LABELS, NEXT_ACTION_LABELS } from "./lib/contactStatus";

const FILTERS_VALIDATOR = v.object({
  searchTerm: v.optional(v.string()),
  statuses: v.optional(v.array(v.string())),
  dripStatuses: v.optional(v.array(v.string())),
  emailStatuses: v.optional(v.array(v.string())),
  nextActions: v.optional(v.array(v.string())),
  hasReplied: v.optional(v.boolean()),
  dripCampaignIds: v.optional(v.array(v.id("crmDripCampaigns"))),
  dripPhases: v.optional(v.array(v.number())),
  jobFunctions: v.optional(v.array(v.string())),
  seniorities: v.optional(v.array(v.string())),
  jobTitleContains: v.optional(v.array(v.string())),
  jobTitleExcludes: v.optional(v.array(v.string())),
  states: v.optional(v.array(v.string())),
  tagGroups: v.optional(v.array(v.object({
    categoryId: v.optional(v.id("crmTagCategories")),
    tagIds: v.array(v.id("crmTags")),
  }))),
  excludeTagIds: v.optional(v.array(v.id("crmTags"))),
  ownerClerkUserIds: v.optional(v.array(v.string())),
  hasEmail: v.optional(v.boolean()),
  hasMobile: v.optional(v.boolean()),
  emailable: v.optional(v.boolean()),
  callable: v.optional(v.boolean()),
  neverContacted: v.optional(v.boolean()),
  lastContactedBeforeDays: v.optional(v.number()),
  createdAfter: v.optional(v.number()),
  importBatchId: v.optional(v.id("crmImportBatches")),
  isArchived: v.optional(v.boolean()),
});

export const listSegments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const [mine, shared] = await Promise.all([
      ctx.db.query("crmSegments").withIndex("by_owner", (q) => q.eq("ownerClerkUserId", identity.clerkUserId)).collect(),
      ctx.db.query("crmSegments").withIndex("by_shared", (q) => q.eq("isShared", true)).collect(),
    ]);
    const seen = new Set(mine.map((s) => s._id));
    return [...mine, ...shared.filter((s) => !seen.has(s._id))];
  },
});

export const getSegment = query({
  args: { segmentId: v.id("crmSegments") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.segmentId);
  },
});

export const saveSegment = mutation({
  args: {
    segmentId: v.optional(v.id("crmSegments")),
    name: v.string(),
    description: v.optional(v.string()),
    filters: FILTERS_VALIDATOR,
    isShared: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    if (args.segmentId) {
      await ctx.db.patch(args.segmentId, { name: args.name, description: args.description, filters: args.filters, isShared: args.isShared, updatedAt: now });
      return args.segmentId;
    }
    return await ctx.db.insert("crmSegments", {
      name: args.name, description: args.description, entity: "contact", filters: args.filters,
      isShared: args.isShared, ownerClerkUserId: identity.clerkUserId, createdAt: now, updatedAt: now,
    });
  },
});

export const deleteSegment = mutation({
  args: { segmentId: v.id("crmSegments") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.delete(args.segmentId);
  },
});

const SCAN_CAP = 5000;
const PREVIEW_CAP = 25;

/** Exported so convex/crm/campaigns.ts can resolve a segment's matching contacts for recipient build with the exact same driver/predicate logic the list and export paths use. */
export async function scanFiltered(ctx: QueryCtx | MutationCtx, filters: ContactFilters, cap: number) {
  const driver = chooseDriverIndex(filters);
  const predicate = buildContactPredicate(filters);
  let raw: Doc<"crmContacts">[];

  switch (driver.kind) {
    case "search_contacts":
      raw = await ctx.db.query("crmContacts").withSearchIndex("search_contacts", (q) => q.search("searchText", driver.searchTerm)).take(cap);
      break;
    case "by_tag_contact": {
      const links = await ctx.db.query("crmContactTags").withIndex("by_tag_contact", (q) => q.eq("tagId", driver.tagId as Id<"crmTags">)).take(cap);
      raw = (await Promise.all(links.map((l) => (l.contactId ? ctx.db.get(l.contactId) : null)))).filter((c): c is Doc<"crmContacts"> => c !== null);
      break;
    }
    case "by_company":
      raw = await ctx.db.query("crmContacts").withIndex("by_company", (q) => q.eq("companyId", driver.companyId as Id<"crmCompanies">)).take(cap);
      break;
    case "by_owner_status":
      raw = await ctx.db.query("crmContacts").withIndex("by_owner_status", (q) => q.eq("ownerClerkUserId", driver.ownerClerkUserId).eq("status", driver.status as Doc<"crmContacts">["status"])).take(cap);
      break;
    case "by_status":
      raw = await ctx.db.query("crmContacts").withIndex("by_status", (q) => q.eq("status", driver.status as Doc<"crmContacts">["status"])).order("desc").take(cap);
      break;
    case "by_last_contacted":
      raw = await ctx.db.query("crmContacts").withIndex("by_last_contacted").take(cap);
      break;
    default:
      raw = await ctx.db.query("crmContacts").withIndex("by_updated").order("desc").take(cap);
  }

  return { matched: raw.filter(predicate), truncated: raw.length === cap };
}

export const countSegment = query({
  args: { filters: FILTERS_VALIDATOR },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { matched, truncated } = await scanFiltered(ctx, args.filters, SCAN_CAP);
    return { count: matched.length, truncated };
  },
});

export const previewSegment = query({
  args: { filters: FILTERS_VALIDATOR },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const { matched } = await scanFiltered(ctx, args.filters, SCAN_CAP);
    return matched.slice(0, PREVIEW_CAP);
  },
});

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Date-only, so a spreadsheet doesn't reformat it into something ambiguous. */
function isoDay(ts: number | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "";
}

const EXPORT_CAP = 20000;

export const exportSegmentCsv = action({
  args: { filters: FILTERS_VALIDATOR },
  handler: async (ctx, args): Promise<{ csv: string; rowCount: number; truncated: boolean }> => {
    const { matched, truncated } = await ctx.runQuery(internal.crm.segments._scanForExport, { filters: args.filters });
    const headers = [
      "First Name", "Last Name", "Job Title", "Company", "Email", "Mobile Phone", "Office Phone",
      "City", "State", "Status", "Owner",
      // Outreach state. Status stays a raw enum value (existing exports feed
      // spreadsheets that already key off it); the new columns are written for
      // a human to read, since nothing downstream depends on them yet.
      "Drip Progress", "Drip Step", "Email Status", "Next Action",
      "Last Email Sent", "Last Opened", "Last Clicked", "Replied", "Notes",
    ];
    const rows = matched.map((c) => [
      c.firstName, c.lastName, c.jobTitle ?? "", c.companyName ?? "", c.email ?? "",
      c.mobilePhone ?? "", c.officePhone ?? "", c.city ?? "", c.state ?? "", c.status, c.ownerClerkUserId ?? "",
      dripLabel(c.dripStatus, c.dripStep), c.dripStep ?? 0,
      EMAIL_STATUS_LABELS[c.emailStatus] ?? c.emailStatus,
      c.nextAction ? NEXT_ACTION_LABELS[c.nextAction] : "",
      isoDay(c.lastEmailSentAt), isoDay(c.lastEmailOpenedAt), isoDay(c.lastLinkClickedAt),
      c.hasReplied ? "Yes" : "No", c.notes ?? "",
    ].map((v) => csvEscape(String(v))).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    return { csv, rowCount: matched.length, truncated };
  },
});

export const _scanForExport = internalQuery({
  args: { filters: FILTERS_VALIDATOR },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await scanFiltered(ctx, args.filters, EXPORT_CAP);
  },
});
