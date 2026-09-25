/**
 * PIPELINES & STAGES — the configurable layer over the fixed canonical spine.
 *
 * Every stage row declares a `canonicalStage` from the same nine-value union
 * `crmCompanies.stage` uses. That is what keeps this configurable without a
 * migration: sales ops renames "Verbal" to "Verbal Commit" or inserts a "Legal
 * Review" column, and the search index, by_stage, saved segments and the
 * funnel keep reading a stable canonical value underneath.
 *
 * Deleting a stage is deliberately absent. A stage with deals on it cannot go
 * away without silently reparenting or orphaning them — archive it instead
 * (archived stages stay resolvable for historical deals but leave the board).
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { syncPrimaryDealCache } from "./lib/dealCache";

const CANONICAL_STAGE_VALIDATOR = v.union(
  v.literal("unqualified"), v.literal("prospect"), v.literal("contacted"),
  v.literal("engaged"), v.literal("proposal"), v.literal("verbal"),
  v.literal("won"), v.literal("lost"), v.literal("dormant"),
);

export type CanonicalStage = Doc<"crmPipelineStages">["canonicalStage"];

/**
 * The seed set — deliberately identical to the hardcoded union companies have
 * always used, so the migration is a pure lift with no semantic change on day
 * one. Probabilities match STAGE_DEFAULT_PROBABILITY in
 * src/components/admin/crm/constants.ts.
 */
export const DEFAULT_STAGE_SEED: {
  name: string;
  canonicalStage: CanonicalStage;
  probability: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  isFolded: boolean;
}[] = [
  { name: "Unqualified", canonicalStage: "unqualified", probability: 5, color: "slate", isWon: false, isLost: false, isFolded: false },
  { name: "Prospect", canonicalStage: "prospect", probability: 10, color: "slate", isWon: false, isLost: false, isFolded: false },
  { name: "Contacted", canonicalStage: "contacted", probability: 20, color: "blue", isWon: false, isLost: false, isFolded: false },
  { name: "Engaged", canonicalStage: "engaged", probability: 35, color: "blue", isWon: false, isLost: false, isFolded: false },
  { name: "Proposal", canonicalStage: "proposal", probability: 55, color: "purple", isWon: false, isLost: false, isFolded: false },
  { name: "Verbal", canonicalStage: "verbal", probability: 80, color: "amber", isWon: false, isLost: false, isFolded: false },
  { name: "Won", canonicalStage: "won", probability: 100, color: "green", isWon: true, isLost: false, isFolded: false },
  { name: "Lost", canonicalStage: "lost", probability: 0, color: "red", isWon: false, isLost: true, isFolded: true },
  { name: "Dormant", canonicalStage: "dormant", probability: 5, color: "slate", isWon: false, isLost: false, isFolded: true },
];

/**
 * Find-or-create the default pipeline and its stages. Idempotent — safe to
 * call from the migration, from tests, and lazily from deals.ts when a deal is
 * created before anyone has visited the settings page.
 */
export async function ensureDefaultPipeline(ctx: MutationCtx): Promise<{
  pipelineId: Id<"crmPipelines">;
  stagesByCanonical: Map<CanonicalStage, Id<"crmPipelineStages">>;
  created: boolean;
}> {
  const now = Date.now();
  let pipeline = await ctx.db
    .query("crmPipelines")
    .withIndex("by_default", (q) => q.eq("isDefault", true))
    .first();
  let created = false;

  if (!pipeline) {
    const pipelineId = await ctx.db.insert("crmPipelines", {
      name: "Sales Pipeline",
      description: "Default employer/broker benefits pipeline",
      isDefault: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    pipeline = (await ctx.db.get(pipelineId))!;
    created = true;
  }

  const existing = await ctx.db
    .query("crmPipelineStages")
    .withIndex("by_pipeline_order", (q) => q.eq("pipelineId", pipeline!._id))
    .collect();

  const stagesByCanonical = new Map<CanonicalStage, Id<"crmPipelineStages">>();
  for (const stage of existing) {
    if (!stagesByCanonical.has(stage.canonicalStage)) {
      stagesByCanonical.set(stage.canonicalStage, stage._id);
    }
  }

  for (const [index, seed] of DEFAULT_STAGE_SEED.entries()) {
    if (stagesByCanonical.has(seed.canonicalStage)) continue;
    const stageId = await ctx.db.insert("crmPipelineStages", {
      pipelineId: pipeline._id,
      name: seed.name,
      order: index * 10,
      probability: seed.probability,
      canonicalStage: seed.canonicalStage,
      isWon: seed.isWon,
      isLost: seed.isLost,
      color: seed.color,
      isFolded: seed.isFolded,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    stagesByCanonical.set(seed.canonicalStage, stageId);
    created = true;
  }

  return { pipelineId: pipeline._id, stagesByCanonical, created };
}

/**
 * Resolve a stage's effective win probability. The stage ROW is the source of
 * truth — this is the fix for a custom stage silently weighting at 0% in
 * pipelineSummary. `dealOverride` (a deal's own winProbability) wins when set.
 */
export function resolveProbability(
  stage: Pick<Doc<"crmPipelineStages">, "probability"> | null | undefined,
  dealOverride?: number,
): number {
  if (dealOverride !== undefined && dealOverride !== null) return dealOverride;
  return stage?.probability ?? 0;
}

export async function loadStageMap(
  ctx: QueryCtx | MutationCtx,
): Promise<Map<string, Doc<"crmPipelineStages">>> {
  const stages = await ctx.db.query("crmPipelineStages").collect();
  return new Map(stages.map((s) => [s._id as string, s]));
}

// ---------------------------------------------------------------- queries

export const listPipelines = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmPipelines").withIndex("by_archived", (q) => q.eq("isArchived", false)).collect();
  },
});

/** The board's column definition. Ordered, archived excluded. */
export const listStages = query({
  args: { pipelineId: v.optional(v.id("crmPipelines")), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);

    let pipelineId = args.pipelineId;
    if (!pipelineId) {
      const def = await ctx.db.query("crmPipelines").withIndex("by_default", (q) => q.eq("isDefault", true)).first();
      if (!def) return [];
      pipelineId = def._id;
    }

    const stages = await ctx.db
      .query("crmPipelineStages")
      .withIndex("by_pipeline_order", (q) => q.eq("pipelineId", pipelineId!))
      .collect();
    return (args.includeArchived ? stages : stages.filter((s) => !s.isArchived)).sort((a, b) => a.order - b.order);
  },
});

export const getDefaultPipeline = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmPipelines").withIndex("by_default", (q) => q.eq("isDefault", true)).first();
  },
});

// ---------------------------------------------------------------- mutations

/** Callable seed for a fresh deployment / the settings page's empty state. */
export const seedDefaultPipeline = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCrmManager(ctx);
    const { pipelineId, created } = await ensureDefaultPipeline(ctx);
    return { pipelineId, created };
  },
});

export const createStage = mutation({
  args: {
    pipelineId: v.id("crmPipelines"),
    name: v.string(),
    canonicalStage: CANONICAL_STAGE_VALIDATOR,
    probability: v.number(),
    color: v.optional(v.string()),
    /** Inserted after this stage; appended when omitted. */
    afterStageId: v.optional(v.id("crmPipelineStages")),
  },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    if (args.probability < 0 || args.probability > 100) {
      throw new Error("Probability must be between 0 and 100");
    }

    const siblings = (
      await ctx.db.query("crmPipelineStages").withIndex("by_pipeline_order", (q) => q.eq("pipelineId", args.pipelineId)).collect()
    ).sort((a, b) => a.order - b.order);

    // Midpoint insert keeps every other row's order untouched.
    let order: number;
    if (args.afterStageId) {
      const idx = siblings.findIndex((s) => s._id === args.afterStageId);
      if (idx === -1) throw new Error("afterStageId is not in this pipeline");
      const next = siblings[idx + 1];
      order = next ? (siblings[idx].order + next.order) / 2 : siblings[idx].order + 10;
    } else {
      order = siblings.length > 0 ? siblings[siblings.length - 1].order + 10 : 0;
    }

    const now = Date.now();
    return await ctx.db.insert("crmPipelineStages", {
      pipelineId: args.pipelineId,
      name: args.name.trim(),
      order,
      probability: args.probability,
      canonicalStage: args.canonicalStage,
      isWon: args.canonicalStage === "won",
      isLost: args.canonicalStage === "lost",
      color: args.color,
      isFolded: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStage = mutation({
  args: {
    stageId: v.id("crmPipelineStages"),
    name: v.string(),
    probability: v.number(),
    color: v.optional(v.string()),
    isFolded: v.optional(v.boolean()),
    canonicalStage: v.optional(CANONICAL_STAGE_VALIDATOR),
  },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    if (args.probability < 0 || args.probability > 100) {
      throw new Error("Probability must be between 0 and 100");
    }
    const stage = await ctx.db.get(args.stageId);
    if (!stage) throw new Error("Stage not found");

    const canonical = args.canonicalStage ?? stage.canonicalStage;
    await ctx.db.patch(args.stageId, {
      name: args.name.trim(),
      probability: args.probability,
      color: args.color,
      isFolded: args.isFolded ?? stage.isFolded,
      canonicalStage: canonical,
      isWon: canonical === "won",
      isLost: canonical === "lost",
      updatedAt: Date.now(),
    });

    // Re-point the company cache for every deal in this stage: changing a
    // stage's canonical mapping changes what those companies report to the
    // funnel, and leaving the cache stale is precisely the drift this
    // module's single-writer rule exists to prevent.
    if (args.canonicalStage && args.canonicalStage !== stage.canonicalStage) {
      const affected = await ctx.db
        .query("crmDeals")
        .withIndex("by_stage_position", (q) => q.eq("stageId", args.stageId))
        .collect();
      const companyIds = new Set(affected.filter((d) => d.isPrimary).map((d) => d.companyId));
      for (const companyId of companyIds) await syncPrimaryDealCache(ctx, companyId);
    }
  },
});

/** Reorder by rewriting the whole ordered list — small table, simplest correct thing. */
export const reorderStages = mutation({
  args: { pipelineId: v.id("crmPipelines"), orderedStageIds: v.array(v.id("crmPipelineStages")) },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    for (const [index, stageId] of args.orderedStageIds.entries()) {
      const stage = await ctx.db.get(stageId);
      if (!stage || stage.pipelineId !== args.pipelineId) continue;
      await ctx.db.patch(stageId, { order: index * 10, updatedAt: Date.now() });
    }
  },
});

export const archiveStage = mutation({
  args: { stageId: v.id("crmPipelineStages"), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);

    if (args.archived) {
      const open = (
        await ctx.db.query("crmDeals").withIndex("by_stage_position", (q) => q.eq("stageId", args.stageId)).collect()
      ).filter((d) => !d.isArchived);
      if (open.length > 0) {
        throw new Error(`${open.length} open deal(s) are still in this stage — move them before archiving it`);
      }
    }
    await ctx.db.patch(args.stageId, { isArchived: args.archived, updatedAt: Date.now() });
  },
});
