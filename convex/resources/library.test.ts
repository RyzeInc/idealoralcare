/**
 * RESOURCE LIBRARY — visibility and download gating.
 *
 * The rule that matters most: a white-label agency must never be handed
 * another brand's collateral. After that, that a resource id obtained by any
 * means cannot be turned into a download URL unless the viewer was entitled to
 * it in the first place.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

async function seedWorld(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_res", email: "s@t.dev", name: "Staff",
      role: "owner", createdAt: now,
    });

    const mkSite = async (slug: string, name: string) =>
      await ctx.db.insert("sites", {
        slug, name, type: "whitelabel" as const, branding: {}, allowedPlanIds: [],
        enrollmentDefaults: {
          requireGroupCode: false, requireEligibilityMatch: false,
          allowSelfEnrollment: true, requirePayment: true, autoActivate: true,
          collectAddress: false, collectPhone: false, collectEmployeeId: false,
        },
        status: "active" as const, createdAt: now, updatedAt: now,
      });

    const siteNexus = await mkSite("nexus", "Ideal Oral Health");
    const siteFlourish = await mkSite("flourish", "Flourish XV");

    // Two agencies, each selling into a different brand.
    const mkAgency = async (
      name: string, clerkUserId: string,
      type: "fmo" | "agency", siteId: any,
    ) => {
      const agencyId = await ctx.db.insert("distributionPartners", {
        name, type, contactName: name, contactEmail: `${clerkUserId}@t.dev`,
        clerkUserId, status: "active" as const, createdAt: now, updatedAt: now,
      });
      const leaderId = await ctx.db.insert("partnerLeaders", {
        partnerId: agencyId, name: `${name} Rep`, email: `rep-${clerkUserId}@t.dev`,
        isPrimary: true, createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: `acct-${clerkUserId}`, name: `${name} Acct`,
        accountType: "employer" as const, billingModel: "direct" as const,
        contacts: [], status: "active" as const, createdAt: now, updatedAt: now,
      });
      const groupId = await ctx.db.insert("groups", {
        siteId, accountId, slug: `g-${clerkUserId}`, name: `${name} Group`,
        groupCode: `GC${clerkUserId}`, status: "active" as const,
        createdAt: now, updatedAt: now,
      });
      // One member, which is what binds this partner to that brand.
      await ctx.db.insert("memberProfiles", {
        memberId: `M-${clerkUserId}`, barcode: `B${clerkUserId}`,
        siteId, accountId, groupId,
        firstName: "A", lastName: "B", memberType: "active" as const,
        memberRole: "primary" as const, status: "active" as const,
        attributedRepId: String(leaderId), attributedAgencyId: String(agencyId),
        enrolledAt: now, createdAt: now, updatedAt: now,
      } as any);
      return { agencyId, leaderId };
    };

    const nexusAgency = await mkAgency("Ideal Partners", "broker_nexus", "agency", siteNexus);
    const flourishAgency = await mkAgency("Flourish Partners", "broker_flourish", "fmo", siteFlourish);

    return { siteNexus, siteFlourish, nexusAgency, flourishAgency };
  });
}

async function makeResource(
  t: ReturnType<typeof convexTest>,
  over: Record<string, unknown> = {},
) {
  return await t.withIdentity(tok("staff_res")).mutation(
    api.resources.admin.createResource,
    {
      title: "Flyer",
      category: "partner_pieces",
      kind: "link",
      externalUrl: "https://example.com/flyer.pdf",
      audience: "all",
      status: "published",
      ...over,
    } as any,
  );
}

describe("audience visibility", () => {
  test("an 'all' resource reaches every partner", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    await makeResource(t, { title: "Universal One-Pager" });

    for (const who of ["broker_nexus", "broker_flourish"]) {
      const lib: any = await t.withIdentity(tok(who))
        .query(api.resources.library.listForViewer, {});
      expect(lib.total).toBe(1);
    }
  });

  test("a partner-type resource reaches only that type", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    // Flourish is an FMO; Ideal Partners is an agency.
    await makeResource(t, {
      title: "FMO Override Guide",
      audience: "partner_types",
      partnerTypes: ["fmo"],
    });

    const fmo: any = await t.withIdentity(tok("broker_flourish"))
      .query(api.resources.library.listForViewer, {});
    const agency: any = await t.withIdentity(tok("broker_nexus"))
      .query(api.resources.library.listForViewer, {});

    expect(fmo.total).toBe(1);
    expect(agency.total).toBe(0);
  });

  test("a specific-partner resource reaches only the named partner", async () => {
    const t = convexTest(schema);
    const { nexusAgency } = await seedWorld(t);
    await makeResource(t, {
      title: "Custom Deck",
      audience: "specific",
      partnerIds: [String(nexusAgency.agencyId)],
    });

    const named: any = await t.withIdentity(tok("broker_nexus"))
      .query(api.resources.library.listForViewer, {});
    const other: any = await t.withIdentity(tok("broker_flourish"))
      .query(api.resources.library.listForViewer, {});

    expect(named.total).toBe(1);
    expect(other.total).toBe(0);
  });

  test("drafts are invisible to partners but visible to staff", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    await makeResource(t, { title: "Unfinished", status: "draft" });

    const partner: any = await t.withIdentity(tok("broker_nexus"))
      .query(api.resources.library.listForViewer, {});
    expect(partner.total).toBe(0);

    const admin: any = await t.withIdentity(tok("staff_res"))
      .query(api.resources.admin.listAll, {});
    expect(admin.rows).toHaveLength(1);
  });
});

describe("white-label brand isolation", () => {
  test("brand-restricted collateral does not cross brands", async () => {
    const t = convexTest(schema);
    const { siteNexus } = await seedWorld(t);
    await makeResource(t, {
      title: "Ideal-Branded Flyer",
      siteIds: [siteNexus],
    });

    const nexus: any = await t.withIdentity(tok("broker_nexus"))
      .query(api.resources.library.listForViewer, {});
    const flourish: any = await t.withIdentity(tok("broker_flourish"))
      .query(api.resources.library.listForViewer, {});

    // The whole point: a Flourish agency must never be handed Ideal material.
    expect(nexus.total).toBe(1);
    expect(flourish.total).toBe(0);
  });

  test("an unrestricted resource is brand-agnostic", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    await makeResource(t, { title: "Generic Training", siteIds: [] });

    const flourish: any = await t.withIdentity(tok("broker_flourish"))
      .query(api.resources.library.listForViewer, {});
    expect(flourish.total).toBe(1);
  });
});

describe("download gating", () => {
  test("a resource id you cannot see cannot be downloaded", async () => {
    const t = convexTest(schema);
    const { siteNexus } = await seedWorld(t);
    const resourceId = await makeResource(t, {
      title: "Ideal Only", siteIds: [siteNexus],
    });

    // Flourish holds a real id — listing and downloading are separately
    // authorized, so holding the id is not enough.
    const result = await t.withIdentity(tok("broker_flourish")).mutation(
      api.resources.library.getDownloadUrl, { resourceId },
    );
    expect(result).toBeNull();

    // And no download was logged for the refused attempt.
    const logs = await t.run(async (ctx) =>
      await ctx.db.query("partnerResourceDownloads").collect());
    expect(logs).toHaveLength(0);
  });

  test("an entitled download returns a URL and is recorded", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    const resourceId = await makeResource(t, { title: "Shared Kit" });

    const result: any = await t.withIdentity(tok("broker_nexus")).mutation(
      api.resources.library.getDownloadUrl, { resourceId },
    );
    expect(result?.url).toBe("https://example.com/flyer.pdf");

    const logs = await t.run(async (ctx) =>
      await ctx.db.query("partnerResourceDownloads").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0].partnerName).toBe("Ideal Partners");
    expect(logs[0].viewerKind).toBe("partner");

    const resource: any = await t.run(async (ctx) => await ctx.db.get(resourceId));
    expect(resource.downloadCount).toBe(1);
  });

  test("an archived resource stops being downloadable", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    const resourceId = await makeResource(t, { title: "Old Notice" });

    await t.withIdentity(tok("staff_res")).mutation(
      api.resources.admin.setStatus, { resourceId, status: "archived" },
    );

    const result = await t.withIdentity(tok("broker_nexus")).mutation(
      api.resources.library.getDownloadUrl, { resourceId },
    );
    expect(result).toBeNull();
  });
});

describe("curation guards", () => {
  test("a partner cannot publish resources", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    await expect(
      t.withIdentity(tok("broker_nexus")).mutation(api.resources.admin.createResource, {
        title: "Rogue", category: "partner_pieces", kind: "link",
        externalUrl: "https://evil.example", audience: "all",
      } as any),
    ).rejects.toThrow(/Admin role required/);
  });

  test("a resource that could never resolve is refused", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    // A file resource with no file would publish a dead tile into every
    // partner's library.
    await expect(makeResource(t, { kind: "file", externalUrl: undefined }))
      .rejects.toThrow(/needs an uploaded file/);
    await expect(
      makeResource(t, { audience: "partner_types", partnerTypes: [] }),
    ).rejects.toThrow(/at least one partner type/);
  });

  test("superseding archives the prior version and bumps the number", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    const v1 = await makeResource(t, { title: "Rate Sheet" });
    const v2 = await makeResource(t, { title: "Rate Sheet", supersedesId: v1 });

    const oldRow: any = await t.run(async (ctx) => await ctx.db.get(v1));
    const newRow: any = await t.run(async (ctx) => await ctx.db.get(v2));

    expect(oldRow.status).toBe("archived");
    expect(newRow.version).toBe(2);
    // Partners now see only the current one.
    const lib: any = await t.withIdentity(tok("broker_nexus"))
      .query(api.resources.library.listForViewer, {});
    expect(lib.total).toBe(1);
  });
});
