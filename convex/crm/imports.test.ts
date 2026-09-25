/**
 * CSV IMPORT — the round trip, and the dedupe strategies that decide whether
 * an existing contact gets touched.
 *
 * Dedupe is the part worth pinning. It resolves a match in three escalating
 * ways (email, then mobile+surname, then a name+company key), and the chosen
 * strategy then decides what happens to the row that was already there.
 * "Fill blanks only" is the default in the UI, so its promise — never
 * overwrite data someone already confirmed — is the one most worth a test.
 *
 * Chunking matters too: the UI sends 200 rows at a time, and a duplicate
 * split across two chunks still has to resolve against the row the earlier
 * chunk created.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

type TestCtx = ReturnType<typeof convexTest<(typeof schema)["tables"]>>;
type IdentityCtx = ReturnType<TestCtx["withIdentity"]>;

async function seedStaff(t: TestCtx): Promise<IdentityCtx> {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_import", email: "o@t.dev", name: "Owner",
      role: "owner", createdAt: Date.now(),
    });
  });
  return t.withIdentity(tok("staff_import"));
}

/** One mapped CSV row, already shaped to contact fields by the client. */
type Row = Record<string, string>;

async function runImport(
  as: IdentityCtx,
  rows: Row[],
  dedupeStrategy:
    | "fill_blanks_only" | "skip_existing" | "update_existing" | "create_duplicates" = "fill_blanks_only",
  chunkSize = 200,
) {
  const batchId = await as.mutation(api.crm.imports.createBatch, {
    filename: "leads.csv",
    entity: "contact",
    columnMapping: {},
    defaultTagIds: [],
    dedupeStrategy,
    totalRows: rows.length,
  });
  for (let i = 0; i < rows.length; i += chunkSize) {
    await as.mutation(api.crm.imports.commitChunk, {
      batchId,
      rows: rows.slice(i, i + chunkSize) as never,
    });
  }
  await as.mutation(api.crm.imports.finalizeBatch, { batchId });
  return await as.query(api.crm.imports.getBatch, { batchId });
}

describe("CSV contact import", () => {
  test("imports rows and derives the fields the contacts table displays", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);

    const batch = await runImport(as, [
      {
        firstName: "Dana", lastName: "Brooks", jobTitle: "VP of Benefits",
        companyName: "Acme Dental", email: "Dana.Brooks@Acme.com",
        mobilePhone: "(813) 555-0142", city: "Tampa", state: "FL",
      },
      // Only a single "name" column — split server-side.
      { fullName: "Sam Ruiz", companyName: "Ruiz Agency", email: "sam@ruiz.com" },
    ]);

    expect(batch?.createdCount).toBe(2);
    expect(batch?.errorCount).toBe(0);
    expect(batch?.status).toBe("completed");

    const contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(2);

    const dana = contacts.find((c) => c.lastName === "Brooks")!;
    expect(dana.fullName).toBe("Dana Brooks");
    // Normalized for dedupe and search, without mangling what gets displayed.
    expect(dana.emailLower).toBe("dana.brooks@acme.com");
    expect(dana.email).toBe("Dana.Brooks@Acme.com");
    expect(dana.mobilePhoneE164).toBe("+18135550142");
    expect(dana.source).toBe("csv_import");
    // A fresh import lands at the start of the relationship spine, with an
    // untouched email sequence — see crm/lib/contactStatus.ts.
    expect(dana.status).toBe("prospect");
    expect(dana.dripStatus).toBe("not_started");
    expect(dana.dripStep).toBe(0);

    const sam = contacts.find((c) => c.lastName === "Ruiz")!;
    expect(sam.firstName).toBe("Sam");

    // Every import leaves an audit trail on the contact.
    const activities = await t.run(async (ctx) =>
      await ctx.db.query("crmActivities").collect());
    expect(activities.filter((a) => a.activityType === "imported")).toHaveLength(2);
  });

  test("rows with neither a name nor an email are skipped, not failed", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);

    const batch = await runImport(as, [
      { companyName: "Ghost Corp", city: "Nowhere" },
      { firstName: "Real", lastName: "Person", email: "real@t.dev" },
    ]);

    expect(batch?.createdCount).toBe(1);
    expect(batch?.skippedCount).toBe(1);
    expect(batch?.errorCount).toBe(0);
  });

  test("fill blanks only never overwrites data that is already there", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);

    await runImport(as, [
      { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com", jobTitle: "VP Benefits" },
    ]);

    // Same person, a worse title, and a city we did not have before.
    const batch = await runImport(as, [
      { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com", jobTitle: "Unknown", city: "Tampa" },
    ]);

    expect(batch?.createdCount).toBe(0);
    expect(batch?.updatedCount).toBe(1);

    const contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(1);
    expect(contacts[0].jobTitle).toBe("VP Benefits"); // held
    expect(contacts[0].city).toBe("Tampa");           // filled
  });

  test("overwrite replaces, skip leaves alone, and duplicates can be forced", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);
    const seed = { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com", jobTitle: "VP Benefits" };
    await runImport(as, [seed]);

    await runImport(as, [{ ...seed, jobTitle: "Director" }], "update_existing");
    let contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts[0].jobTitle).toBe("Director");

    const skipped = await runImport(as, [{ ...seed, jobTitle: "Intern" }], "skip_existing");
    expect(skipped?.skippedCount).toBe(1);
    contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(1);
    expect(contacts[0].jobTitle).toBe("Director");

    const forced = await runImport(as, [seed], "create_duplicates");
    expect(forced?.createdCount).toBe(1);
    contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(2);
  });

  test("a duplicate split across two chunks still dedupes", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);

    // Chunk size 1 forces the pair into separate mutations, which is what the
    // 200-row chunking in the UI does to a large file.
    const batch = await runImport(
      as,
      [
        { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com" },
        { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com", city: "Tampa" },
      ],
      "fill_blanks_only",
      1,
    );

    expect(batch?.createdCount).toBe(1);
    expect(batch?.updatedCount).toBe(1);
    const contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(1);
    expect(contacts[0].city).toBe("Tampa");
  });

  test("matches on mobile + surname when the emails differ", async () => {
    const t = convexTest(schema);
    const as = await seedStaff(t);

    await runImport(as, [
      { firstName: "Dana", lastName: "Brooks", email: "dana@acme.com", mobilePhone: "813-555-0142" },
    ]);
    const batch = await runImport(as, [
      { firstName: "Dana", lastName: "Brooks", email: "d.brooks@newco.com", mobilePhone: "(813) 555-0142", city: "Tampa" },
    ]);

    expect(batch?.createdCount).toBe(0);
    expect(batch?.updatedCount).toBe(1);
    const contacts = await t.run(async (ctx) => await ctx.db.query("crmContacts").collect());
    expect(contacts).toHaveLength(1);
  });

  test("a partner cannot import contacts", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("distributionPartners", {
        name: "Broker LLC", type: "agency", contactName: "B", contactEmail: "b@t.dev",
        clerkUserId: "broker_x", status: "active", createdAt: Date.now(), updatedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(tok("broker_x")).mutation(api.crm.imports.createBatch, {
        filename: "x.csv", entity: "contact", columnMapping: {},
        defaultTagIds: [], dedupeStrategy: "fill_blanks_only", totalRows: 1,
      }),
    ).rejects.toThrow();
  });
});
