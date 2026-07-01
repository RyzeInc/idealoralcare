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
