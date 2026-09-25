/**
 * CRM SETUP — the admin-facing side of the deal-pipeline migration.
 *
 * The migration logic itself lives in maintenance.ts, which is deliberately
 * internal-only (crons and dashboard-triggered backfills). This module is the
 * thin public surface a manager can actually reach from /admin/crm/settings:
 * a status read, and one guarded trigger.
 *
 * Separated rather than making maintenance.ts public because the two have
 * different audiences and different blast radii — everything here is gated by
 * requireCrmManager and safe to press twice.
 */

import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireCrmUser, requireCrmManager } from "./guards";
import { ensureDefaultPipeline } from "./pipelines";
import { seedRelationshipTagsInner } from "./maintenance";
import { RELATIONSHIP_CATEGORY_SLUG, RELATIONSHIP_TAG_SEED } from "./lib/relationshipTags";
import { isLegacyStatus } from "./lib/contactStatus";

/** Bounded, same ceiling analytics uses — this is a status panel, not a report. */
const STATUS_CAP = 5000;

/**
 * What is and isn't set up. Drives the settings panel so the button can say
 * what it will actually do rather than being a mystery switch.
 */
export const expansionStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);

    const pipeline = await ctx.db
      .query("crmPipelines")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    const stages = pipeline
      ? await ctx.db
          .query("crmPipelineStages")
          .withIndex("by_pipeline_order", (q) => q.eq("pipelineId", pipeline._id))
          .collect()
      : [];

    const relationshipCategory = await ctx.db
      .query("crmTagCategories")
      .withIndex("by_slug", (q) => q.eq("slug", RELATIONSHIP_CATEGORY_SLUG))
      .first();

    const relationshipTags = relationshipCategory
      ? await ctx.db
          .query("crmTags")
          .withIndex("by_category", (q) => q.eq("categoryId", relationshipCategory._id))
          .collect()
      : [];

    // Two bounded scans plus a Set beats one point-lookup per company: the
    // backfill writes exactly one deal per company, so comparing distinct
    // companyIds on deals against the company count is both cheap and exact
    // at this scale.
    const companies = await ctx.db.query("crmCompanies").take(STATUS_CAP);
    const deals = await ctx.db.query("crmDeals").take(STATUS_CAP);
    const companiesWithDeals = new Set(deals.map((d) => d.companyId)).size;

    const companiesMissingDeals = Math.max(0, companies.length - companiesWithDeals);

    // Same bounded-scan approach for the status redesign: a contact still on a
    // legacy value, or with no drip state, is one migrateContactStatuses has
    // yet to reach.
    const contacts = await ctx.db.query("crmContacts").take(STATUS_CAP);
    const contactsNeedingMigration = contacts.filter(
      (c) => isLegacyStatus(c.status) || c.dripStatus === undefined,
    ).length;

    return {
      pipelineReady: !!pipeline && stages.length > 0,
      stageCount: stages.length,
      relationshipTagsReady: !!relationshipCategory && relationshipTags.length >= RELATIONSHIP_TAG_SEED.length,
      relationshipTagCount: relationshipTags.length,
      expectedRelationshipTags: RELATIONSHIP_TAG_SEED.length,
      companyCount: companies.length,
      dealCount: deals.length,
      companiesMissingDeals,
      contactCount: contacts.length,
      contactsNeedingMigration,
      statusMigrationReady: contactsNeedingMigration === 0,
      /** True when there is nothing left for the button to do. */
      isComplete:
        !!pipeline &&
        stages.length > 0 &&
        !!relationshipCategory &&
        relationshipTags.length >= RELATIONSHIP_TAG_SEED.length &&
        companiesMissingDeals === 0 &&
        contactsNeedingMigration === 0,
      /** Counts are capped; a book larger than this reports the ceiling. */
      truncated:
        companies.length >= STATUS_CAP ||
        deals.length >= STATUS_CAP ||
        contacts.length >= STATUS_CAP,
    };
  },
});

/**
 * Run the one-time setup: default pipeline + stages, the Relationship Type
 * taxonomy, then the (self-rescheduling, chunked) deal backfill.
 *
 * Idempotent in all three parts — pressing it twice creates nothing twice, and
 * pressing it after adding new companies backfills only the new ones. Manager
 * only: it writes a row for every company in the book.
 */
export const runExpansionSetup = mutation({
  args: {},
  handler: async (ctx): Promise<{ pipelineCreated: boolean; tagsCreated: number; backfillStarted: boolean }> => {
    await requireCrmManager(ctx);

    const { created } = await ensureDefaultPipeline(ctx);
    const { createdTags } = await seedRelationshipTagsInner(ctx);

    // Scheduled rather than inline: the backfill pages through every company
    // and self-reschedules, which must not run inside the caller's mutation.
    await ctx.scheduler.runAfter(0, internal.crm.maintenance.backfillDealsFromCompanies, {});

    return { pipelineCreated: created, tagsCreated: createdTags, backfillStarted: true };
  },
});

/**
 * Run the contact status migration on demand. Chunked and self-rescheduling,
 * so this only kicks off the first page. Safe to press repeatedly: rows
 * already migrated are skipped.
 */
export const migrateStatusesNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCrmManager(ctx);
    await ctx.scheduler.runAfter(0, internal.crm.maintenance.migrateContactStatuses, {});
    return { started: true };
  },
});

/**
 * Re-run the primary-deal cache reconciliation on demand. The nightly cron
 * already does this; the button exists for the case where someone has just
 * noticed a company and its board card disagreeing and wants it fixed now.
 */
export const reconcileNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCrmManager(ctx);
    await ctx.scheduler.runAfter(0, internal.crm.maintenance.reconcilePrimaryDealCache, {});
    return { started: true };
  },
});
