import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  sha256,
  validateMetadata,
  validateFileBytes,
  verifyBridgeSignature,
} from "./lib/eligibilityIntake";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

type Receipt = { receiptId: Id<"eligibilitySubmissions"> };

const identity = (id: string) => ({
  tokenIdentifier: `https://clerk.test|${id}`,
});
const token = "nxu_" + "a".repeat(64);
const content =
  "First Name,Last Name,Email,Date of Birth,Effective Date\nJane,Example,jane@example.test,1990-01-01,2026-10-01\n";
const bytes = new TextEncoder().encode(content);

async function world() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: "intake",
      name: "Intake",
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
      slug: "employer",
      name: "Employer",
      accountType: "employer",
      billingModel: "per_member",
      contacts: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const base = {
      accountId,
      siteId,
      status: "active" as const,
      organizationCode: "123",
      createdAt: now,
      updatedAt: now,
    };
    const groupId = await ctx.db.insert("groups", {
      ...base,
      slug: "a",
      name: "Employer A",
      groupCode: "A",
    });
    const otherGroupId = await ctx.db.insert("groups", {
      ...base,
      slug: "b",
      name: "Employer B",
      groupCode: "B",
    });
    const accessId = await ctx.db.insert("eligibilityIntakeAccess", {
      groupId,
      email: "hr@employer.test",
      clerkUserId: "employer",
      browserEnabled: true,
      emailEnabled: true,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "staff",
    });
    await ctx.db.insert("eligibilityIntakeRoutes", { groupId, alias: "org-a" });
    await ctx.db.insert("eligibilityIntakeRoutes", {
      groupId: otherGroupId,
      alias: "org-b",
    });
    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff",
      email: "staff@ideal.test",
      name: "Staff",
      role: "owner",
      createdAt: now,
    });
    return { siteId, accountId, groupId, otherGroupId, accessId };
  });
  return {
    t,
    ...ids,
    staff: t.withIdentity(identity("staff")),
    employer: t.withIdentity(identity("employer")),
  };
}
async function browserSession(
  w: Awaited<ReturnType<typeof world>>,
  rawToken = token,
) {
  return w.t.mutation(internal.eligibilityIntake.beginBrowser, {
    groupId: w.groupId,
    clerkUserId: "employer",
    tokenHash: await sha256(rawToken),
    fileName: "roster.csv",
    fileBytes: bytes.length,
  });
}
async function upload(
  w: Awaited<ReturnType<typeof world>>,
  rawToken = token,
  file = bytes,
) {
  return w.t.fetch("/eligibility/upload", {
    method: "POST",
    headers: { "X-Upload-Token": rawToken },
    body: file,
  });
}
beforeEach(() => {
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("ELIGIBILITY_INBOUND_DOMAIN", "intake.ideal.test");
  vi.stubEnv("ELIGIBILITY_EMAIL_BRIDGE_SECRET", "bridge-secret-".repeat(4));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("organization access", () => {
  test("unapproved users and brokers cannot read the staff queue or grant themselves access", async () => {
    const w = await world();
    await expect(
      w.employer.query(api.eligibilityIntake.adminInbox, {}),
    ).rejects.toThrow(/Admin role required/);
    await expect(
      w.employer.action(api.eligibilityIntake.saveAccess, {
        groupId: w.otherGroupId,
        email: "hr@employer.test",
        browserEnabled: true,
        emailEnabled: true,
      }),
    ).rejects.toThrow(/Admin role required/);
    await expect(
      w.t.query(api.eligibilityIntake.myOrganizations, {}),
    ).rejects.toThrow(/Authentication required/);
  });
  test("browser scope prevents cross-organization sessions and history reads", async () => {
    const w = await world();
    expect(
      (await w.employer.query(api.eligibilityIntake.myOrganizations, {})).map(
        (g) => g.groupId,
      ),
    ).toEqual([w.groupId]);
    await expect(
      w.employer.action(api.eligibilityIntake.createBrowserSession, {
        groupId: w.otherGroupId,
        fileName: "roster.csv",
        fileBytes: bytes.length,
      }),
    ).rejects.toThrow(/Organization upload access/);
    await expect(
      w.employer.query(api.eligibilityIntake.mySubmissions, {
        groupId: w.otherGroupId,
      }),
    ).rejects.toThrow(/Organization access/);
  });
  test("a claimed JWT email does not bind access; Clerk must confirm a verified address", async () => {
    const w = await world();
    await w.t.run(async (ctx) =>
      ctx.db.patch(w.accessId, { clerkUserId: undefined }),
    );
    const claimant = w.t.withIdentity({
      ...identity("new_user"),
      email: "hr@employer.test",
    });
    expect(
      await claimant.query(api.eligibilityIntake.myOrganizations, {}),
    ).toEqual([]);
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_mock");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "new_user",
          email_addresses: [
            {
              email_address: "hr@employer.test",
              verification: { status: "unverified" },
            },
          ],
        }),
      ),
    );
    expect(
      await claimant.action(api.eligibilityIntake.claimBrowserAccess, {}),
    ).toBe(0);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "new_user",
          email_addresses: [
            {
              email_address: "hr@employer.test",
              verification: { status: "verified" },
            },
          ],
        }),
      ),
    );
    expect(
      await claimant.action(api.eligibilityIntake.claimBrowserAccess, {}),
    ).toBe(1);
    expect(
      (await claimant.query(api.eligibilityIntake.myOrganizations, {}))[0]
        .groupId,
    ).toBe(w.groupId);
  });
});

describe("file intake", () => {
  test("duplicate detection retains the original receipt across later roster dates", async () => {
    const w = await world();
    await browserSession(w);
    const { receiptId }: Receipt = await (await upload(w)).json();
    await w.t.run(async (ctx) => {
      const original = (await ctx.db.get(receiptId))!;
      for (let i = 0; i < 51; i++)
        await ctx.db.insert("eligibilitySubmissions", {
          groupId: w.groupId,
          fileName: original.fileName,
          fileType: original.fileType,
          fileBytes: original.fileBytes,
          sha256: original.sha256,
          sourceDate: new Date(Date.UTC(2026, 0, i + 1))
            .toISOString()
            .slice(0, 10),
          source: "browser",
          submittedBy: "employer",
          status: "submitted",
          createdAt: original.createdAt + i + 1,
        });
    });
    const next = "nxu_" + "c".repeat(64);
    await browserSession(w, next);
    expect((await (await upload(w, next)).json()).receiptId).toBe(receiptId);
  });
  test("the downloadable template imports a primary and dependent only after staff review and processing", async () => {
    vi.useFakeTimers();
    const w = await world();
    const headers = readFileSync(
      new URL("../public/eligibility-template.csv", import.meta.url),
      "utf8",
    )
      .trim()
      .split(",");
    const primary: Record<string, string> = {
      "Employee Last Name": "Example",
      "Employee First Name": "Jane",
      "Employee DOB": "1990-01-01",
      "Employee ID": "employee-1",
      "Covered Member Last Name": "Example",
      "Covered Member First Name": "Jane",
      "Covered Member DOB": "1990-01-01",
      "Covered Member Relationship": "Employee",
      Email: "jane@example.test",
      "Address Line 1": "123 Test Street",
      City: "Testville",
      State: "NY",
      Zip: "10001",
      "Effective Date": "2026-10-01",
    };
    const child = {
      ...primary,
      "Covered Member First Name": "Child",
      "Covered Member DOB": "2018-01-01",
      "Covered Member Relationship": "Child",
    };
    const census = new TextEncoder().encode(
      [
        headers.join(","),
        ...[primary, child].map((row) =>
          headers.map((name) => (row as Record<string, string>)[name] ?? "").join(","),
        ),
      ].join("\n"),
    );
    await w.t.mutation(internal.eligibilityIntake.beginBrowser, {
      groupId: w.groupId,
      clerkUserId: "employer",
      tokenHash: await sha256(token),
      fileName: "census.csv",
      fileBytes: census.length,
    });
    const { receiptId }: Receipt = await (await upload(w, token, census)).json();
    const preview = await w.staff.action(
      api.eligibilityIntake.previewSubmission,
      { receiptId },
    );
    expect(preview.primaryCount).toBe(1);
    expect(preview.dependentCount).toBe(1);
    expect(preview.validationErrorCount).toBe(0);
    await w.staff.action(api.eligibilityIntake.approveSubmission, {
      receiptId,
    });
    await w.staff.action(api.eligibilityIntake.processApproved, { receiptId });
    await w.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const members = await w.t.run((ctx) =>
      ctx.db.query("memberProfiles").collect(),
    );
    expect(members).toHaveLength(2);
    expect(members.every((member) => member.groupId === w.groupId)).toBe(true);
    expect(
      members.find((member) => member.memberRole === "dependent")?.firstName,
    ).toBe("Child");
    expect(
      (
        await w.employer.query(api.eligibilityIntake.mySubmissions, {
          groupId: w.groupId,
        })
      )[0].processingStatus,
    ).toBe("completed");
  });
  test("pending submissions remain visible after more than 100 newer completed reviews", async () => {
    const w = await world();
    const oldest = await w.t.run(async (ctx) => {
      const base = {
        groupId: w.groupId,
        fileName: "roster.csv",
        fileType: "csv" as const,
        fileBytes: bytes.length,
        sha256: "test",
        source: "browser" as const,
        submittedBy: "employer",
      };
      const id = await ctx.db.insert("eligibilitySubmissions", {
        ...base,
        status: "submitted",
        createdAt: 1,
      });
      for (let i = 0; i < 101; i++)
        await ctx.db.insert("eligibilitySubmissions", {
          ...base,
          status: "rejected",
          createdAt: i + 2,
        });
      return id;
    });
    expect(
      (await w.staff.query(api.eligibilityIntake.adminInbox, {})).some(
        (r) => r._id === oldest,
      ),
    ).toBe(false);
    expect(
      (
        await w.staff.query(api.eligibilityIntake.adminInbox, {
          pendingOnly: true,
        })
      ).map((r) => r._id),
    ).toEqual([oldest]);
  });
  test("uploads create review receipts, never member changes; retries are idempotent", async () => {
    const w = await world();
    await browserSession(w);
    const response = await upload(w);
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.duplicate).toBe(false);
    const duplicate = await (await upload(w)).json();
    expect(duplicate.receiptId).toBe(result.receiptId);
    expect(duplicate.duplicate).toBe(true);
    const retryToken = "nxu_" + "b".repeat(64);
    await browserSession(w, retryToken);
    expect((await (await upload(w, retryToken)).json()).receiptId).toBe(
      result.receiptId,
    );
    const state = await w.t.run(async (ctx) => ({
      submissions: await ctx.db.query("eligibilitySubmissions").collect(),
      members: await ctx.db.query("memberProfiles").collect(),
      files: await ctx.db.query("eligibilityFiles").collect(),
    }));
    expect(state.submissions).toHaveLength(1);
    expect(state.members).toHaveLength(0);
    expect(state.files).toHaveLength(0);
    const history = await w.employer.query(
      api.eligibilityIntake.mySubmissions,
      { groupId: w.groupId },
    );
    expect(history[0]).not.toHaveProperty("storageId");
  });
  test("revocation invalidates already-issued sessions", async () => {
    const w = await world();
    await browserSession(w);
    await w.staff.mutation(api.eligibilityIntake.revokeAccess, {
      accessId: w.accessId,
    });
    expect((await upload(w)).status).toBe(403);
    expect(
      await w.t.run((ctx) => ctx.db.query("eligibilitySubmissions").collect()),
    ).toHaveLength(0);
  });
  test("size mismatch fails before a file is committed", async () => {
    const w = await world();
    await browserSession(w);
    expect(
      (await upload(w, token, new TextEncoder().encode("short"))).status,
    ).toBe(400);
    expect(
      await w.t.run((ctx) => ctx.db.query("eligibilitySubmissions").collect()),
    ).toHaveLength(0);
  });
  test("expired sessions and unauthorized downloads are refused", async () => {
    const w = await world();
    const id = await browserSession(w);
    await w.t.run((ctx) => ctx.db.patch(id, { expiresAt: Date.now() - 1 }));
    expect((await upload(w)).status).toBe(401);
    expect(
      (await w.t.fetch("/eligibility/download", { method: "POST", body: "{}" }))
        .status,
    ).toBe(401);
  });
  test("missing-field warnings require explicit staff acknowledgement; approval is separate from processing", async () => {
    const w = await world();
    await browserSession(w);
    const { receiptId }: Receipt = await (await upload(w)).json();
    const preview = await w.staff.action(
      api.eligibilityIntake.previewSubmission,
      { receiptId },
    );
    expect(preview.primaryCount).toBe(1);
    expect(preview.validationErrorCount).toBeGreaterThan(0);
    await expect(
      w.staff.action(api.eligibilityIntake.approveSubmission, { receiptId }),
    ).rejects.toThrow(/acknowledge/);
    const fileId = await w.staff.action(
      api.eligibilityIntake.approveSubmission,
      { receiptId, acknowledgeValidationWarnings: true },
    );
    expect(
      await w.staff.action(api.eligibilityIntake.approveSubmission, {
        receiptId,
        acknowledgeValidationWarnings: true,
      }),
    ).toBe(fileId);
    const state = await w.t.run(async (ctx) => ({
      file: await ctx.db.get(fileId),
      row: await ctx.db.get(receiptId),
      members: await ctx.db.query("memberProfiles").collect(),
    }));
    expect(state.file?.status).toBe("uploaded");
    expect(state.row?.validationWarningsAcknowledged).toBe(true);
    expect(state.members).toHaveLength(0);
    await w.t.mutation(internal.eligibilityIntake.claimProcessing, {
      receiptId,
      actor: "staff",
    });
    await expect(
      w.t.mutation(internal.eligibilityIntake.claimProcessing, {
        receiptId,
        actor: "staff",
      }),
    ).rejects.toThrow(/already started/);
  });
  test("rejected source files are purged while receipts remain", async () => {
    vi.useFakeTimers();
    const w = await world();
    await browserSession(w);
    const { receiptId }: Receipt = await (await upload(w)).json();
    await w.staff.mutation(api.eligibilityIntake.rejectSubmission, {
      receiptId,
      note: "Please correct the column headings.",
    });
    await w.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const row = await w.t.run((ctx) => ctx.db.get(receiptId));
    expect(row?.status).toBe("rejected");
    expect(row?.storageId).toBeUndefined();
  });
});

describe("automated and email intake", () => {
  test("API keys are hashed, scoped to one organization, and revocable", async () => {
    const w = await world();
    const issued = await w.staff.action(api.eligibilityIntake.issueKey, {
      groupId: w.groupId,
      label: "Payroll",
      expiresInDays: 30,
    });
    const stored = await w.t.run((ctx) => ctx.db.get(issued.keyId));
    expect(stored?.tokenHash).toBe(await sha256(issued.token));
    expect(
      JSON.stringify(
        await w.staff.query(api.eligibilityIntake.adminConfiguration, {}),
      ),
    ).not.toContain(issued.token);
    const response = await w.t.fetch("/eligibility/sessions", {
      method: "POST",
      headers: { "X-Eligibility-Key": issued.token },
      body: JSON.stringify({
        fileName: "roster.csv",
        fileBytes: bytes.length,
        groupId: w.otherGroupId,
      }),
    });
    expect(response.status).toBe(201);
    const ticket = await response.json();
    const { receiptId }: Receipt = await (await upload(w, ticket.uploadToken)).json();
    expect((await w.t.run((ctx) => ctx.db.get(receiptId)))?.groupId).toBe(
      w.groupId,
    );
    await w.staff.mutation(api.eligibilityIntake.revokeKey, {
      keyId: issued.keyId,
    });
    expect(
      (
        await w.t.fetch("/eligibility/status", {
          method: "POST",
          headers: { "X-Eligibility-Key": issued.token },
          body: JSON.stringify({ receiptId }),
        })
      ).status,
    ).toBe(401);
  });
  test("an API credential cannot read another organization's receipt", async () => {
    const w = await world();
    await browserSession(w);
    const { receiptId }: Receipt = await (await upload(w)).json();
    const issued = await w.staff.action(api.eligibilityIntake.issueKey, {
      groupId: w.otherGroupId,
      label: "B payroll",
      expiresInDays: 1,
    });
    const result = await w.t.fetch("/eligibility/status", {
      method: "POST",
      headers: { "X-Eligibility-Key": issued.token },
      body: JSON.stringify({ receiptId }),
    });
    expect(result.status).toBe(403);
  });
  test("email intake rejects unapproved senders, wrong organization aliases, and failed authentication", async () => {
    const w = await world();
    const base = {
      sender: "hr@employer.test",
      recipients: ["org-a@intake.ideal.test"],
      messageId: "message:0",
      tokenHash: await sha256(token),
      dmarc: "PASS",
      spam: "PASS",
      virus: "PASS",
      fileName: "roster.csv",
      fileBytes: bytes.length,
    };
    await expect(
      w.t.mutation(internal.eligibilityIntake.beginEmail, {
        ...base,
        sender: "attacker@employer.test",
      }),
    ).rejects.toThrow(/approved address/);
    await expect(
      w.t.mutation(internal.eligibilityIntake.beginEmail, {
        ...base,
        recipients: ["org-b@intake.ideal.test"],
      }),
    ).rejects.toThrow(/approved address/);
    await expect(
      w.t.mutation(internal.eligibilityIntake.beginEmail, {
        ...base,
        dmarc: "FAIL",
      }),
    ).rejects.toThrow(/authentication/);
    await w.t.mutation(internal.eligibilityIntake.beginEmail, base);
    expect((await upload(w)).status).toBe(201);
  });
  test("the public email endpoint cannot accept fabricated authentication verdicts", async () => {
    const w = await world();
    const result = await w.t.fetch("/eligibility/email/prepare", {
      method: "POST",
      body: JSON.stringify({ sender: "hr@employer.test", dmarc: "PASS" }),
    });
    expect(result.status).toBe(401);
  });
});

describe("format and bridge guards", () => {
  test("actual workbook inflation is bounded even when archive size metadata lies", async () => {
    const w = await world();
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["First Name"], ["Jane"]]),
      "Roster",
    );
    const array = new Uint8Array(
      XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }),
    );
    const original = await w.t.run((ctx) =>
      ctx.storage.store(new Blob([array])),
    );
    await expect(
      w.t.action(internal.eligibilityIntakeFiles.validateWorkbook, {
        storageId: original,
      }),
    ).resolves.toBeNull();
    const view = new DataView(array.buffer);
    for (let i = 0; i < array.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 1, true);
        view.setUint32(view.getUint32(i + 42, true) + 22, 1, true);
        break;
      }
    const dishonest = await w.t.run((ctx) =>
      ctx.storage.store(new Blob([array])),
    );
    await expect(
      w.t.action(internal.eligibilityIntakeFiles.validateWorkbook, {
        storageId: dishonest,
      }),
    ).rejects.toThrow(/expansion limits/);
  });
  test("metadata rejects unsupported files, path names, large files, and invalid calendar dates", () => {
    for (const [name, size, date] of [
      ["roster.exe", 100],
      ["../roster.csv", 100],
      ["roster.csv", 11 * 1024 * 1024],
      ["roster.csv", 100, "2026-02-30"],
    ] as const)
      expect(() => validateMetadata(name, size, date)).toThrow();
  });
  test("valid workbooks pass; a workbook with inflated ZIP sizes is blocked before parsing", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["First Name"], ["Jane"]]),
      "Roster",
    );
    const array = new Uint8Array(
      XLSX.write(book, { type: "array", bookType: "xlsx" }),
    );
    expect(() => validateFileBytes(array, "xlsx")).not.toThrow();
    const view = new DataView(array.buffer);
    for (let i = 0; i < array.length - 46; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 60 * 1024 * 1024, true);
        break;
      }
    expect(() => validateFileBytes(array, "xlsx")).toThrow(/oversized/);
  });
  test("text and JSON validation rejects binary payloads", () => {
    expect(() => validateFileBytes(new Uint8Array([0, 1]), "csv")).toThrow();
    expect(() =>
      validateFileBytes(new TextEncoder().encode("not JSON"), "json"),
    ).toThrow();
  });
  test("signed bridge bodies expire and cannot be modified", async () => {
    const secret = "bridge-test-secret";
    const timestamp = Date.now().toString();
    const body = "{}";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`${timestamp}.${body}`),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    expect(
      await verifyBridgeSignature(body, timestamp, signature, secret),
    ).toBe(true);
    expect(
      await verifyBridgeSignature(
        '{"changed":true}',
        timestamp,
        signature,
        secret,
      ),
    ).toBe(false);
    expect(
      await verifyBridgeSignature(
        body,
        (Date.now() - 600000).toString(),
        signature,
        secret,
      ),
    ).toBe(false);
  });
});
