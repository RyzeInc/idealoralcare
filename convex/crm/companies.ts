/**
 * CRM COMPANIES — the employer/broker/agency side of a benefits deal.
 *
 * Deliberately simpler than contacts.ts: companies don't have the
 * call/draft/consent machinery contacts do, and volumes are far smaller (one
 * company per employer, not one row per cold-list row), so a single
 * search-or-index-or-scan list query is enough — no need for the same
 * multi-driver predicate split contacts.ts has.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { recordAdminAction } from "../admin/adminAudit";
import { normalizeCompanyKey, buildCompanySearchText, extractDomain } from "./lib/normalize";
import { ensureDefaultPipeline } from "./pipelines";
import { applyStageMove } from "./deals";
import { BOARD_POSITION_GAP } from "./lib/dealCache";
import { fireWorkflowTrigger } from "./workflowTriggers";

const STAGE_VALIDATOR = v.union(
  v.literal("unqualified"), v.literal("prospect"), v.literal("contacted"), v.literal("engaged"),
  v.literal("proposal"), v.literal("verbal"), v.literal("won"), v.literal("lost"), v.literal("dormant"),
);

export const listCompanies = query({
  args: {
    paginationOpts: paginationOptsValidator,
    searchTerm: v.optional(v.string()),
    stage: v.optional(STAGE_VALIDATOR),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const isArchived = args.isArchived ?? false;
    const term = args.searchTerm?.trim();

    if (term && term.length >= 2) {
      const result = await ctx.db
        .query("crmCompanies")
        .withSearchIndex("search_companies", (q) => {
          let sq = q.search("searchText", term).eq("isArchived", isArchived);
          if (args.stage) sq = sq.eq("stage", args.stage);
          return sq;
        })
        .paginate(args.paginationOpts);
      return result;
    }

    const result = args.stage
      ? await ctx.db.query("crmCompanies").withIndex("by_stage", (q) => q.eq("stage", args.stage!)).order("desc").paginate(args.paginationOpts)
      : await ctx.db.query("crmCompanies").withIndex("by_updated").order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((c) => c.isArchived === isArchived) };
  },
});

export const getCompany = query({
  args: { companyId: v.id("crmCompanies") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.companyId);
  },
});

export const quickSearchCompanies = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const term = args.term.trim();
    if (term.length < 2) return [];
    return await ctx.db
      .query("crmCompanies")
      .withSearchIndex("search_companies", (q) => q.search("searchText", term).eq("isArchived", false))
      .take(args.limit ?? 20);
  },
});

const COMPANY_TYPE_VALIDATOR = v.union(
  v.literal("employer"), v.literal("broker"), v.literal("agency"), v.literal("fmo"),
  v.literal("association"), v.literal("vendor"), v.literal("other"),
);

const COMPANY_WRITABLE_FIELDS = v.object({
  name: v.string(),
  domain: v.optional(v.string()),
  website: v.optional(v.string()),
  companyType: COMPANY_TYPE_VALIDATOR,
  industry: v.optional(v.string()),
  employeeCount: v.optional(v.number()),
  phone: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
});

function buildCompanyDerivedFields(fields: { name: string; domain?: string; industry?: string; city?: string; state?: string }) {
  return {
    nameKey: normalizeCompanyKey(fields.name) ?? fields.name.toLowerCase(),
    searchText: buildCompanySearchText(fields),
  };
}

export const createCompany = mutation({
  args: { ...COMPANY_WRITABLE_FIELDS.fields, ownerClerkUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    const derived = buildCompanyDerivedFields(args);
    const domain = args.domain ?? (args.website ? extractDomain(`x@${args.website.replace(/^https?:\/\//, "").replace(/^www\./, "")}`) : undefined);

    const companyId = await ctx.db.insert("crmCompanies", {
      name: args.name,
      nameKey: derived.nameKey,
      domain,
      website: args.website,
      companyType: args.companyType,
      industry: args.industry,
      employeeCount: args.employeeCount,
      phone: args.phone,
      city: args.city,
      state: args.state,
      stage: "unqualified",
      stageChangedAt: now,
      ownerClerkUserId: args.ownerClerkUserId ?? identity.clerkUserId,
      tagIds: [],
      isArchived: false,
      searchText: derived.searchText,
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
    });

    await fireWorkflowTrigger(ctx, {
      triggerType: "company_created",
      targetType: "company",
      targetId: companyId,
      occurrenceKey: `created:${companyId}`,
    });

    return companyId;
  },
});

export const updateCompany = mutation({
  args: { companyId: v.id("crmCompanies"), fields: COMPANY_WRITABLE_FIELDS },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const derived = buildCompanyDerivedFields(args.fields);
    await ctx.db.patch(args.companyId, {
      ...args.fields,
      nameKey: derived.nameKey,
      searchText: derived.searchText,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set a company's stage — now a DELEGATION to its primary deal, not a direct
 * write.
 *
 * The company's stage columns became a cache of the primary deal when crmDeals
 * landed (see lib/dealCache.ts). Keeping this mutation patching them directly
 * would have made two independent writers for one rollup, which is exactly the
 * drift the single-writer rule in activities.ts exists to prevent — the deal
 * board and the company list would disagree, and only one of them would be
 * feeding the funnel.
 *
 * Kept as a mutation (rather than deleted) because the company detail page and
 * bulk actions still call it, and "set the stage on this company" remains the
 * natural thing to express there. A company with no deal yet gets one created,
 * so the call never silently does nothing.
 */
export const setStage = mutation({
  args: {
    companyId: v.id("crmCompanies"),
    stage: STAGE_VALIDATOR,
    estimatedLives: v.optional(v.number()),
    estimatedMrrCents: v.optional(v.number()),
    winProbability: v.optional(v.number()),
    expectedCloseDate: v.optional(v.string()),
    lostReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error("Company not found");

    const { stagesByCanonical } = await ensureDefaultPipeline(ctx);
    const stageId = stagesByCanonical.get(args.stage);
    if (!stageId) throw new Error(`No pipeline stage is mapped to "${args.stage}"`);

    const open = (
      await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", args.companyId)).collect()
    ).filter((d) => !d.isArchived);
    let primary = open.find((d) => d.isPrimary) ?? open[0];

    const now = Date.now();
    if (!primary) {
      const dealId = await ctx.db.insert("crmDeals", {
        pipelineId: (await ctx.db.get(stageId))!.pipelineId,
        stageId,
        stageChangedAt: now,
        companyId: args.companyId,
        name: `${company.name} — benefits`,
        ownerClerkUserId: company.ownerClerkUserId ?? identity.clerkUserId,
        mrrCents: args.estimatedMrrCents ?? company.estimatedMrrCents,
        estimatedLives: args.estimatedLives ?? company.estimatedLives,
        winProbability: args.winProbability ?? company.winProbability,
        expectedCloseDate: args.expectedCloseDate ?? company.expectedCloseDate,
        lostReason: args.stage === "lost" ? args.lostReason : undefined,
        isPrimary: true,
        boardPosition: BOARD_POSITION_GAP,
        isArchived: false,
        searchText: `${company.name} — benefits ${company.name}`.toLowerCase(),
        createdAt: now,
        updatedAt: now,
        createdBy: identity.clerkUserId,
      });
      primary = (await ctx.db.get(dealId))!;
    } else {
      // Carry the deal-shaped fields the caller supplied onto the deal, so the
      // cache sync below mirrors the caller's intent rather than stale values.
      await ctx.db.patch(primary._id, {
        mrrCents: args.estimatedMrrCents ?? primary.mrrCents,
        estimatedLives: args.estimatedLives ?? primary.estimatedLives,
        winProbability: args.winProbability ?? primary.winProbability,
        expectedCloseDate: args.expectedCloseDate ?? primary.expectedCloseDate,
        updatedAt: now,
      });
      primary = (await ctx.db.get(primary._id))!;
    }

    // applyStageMove writes the stage_changed activity (with BOTH ids and
    // canonical strings in metadata) and re-syncs the company cache — the
    // funnel history is produced there now, not here.
    await applyStageMove(ctx, {
      deal: primary,
      stageId,
      actor: {
        clerkUserId: identity.clerkUserId,
        name: identity.name ?? identity.email ?? "Staff",
        actorType: "staff",
      },
      lostReason: args.lostReason,
    });
  },
});

export const linkToAccount = mutation({
  args: { companyId: v.id("crmCompanies"), accountId: v.optional(v.id("accounts")), groupId: v.optional(v.id("groups")) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.companyId, {
      linkedAccountId: args.accountId,
      linkedGroupId: args.groupId,
      updatedAt: Date.now(),
    });
  },
});

export const archiveCompany = mutation({
  args: { companyId: v.id("crmCompanies"), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.companyId, { isArchived: args.archived, updatedAt: Date.now() });
  },
});

export const mergeCompanies = mutation({
  args: { winnerId: v.id("crmCompanies"), loserId: v.id("crmCompanies") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    if (args.winnerId === args.loserId) throw new Error("Cannot merge a company into itself");
    const [winner, loser] = await Promise.all([ctx.db.get(args.winnerId), ctx.db.get(args.loserId)]);
    if (!winner || !loser) throw new Error("Company not found");
    const now = Date.now();

    const [contacts, activities, tagLinks] = await Promise.all([
      ctx.db.query("crmContacts").withIndex("by_company", (q) => q.eq("companyId", args.loserId)).collect(),
      ctx.db.query("crmActivities").withIndex("by_company", (q) => q.eq("companyId", args.loserId)).collect(),
      ctx.db.query("crmContactTags").withIndex("by_company", (q) => q.eq("companyId", args.loserId)).collect(),
    ]);
    for (const c of contacts) await ctx.db.patch(c._id, { companyId: args.winnerId, companyName: winner.name });
    for (const a of activities) await ctx.db.patch(a._id, { companyId: args.winnerId });

    const winnerTagIds = new Set(winner.tagIds);
    for (const link of tagLinks) {
      if (winnerTagIds.has(link.tagId)) {
        await ctx.db.delete(link._id);
      } else {
        await ctx.db.patch(link._id, { companyId: args.winnerId });
        winnerTagIds.add(link.tagId);
      }
    }

    const fillable: (keyof Doc<"crmCompanies">)[] = ["domain", "website", "industry", "employeeCount", "phone", "city", "state"];
    const patch: Record<string, unknown> = { tagIds: Array.from(winnerTagIds), updatedAt: now };
    for (const field of fillable) {
      if (!winner[field] && loser[field]) patch[field] = loser[field];
    }
    await ctx.db.patch(args.winnerId, patch);
    await ctx.db.delete(args.loserId);

    await recordAdminAction(ctx, identity, {
      action: "crm.company.merge",
      targetType: "crmCompanies",
      targetId: args.winnerId,
      summary: `Merged ${loser.name} into ${winner.name}`,
    });
  },
});
