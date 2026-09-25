/**
 * CRM CONTACTS — the core prospect record.
 *
 * listContacts is the load-bearing query: it's the one place in this module
 * that must never `.collect()` an unbounded table (see convex/crm/lib/filters.ts
 * for the index-selection + predicate logic this delegates to).
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { insertActivity } from "./activities";
import { recordAdminAction } from "../admin/adminAudit";
import {
  normalizeEmail, normalizePhoneE164, buildDedupeKey, buildContactSearchText,
} from "./lib/normalize";
import { classifyJobTitle } from "./lib/jobTitles";
import { chooseDriverIndex, buildContactPredicate, type ContactFilters } from "./lib/filters";
import { fireWorkflowTrigger } from "./workflowTriggers";
import {
  CLOSED_CONTACT_STATUSES, DEFAULT_CONTACT_STATUS, DRIP_MAX_STEP,
  isBlockingEmailStatus, type ContactStatus,
} from "./lib/contactStatus";
import { recordEmailBlocked } from "./lib/emailProgress";

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
  companyId: v.optional(v.id("crmCompanies")),
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

export const listContacts = query({
  args: { paginationOpts: paginationOptsValidator, filters: v.optional(FILTERS_VALIDATOR) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const filters: ContactFilters = args.filters ?? {};
    const driver = chooseDriverIndex(filters);
    const predicate = buildContactPredicate(filters);

    let queryBuilder;
    switch (driver.kind) {
      case "search_contacts":
        queryBuilder = ctx.db
          .query("crmContacts")
          .withSearchIndex("search_contacts", (q) => {
            let sq = q.search("searchText", driver.searchTerm);
            if (filters.isArchived !== undefined) sq = sq.eq("isArchived", filters.isArchived);
            if (filters.companyId) sq = sq.eq("companyId", filters.companyId as Id<"crmCompanies">);
            return sq;
          });
        break;
      case "by_tag_contact": {
        const links = await ctx.db
          .query("crmContactTags")
          .withIndex("by_tag_contact", (q) => q.eq("tagId", driver.tagId as Id<"crmTags">))
          .collect();
        const contacts = (
          await Promise.all(links.map((l) => (l.contactId ? ctx.db.get(l.contactId) : null)))
        ).filter((c): c is Doc<"crmContacts"> => c !== null && predicate(c));
        return { page: contacts, isDone: true, continueCursor: "" };
      }
      case "by_company":
        queryBuilder = ctx.db.query("crmContacts").withIndex("by_company", (q) => q.eq("companyId", driver.companyId as Id<"crmCompanies">));
        break;
      case "by_owner_status":
        queryBuilder = ctx.db.query("crmContacts").withIndex("by_owner_status", (q) => q.eq("ownerClerkUserId", driver.ownerClerkUserId).eq("status", driver.status as Doc<"crmContacts">["status"]));
        break;
      case "by_status":
        queryBuilder = ctx.db.query("crmContacts").withIndex("by_status", (q) => q.eq("status", driver.status as Doc<"crmContacts">["status"])).order("desc");
        break;
      case "by_last_contacted":
        queryBuilder = ctx.db.query("crmContacts").withIndex("by_last_contacted");
        break;
      default:
        queryBuilder = ctx.db.query("crmContacts").withIndex("by_updated").order("desc");
    }

    const result = await queryBuilder.paginate(args.paginationOpts);
    return { ...result, page: result.page.filter(predicate) };
  },
});

export const getContact = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.contactId);
  },
});

export const getContactDetail = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    const [tagLinks, company, openTasks] = await Promise.all([
      ctx.db.query("crmContactTags").withIndex("by_contact", (q) => q.eq("contactId", args.contactId)).collect(),
      contact.companyId ? ctx.db.get(contact.companyId) : Promise.resolve(null),
      ctx.db.query("crmTasks").withIndex("by_contact_status", (q) => q.eq("contactId", args.contactId).eq("status", "open")).collect(),
    ]);

    const tags = (await Promise.all(tagLinks.map((l) => ctx.db.get(l.tagId))))
      .filter((t): t is Doc<"crmTags"> => t !== null);

    return { contact, company, tags, openTasks };
  },
});

export const quickSearchContacts = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const term = args.term.trim();
    if (term.length < 2) return [];
    return await ctx.db
      .query("crmContacts")
      .withSearchIndex("search_contacts", (q) => q.search("searchText", term).eq("isArchived", false))
      .take(args.limit ?? 20);
  },
});

/** Cheap indexed-only duplicate check — never a table scan. */
export const possibleDuplicates = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return [];

    const candidates = new Map<string, Doc<"crmContacts">>();
    if (contact.emailLower) {
      for (const c of await ctx.db.query("crmContacts").withIndex("by_email_lower", (q) => q.eq("emailLower", contact.emailLower)).collect()) {
        if (c._id !== contact._id) candidates.set(c._id, c);
      }
    }
    if (contact.mobilePhoneE164) {
      for (const c of await ctx.db.query("crmContacts").withIndex("by_mobile_e164", (q) => q.eq("mobilePhoneE164", contact.mobilePhoneE164)).collect()) {
        if (c._id !== contact._id) candidates.set(c._id, c);
      }
    }
    if (contact.dedupeKey) {
      for (const c of await ctx.db.query("crmContacts").withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", contact.dedupeKey)).collect()) {
        if (c._id !== contact._id) candidates.set(c._id, c);
      }
    }
    return Array.from(candidates.values()).slice(0, 10);
  },
});

const WRITABLE_FIELDS = v.object({
  firstName: v.string(),
  lastName: v.string(),
  jobTitle: v.optional(v.string()),
  companyId: v.optional(v.id("crmCompanies")),
  companyName: v.optional(v.string()),
  email: v.optional(v.string()),
  secondaryEmail: v.optional(v.string()),
  mobilePhone: v.optional(v.string()),
  officePhone: v.optional(v.string()),
  officePhoneExt: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
});

/** Exported so convex/crm/imports.ts can recompute the same derived fields on a matched/updated row. */
export function buildDerivedFields(fields: {
  firstName: string; lastName: string; jobTitle?: string; companyName?: string;
  email?: string; mobilePhone?: string; officePhone?: string;
}) {
  const fullName = `${fields.firstName} ${fields.lastName}`.trim();
  const { jobFunction, seniority } = classifyJobTitle(fields.jobTitle);
  const emailLower = normalizeEmail(fields.email);
  const mobilePhoneE164 = normalizePhoneE164(fields.mobilePhone);
  const officePhoneE164 = normalizePhoneE164(fields.officePhone);
  const dedupeKey = buildDedupeKey(fields.firstName, fields.lastName, fields.companyName);
  const searchText = buildContactSearchText({
    fullName, email: fields.email, companyName: fields.companyName, jobTitle: fields.jobTitle,
    mobilePhone: fields.mobilePhone, officePhone: fields.officePhone,
  });
  return { fullName, jobFunction, seniority, emailLower, mobilePhoneE164, officePhoneE164, dedupeKey, searchText };
}

export const createContact = mutation({
  args: {
    ...WRITABLE_FIELDS.fields,
    ownerClerkUserId: v.optional(v.string()),
    source: v.optional(v.union(
      v.literal("manual"), v.literal("csv_import"), v.literal("nexus_lead"), v.literal("inquiry"),
      v.literal("partner_registration"), v.literal("partner_kit"), v.literal("rep_onboarding"),
      v.literal("account_contact"), v.literal("web_form"), v.literal("referral"), v.literal("event"),
    )),
    sourceDetail: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("crmTags"))),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    const derived = buildDerivedFields(args);

    const contactId = await ctx.db.insert("crmContacts", {
      firstName: args.firstName,
      lastName: args.lastName,
      fullName: derived.fullName,
      jobTitle: args.jobTitle,
      jobFunction: derived.jobFunction,
      seniority: derived.seniority,
      companyId: args.companyId,
      companyName: args.companyName,
      email: args.email,
      emailLower: derived.emailLower,
      secondaryEmail: args.secondaryEmail,
      mobilePhone: args.mobilePhone,
      mobilePhoneE164: derived.mobilePhoneE164,
      officePhone: args.officePhone,
      officePhoneE164: derived.officePhoneE164,
      officePhoneExt: args.officePhoneExt,
      linkedinUrl: args.linkedinUrl,
      city: args.city,
      state: args.state,
      postalCode: args.postalCode,
      status: DEFAULT_CONTACT_STATUS,
      statusChangedAt: now,
      dripStatus: "not_started",
      dripStep: 0,
      ownerClerkUserId: args.ownerClerkUserId ?? identity.clerkUserId,
      tagIds: args.tagIds ?? [],
      emailOptOut: false,
      callOptOut: false,
      emailStatus: "unknown",
      phoneStatus: "unknown",
      source: args.source ?? "manual",
      sourceDetail: args.sourceDetail,
      emailsSentCount: 0,
      callsMadeCount: 0,
      callsConnectedCount: 0,
      firstTouchAt: now,
      isArchived: false,
      dedupeKey: derived.dedupeKey,
      searchText: derived.searchText,
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
    });

    for (const tagId of args.tagIds ?? []) {
      await ctx.db.insert("crmContactTags", {
        tagId,
        categoryId: (await ctx.db.get(tagId))!.categoryId,
        contactId,
        createdAt: now,
        createdBy: identity.clerkUserId,
      });
    }

    await insertActivity(ctx, {
      contactId,
      activityType: "contact_created",
      title: "Contact created",
      isTouch: false,
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });

    await fireWorkflowTrigger(ctx, {
      triggerType: "contact_created",
      targetType: "contact",
      targetId: contactId,
      occurrenceKey: `created:${contactId}`,
    });

    return contactId;
  },
});

export const updateContact = mutation({
  args: { contactId: v.id("crmContacts"), fields: WRITABLE_FIELDS },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const existing = await ctx.db.get(args.contactId);
    if (!existing) throw new Error("Contact not found");

    const merged = { ...existing, ...args.fields };
    const derived = buildDerivedFields(merged);

    await ctx.db.patch(args.contactId, {
      ...args.fields,
      fullName: derived.fullName,
      jobFunction: derived.jobFunction,
      seniority: derived.seniority,
      emailLower: derived.emailLower,
      mobilePhoneE164: derived.mobilePhoneE164,
      officePhoneE164: derived.officePhoneE164,
      dedupeKey: derived.dedupeKey,
      searchText: derived.searchText,
      updatedAt: Date.now(),
    });
  },
});

/** Mirrors the schema union exactly — including the legacy tail, so a row that
 * has not been migrated yet can still be re-saved. See lib/contactStatus.ts. */
const STATUS_VALIDATOR = v.union(
  v.literal("prospect"), v.literal("contacted"), v.literal("nurturing"),
  v.literal("interested_qualified"), v.literal("meeting_scheduled"),
  v.literal("agreement_sent"), v.literal("partner"), v.literal("inactive_partner"),
  v.literal("not_interested"), v.literal("disqualified"),
  v.literal("new"), v.literal("working"), v.literal("qualified"),
  v.literal("customer"), v.literal("unresponsive"),
);

const DRIP_STATUS_VALIDATOR = v.union(
  v.literal("not_started"), v.literal("in_progress"), v.literal("completed"),
  v.literal("paused"), v.literal("replied_removed"),
);

const EMAIL_STATUS_VALIDATOR = v.union(
  v.literal("unknown"), v.literal("valid"), v.literal("bounced_soft"),
  v.literal("bounced_hard"), v.literal("complained"), v.literal("unsubscribed"),
  v.literal("blocked"), v.literal("invalid"), v.literal("do_not_contact"),
);

const NEXT_ACTION_VALIDATOR = v.union(
  v.literal("send_follow_up"), v.literal("call"), v.literal("schedule_meeting"),
  v.literal("send_partner_kit"), v.literal("send_agreement"), v.literal("awaiting_response"),
);

export const setStatus = mutation({
  args: { contactId: v.id("crmContacts"), status: STATUS_VALIDATOR, disqualifiedReason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    const now = Date.now();

    const patch: Partial<Doc<"crmContacts">> = {
      status: args.status,
      statusChangedAt: now,
      disqualifiedReason: args.status === "disqualified" ? args.disqualifiedReason : undefined,
      updatedAt: now,
    };
    // Closing a relationship has to stop the sequence too, or the drip keeps
    // mailing someone the CRM already agrees we should stop mailing.
    if (
      CLOSED_CONTACT_STATUSES.includes(args.status as ContactStatus) &&
      (contact.dripStatus ?? "not_started") === "in_progress"
    ) {
      patch.dripStatus = "paused";
    }
    await ctx.db.patch(args.contactId, patch);

    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "status_changed",
      title: `Status changed to ${args.status.replace(/_/g, " ")}`,
      metadata: { from: contact.status, to: args.status },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });

    if (contact.status !== args.status) {
      await fireWorkflowTrigger(ctx, {
        triggerType: "status_changed",
        targetType: "contact",
        targetId: args.contactId,
        status: args.status,
        // Timestamped so a later return to the same status re-fires.
        occurrenceKey: `status:${args.status}:${now}`,
      });
    }
  },
});

export const setOwner = mutation({
  args: { contactId: v.id("crmContacts"), ownerClerkUserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    await ctx.db.patch(args.contactId, { ownerClerkUserId: args.ownerClerkUserId, updatedAt: Date.now() });
    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "owner_changed",
      title: "Owner changed",
      metadata: { ownerClerkUserId: args.ownerClerkUserId },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
  },
});

/**
 * DRIP / DELIVERABILITY / NEXT ACTION — the three fields the contact list
 * edits in place, one narrow mutation each.
 *
 * Separate named mutations rather than one generic `patchContact`, for the
 * same reason setStatus and setOwner are separate: each has different
 * side effects (a deliverability change gates future sends and pauses a
 * sequence; a next-action change does not), and a single catch-all would have
 * to re-derive which of those to run from whichever keys happened to be
 * present.
 *
 * Only setEmailStatus writes to the timeline. A rep re-triaging their
 * next-action column a dozen times an hour would otherwise bury the actual
 * touch history under dropdown noise — whereas "who marked this address Do
 * Not Contact, and when" is exactly the question a compliance review asks.
 */
export const setDripProgress = mutation({
  args: {
    contactId: v.id("crmContacts"),
    dripStatus: DRIP_STATUS_VALIDATOR,
    dripStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    // "Not Started" and a non-zero step is not a state that means anything —
    // normalise rather than storing a pair the label function can't render.
    const requested = args.dripStep ?? contact.dripStep ?? 0;
    const dripStep = args.dripStatus === "not_started"
      ? 0
      : Math.max(0, Math.min(Math.round(requested), DRIP_MAX_STEP));

    await ctx.db.patch(args.contactId, {
      dripStatus: args.dripStatus,
      dripStep,
      updatedAt: Date.now(),
    });
  },
});

export const setEmailStatus = mutation({
  args: { contactId: v.id("crmContacts"), emailStatus: EMAIL_STATUS_VALIDATOR },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.emailStatus === args.emailStatus) return;

    if (isBlockingEmailStatus(args.emailStatus)) {
      // Shares the webhook's path, so a hand-set "Hard Bounce" pauses the
      // drip exactly the way a real bounce would. Unsubscribed / Do Not
      // Contact additionally set the consent flag — those are the two that
      // are a stated wish, not just a delivery fact.
      await recordEmailBlocked(ctx, args.contactId, {
        emailStatus: args.emailStatus,
        optOut: args.emailStatus === "unsubscribed" || args.emailStatus === "do_not_contact",
      });
    } else {
      await ctx.db.patch(args.contactId, { emailStatus: args.emailStatus, updatedAt: Date.now() });
    }

    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "system",
      title: `Email status set to ${args.emailStatus.replace(/_/g, " ")}`,
      metadata: { from: contact.emailStatus, to: args.emailStatus },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
  },
});

export const setNextAction = mutation({
  args: { contactId: v.id("crmContacts"), nextAction: v.optional(NEXT_ACTION_VALIDATOR) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    // undefined clears it — "nothing owed" is a real state, not a missing value.
    await ctx.db.patch(args.contactId, { nextAction: args.nextAction, updatedAt: Date.now() });
  },
});

export const setNotes = mutation({
  args: { contactId: v.id("crmContacts"), notes: v.string() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const trimmed = args.notes.trim();
    await ctx.db.patch(args.contactId, {
      notes: trimmed.length > 0 ? trimmed : undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Materializes touches-to-convert at conversion time so
 * analytics.touchesToConvert is a pure indexed read forever after — never a
 * scan over every contact's full activity history.
 */
export const markConverted = mutation({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.convertedAt) return;

    const now = Date.now();
    const since = contact.firstTouchAt ?? contact.createdAt;
    const activities = await ctx.db
      .query("crmActivities")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId).gte("occurredAt", since))
      .collect();
    const touches = activities.filter((a) => a.isTouch && !a.isDraft);
    const emailCount = touches.filter((a) => a.activityType === "email_outbound").length;
    const callCount = touches.filter((a) => a.activityType === "call").length;

    await ctx.db.patch(args.contactId, {
      // "Partner" is an onboarded Strategic Distribution Partner — the
      // executed-agreement end of the funnel, not merely interested.
      status: "partner",
      statusChangedAt: now,
      convertedAt: now,
      convertEmailCount: emailCount,
      convertCallCount: callCount,
      convertTouchCount: touches.length,
      convertDaysToClose: Math.round((now - since) / (24 * 60 * 60 * 1000)),
      updatedAt: now,
    });

    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "status_changed",
      title: "Converted to partner",
      metadata: { emailCount, callCount, touchCount: touches.length },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
  },
});

const MAX_BULK_OP = 500;

export const archiveContacts = mutation({
  args: { contactIds: v.array(v.id("crmContacts")), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    if (args.contactIds.length > MAX_BULK_OP) throw new Error(`Bulk op limited to ${MAX_BULK_OP} contacts at a time`);
    const now = Date.now();
    for (const id of args.contactIds) {
      await ctx.db.patch(id, { isArchived: args.archived, updatedAt: now });
    }
  },
});

export const bulkUpdate = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    addTagIds: v.optional(v.array(v.id("crmTags"))),
    removeTagIds: v.optional(v.array(v.id("crmTags"))),
    ownerClerkUserId: v.optional(v.string()),
    status: v.optional(STATUS_VALIDATOR),
    dripStatus: v.optional(DRIP_STATUS_VALIDATOR),
    dripStep: v.optional(v.number()),
    emailStatus: v.optional(EMAIL_STATUS_VALIDATOR),
    nextAction: v.optional(NEXT_ACTION_VALIDATOR),
    /** `nextAction: undefined` can't distinguish "leave alone" from "clear it". */
    clearNextAction: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (args.contactIds.length > MAX_BULK_OP) throw new Error(`Bulk op limited to ${MAX_BULK_OP} contacts at a time`);
    const now = Date.now();

    for (const contactId of args.contactIds) {
      const contact = await ctx.db.get(contactId);
      if (!contact) continue;

      let tagIds = contact.tagIds;
      if (args.addTagIds?.length) {
        for (const tagId of args.addTagIds) {
          if (!tagIds.includes(tagId)) {
            tagIds = [...tagIds, tagId];
            await ctx.db.insert("crmContactTags", {
              tagId, categoryId: (await ctx.db.get(tagId))!.categoryId, contactId, createdAt: now, createdBy: identity.clerkUserId,
            });
          }
        }
      }
      if (args.removeTagIds?.length) {
        tagIds = tagIds.filter((t) => !args.removeTagIds!.includes(t));
        for (const tagId of args.removeTagIds) {
          const link = await ctx.db.query("crmContactTags").withIndex("by_tag_contact", (q) => q.eq("tagId", tagId).eq("contactId", contactId)).first();
          if (link) await ctx.db.delete(link._id);
        }
      }

      const dripStatus = args.dripStatus ?? contact.dripStatus;
      await ctx.db.patch(contactId, {
        tagIds,
        ownerClerkUserId: args.ownerClerkUserId ?? contact.ownerClerkUserId,
        status: args.status ?? contact.status,
        statusChangedAt: args.status && args.status !== contact.status ? now : contact.statusChangedAt,
        dripStatus,
        dripStep: dripStatus === "not_started"
          ? 0
          : Math.max(0, Math.min(Math.round(args.dripStep ?? contact.dripStep ?? 0), DRIP_MAX_STEP)),
        emailStatus: args.emailStatus ?? contact.emailStatus,
        nextAction: args.clearNextAction ? undefined : (args.nextAction ?? contact.nextAction),
        updatedAt: now,
      });
    }
  },
});

/** Merges `loserId` into `winnerId`: activities/tasks/tags move, blank fields on the winner fill from the loser, loser is deleted. */
export const mergeContacts = mutation({
  args: { winnerId: v.id("crmContacts"), loserId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    if (args.winnerId === args.loserId) throw new Error("Cannot merge a contact into itself");
    const [winner, loser] = await Promise.all([ctx.db.get(args.winnerId), ctx.db.get(args.loserId)]);
    if (!winner || !loser) throw new Error("Contact not found");
    const now = Date.now();

    const [activities, tasks, tagLinks] = await Promise.all([
      ctx.db.query("crmActivities").withIndex("by_contact", (q) => q.eq("contactId", args.loserId)).collect(),
      ctx.db.query("crmTasks").withIndex("by_contact_status", (q) => q.eq("contactId", args.loserId)).collect(),
      ctx.db.query("crmContactTags").withIndex("by_contact", (q) => q.eq("contactId", args.loserId)).collect(),
    ]);
    for (const a of activities) await ctx.db.patch(a._id, { contactId: args.winnerId });
    for (const t of tasks) await ctx.db.patch(t._id, { contactId: args.winnerId });

    const winnerTagIds = new Set(winner.tagIds);
    for (const link of tagLinks) {
      if (winnerTagIds.has(link.tagId)) {
        await ctx.db.delete(link._id);
      } else {
        await ctx.db.patch(link._id, { contactId: args.winnerId });
        winnerTagIds.add(link.tagId);
      }
    }

    // fill_blanks_only: the winner keeps its own values, loser only fills gaps.
    const fillable: (keyof Doc<"crmContacts">)[] = [
      "jobTitle", "companyId", "companyName", "email", "mobilePhone", "officePhone",
      "officePhoneExt", "linkedinUrl", "city", "state", "postalCode",
    ];
    const patch: Record<string, unknown> = { tagIds: Array.from(winnerTagIds), updatedAt: now };
    for (const field of fillable) {
      if (!winner[field] && loser[field]) patch[field] = loser[field];
    }
    await ctx.db.patch(args.winnerId, patch);
    await ctx.db.delete(args.loserId);

    await insertActivity(ctx, {
      contactId: args.winnerId,
      activityType: "merged",
      title: "Merged with a duplicate contact",
      metadata: { loserName: loser.fullName, loserEmail: loser.email },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
    await recordAdminAction(ctx, identity, {
      action: "crm.contact.merge",
      targetType: "crmContacts",
      targetId: args.winnerId,
      summary: `Merged ${loser.fullName} into ${winner.fullName}`,
    });
  },
});

export const deleteContact = mutation({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return;

    const [activities, tasks, tagLinks] = await Promise.all([
      ctx.db.query("crmActivities").withIndex("by_contact", (q) => q.eq("contactId", args.contactId)).collect(),
      ctx.db.query("crmTasks").withIndex("by_contact_status", (q) => q.eq("contactId", args.contactId)).collect(),
      ctx.db.query("crmContactTags").withIndex("by_contact", (q) => q.eq("contactId", args.contactId)).collect(),
    ]);
    for (const a of activities) await ctx.db.delete(a._id);
    for (const t of tasks) await ctx.db.delete(t._id);
    for (const l of tagLinks) await ctx.db.delete(l._id);
    await ctx.db.delete(args.contactId);

    await recordAdminAction(ctx, identity, {
      action: "crm.contact.delete",
      targetType: "crmContacts",
      targetId: args.contactId,
      summary: `Deleted contact ${contact.fullName}`,
    });
  },
});
