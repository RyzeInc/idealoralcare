/**
 * DEAL PIPELINE — the invariants that fail SILENTLY if broken.
 *
 * Every test here targets a specific way this feature can go wrong without
 * throwing anything: a company cache that drifts from its deal, a funnel that
 * quietly empties because an activity carried the wrong ids, or a custom stage
 * that weights at 0% and understates the pipeline in a revenue report. Those
 * are the failures nobody notices until a number is used in a decision.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { ensureDefaultPipeline } from "./pipelines";
import { syncPrimaryDealCache } from "./lib/dealCache";
import type { Id } from "../_generated/dataModel";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

/**
 * Fully-typed test handles. `ReturnType<typeof convexTest>` without the schema
 * argument degrades to an index-less, `any`-shaped data model, which silently
 * switches OFF type checking inside every helper that takes one — table names,
 * index names and document shapes all stop being verified. Deriving the type
 * from an actual `convexTest(schema)` call keeps the helpers honest.
 */
type TestCtx = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;
type IdentityCtx = ReturnType<TestCtx["withIdentity"]>;


/**
 * ensureDefaultPipeline returns a Map, which convex-test cannot serialise back
 * out of `t.run`. These helpers seed inside the transaction and return only
 * plain ids.
 */
async function seedPipeline(t: TestCtx): Promise<Id<"crmPipelines">> {
  return await t.run(async (ctx) => {
    const { pipelineId } = await ensureDefaultPipeline(ctx as any);
    return pipelineId;
  });
}

async function seedStageId(
  t: TestCtx,
  canonical: "unqualified" | "prospect" | "contacted" | "engaged" | "proposal" | "verbal" | "won" | "lost" | "dormant",
): Promise<Id<"crmPipelineStages">> {
  return await t.run(async (ctx) => {
    const { stagesByCanonical } = await ensureDefaultPipeline(ctx as any);
    return stagesByCanonical.get(canonical)!;
  });
}

async function seedStaff(t: TestCtx, clerkUserId = "staff_owner"): Promise<IdentityCtx> {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId, email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
    });
  });
  return t.withIdentity(tok(clerkUserId));
}

async function seedCompany(t: TestCtx, name = "Acme Co"): Promise<Id<"crmCompanies">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("crmCompanies", {
      name, nameKey: name.toLowerCase(), companyType: "employer",
      stage: "unqualified", stageChangedAt: now, tagIds: [], isArchived: false,
      searchText: name.toLowerCase(), createdAt: now, updatedAt: now,
    });
  });
}

describe("primary-deal cache", () => {
  test("moving a deal's stage updates the company's cached canonical stage", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const proposalStageId = await seedStageId(t, "proposal");

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: proposalStageId });

    const company = await t.run(async (ctx) => await ctx.db.get(companyId));
    expect(company?.stage).toBe("proposal");
  });

  test("companies.setStage delegates to the deal rather than writing its own stage", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);
    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });

    await asStaff.mutation(api.crm.companies.setStage, { companyId, stage: "verbal" });

    const { company, deal, stage } = await t.run(async (ctx) => {
      const company = await ctx.db.get(companyId);
      const deal = await ctx.db.get(dealId);
      const stage = deal ? await ctx.db.get(deal.stageId) : null;
      return { company, deal, stage };
    });

    // The deal moved — not just the company's column. If setStage were still
    // writing the company directly, the deal would be stranded on its old
    // stage and the board would disagree with the company list.
    expect(stage?.canonicalStage).toBe("verbal");
    expect(company?.stage).toBe("verbal");
    expect(deal?.stageId).toBe(stage?._id);
  });

  test("setStage creates a primary deal when a company has none", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    await asStaff.mutation(api.crm.companies.setStage, { companyId, stage: "engaged" });

    const deals = await t.run(async (ctx) =>
      await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", companyId)).collect(),
    );
    expect(deals).toHaveLength(1);
    expect(deals[0].isPrimary).toBe(true);
  });

  test("archiving the primary deal promotes the next open deal", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const firstId = await asStaff.mutation(api.crm.deals.createDeal, { companyId, name: "Primary" });
    const secondId = await asStaff.mutation(api.crm.deals.createDeal, { companyId, name: "Upsell" });

    await asStaff.mutation(api.crm.deals.archiveDeal, { dealId: firstId, archived: true });

    const second = await t.run(async (ctx) => await ctx.db.get(secondId));
    expect(second?.isPrimary).toBe(true);
  });

  test("only one deal per company is primary", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const firstId = await asStaff.mutation(api.crm.deals.createDeal, { companyId, name: "A" });
    const secondId = await asStaff.mutation(api.crm.deals.createDeal, { companyId, name: "B" });
    await asStaff.mutation(api.crm.deals.setPrimaryDeal, { dealId: secondId });

    const deals = await t.run(async (ctx) =>
      await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", companyId)).collect(),
    );
    expect(deals.filter((d) => d.isPrimary)).toHaveLength(1);
    expect(deals.find((d) => d.isPrimary)?._id).toBe(secondId);
    expect(deals.find((d) => d._id === firstId)?.isPrimary).toBe(false);
  });

  test("reconcile repairs a company whose cached stage drifted", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);
    await asStaff.mutation(api.crm.deals.createDeal, { companyId });

    // Simulate drift — the exact thing the nightly sweep exists to catch.
    await t.run(async (ctx) => {
      await ctx.db.patch(companyId, { stage: "won" });
    });

    await t.run(async (ctx) => {
      await syncPrimaryDealCache(ctx as any, companyId);
    });

    const company = await t.run(async (ctx) => await ctx.db.get(companyId));
    expect(company?.stage).toBe("unqualified");
  });
});

describe("stage-change activities keep the funnel populated", () => {
  test("a deal stage change writes companyId AND canonical strings in metadata", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const stageId = await seedStageId(t, "proposal");

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId });

    const activity = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("crmActivities")
        .withIndex("by_type_occurred", (q) => q.eq("activityType", "stage_changed"))
        .collect();
      return rows[0];
    });

    // stageVelocity groups by companyId — a deal-only row silently disappears.
    expect(activity.companyId).toBe(companyId);
    expect(activity.dealId).toBe(dealId);
    // funnelByStage groups on metadata.to; a raw stage-row id would produce a
    // funnel bucketed by opaque ids instead of stages.
    const metadata = activity.metadata as { from?: string; to?: string };
    expect(metadata.to).toBe("proposal");
    expect(metadata.from).toBe("unqualified");
  });

  test("funnelByStage counts the move", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const stageId = await seedStageId(t, "engaged");

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, { companyId });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId });

    const funnel = await asStaff.query(api.crm.analytics.funnelByStage, {});
    expect(funnel.find((f) => f.stage === "engaged")?.count).toBe(1);
  });
});

describe("weighted pipeline value", () => {
  test("a CUSTOM stage weights by its own probability, not 0%", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const pipelineId = await seedPipeline(t);

    // "Legal Review" — a stage that does not exist in the hardcoded
    // STAGE_DEFAULT_PROBABILITY map. Before the stage row became the source of
    // truth this fell through to `?? 0` and silently contributed nothing.
    const customStageId = await asStaff.mutation(api.crm.pipelines.createStage, {
      pipelineId,
      name: "Legal Review",
      canonicalStage: "proposal",
      probability: 70,
      color: "purple",
    });

    const dealId = await asStaff.mutation(api.crm.deals.createDeal, {
      companyId,
      mrrCents: 100_000, // $1,000/mo
    });
    await asStaff.mutation(api.crm.deals.moveDealStage, { dealId, stageId: customStageId });

    const summary = await asStaff.query(api.crm.analytics.dealPipelineSummary, {});
    const column = summary.stages.find((s) => s.stageId === customStageId);
    expect(column?.grossCents).toBe(100_000);
    expect(column?.weightedCents).toBe(70_000);

    // And the company-level rollup agrees rather than reporting zero.
    const pipeline = await asStaff.query(api.crm.analytics.pipelineSummary, {});
    const bucket = pipeline.find((p) => p.stage === "proposal");
    expect(bucket?.weightedMrrCents).toBe(70_000);
  });

  test("a deal's own winProbability overrides the stage default", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);
    await seedPipeline(t);

    await asStaff.mutation(api.crm.deals.createDeal, {
      companyId,
      mrrCents: 200_000,
      winProbability: 25,
    });

    const summary = await asStaff.query(api.crm.analytics.dealPipelineSummary, {});
    const column = summary.stages.find((s) => s.canonicalStage === "unqualified");
    // 25% override, not the stage's 5% default.
    expect(column?.weightedCents).toBe(50_000);
  });
});

describe("stage configuration", () => {
  test("a stage with open deals cannot be archived", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t);

    const stageId = await seedStageId(t, "unqualified");
    await asStaff.mutation(api.crm.deals.createDeal, { companyId });

    await expect(
      asStaff.mutation(api.crm.pipelines.archiveStage, { stageId, archived: true }),
    ).rejects.toThrow(/open deal/i);
  });

  test("seeding the default pipeline is idempotent", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);

    await asStaff.mutation(api.crm.pipelines.seedDefaultPipeline, {});
    await asStaff.mutation(api.crm.pipelines.seedDefaultPipeline, {});

    const stages = await asStaff.query(api.crm.pipelines.listStages, {});
    expect(stages).toHaveLength(9);
    const pipelines = await asStaff.query(api.crm.pipelines.listPipelines, {});
    expect(pipelines).toHaveLength(1);
  });

  test("a non-manager cannot reconfigure stages", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_editor", email: "e@t.dev", name: "Editor",
        role: "editor", createdAt: Date.now(),
      });
    });
    const asEditor = t.withIdentity(tok("staff_editor"));
    const pipelineId = await seedPipeline(t);

    await expect(
      asEditor.mutation(api.crm.pipelines.createStage, {
        pipelineId, name: "Sneaky", canonicalStage: "won", probability: 100,
      }),
    ).rejects.toThrow(/manager/i);
  });
});

describe("deal access control", () => {
  test("an unauthenticated caller cannot read the board", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.crm.deals.boardByStage, {})).rejects.toThrow(/Authentication required/);
  });

  test("a distribution partner cannot read the board", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_crm", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_crm")).query(api.crm.deals.boardByStage, {}),
    ).rejects.toThrow(/Admin role required/);
  });
});
