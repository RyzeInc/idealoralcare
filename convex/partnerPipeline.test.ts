/**
 * PARTNER PIPELINE — retroactive backfill tests
 *
 * Proves backfillPipelineLinks retroactively cross-links historical rows by
 * email: application → source lead (+ lead marked converted), signed kit →
 * application (both directions), and signed kit → lead. Also covers the
 * repEmail match path, dry-run (no writes), and idempotency.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const ADMIN_TOKEN = "https://test.clerk.dev|admin_pipeline";

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin_pipeline",
      email: "admin@pipeline.test",
      name: "Pipeline Admin",
      role: "owner",
      createdAt: Date.now(),
    });
  });
}

const asAdmin = (t: ReturnType<typeof convexTest>) =>
  t.withIdentity({ tokenIdentifier: ADMIN_TOKEN });

/** Seed one unlinked lead + application + signed kit sharing an email. */
async function seedTrio(
  t: ReturnType<typeof convexTest>,
  opts: { email: string; viaRepEmail?: boolean },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const leadId = await ctx.db.insert("partnerRegistrations", {
      name: "Jane Doe",
      email: opts.email,
      phone: "5551234567",
      business: "Acme Agency",
      wantsPartnerKit: true,
      status: "new",
      createdAt: now,
    });
    const appId = await ctx.db.insert("repOnboardingSubmissions", {
      submissionType: opts.viaRepEmail ? "rep" : "agency",
      ...(opts.viaRepEmail
        ? { repFirstName: "Jane", repLastName: "Doe", repEmail: opts.email }
        : { agencyName: "Acme Agency", primaryContactName: "Jane Doe", primaryContactEmail: opts.email }),
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    const kitId = await ctx.db.insert("partnerKitSubmissions", {
      partnerAgencyName: "Acme Agency",
      primaryContactName: "Jane Doe",
      email: opts.email,
      acknowledged: true,
      method: "online",
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
    return { leadId, appId, kitId };
  });
}

describe("backfillPipelineLinks", () => {
  test("dry run reports matches without writing", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { leadId, appId, kitId } = await seedTrio(t, { email: "jane@acme.com" });

    const summary = await asAdmin(t).mutation(
      api.partnerPipeline.backfillPipelineLinks,
      { dryRun: true },
    );

    expect(summary.dryRun).toBe(true);
    expect(summary.applicationsLinkedToLead).toBe(1);
    expect(summary.leadsMarkedConverted).toBe(1);
    expect(summary.kitsLinkedToApplication).toBe(1);
    expect(summary.kitsLinkedToLead).toBe(1);

    // Nothing was actually written.
    await t.run(async (ctx) => {
      expect((await ctx.db.get(appId))?.sourceLeadId).toBeUndefined();
      expect((await ctx.db.get(leadId))?.convertedToApplicationId).toBeUndefined();
      expect((await ctx.db.get(leadId))?.status).toBe("new");
      expect((await ctx.db.get(kitId))?.matchedApplicationId).toBeUndefined();
      expect((await ctx.db.get(kitId))?.matchedLeadId).toBeUndefined();
    });
  });

  test("apply links all three records by primary contact email", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { leadId, appId, kitId } = await seedTrio(t, { email: "jane@acme.com" });

    await asAdmin(t).mutation(api.partnerPipeline.backfillPipelineLinks, { dryRun: false });

    await t.run(async (ctx) => {
      const app = await ctx.db.get(appId);
      const lead = await ctx.db.get(leadId);
      const kit = await ctx.db.get(kitId);
      expect(app?.sourceLeadId).toBe(leadId);
      expect(app?.partnerKitSubmissionId).toBe(kitId);
      expect(lead?.convertedToApplicationId).toBe(appId);
      expect(lead?.status).toBe("converted");
      expect(lead?.inviteStatus).toBe("claimed");
      expect(kit?.matchedApplicationId).toBe(appId);
      expect(kit?.matchedLeadId).toBe(leadId);
    });
  });

  test("matches applications on repEmail too", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { leadId, appId, kitId } = await seedTrio(t, { email: "bob@rep.com", viaRepEmail: true });

    await asAdmin(t).mutation(api.partnerPipeline.backfillPipelineLinks, { dryRun: false });

    await t.run(async (ctx) => {
      expect((await ctx.db.get(appId))?.sourceLeadId).toBe(leadId);
      expect((await ctx.db.get(kitId))?.matchedApplicationId).toBe(appId);
    });
  });

  test("is idempotent — a second apply changes nothing", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await seedTrio(t, { email: "jane@acme.com" });

    await asAdmin(t).mutation(api.partnerPipeline.backfillPipelineLinks, { dryRun: false });
    const second = await asAdmin(t).mutation(
      api.partnerPipeline.backfillPipelineLinks,
      { dryRun: false },
    );

    expect(second.applicationsLinkedToLead).toBe(0);
    expect(second.leadsMarkedConverted).toBe(0);
    expect(second.kitsLinkedToApplication).toBe(0);
    expect(second.kitsLinkedToLead).toBe(0);
  });

  test("email matching is case-insensitive", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const leadId = await ctx.db.insert("partnerRegistrations", {
        name: "Casey", email: "Casey@Mixed.COM", phone: "5550000000",
        business: "Mixed Co", wantsPartnerKit: false, status: "new", createdAt: now,
      });
      const appId = await ctx.db.insert("repOnboardingSubmissions", {
        submissionType: "agency", agencyName: "Mixed Co",
        primaryContactEmail: "casey@mixed.com", status: "new", createdAt: now, updatedAt: now,
      });
      return { leadId, appId };
    });

    await asAdmin(t).mutation(api.partnerPipeline.backfillPipelineLinks, { dryRun: false });

    await t.run(async (ctx) => {
      expect((await ctx.db.get(ids.appId))?.sourceLeadId).toBe(ids.leadId);
    });
  });
});
