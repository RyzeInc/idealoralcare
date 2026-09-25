/**
 * SETUP — the one-time migration a manager runs from /admin/crm/settings.
 *
 * The button is the only realistic way this gets run, so the properties that
 * matter are: it is safe to press twice, it is manager-gated (it writes a row
 * per company), it preserves each company's existing stage rather than
 * resetting the book, and the status it reports is honest.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

type TestCtx = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;
type IdentityCtx = ReturnType<TestCtx["withIdentity"]>;

async function seedStaff(t: TestCtx, clerkUserId = "staff_owner"): Promise<IdentityCtx> {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId, email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
    });
  });
  return t.withIdentity(tok(clerkUserId));
}

async function seedCompany(
  t: TestCtx,
  name: string,
  stage: "unqualified" | "proposal" | "won" = "unqualified",
  stageChangedAt = Date.now(),
): Promise<Id<"crmCompanies">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("crmCompanies", {
      name, nameKey: name.toLowerCase(), companyType: "employer",
      stage, stageChangedAt, estimatedLives: 40, estimatedMrrCents: 120_000,
      tagIds: [], isArchived: false, searchText: name.toLowerCase(),
      createdAt: now, updatedAt: now,
    });
  });
}

/** The backfill self-reschedules; drain it the way the runtime would. */
async function drain(t: TestCtx) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await t.finishAllScheduledFunctions(() => {});
}

describe("expansion setup", () => {
  test("reports what still needs doing before it is run", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme");

    const status = await asStaff.query(api.crm.setup.expansionStatus, {});
    expect(status.pipelineReady).toBe(false);
    expect(status.relationshipTagsReady).toBe(false);
    expect(status.companyCount).toBe(1);
    expect(status.companiesMissingDeals).toBe(1);
    expect(status.isComplete).toBe(false);
  });

  test("one press creates the pipeline, the tags, and a deal per company", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme");
    await seedCompany(t, "Globex");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const status = await asStaff.query(api.crm.setup.expansionStatus, {});
    expect(status.pipelineReady).toBe(true);
    expect(status.stageCount).toBe(9);
    expect(status.relationshipTagsReady).toBe(true);
    expect(status.companiesMissingDeals).toBe(0);
    expect(status.isComplete).toBe(true);
  });

  test("the backfill preserves each company's existing stage", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme", "proposal");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const canonical = await t.run(async (ctx) => {
      const deal = await ctx.db.query("crmDeals").first();
      const stage = deal ? await ctx.db.get(deal.stageId) : null;
      return stage?.canonicalStage;
    });
    // A migration that reset every deal to the opening stage would silently
    // destroy the book's pipeline position.
    expect(canonical).toBe("proposal");
  });

  test("the backfill preserves stageChangedAt so velocity reporting is not reset", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    await seedCompany(t, "Acme", "proposal", sixtyDaysAgo);

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const deal = await t.run(async (ctx) => await ctx.db.query("crmDeals").first());
    expect(deal?.stageChangedAt).toBe(sixtyDaysAgo);
  });

  test("pressing it twice creates nothing twice", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);
    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const counts = await t.run(async (ctx) => ({
      pipelines: (await ctx.db.query("crmPipelines").collect()).length,
      stages: (await ctx.db.query("crmPipelineStages").collect()).length,
      deals: (await ctx.db.query("crmDeals").collect()).length,
      tags: (await ctx.db.query("crmTags").collect()).length,
    }));

    expect(counts.pipelines).toBe(1);
    expect(counts.stages).toBe(9);
    expect(counts.deals).toBe(1);
    expect(counts.tags).toBe(6);
  });

  test("re-running picks up only companies added since", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    await seedCompany(t, "Newco");
    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const status = await asStaff.query(api.crm.setup.expansionStatus, {});
    expect(status.companyCount).toBe(2);
    expect(status.dealCount).toBe(2);
    expect(status.isComplete).toBe(true);
  });

  test("the migrated deal is primary and mirrors the company's values", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedCompany(t, "Acme", "proposal");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const deal = await t.run(async (ctx) => await ctx.db.query("crmDeals").first());
    expect(deal?.isPrimary).toBe(true);
    expect(deal?.estimatedLives).toBe(40);
    expect(deal?.mrrCents).toBe(120_000);
    expect(deal?.source).toBe("migration");
  });

  test("a non-manager cannot run it", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_editor", email: "e@t.dev", name: "Editor",
        role: "editor", createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(tok("staff_editor")).mutation(api.crm.setup.runExpansionSetup, {}),
    ).rejects.toThrow(/manager/i);
  });

  test("a distribution partner cannot even read the status", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_crm", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_crm")).query(api.crm.setup.expansionStatus, {}),
    ).rejects.toThrow(/Admin role required/);
  });

  test("reconcileNow repairs a drifted company cache", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t, "Acme", "proposal");

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    // Drift the cache the way a crashed mutation or a console edit would.
    await t.run(async (ctx) => {
      await ctx.db.patch(companyId, { stage: "won" });
    });

    await asStaff.mutation(api.crm.setup.reconcileNow, {});
    await drain(t);

    const company = await t.run(async (ctx) => await ctx.db.get(companyId));
    expect(company?.stage).toBe("proposal");
  });

  test("an archived company still gets a deal, kept archived", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const companyId = await seedCompany(t, "Defunct");
    await t.run(async (ctx) => {
      await ctx.db.patch(companyId, { isArchived: true });
    });

    await asStaff.mutation(api.crm.setup.runExpansionSetup, {});
    await drain(t);

    const deal = await t.run(async (ctx) => await ctx.db.query("crmDeals").first());
    // Archived companies keep their history rather than being skipped, but
    // their deal must not surface on the board.
    expect(deal).not.toBeNull();
    expect(deal?.isArchived).toBe(true);
  });

  test("the internal initializer stays available for dashboard use", async () => {
    const t = convexTest(schema);
    await seedCompany(t, "Acme");

    const result = await t.mutation(internal.crm.maintenance.initializeCrmExpansion, {});
    await drain(t);

    expect(result.pipelineCreated).toBe(true);
    expect(result.tagsCreated).toBe(6);
  });
});
