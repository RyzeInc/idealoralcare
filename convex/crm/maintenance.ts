/**
 * CRM MAINTENANCE — internal-only cron jobs and one-time backfills.
 *
 * reconcileCounters exists because contactCount/companyCount on crmTags are
 * a display cache maintained incrementally by tags.ts — this is the
 * self-healing pass that catches any drift, the same role
 * subscriptions/reconcile.ts plays for Stripe subscription status.
 */

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { ensureDefaultPipeline } from "./pipelines";
import { isLegacyStatus, LEGACY_STATUS_MIGRATION } from "./lib/contactStatus";
import { syncPrimaryDealCache, BOARD_POSITION_GAP } from "./lib/dealCache";
import { RELATIONSHIP_CATEGORY_SLUG, RELATIONSHIP_TAG_SEED } from "./lib/relationshipTags";

const DRAFT_STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

export const reconcileCounters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tags = await ctx.db.query("crmTags").collect();
    let fixed = 0;
    for (const tag of tags) {
      const [contactLinks, companyLinks] = await Promise.all([
        ctx.db.query("crmContactTags").withIndex("by_tag_contact", (q) => q.eq("tagId", tag._id)).collect(),
        ctx.db.query("crmContactTags").withIndex("by_tag_company", (q) => q.eq("tagId", tag._id)).collect(),
      ]);
      const contactCount = contactLinks.filter((l) => l.contactId).length;
      const companyCount = companyLinks.filter((l) => l.companyId).length;
      if (contactCount !== tag.contactCount || companyCount !== tag.companyCount) {
        await ctx.db.patch(tag._id, { contactCount, companyCount });
        fixed++;
      }
    }
    return { checked: tags.length, fixed };
  },
});

/**
 * ONE-TIME MIGRATION — move every contact onto the redesigned status spine and
 * give pre-existing rows a drip state.
 *
 * Ordering matters and is why this is a separate pass rather than part of the
 * deploy: convex/schema.ts still ACCEPTS the five legacy values, because
 * Convex validates the whole table at deploy time and a union that rejected
 * them would fail the deploy while rows still carried them. So the sequence is
 * deploy (both accepted) → run this → drop the legacy literals from the schema
 * and from contacts.ts's STATUS_VALIDATOR in a follow-up commit.
 *
 * `statusChangedAt` is deliberately left alone: the relationship did not
 * change, only the name we give it, and rewriting the date would erase how
 * long each contact has genuinely been sitting where they are.
 *
 * Chunked and self-rescheduling, like the backfills below. Idempotent — a row
 * already on a new value with a drip state set is skipped, so re-running is
 * free.
 */
export const migrateContactStatuses = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ done: boolean; migrated: number }> => {
    const page = await ctx.db
      .query("crmContacts")
      .withIndex("by_updated")
      .paginate({ numItems: BACKFILL_CHUNK_SIZE, cursor: args.cursor ?? null });

    let migrated = 0;
    for (const contact of page.page) {
      const patch: Partial<Doc<"crmContacts">> = {};
      if (isLegacyStatus(contact.status)) {
        patch.status = LEGACY_STATUS_MIGRATION[contact.status];
      }
      if (contact.dripStatus === undefined) {
        patch.dripStatus = "not_started";
        patch.dripStep = 0;
      }
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch(contact._id, patch);
      migrated++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.maintenance.migrateContactStatuses, { cursor: page.continueCursor });
    }
    return { done: page.isDone, migrated };
  },
});

/**
 * A dial URI (tel:, rcmobile:, etc.) can hand the browser to another app
 * before completeCall/discardCall ever fires — this sweeps up whatever a rep
 * never came back to close out, so drafts don't accumulate forever.
 */
export const expireStaleCallDrafts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DRAFT_STALE_AFTER_MS;
    const oldCalls = await ctx.db
      .query("crmActivities")
      .withIndex("by_type_occurred", (q) => q.eq("activityType", "call").lt("occurredAt", cutoff))
      .collect();
    const stale = oldCalls.filter((a) => a.isDraft);
    for (const a of stale) await ctx.db.delete(a._id);
    return { expired: stale.length };
  },
});

const BACKFILL_CHUNK_SIZE = 100;

/**
 * One-time backfill for contacts that converted before markConverted existed
 * to compute convertEmailCount/convertCallCount/convertTouchCount at
 * conversion time. Chunked + self-rescheduling so it never risks the ~1s
 * mutation compute budget on a large book. Trigger manually (dev-tools), not
 * on a cron — this should only ever need to run once.
 */
export const backfillConversionMetrics = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ done: boolean; processed: number }> => {
    const page = await ctx.db
      .query("crmContacts")
      .withIndex("by_converted")
      .filter((q) => q.neq(q.field("convertedAt"), undefined))
      .paginate({ numItems: BACKFILL_CHUNK_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const contact of page.page) {
      if (contact.convertTouchCount !== undefined) continue; // already backfilled
      const since = contact.firstTouchAt ?? contact.createdAt;
      const activities = await ctx.db
        .query("crmActivities")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id).gte("occurredAt", since))
        .collect();
      const touches = activities.filter((a) => a.isTouch && !a.isDraft);
      await ctx.db.patch(contact._id, {
        convertEmailCount: touches.filter((a) => a.activityType === "email_outbound").length,
        convertCallCount: touches.filter((a) => a.activityType === "call").length,
        convertTouchCount: touches.length,
        convertDaysToClose: contact.convertedAt
          ? Math.round((contact.convertedAt - since) / (24 * 60 * 60 * 1000))
          : undefined,
      });
      processed++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.maintenance.backfillConversionMetrics, { cursor: page.continueCursor });
    }
    return { done: page.isDone, processed };
  },
});

/**
 * ONE-TIME MIGRATION — lift every existing company onto the deal pipeline.
 *
 * Companies used to carry the stage themselves. This seeds the default
 * pipeline (nine stages mapping 1:1 to the old hardcoded union, so nothing
 * changes semantically on day one) and gives each company a primary deal
 * mirroring the values it already had. Idempotent: a company that already has
 * a deal is skipped, so a re-run is safe.
 *
 * Chunked and self-rescheduling for the same reason backfillConversionMetrics
 * is — a large book must not risk the mutation compute budget.
 */
export const backfillDealsFromCompanies = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ done: boolean; created: number; skipped: number }> => {
    const { stagesByCanonical } = await ensureDefaultPipeline(ctx);

    const page = await ctx.db
      .query("crmCompanies")
      .withIndex("by_updated")
      .paginate({ numItems: BACKFILL_CHUNK_SIZE, cursor: args.cursor ?? null });

    let created = 0;
    let skipped = 0;

    for (const company of page.page) {
      const existing = await ctx.db
        .query("crmDeals")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .first();
      if (existing) {
        skipped++;
        continue;
      }

      const stageId = stagesByCanonical.get(company.stage);
      if (!stageId) {
        skipped++;
        continue;
      }

      const now = Date.now();
      await ctx.db.insert("crmDeals", {
        pipelineId: (await ctx.db.get(stageId))!.pipelineId,
        stageId,
        // Preserve the original stage timestamp: overwriting it with `now`
        // would reset every deal's age and corrupt stage-velocity reporting.
        stageChangedAt: company.stageChangedAt,
        companyId: company._id,
        name: `${company.name} — benefits`,
        ownerClerkUserId: company.ownerClerkUserId,
        mrrCents: company.estimatedMrrCents,
        estimatedLives: company.estimatedLives,
        winProbability: company.winProbability,
        expectedCloseDate: company.expectedCloseDate,
        lostReason: company.lostReason,
        closedAt: company.convertedAt,
        isPrimary: true,
        boardPosition: BOARD_POSITION_GAP * (created + 1),
        source: "migration",
        isArchived: company.isArchived,
        searchText: `${company.name} — benefits ${company.name}`.toLowerCase(),
        createdAt: company.createdAt,
        updatedAt: now,
        createdBy: company.createdBy,
      });
      created++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.maintenance.backfillDealsFromCompanies, { cursor: page.continueCursor });
    }
    return { done: page.isDone, created, skipped };
  },
});

/**
 * Self-healing pass for the primary-deal cache on crmCompanies — the same role
 * reconcileCounters plays for tag counts. Catches drift from a crashed
 * mutation, a manual console edit, or a deal archived without a sync.
 */
export const reconcilePrimaryDealCache = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ done: boolean; checked: number; fixed: number }> => {
    const page = await ctx.db
      .query("crmCompanies")
      .withIndex("by_updated")
      .paginate({ numItems: BACKFILL_CHUNK_SIZE, cursor: args.cursor ?? null });

    let fixed = 0;
    for (const company of page.page) {
      const before = company.stage;
      await syncPrimaryDealCache(ctx, company._id);
      const after = await ctx.db.get(company._id);
      if (after && after.stage !== before) fixed++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.maintenance.reconcilePrimaryDealCache, { cursor: page.continueCursor });
    }
    return { done: page.isDone, checked: page.page.length, fixed };
  },
});

/**
 * Seed the Relationship Type tag category. Idempotent, and safe to run on a
 * live book — it only ever adds the category and its tags, never applies them
 * to anyone. See lib/relationshipTags.ts for why this is a tag category rather
 * than a column.
 */
/** Exported so crm/setup.ts's manager-facing trigger seeds via the same path. */
export async function seedRelationshipTagsInner(
  ctx: MutationCtx,
): Promise<{ categoryId: Id<"crmTagCategories">; createdTags: number }> {
  const now = Date.now();
  let category = await ctx.db
    .query("crmTagCategories")
    .withIndex("by_slug", (q) => q.eq("slug", RELATIONSHIP_CATEGORY_SLUG))
    .first();

  if (!category) {
    const count = (await ctx.db.query("crmTagCategories").collect()).length;
    const categoryId = await ctx.db.insert("crmTagCategories", {
      name: "Relationship Type",
      slug: RELATIONSHIP_CATEGORY_SLUG,
      description: "What this person or organisation is to us — prospect, partner, member contact, vendor.",
      color: "teal",
      // NOT exclusive: someone can legitimately be both a broker partner and
      // an enrolled-member contact, which a single-select category (or an
      // enum column) could not express.
      isExclusive: false,
      isPrimaryFilter: true,
      order: count,
      appliesTo: "both",
      createdAt: now,
      updatedAt: now,
    });
    category = (await ctx.db.get(categoryId))!;
  }

  let createdTags = 0;
  for (const seed of RELATIONSHIP_TAG_SEED) {
    const existing = await ctx.db
      .query("crmTags")
      .withIndex("by_category_slug", (q) => q.eq("categoryId", category!._id).eq("slug", seed.slug))
      .first();
    if (existing) continue;
    await ctx.db.insert("crmTags", {
      categoryId: category._id,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      color: seed.color,
      contactCount: 0,
      companyCount: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    createdTags++;
  }

  return { categoryId: category._id, createdTags };
}

export const seedRelationshipTags = internalMutation({
  args: {},
  handler: async (ctx) => await seedRelationshipTagsInner(ctx),
});

/**
 * The whole day-one setup, in one call: pipeline + stages, relationship
 * taxonomy, then the (self-rescheduling) deal backfill. Exposed so the CRM
 * settings page has a single "initialise" button rather than three
 * ordering-sensitive ones.
 */
export const initializeCrmExpansion = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ pipelineCreated: boolean; tagsCreated: number }> => {
    const { created } = await ensureDefaultPipeline(ctx);
    const tags = await seedRelationshipTagsInner(ctx);
    await ctx.scheduler.runAfter(0, internal.crm.maintenance.backfillDealsFromCompanies, {});
    return { pipelineCreated: created, tagsCreated: tags.createdTags };
  },
});
