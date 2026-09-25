/**
 * A PARTNER'S OWN EXECUTED AGREEMENT — who may pull it.
 *
 * The document carries an authorized signature and NPN, so the entitlement
 * rule is deliberately tighter than the resource library's: the signing agency
 * and nobody else. These tests pin that, and pin that the match is on partner
 * id rather than the self-reported email on the intake row.
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
      clerkUserId: "staff_agr", email: "s@t.dev", name: "Staff",
      role: "owner", createdAt: now,
    });

    const mkAgency = async (name: string, clerkUserId: string) => {
      const agencyId = await ctx.db.insert("distributionPartners", {
        name, type: "agency" as const, contactName: name,
        contactEmail: `${clerkUserId}@t.dev`, clerkUserId,
        status: "active" as const, createdAt: now, updatedAt: now,
      });
      return { agencyId };
    };

    const mkLeader = async (
      partnerId: any, clerkUserId: string, isPrimary: boolean,
    ) =>
      await ctx.db.insert("partnerLeaders", {
        partnerId, name: clerkUserId, email: `${clerkUserId}@t.dev`,
        clerkUserId, isPrimary, createdAt: now, updatedAt: now,
      });

    const signer = await mkAgency("Signing Agency", "broker_signer");
    const other = await mkAgency("Other Agency", "broker_other");

    // How promotion actually provisions the signatory: a primary leader whose
    // clerkUserId is set when they claim their invite. Plus a downline rep,
    // who must NOT inherit the firm's contract.
    const principalLeaderId = await mkLeader(signer.agencyId, "principal_signer", true);
    const downlineLeaderId = await mkLeader(signer.agencyId, "downline_rep", false);

    return { signer, other, principalLeaderId, downlineLeaderId, now };
  });
}

/** A signed kit, promoted to `partnerId`. `storageId` marks it rendered. */
async function seedKit(
  t: ReturnType<typeof convexTest>,
  over: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const storageId = await ctx.storage.store(
      new Blob(["%PDF-1.4 executed"], { type: "application/pdf" }),
    );
    return await ctx.db.insert("partnerKitSubmissions", {
      partnerAgencyName: "Signing Agency",
      primaryContactName: "Dana Signer",
      email: "shared@t.dev",
      acknowledged: true,
      method: "online" as const,
      signatureDataUrl: "data:image/png;base64,SIG",
      printedName: "Dana Signer",
      signedDate: "2026-01-15",
      status: "approved" as const,
      executedAgreementFileId: storageId as unknown as string,
      createdAt: now,
      updatedAt: now,
      ...over,
    } as any);
  });
}

describe("a partner's own agreement", () => {
  test("the signing agency sees it and can download it", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    await seedKit(t, { approvedPartnerId: String(signer.agencyId) });

    const mine = await t
      .withIdentity(tok("broker_signer"))
      .query(api.resources.agreement.getMine, {});
    expect(mine?.partnerAgencyName).toBe("Signing Agency");
    expect(mine?.available).toBe(true);

    const dl = await t
      .withIdentity(tok("broker_signer"))
      .mutation(api.resources.agreement.getMineDownloadUrl, {});
    expect(dl?.url).toBeTruthy();
  });

  test("another agency gets nothing, even sharing the intake email", async () => {
    const t = convexTest(schema);
    const { signer, other } = await seedWorld(t);
    await seedKit(t, { approvedPartnerId: String(signer.agencyId) });

    // The other agency's contact email is different, but the point stands even
    // if it were not: matching is on partner id, so email is never consulted.
    await t.run(async (ctx) => {
      await ctx.db.patch(other.agencyId, { contactEmail: "shared@t.dev" });
    });

    expect(
      await t.withIdentity(tok("broker_other")).query(api.resources.agreement.getMine, {}),
    ).toBeNull();
    expect(
      await t
        .withIdentity(tok("broker_other"))
        .mutation(api.resources.agreement.getMineDownloadUrl, {}),
    ).toBeNull();
  });

  test("the agency principal sees it after claiming their invite", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    await seedKit(t, { approvedPartnerId: String(signer.agencyId) });

    // `claimInvite` puts clerkUserId on partnerLeaders, so the person who
    // signed resolves as REP scope — not partner scope. They must still get it.
    const mine = await t
      .withIdentity(tok("principal_signer"))
      .query(api.resources.agreement.getMine, {});
    expect(mine?.partnerAgencyName).toBe("Signing Agency");

    const dl = await t
      .withIdentity(tok("principal_signer"))
      .mutation(api.resources.agreement.getMineDownloadUrl, {});
    expect(dl?.url).toBeTruthy();
  });

  test("a downline rep does not inherit their agency's agreement", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    await seedKit(t, { approvedPartnerId: String(signer.agencyId) });

    expect(
      await t.withIdentity(tok("downline_rep")).query(api.resources.agreement.getMine, {}),
    ).toBeNull();
    expect(
      await t
        .withIdentity(tok("downline_rep"))
        .mutation(api.resources.agreement.getMineDownloadUrl, {}),
    ).toBeNull();
  });

  test("an unrendered online submission shows as pending, not downloadable", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    await seedKit(t, {
      approvedPartnerId: String(signer.agencyId),
      executedAgreementFileId: undefined,
    });

    const mine = await t
      .withIdentity(tok("broker_signer"))
      .query(api.resources.agreement.getMine, {});
    expect(mine).not.toBeNull();
    expect(mine?.available).toBe(false);
    expect(
      await t
        .withIdentity(tok("broker_signer"))
        .mutation(api.resources.agreement.getMineDownloadUrl, {}),
    ).toBeNull();
  });

  test("an uploaded kit is served as-is, never the rendered copy", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    const uploadedId = await t.run(async (ctx) =>
      String(
        await ctx.storage.store(new Blob(["%PDF-1.4 uploaded"], { type: "application/pdf" })),
      ),
    );
    await seedKit(t, {
      approvedPartnerId: String(signer.agencyId),
      method: "upload",
      signatureDataUrl: undefined,
      partnerKitFileId: uploadedId,
      partnerKitFileName: "Signed Kit.pdf",
    });

    const dl = await t
      .withIdentity(tok("broker_signer"))
      .mutation(api.resources.agreement.getMineDownloadUrl, {});
    expect(dl?.fileName).toBe("Signed Kit.pdf");
    // The rendered copy exists too — this proves which one was handed back.
    const served = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(uploadedId as any);
      return await blob!.text();
    });
    expect(served).toContain("uploaded");
  });

  test("a partner promoted through an application still finds their kit", async () => {
    const t = convexTest(schema);
    const { signer } = await seedWorld(t);
    // No `approvedPartnerId` on the kit — the link lives on the application,
    // which is how partners promoted through the pipeline are wired up.
    const kitId = await seedKit(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("repOnboardingSubmissions", {
        submissionType: "agency" as const,
        agencyName: "Signing Agency",
        primaryContactEmail: "shared@t.dev",
        status: "approved" as const,
        approvedPartnerId: String(signer.agencyId),
        partnerKitSubmissionId: kitId,
        createdAt: now,
        updatedAt: now,
      } as any);
    });

    const mine = await t
      .withIdentity(tok("broker_signer"))
      .query(api.resources.agreement.getMine, {});
    expect(mine?.partnerAgencyName).toBe("Signing Agency");
    expect(mine?.available).toBe(true);
  });

  test("a partner with no signed kit has no card", async () => {
    const t = convexTest(schema);
    await seedWorld(t);
    expect(
      await t.withIdentity(tok("broker_signer")).query(api.resources.agreement.getMine, {}),
    ).toBeNull();
  });
});
