/**
 * CRM DEALS — the opportunity record. crmCompanies' stage columns are a cache
 * of the PRIMARY deal here (see lib/dealCache.ts for the single writer).
 *
 * TWO INVARIANTS THIS MODULE EXISTS TO HOLD, both of which break analytics
 * silently rather than loudly if violated:
 *
 *   1. Every stage_changed activity carries BOTH dealId and companyId, and
 *      puts the CANONICAL stage string — never the stage row id — in
 *      metadata.from/metadata.to. analytics.ts:funnelByStage groups on
 *      metadata.to and stageVelocity groups on companyId; a deal-only row with
 *      raw ids in metadata would just quietly vanish from both charts.
 *
 *   2. syncPrimaryDealCache runs after every write that touches a primary
 *      deal's stage, value or lifecycle. Anything that patches crmCompanies'
 *      stage columns directly is a bug.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { insertActivity } from "./activities";
import { recordAdminAction } from "../admin/adminAudit";
import { ensureDefaultPipeline } from "./pipelines";
import { syncPrimaryDealCache, positionBetween, BOARD_POSITION_GAP } from "./lib/dealCache";
import { fireWorkflowTrigger } from "./workflowTriggers";

function buildDealSearchText(fields: { name: string; companyName?: string; ownerName?: string }): string {
  return [fields.name, fields.companyName, fields.ownerName].filter(Boolean).join(" ").toLowerCase();
}

/** Trailing edge of a stage column, so new cards land at the bottom. */
async function nextPositionInStage(ctx: MutationCtx, stageId: Id<"crmPipelineStages">): Promise<number> {
  const last = await ctx.db
    .query("crmDeals")
    .withIndex("by_stage_position", (q) => q.eq("stageId", stageId))
    .order("desc")
    .first();
  return last ? last.boardPosition + BOARD_POSITION_GAP : BOARD_POSITION_GAP;
}

// ---------------------------------------------------------------- queries

/**
 * The Kanban payload: every open deal for a pipeline, grouped by stage, with
 * per-column rollups computed server-side. Capped — a board that would render
 * more than this is a filtering problem, not a paging problem.
 */
const BOARD_CAP = 2000;

export interface BoardColumn {
  stage: Doc<"crmPipelineStages">;
  deals: (Doc<"crmDeals"> & { companyName: string })[];
  rollup: { count: number; grossCents: number; weightedCents: number; lives: number };
}

export const boardByStage = query({
  args: {
    pipelineId: v.optional(v.id("crmPipelines")),
    ownerClerkUserId: v.optional(v.string()),
  },
  // Annotated so the "no pipeline yet" branch and the populated branch share
  // ONE type. Without this, TS infers `columns: never[]` for the empty branch,
  // and the board's optimistic update can't typecheck against the union.
  handler: async (ctx, args): Promise<{ pipelineId: Id<"crmPipelines"> | null; columns: BoardColumn[] }> => {
    await requireCrmUser(ctx);

    let pipelineId = args.pipelineId;
    if (!pipelineId) {
      const def = await ctx.db.query("crmPipelines").withIndex("by_default", (q) => q.eq("isDefault", true)).first();
      if (!def) return { pipelineId: null, columns: [] };
      pipelineId = def._id;
    }

    const stages = (
      await ctx.db.query("crmPipelineStages").withIndex("by_pipeline_order", (q) => q.eq("pipelineId", pipelineId!)).collect()
    )
      .filter((s) => !s.isArchived)
      .sort((a, b) => a.order - b.order);

    const columns = await Promise.all(
      stages.map(async (stage) => {
        const deals = (
          await ctx.db
            .query("crmDeals")
            .withIndex("by_stage_position", (q) => q.eq("stageId", stage._id))
            .take(BOARD_CAP)
        ).filter((d) => !d.isArchived && (!args.ownerClerkUserId || d.ownerClerkUserId === args.ownerClerkUserId));

        const companies = await Promise.all(deals.map((d) => ctx.db.get(d.companyId)));

        let grossCents = 0;
        let weightedCents = 0;
        let lives = 0;
        for (const deal of deals) {
          const amount = deal.mrrCents ?? deal.amountCents ?? 0;
          // Stage row's own probability — never the hardcoded canonical map.
          const probability = deal.winProbability ?? stage.probability;
          grossCents += amount;
          weightedCents += Math.round((amount * probability) / 100);
          lives += deal.estimatedLives ?? 0;
        }

        return {
          stage,
          deals: deals.map((deal, i) => ({
            ...deal,
            companyName: companies[i]?.name ?? "—",
          })),
          rollup: { count: deals.length, grossCents, weightedCents, lives },
        };
      })
    );

    return { pipelineId, columns };
  },
});

export const getDeal = query({
  args: { dealId: v.id("crmDeals") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) return null;
    const [company, stage, primaryContact] = await Promise.all([
      ctx.db.get(deal.companyId),
      ctx.db.get(deal.stageId),
      deal.primaryContactId ? ctx.db.get(deal.primaryContactId) : Promise.resolve(null),
    ]);
    return { deal, company, stage, primaryContact };
  },
});

export const listDealsForCompany = query({
  args: { companyId: v.id("crmCompanies"), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const deals = await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", args.companyId)).collect();
    const filtered = args.includeArchived ? deals : deals.filter((d) => !d.isArchived);
    const stages = await Promise.all(filtered.map((d) => ctx.db.get(d.stageId)));
    return filtered.map((deal, i) => ({ ...deal, stage: stages[i] }));
  },
});

export const listDeals = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchTerm: v.optional(v.string()),
    stageId: v.optional(v.id("crmPipelineStages")),
    ownerClerkUserId: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const isArchived = args.isArchived ?? false;
    const term = args.searchTerm?.trim();

    if (term && term.length >= 2) {
      return await ctx.db
        .query("crmDeals")
        .withSearchIndex("search_deals", (q) => {
          let sq = q.search("searchText", term).eq("isArchived", isArchived);
          if (args.stageId) sq = sq.eq("stageId", args.stageId);
          if (args.ownerClerkUserId) sq = sq.eq("ownerClerkUserId", args.ownerClerkUserId);
          return sq;
        })
        .paginate(args.paginationOpts);
    }

    const result = args.stageId
      ? await ctx.db.query("crmDeals").withIndex("by_stage_position", (q) => q.eq("stageId", args.stageId!)).order("desc").paginate(args.paginationOpts)
      : await ctx.db.query("crmDeals").withIndex("by_updated").order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((d) => d.isArchived === isArchived) };
  },
});

// ---------------------------------------------------------------- mutations

export const createDeal = mutation({
  args: {
    companyId: v.id("crmCompanies"),
    name: v.optional(v.string()),
    stageId: v.optional(v.id("crmPipelineStages")),
    primaryContactId: v.optional(v.id("crmContacts")),
    ownerClerkUserId: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    mrrCents: v.optional(v.number()),
    estimatedLives: v.optional(v.number()),
    winProbability: v.optional(v.number()),
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    /** First deal on a company becomes primary automatically. */
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error("Company not found");

    const { pipelineId, stagesByCanonical } = await ensureDefaultPipeline(ctx);
    const stageId = args.stageId ?? stagesByCanonical.get("unqualified");
    if (!stageId) throw new Error("No opening stage configured on the default pipeline");

    const stage = await ctx.db.get(stageId);
    if (!stage) throw new Error("Stage not found");

    const existing = (
      await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", args.companyId)).collect()
    ).filter((d) => !d.isArchived);
    const isPrimary = args.isPrimary ?? existing.length === 0;

    const now = Date.now();
    const name = args.name?.trim() || `${company.name} — benefits`;

    const dealId = await ctx.db.insert("crmDeals", {
      pipelineId: stage.pipelineId ?? pipelineId,
      stageId,
      stageChangedAt: now,
      companyId: args.companyId,
      primaryContactId: args.primaryContactId,
      name,
      ownerClerkUserId: args.ownerClerkUserId ?? company.ownerClerkUserId ?? identity.clerkUserId,
      amountCents: args.amountCents,
      mrrCents: args.mrrCents,
      estimatedLives: args.estimatedLives,
      winProbability: args.winProbability,
      expectedCloseDate: args.expectedCloseDate,
      isPrimary,
      boardPosition: await nextPositionInStage(ctx, stageId),
      notes: args.notes,
      isArchived: false,
      searchText: buildDealSearchText({ name, companyName: company.name }),
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
    });

    await insertActivity(ctx, {
      dealId,
      companyId: args.companyId,
      contactId: args.primaryContactId,
      activityType: "system",
      title: `Deal created: ${name}`,
      metadata: { stage: stage.canonicalStage },
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });

    if (isPrimary) await syncPrimaryDealCache(ctx, args.companyId);

    await fireWorkflowTrigger(ctx, {
      triggerType: "deal_created",
      targetType: "deal",
      targetId: dealId,
      occurrenceKey: `created:${dealId}`,
    });

    return dealId;
  },
});

const DEAL_WRITABLE_FIELDS = {
  name: v.string(),
  primaryContactId: v.optional(v.id("crmContacts")),
  amountCents: v.optional(v.number()),
  mrrCents: v.optional(v.number()),
  estimatedLives: v.optional(v.number()),
  winProbability: v.optional(v.number()),
  expectedCloseDate: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const updateDeal = mutation({
  args: { dealId: v.id("crmDeals"), fields: v.object(DEAL_WRITABLE_FIELDS) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    if (args.fields.winProbability !== undefined && (args.fields.winProbability < 0 || args.fields.winProbability > 100)) {
      throw new Error("Win probability must be between 0 and 100");
    }
    const company = await ctx.db.get(deal.companyId);

    await ctx.db.patch(args.dealId, {
      ...args.fields,
      searchText: buildDealSearchText({ name: args.fields.name, companyName: company?.name }),
      updatedAt: Date.now(),
    });

    if (deal.isPrimary) await syncPrimaryDealCache(ctx, deal.companyId);
  },
});

export const setDealOwner = mutation({
  args: { dealId: v.id("crmDeals"), ownerClerkUserId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    await ctx.db.patch(args.dealId, { ownerClerkUserId: args.ownerClerkUserId, updatedAt: Date.now() });
    await insertActivity(ctx, {
      dealId: args.dealId,
      companyId: deal.companyId,
      activityType: "owner_changed",
      title: "Deal owner changed",
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
  },
});

/**
 * THE stage-move path. Exported as a plain function so the public mutation
 * below AND the workflow engine's `update_deal_stage` action both go through
 * it — an automated stage change must produce byte-identical timeline history
 * to a human drag, or the funnel gets two different shapes of truth.
 *
 * `beforePosition`/`afterPosition` are the board positions either side of the
 * drop point — passing neither appends to the column.
 */
export async function applyStageMove(
  ctx: MutationCtx,
  params: {
    deal: Doc<"crmDeals">;
    stageId: Id<"crmPipelineStages">;
    actor: { clerkUserId?: string; name: string; actorType: "staff" | "system" };
    beforePosition?: number;
    afterPosition?: number;
    lostReason?: string;
  },
): Promise<{ stageChanged: boolean; canonicalStage: string }> {
  const { deal, stageId, actor } = params;

  const [fromStage, toStage] = await Promise.all([ctx.db.get(deal.stageId), ctx.db.get(stageId)]);
  if (!toStage) throw new Error("Target stage not found");
  if (toStage.isArchived) throw new Error("Cannot move a deal into an archived stage");

  const stageChanged = deal.stageId !== stageId;
  const now = Date.now();

  const boardPosition =
    params.beforePosition === undefined && params.afterPosition === undefined
      ? await nextPositionInStage(ctx, stageId)
      : positionBetween(params.beforePosition, params.afterPosition);

  await ctx.db.patch(deal._id, {
    stageId,
    stageChangedAt: stageChanged ? now : deal.stageChangedAt,
    boardPosition,
    lostReason: toStage.isLost ? (params.lostReason ?? deal.lostReason) : undefined,
    closedAt: toStage.isWon || toStage.isLost ? (deal.closedAt ?? now) : undefined,
    updatedAt: now,
  });

  if (stageChanged) {
    // BOTH ids, and CANONICAL strings in metadata — see this module's header.
    await insertActivity(ctx, {
      dealId: deal._id,
      companyId: deal.companyId,
      contactId: deal.primaryContactId,
      activityType: "stage_changed",
      title: `Stage changed to ${toStage.name}`,
      metadata: {
        from: fromStage?.canonicalStage,
        to: toStage.canonicalStage,
        fromStageName: fromStage?.name,
        toStageName: toStage.name,
      },
      actorType: actor.actorType,
      actorClerkUserId: actor.clerkUserId,
      actorName: actor.name,
    });
  }

  if (deal.isPrimary) await syncPrimaryDealCache(ctx, deal.companyId);

  if (stageChanged) {
    await fireWorkflowTrigger(ctx, {
      triggerType: "stage_entered",
      targetType: "deal",
      targetId: deal._id,
      stageId,
      // Re-entering a stage later is a NEW occurrence and should re-fire;
      // a duplicate event for THIS entry collides on the same key.
      occurrenceKey: `stage:${stageId}:${now}`,
    });
  }

  return { stageChanged, canonicalStage: toStage.canonicalStage };
}

/** The Kanban drag target. */
export const moveDealStage = mutation({
  args: {
    dealId: v.id("crmDeals"),
    stageId: v.id("crmPipelineStages"),
    beforePosition: v.optional(v.number()),
    afterPosition: v.optional(v.number()),
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");

    return await applyStageMove(ctx, {
      deal,
      stageId: args.stageId,
      actor: {
        clerkUserId: identity.clerkUserId,
        name: identity.name ?? identity.email ?? "Staff",
        actorType: "staff",
      },
      beforePosition: args.beforePosition,
      afterPosition: args.afterPosition,
      lostReason: args.lostReason,
    });
  },
});

/** Reorder within the same column without touching stage or logging a change. */
export const repositionDeal = mutation({
  args: {
    dealId: v.id("crmDeals"),
    beforePosition: v.optional(v.number()),
    afterPosition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.dealId, {
      boardPosition: positionBetween(args.beforePosition, args.afterPosition),
      updatedAt: Date.now(),
    });
  },
});

export const setPrimaryDeal = mutation({
  args: { dealId: v.id("crmDeals") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");
    if (deal.isArchived) throw new Error("An archived deal cannot be the primary deal");

    const siblings = await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", deal.companyId)).collect();
    for (const sibling of siblings) {
      if (sibling.isPrimary && sibling._id !== args.dealId) {
        await ctx.db.patch(sibling._id, { isPrimary: false, updatedAt: Date.now() });
      }
    }
    await ctx.db.patch(args.dealId, { isPrimary: true, updatedAt: Date.now() });
    await syncPrimaryDealCache(ctx, deal.companyId);
  },
});

export const archiveDeal = mutation({
  args: { dealId: v.id("crmDeals"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");

    await ctx.db.patch(args.dealId, {
      isArchived: args.archived,
      // Archiving the primary hands primacy to the next open deal via the
      // cache sync below, rather than leaving the company pointing at a
      // hidden row.
      isPrimary: args.archived ? false : deal.isPrimary,
      updatedAt: Date.now(),
    });
    await syncPrimaryDealCache(ctx, deal.companyId);

    await recordAdminAction(ctx, identity, {
      action: args.archived ? "crm.deal.archive" : "crm.deal.restore",
      targetType: "crmDeals",
      targetId: args.dealId,
      summary: `${args.archived ? "Archived" : "Restored"} deal "${deal.name}"`,
    });
  },
});

export const deleteDeal = mutation({
  args: { dealId: v.id("crmDeals") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found");

    // Timeline rows survive a deleted deal — they are the funnel's history.
    // Only the pointer is cleared.
    const activities = await ctx.db.query("crmActivities").withIndex("by_deal", (q) => q.eq("dealId", args.dealId)).collect();
    for (const activity of activities) await ctx.db.patch(activity._id, { dealId: undefined });

    const tasks = await ctx.db.query("crmTasks").withIndex("by_deal_status", (q) => q.eq("dealId", args.dealId)).collect();
    for (const task of tasks) await ctx.db.patch(task._id, { dealId: undefined });

    await ctx.db.delete(args.dealId);
    await syncPrimaryDealCache(ctx, deal.companyId);

    await recordAdminAction(ctx, identity, {
      action: "crm.deal.delete",
      targetType: "crmDeals",
      targetId: args.dealId,
      summary: `Deleted deal "${deal.name}"`,
    });
  },
});
