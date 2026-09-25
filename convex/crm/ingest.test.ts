/**
 * INGEST — the field allow-list is the point of these tests.
 *
 * repOnboardingSubmissions and partnerKitSubmissions are onboarding and
 * compliance records. Between them they carry EIN, agency and rep NPNs,
 * licence numbers, E&O carrier details, W-9 status, payment method, ACH
 * authorisation status, an e-signature data URL and W-9 file handles.
 *
 * The CRM is a different surface with a different audience. Copying any of
 * that onto a crmContacts row would silently widen who can read it, and
 * nothing would fail — which is exactly why it needs a test rather than a
 * comment. `assertNoSensitiveFields` below is the guard: it walks the whole
 * contact document and fails on any value that looks like it escaped.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

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


async function seedStaff(t: TestCtx, clerkUserId = "staff_owner"): Promise<IdentityCtx> {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId, email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
    });
  });
  return t.withIdentity(tok(clerkUserId));
}

/** Distinctive sentinel values planted in every sensitive source field. */
const SENSITIVE_SENTINELS = [
  "EIN-99-1234567",
  "NPN-AGENCY-777",
  "NPN-REP-888",
  "LICENCE-CA-12345",
  "EO-CARRIER-SECRET",
  "W9-RECEIVED-2026-01-02",
  "ACH-AUTHORISED",
  "PAYMENT-METHOD-WIRE",
  "data:image/png;base64,SIGNATUREBLOB",
];

function assertNoSensitiveFields(contact: Doc<"crmContacts">) {
  const serialised = JSON.stringify(contact);
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(serialised).not.toContain(sentinel);
  }
}

async function seedRepApplication(t: TestCtx): Promise<Id<"repOnboardingSubmissions">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("repOnboardingSubmissions", {
      submissionType: "both",
      agencyName: "Northwind Benefits",
      ein: "EIN-99-1234567",
      agencyNpn: "NPN-AGENCY-777",
      agencyLicenses: "LICENCE-CA-12345",
      eoCarrier: "EO-CARRIER-SECRET",
      w9Status: "received",
      w9ReceivedDate: "W9-RECEIVED-2026-01-02",
      paymentMethod: "PAYMENT-METHOD-WIRE",
      achAuthorizationStatus: "ACH-AUTHORISED",
      primaryContactName: "Dana Reed",
      primaryContactEmail: "dana@northwind.test",
      primaryContactPhone: "555-0100",
      repFirstName: "Sam",
      repLastName: "Iyer",
      repEmail: "sam@northwind.test",
      repPhone: "555-0200",
      repNpn: "NPN-REP-888",
      repLicenses: "LICENCE-CA-12345",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedPartnerKit(t: TestCtx): Promise<Id<"partnerKitSubmissions">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("partnerKitSubmissions", {
      partnerAgencyName: "Southgate Agency",
      primaryContactName: "Alex Fry",
      email: "alex@southgate.test",
      phone: "555-0300",
      npnLicenseInfo: "NPN-AGENCY-777",
      signatureDataUrl: "data:image/png;base64,SIGNATUREBLOB",
      acknowledged: true,
      method: "online",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("repOnboardingSubmissions ingest", () => {
  test("imports the primary contact with ONLY name, email, phone and agency", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedRepApplication(t);

    const result = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions",
      sourceId,
      sourceSlot: "primary",
    });
    expect(result.action).toBe("created");

    const contact = await t.run(async (ctx) => await ctx.db.get(result.contactId));
    expect(contact?.fullName).toBe("Dana Reed");
    expect(contact?.email).toBe("dana@northwind.test");
    expect(contact?.mobilePhone).toBe("555-0100");
    expect(contact?.companyName).toBe("Northwind Benefits");
    expect(contact?.source).toBe("rep_onboarding");
    assertNoSensitiveFields(contact!);
  });

  test("the rep slot imports the rep, not the primary contact", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedRepApplication(t);

    const result = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions",
      sourceId,
      sourceSlot: "rep",
    });

    const contact = await t.run(async (ctx) => await ctx.db.get(result.contactId));
    expect(contact?.fullName).toBe("Sam Iyer");
    expect(contact?.email).toBe("sam@northwind.test");
    assertNoSensitiveFields(contact!);
  });

  test("both slots of one row import as two distinct contacts", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedRepApplication(t);

    const primary = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions", sourceId, sourceSlot: "primary",
    });
    const rep = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions", sourceId, sourceSlot: "rep",
    });

    // The (sourceTable, sourceId, sourceSlot) key is what makes this possible —
    // keying on the row alone would let the first slot claim the whole row.
    expect(primary.contactId).not.toBe(rep.contactId);
  });

  test("re-importing the same slot is a no-op, not a duplicate", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedRepApplication(t);

    const first = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions", sourceId, sourceSlot: "primary",
    });
    const second = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "repOnboardingSubmissions", sourceId, sourceSlot: "primary",
    });

    expect(second.action).toBe("skipped");
    expect(second.contactId).toBe(first.contactId);
  });

  test("a REJECTED application cannot be imported", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedRepApplication(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(sourceId, { status: "rejected" });
    });

    await expect(
      asStaff.mutation(api.crm.ingest.importFromSource, {
        sourceTable: "repOnboardingSubmissions", sourceId, sourceSlot: "primary",
      }),
    ).rejects.toThrow(/rejected/i);
  });

  test("candidate listing never exposes sensitive fields", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    await seedRepApplication(t);

    const candidates = await asStaff.query(api.crm.ingest.listIngestCandidates, {
      source: "repOnboardingSubmissions",
    });
    expect(candidates).toHaveLength(1);
    const serialised = JSON.stringify(candidates);
    for (const sentinel of SENSITIVE_SENTINELS) {
      expect(serialised).not.toContain(sentinel);
    }
  });
});

describe("partnerKitSubmissions ingest", () => {
  test("imports contact details and never the signature or NPN", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedPartnerKit(t);

    const result = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "partnerKitSubmissions",
      sourceId,
    });

    const contact = await t.run(async (ctx) => await ctx.db.get(result.contactId));
    expect(contact?.fullName).toBe("Alex Fry");
    expect(contact?.companyName).toBe("Southgate Agency");
    expect(contact?.source).toBe("partner_kit");
    assertNoSensitiveFields(contact!);
  });

  test("a partner-kit signatory is tagged Broker Partner, not left as a raw prospect", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedPartnerKit(t);

    // Seed the relationship taxonomy the way the initialiser does.
    await t.mutation(internal.crm.maintenance.seedRelationshipTags, {});

    const result = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "partnerKitSubmissions",
      sourceId,
    });

    const tagNames = await t.run(async (ctx) => {
      const contact = await ctx.db.get(result.contactId);
      const tags = await Promise.all((contact?.tagIds ?? []).map((id) => ctx.db.get(id)));
      return tags.map((tag) => tag?.slug);
    });

    // Someone who has already signed a partner agreement must not be counted
    // in the prospect funnel.
    expect(tagNames).toContain("broker-partner");
  });

  test("tagging is skipped silently when the taxonomy has not been seeded", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const sourceId = await seedPartnerKit(t);

    // No seedRelationshipTags call — ingest must still succeed.
    const result = await asStaff.mutation(api.crm.ingest.importFromSource, {
      sourceTable: "partnerKitSubmissions",
      sourceId,
    });
    expect(result.action).toBe("created");
  });
});

describe("ingest access control", () => {
  test("a distribution partner cannot list ingest candidates", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_crm", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_crm")).query(api.crm.ingest.listIngestCandidates, {
        source: "partnerKitSubmissions",
      }),
    ).rejects.toThrow(/Admin role required/);
  });

  test("a bulk import reports per-row failures instead of abandoning the batch", async () => {
    const t = convexTest(schema);
    const asStaff = await seedStaff(t);
    const good = await seedRepApplication(t);
    // An application with no rep contact at all — a data gap, not a reason to
    // strand the rest of the operator's selection.
    const bad = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("repOnboardingSubmissions", {
        submissionType: "agency", agencyName: "Empty Co",
        status: "approved", createdAt: now, updatedAt: now,
      });
    });

    const results = await asStaff.mutation(api.crm.ingest.bulkImportFromSource, {
      sourceTable: "repOnboardingSubmissions",
      sourceIds: [good, bad],
      sourceSlot: "rep",
    });

    expect(results).toHaveLength(2);
    expect(results[0].action).toBe("created");
    expect(results[1].action).toBe("skipped");
  });
});
