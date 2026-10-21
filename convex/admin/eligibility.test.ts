/**
 * ELIGIBILITY FILE IMPORT — server tests
 *
 * Focused regression coverage for internalBatchCreateMembers matching logic:
 * re-uploading an eligibility file for a member with no email must UPDATE the
 * existing memberProfile, not create a duplicate. See list_bill_invoices spec
 * / "Harlie Waters" case — members with no email can never be Clerk-provisioned
 * and so are re-matched purely from eligibility file data on every re-upload.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import { parseCsvContent } from "./eligibility";
import type { Id } from "../_generated/dataModel";

const internalBatchCreateMembers = internal.admin.eligibility.internalBatchCreateMembers;

interface World {
  siteId: Id<"sites">;
  accountId: Id<"accounts">;
  groupId: Id<"groups">;
}

async function seedWorld(t: ReturnType<typeof convexTest>): Promise<World> {
  return t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: `s-${Math.random().toString(36).slice(2)}`,
      name: "Elig Site",
      type: "primary",
      branding: {},
      allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false,
        requireEligibilityMatch: false,
        allowSelfEnrollment: true,
        requirePayment: true,
        autoActivate: true,
        collectAddress: false,
        collectPhone: false,
        collectEmployeeId: false,
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId,
      slug: `a-${Math.random().toString(36).slice(2)}`,
      name: "Elig Account",
      accountType: "employer",
      billingModel: "per_member",
      contacts: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId,
      accountId,
      slug: `g-${Math.random().toString(36).slice(2)}`,
      name: "Elig Group",
      groupCode: "ELIGTEST",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { siteId, accountId, groupId };
  });
}

async function seedFile(t: ReturnType<typeof convexTest>, world: World): Promise<Id<"eligibilityFiles">> {
  return t.run(async (ctx) => {
    return ctx.db.insert("eligibilityFiles", {
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      fileName: "census.csv",
      fileType: "csv",
      status: "processing",
      totalRecords: 1,
      processedRecords: 0,
      errorRecords: 0,
      newMembers: 0,
      updatedMembers: 0,
      terminatedMembers: 0,
      fileAction: "full_replace",
      uploadedAt: Date.now(),
    });
  });
}

function baseRecord(overrides: Partial<Record<string, any>> = {}) {
  return {
    title: "",
    firstName: "Harlie",
    middleName: "",
    lastName: "Waters",
    suffix: "",
    email: "",
    phone: "",
    workPhone: "",
    dateOfBirth: "1990-05-14",
    effectiveDate: "2026-07-01",
    gender: "",
    uniqueId: "",
    ...overrides,
  };
}

async function runBatch(
  t: ReturnType<typeof convexTest>,
  world: World,
  fileId: Id<"eligibilityFiles">,
  record: Record<string, any>,
) {
  return t.run(async (ctx) => {
    return ctx.runMutation(internalBatchCreateMembers, {
      fileId,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      records: [record as any],
      batchIndex: 0,
      totalBatches: 1,
      isLastBatch: true,
      startRowIndex: 0,
      parseErrors: [],
    });
  });
}

async function countGroupMembers(t: ReturnType<typeof convexTest>, world: World) {
  return t.run(async (ctx) => {
    const members = await ctx.db.query("memberProfiles").collect();
    return members.filter((m) => m.groupId === world.groupId);
  });
}

describe("internalBatchCreateMembers — no-email member re-match on re-upload", () => {
  test("a roster cannot update another organization's family by vendor ID", async () => {
    const t = convexTest(schema);
    const original = await seedWorld(t);
    const originalFile = await seedFile(t, original);
    await runBatch(t, original, originalFile, baseRecord({ uniqueId: "family-shared-id", dependents: [{ firstName: "Child", lastName: "Original", relationship: "child", seqNum: "01" }] }));
    const before = await countGroupMembers(t, original);
    expect(before).toHaveLength(2);
    const other = await seedWorld(t);
    const otherFile = await seedFile(t, other);
    const result = await runBatch(t, other, otherFile, baseRecord({ uniqueId: "family-shared-id", firstName: "Changed", dependents: [{ firstName: "Changed", lastName: "Dependent", relationship: "child", seqNum: "01" }] }));
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.some((error) => /another organization/.test(error.error ?? ""))).toBe(true);
    expect(await countGroupMembers(t, original)).toEqual(before);
    expect(await countGroupMembers(t, other)).toEqual([]);
  });

  test("matches by name + DOB when no email, uniqueId, groupMemberId, or SSN present", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);

    const r1 = await runBatch(t, world, fileId, baseRecord());
    expect(r1.created).toBe(1);
    expect(r1.updated).toBe(0);

    // Re-upload the same census row (e.g. next month's file) — phone changed,
    // but still no email/uniqueId/groupMemberId/ssn.
    const r2 = await runBatch(t, world, fileId, baseRecord({ phone: "5551234567" }));
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);

    const members = await countGroupMembers(t, world);
    expect(members).toHaveLength(1);
    expect(members[0].phone).toBe("5551234567");
  });

  test("matches by SSN when no email/uniqueId/groupMemberId present", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);

    const r1 = await runBatch(t, world, fileId, baseRecord({ ssn: "123-45-6789" }));
    expect(r1.created).toBe(1);

    // Different DOB formatting/typo shouldn't matter since SSN matches first.
    const r2 = await runBatch(t, world, fileId, baseRecord({ ssn: "123456789", phone: "5559998888" }));
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);

    const members = await countGroupMembers(t, world);
    expect(members).toHaveLength(1);
    expect(members[0].phone).toBe("5559998888");
  });

  test("still creates a new member when name+DOB genuinely differ (no false match)", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);

    await runBatch(t, world, fileId, baseRecord());
    const r2 = await runBatch(
      t,
      world,
      fileId,
      baseRecord({ firstName: "Someone", lastName: "Else", dateOfBirth: "1985-01-01" }),
    );
    expect(r2.created).toBe(1);
    expect(r2.updated).toBe(0);

    const members = await countGroupMembers(t, world);
    expect(members).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* Terminations                                                        */
/* ------------------------------------------------------------------ */

const PAST = "2000-01-31";
const FUTURE = "2099-12-31";

async function getMembers(t: ReturnType<typeof convexTest>, world: World) {
  const members = await countGroupMembers(t, world);
  return {
    primary: members.find((m) => m.memberRole !== "dependent")!,
    dependents: members.filter((m) => m.memberRole === "dependent"),
  };
}

const familyRecord = (overrides: Partial<Record<string, any>> = {}) =>
  baseRecord({
    ssn: "900000001",
    dependents: [{ firstName: "Kid", lastName: "Waters", relationship: "child", seqNum: "01" }],
    ...overrides,
  });

describe("parseCsvContent — Soar census termination signals", () => {
  const header =
    '"Employee Last Name","Employee First Name","Employee SSN","Employee DOB","Employee Status","Covered Member Relationship","Covered Member Last Name","Covered Member First Name","Covered Member DOB","Covered Member SSN","Tier","Effective Date","Term Date","Date Terminated","Approved EE Cost"';
  const csv = [
    header,
    '"Doe","Jane","900000001","12/14/2002","Terminated","Employee","Doe","Jane","12/14/2002","900000001","EMP","05/01/2026","09/30/2026","10/07/2026","14.99"',
    '"Roe","Rick","900000002","05/01/1988","Active","Employee","Roe","Rick","05/01/1988","900000002","ESP","05/01/2026","","","24.99"',
    '"Roe","Rick","900000002","05/01/1988","Active","Spouse","Roe","Rita","01/06/1991","900000003","ESP","05/01/2026","","","0"',
  ].join("\n");

  test("reads Employee Status and Term Date for the employee", () => {
    const [jane, rick] = parseCsvContent(csv);
    expect(jane).toMatchObject({ firstName: "Jane", terminated: true, termDate: "2026-09-30" });
    expect(rick).toMatchObject({ firstName: "Rick", terminated: false });
    expect(rick.termDate).toBeUndefined();
    expect(rick.dependents).toHaveLength(1);
  });
});

describe("internalBatchCreateMembers — terminations", () => {
  test("a terminated status with a past Term Date terminates the member and dependents", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());

    const result = await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: PAST }));
    expect(result.terminated).toBe(2);

    const { primary, dependents } = await getMembers(t, world);
    expect(primary).toMatchObject({ memberType: "terminated", status: "terminated", terminationDate: PAST });
    expect(primary.terminatedAt).toBeTypeOf("number");
    expect(dependents.map((d) => d.memberType)).toEqual(["terminated"]);

    const file = await t.run((ctx) => ctx.db.get(fileId));
    expect(file?.terminatedMembers).toBe(2);
  });

  test("a terminated status with no Term Date ends coverage today", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());

    await runBatch(t, world, fileId, familyRecord({ terminated: true }));
    const { primary } = await getMembers(t, world);
    expect(primary.memberType).toBe("terminated");
    expect(primary.terminationDate).toBe(new Date().toISOString().slice(0, 10));
  });

  test("a past Term Date terminates even when the status still says active", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());

    await runBatch(t, world, fileId, familyRecord({ termDate: PAST }));
    expect((await getMembers(t, world)).primary.memberType).toBe("terminated");
  });

  test("re-uploading the same termination does not count it twice", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());
    await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: PAST }));

    const again = await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: PAST }));
    expect(again.terminated).toBe(0);
  });

  test("a terminated row for someone not on file is reported, not created", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);

    const result = await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: PAST }));
    expect(result.created).toBe(0);
    expect(result.errors.some((e) => /terminated in this file/.test(e.message ?? ""))).toBe(true);
    expect(await countGroupMembers(t, world)).toEqual([]);
  });

  test("a future Term Date is stored, then applied by the daily sweep once it passes", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());

    await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: FUTURE }));
    let { primary } = await getMembers(t, world);
    expect(primary).toMatchObject({ memberType: "eligible", terminationDate: FUTURE });

    // Not due yet: the sweep leaves them alone.
    expect(await t.mutation(internal.admin.eligibility.applyDueEligibilityTerminations, {})).toEqual({ terminated: 0 });

    // The date arrives.
    await t.run((ctx) => ctx.db.patch(primary._id, { terminationDate: PAST }));
    expect(await t.mutation(internal.admin.eligibility.applyDueEligibilityTerminations, {})).toEqual({ terminated: 2 });
    ({ primary } = await getMembers(t, world));
    expect(primary.memberType).toBe("terminated");
  });

  test("a later file without the term withdraws a pending termination", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord({ termDate: FUTURE }));
    expect((await getMembers(t, world)).primary.terminationDate).toBe(FUTURE);

    await runBatch(t, world, fileId, familyRecord());
    expect((await getMembers(t, world)).primary.terminationDate).toBeUndefined();
  });

  test("a dependent with its own past Term Date ends alone and leaves the vendor snapshot", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());

    const result = await runBatch(t, world, fileId, familyRecord({
      dependents: [{ firstName: "Kid", lastName: "Waters", relationship: "child", seqNum: "01", termDate: PAST }],
    }));
    expect(result.terminated).toBe(1);

    const { primary, dependents } = await getMembers(t, world);
    expect(primary.memberType).toBe("eligible");
    expect(primary.dependents).toEqual([]);
    expect(dependents.map((d) => d.memberType)).toEqual(["terminated"]);
  });

  test("a terminated member listed as active again is flagged for review", async () => {
    const t = convexTest(schema);
    const world = await seedWorld(t);
    const fileId = await seedFile(t, world);
    await runBatch(t, world, fileId, familyRecord());
    await runBatch(t, world, fileId, familyRecord({ terminated: true, termDate: PAST }));

    const result = await runBatch(t, world, fileId, familyRecord());
    expect(result.errors.some((e) => /review for re-enrollment/.test(e.message ?? ""))).toBe(true);
    expect((await getMembers(t, world)).primary.memberType).toBe("terminated");
  });
});
