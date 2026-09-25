import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const workspace = api.insights.memberWorkspace;
const identity = (id: string) => ({
  tokenIdentifier: `https://test.clerk.dev|${id}`,
  name: id,
});
async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin",
      name: "Admin",
      email: "admin@test.dev",
      role: "owner",
      createdAt: now,
    });
    const agency = await ctx.db.insert("distributionPartners", {
      name: "Agency",
      type: "agency",
      contactName: "Owner",
      contactEmail: "owner@test.dev",
      clerkUserId: "agency",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const rep = await ctx.db.insert("partnerLeaders", {
      partnerId: agency,
      name: "Rep",
      email: "rep@test.dev",
      clerkUserId: "rep",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
    const otherRep = await ctx.db.insert("partnerLeaders", {
      partnerId: agency,
      name: "Other",
      email: "other@test.dev",
      clerkUserId: "other",
      isPrimary: false,
      createdAt: now,
      updatedAt: now,
    });
    const siteId = await ctx.db.insert("sites", {
      slug: "test",
      name: "Test",
      type: "primary",
      branding: {},
      allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false,
        requireEligibilityMatch: false,
        allowSelfEnrollment: true,
        requirePayment: false,
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
      slug: "acct",
      name: "Employer",
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
      slug: "group",
      name: "Group",
      groupCode: "TEST",
      listBill: {
        enabled: true,
        paymentMethod: "check",
        rates: {
          moCents: 1000,
          msCents: 2000,
          mfCents: 3000,
          rateLabel: "Coverage",
        },
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const base = {
      siteId,
      accountId,
      groupId,
      firstName: "Member",
      lastName: "Test",
      barcode: "123",
      memberType: "active" as const,
      memberRole: "primary" as const,
      status: "active" as const,
      ssn: "PRIVATE-SSN",
      dateOfBirth: "1980-01-01",
      attributedAgencyId: String(agency),
      createdAt: now,
      updatedAt: now,
    };
    const memberId = await ctx.db.insert("memberProfiles", {
      ...base,
      memberId: "MEM-1",
      attributedRepId: String(rep),
      customerId: "member-user",
    });
    const otherMemberId = await ctx.db.insert("memberProfiles", {
      ...base,
      memberId: "MEM-2",
      firstName: "Hidden",
      attributedRepId: String(otherRep),
    });
    await ctx.db.insert("memberNotes", {
      memberProfileId: memberId,
      siteId,
      content: "LEGACY-PRIVATE",
      noteType: "general",
      isPinned: false,
      authorId: "admin",
      authorName: "Admin",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberActivities", {
      memberProfileId: memberId,
      siteId,
      groupId,
      activityType: "note_added",
      title: "PRIVATE-TITLE",
      description: "PRIVATE-CONTENT",
      actorType: "admin",
      createdAt: now,
    });
    await ctx.db.insert("membershipAgreements", {
      userId: "member-user",
      memberId: "MEM-1",
      memberName: "Member Test",
      memberAddress: "PRIVATE-ADDRESS",
      email: "m@test.dev",
      planName: "Plan",
      groupCode: "TEST",
      term: "Monthly",
      effectiveDate: "2026-01-01",
      classification: "Member",
      paymentMode: "Monthly",
      periodicCharge: "$10",
      processingFee: "$0",
      membershipTermsAgreed: true,
      termsAndConditionsAgreed: true,
      memberSignature: "PRIVATE-SIGNATURE",
      signatureTimestamp: now,
      status: "active",
      createdAt: now,
    });
    return { memberId, otherMemberId, groupId, agency, siteId };
  });
  return {
    t,
    ...ids,
    admin: t.withIdentity(identity("admin")),
    rep: t.withIdentity(identity("rep")),
    other: t.withIdentity(identity("other")),
    agencyUser: t.withIdentity(identity("agency")),
  };
}

describe("member workspace", () => {
  test("rejects anonymous access and prevents direct member access across reps in one agency", async () => {
    const { t, rep, agencyUser, memberId, otherMemberId } = await setup();
    await expect(
      t.query(workspace.getWorkspace, { memberId }),
    ).rejects.toThrow();
    expect(
      await rep.query(workspace.getWorkspace, { memberId: otherMemberId }),
    ).toBeNull();
    expect(
      await agencyUser.query(workspace.getWorkspace, {
        memberId: otherMemberId,
      }),
    ).not.toBeNull();
    await expect(
      rep.mutation(workspace.addNote, {
        memberId: otherMemberId,
        content: "No",
        noteType: "general",
        visibility: "shared",
        isPinned: false,
      }),
    ).rejects.toThrow("Member not found");
  });

  test("keeps legacy notes, private alerts/documents, free-text activity, signatures and PII off the broker wire", async () => {
    const { admin, rep, memberId } = await setup();
    await admin.mutation(workspace.createAlert, {
      memberId,
      title: "PRIVATE-ALERT",
      severity: "urgent",
      visibility: "admin",
    });
    await admin.mutation(workspace.addDocument, {
      memberId,
      name: "PRIVATE-DOCUMENT",
      url: "https://example.com/private",
      category: "other",
      visibility: "admin",
    });
    const broker = await rep.query(workspace.getWorkspace, { memberId });
    const wire = JSON.stringify(broker);
    for (const secret of [
      "PRIVATE-",
      "LEGACY-PRIVATE",
      "memberSignature",
      "1980-01-01",
    ])
      expect(wire).not.toContain(secret);
    expect(broker?.raw).toBeNull();
    expect(broker?.notes).toHaveLength(0);
    expect(broker?.agreements[0].planName).toBe("Plan");
    const staff = await admin.query(workspace.getWorkspace, { memberId });
    expect(staff?.notes[0].content).toBe("LEGACY-PRIVATE");
    expect(staff?.alerts).toHaveLength(1);
    expect(staff?.documents).toHaveLength(1);
  });

  test("persists shared notes with server-derived authors and records activity", async () => {
    const { admin, rep, memberId } = await setup();
    await rep.mutation(workspace.addNote, {
      memberId,
      content: " Follow up tomorrow ",
      noteType: "follow_up",
      visibility: "shared",
      isPinned: true,
    });
    const data = await admin.query(workspace.getWorkspace, { memberId });
    expect(data?.notes[0]).toMatchObject({
      content: "Follow up tomorrow",
      authorId: "rep",
      isPinned: true,
    });
    expect(data?.timeline.some((a) => a.title === "Member note added")).toBe(
      true,
    );
    expect(
      (await rep.query(workspace.getWorkspace, { memberId }))?.notes,
    ).toHaveLength(1);
    await expect(
      rep.mutation(workspace.addNote, {
        memberId,
        content: "No",
        noteType: "internal",
        visibility: "shared",
        isPinned: false,
      }),
    ).rejects.toThrow();
    await expect(
      admin.mutation(workspace.addNote, {
        memberId,
        content: "No",
        noteType: "internal",
        visibility: "shared",
        isPinned: false,
      }),
    ).rejects.toThrow();
    await expect(
      rep.mutation(workspace.addNote, {
        memberId,
        content: " ",
        noteType: "general",
        visibility: "shared",
        isPinned: false,
      }),
    ).rejects.toThrow();
  });

  test("alerts can only be resolved by their author or an admin, with expiration validation", async () => {
    const { admin, rep, other, memberId } = await setup();
    const alertId = await admin.mutation(workspace.createAlert, {
      memberId,
      title: "Check enrollment",
      severity: "warning",
      visibility: "shared",
    });
    await expect(
      rep.mutation(workspace.resolveAlert, { alertId }),
    ).rejects.toThrow("Only the author");
    await expect(
      other.mutation(workspace.resolveAlert, { alertId }),
    ).rejects.toThrow("Member not found");
    await admin.mutation(workspace.resolveAlert, { alertId });
    const data = await rep.query(workspace.getWorkspace, { memberId });
    expect(data?.alerts[0].resolvedAt).toBeTypeOf("number");
    await expect(
      rep.mutation(workspace.createAlert, {
        memberId,
        title: "Expired",
        severity: "info",
        visibility: "shared",
        expiresAt: Date.now() - 1,
      }),
    ).rejects.toThrow("future");
  });

  test("document references reject executable URLs and enforce shared broker visibility", async () => {
    const { rep, memberId } = await setup();
    for (const url of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:password@example.com",
    ]) {
      await expect(
        rep.mutation(workspace.addDocument, {
          memberId,
          name: "Document",
          url,
          category: "other",
          visibility: "shared",
        }),
      ).rejects.toThrow();
    }
    await expect(
      rep.mutation(workspace.addDocument, {
        memberId,
        name: "Document",
        url: "https://example.com",
        category: "other",
        visibility: "admin",
      }),
    ).rejects.toThrow();
    await rep.mutation(workspace.addDocument, {
      memberId,
      name: "Enrollment",
      url: "https://example.com/enrollment",
      category: "enrollment",
      visibility: "shared",
    });
    expect(
      (await rep.query(workspace.getWorkspace, { memberId }))?.documents[0]
        .name,
    ).toBe("Enrollment");
  });

  test("employer invoice history returns only this member's lines, never the group census or balance", async () => {
    const { admin, rep, memberId, groupId } = await setup();
    await admin.mutation(api.admin.listBillInvoices.generateInvoice, {
      groupId,
      coveragePeriod: "2026-09",
    });
    const data = await rep.query(workspace.getWorkspace, { memberId });
    expect(data?.billingSource).toBe("list_bill");
    expect(data?.invoices).toHaveLength(1);
    expect(data?.invoices[0].rateCents).toBe(1000);
    expect(JSON.stringify(data?.invoices)).not.toContain("Hidden");
    expect(JSON.stringify(data?.invoices)).not.toContain("ssn");
    expect(data?.invoices[0]).not.toHaveProperty("balanceCents");
  });

  test("revoking an agency removes access to reads and writes", async () => {
    const { t, rep, memberId, agency } = await setup();
    await t.run((ctx) => ctx.db.patch(agency, { status: "suspended" }));
    await expect(
      rep.query(workspace.getWorkspace, { memberId }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      rep.mutation(workspace.createAlert, {
        memberId,
        title: "No",
        severity: "info",
        visibility: "shared",
      }),
    ).rejects.toThrow("Unauthorized");
  });
  test("permanent member removal also removes owned workspace records", async () => {
    const { t, admin, memberId } = await setup();
    const alertId = await admin.mutation(workspace.createAlert, {
      memberId,
      title: "Follow up",
      severity: "info",
      visibility: "admin",
    });
    const documentId = await admin.mutation(workspace.addDocument, {
      memberId,
      name: "Document",
      url: "https://example.com/document",
      category: "other",
      visibility: "admin",
    });
    await admin.mutation(api.admin.members.hardDeleteMember, { memberId });
    const records = await t.run(async (ctx) => [
      await ctx.db.get(alertId),
      await ctx.db.get(documentId),
    ]);
    expect(records).toEqual([null, null]);
  });
});
