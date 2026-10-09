/**
 * MASTER MGU AGREEMENT — only an agency principal signs, only the current
 * version can be signed, and nothing shows before staff upload one.
 */

import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const tok = (id: string) => ({ tokenIdentifier: `https://clerk.test|${id}`, subject: id, email: `${id}@harbor.test` });

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", { clerkUserId: "owner", email: "o@ideal.test", name: "Owner", role: "owner", createdAt: now });
    const agency = await ctx.db.insert("distributionPartners", {
      name: "Harbor Agency", type: "agency", contactName: "A", contactEmail: "a@harbor.test", status: "active", createdAt: now, updatedAt: now,
    });
    const leader = (clerkUserId: string, isPrimary: boolean) =>
      ctx.db.insert("partnerLeaders", {
        partnerId: agency, name: clerkUserId, email: `${clerkUserId}@harbor.test`, isPrimary, clerkUserId, createdAt: now, updatedAt: now,
      });
    await leader("principal", true);
    await leader("downline_rep", false);
    return { agency };
  });
  const owner = t.withIdentity(tok("owner"));
  const publish = async (name: string) => {
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-1.4 test"], { type: "application/pdf" })));
    return owner.mutation(api.legal.mguAgreement.publishVersion, { storageId, fileName: name });
  };
  return { t, ...ids, owner, publish, principal: t.withIdentity(tok("principal")), rep: t.withIdentity(tok("downline_rep")) };
}

const signArgs = (versionId: Id<"mguAgreementVersions">) => ({
  versionId, signerName: "Pat Principal", signerTitle: "Owner", acknowledged: true,
});

describe("MGU agreement", () => {
  test("shows nothing to agencies until one is uploaded", async () => {
    const s = await setup();
    expect(await s.principal.query(api.legal.mguAgreement.getMine, {})).toBeNull();
  });

  test("the agency principal signs; a downline rep can't", async () => {
    const s = await setup();
    const { versionId } = await s.publish("MGU v1.pdf");
    expect(await s.rep.query(api.legal.mguAgreement.getMine, {})).toBeNull();
    await expect(s.rep.mutation(api.legal.mguAgreement.sign, signArgs(versionId))).rejects.toThrow(/principal/);

    const before = await s.principal.query(api.legal.mguAgreement.getMine, {});
    expect(before).toMatchObject({ version: 1, partnerName: "Harbor Agency", signed: null });
    await s.principal.mutation(api.legal.mguAgreement.sign, signArgs(versionId));
    const after = await s.principal.query(api.legal.mguAgreement.getMine, {});
    expect(after?.signed).toMatchObject({ signerName: "Pat Principal", signerTitle: "Owner" });
    await expect(s.principal.mutation(api.legal.mguAgreement.sign, signArgs(versionId))).rejects.toThrow(/already signed/);

    const overview = await s.owner.query(api.legal.mguAgreement.getAdminOverview, {});
    expect(overview.agencies).toHaveLength(1);
    expect(overview.agencies[0].signed?.signerName).toBe("Pat Principal");
  });

  test("a new version asks for a new signature and the old one can no longer be signed", async () => {
    const s = await setup();
    const v1 = await s.publish("MGU v1.pdf");
    await s.principal.mutation(api.legal.mguAgreement.sign, signArgs(v1.versionId));
    const v2 = await s.publish("MGU v2.pdf");
    expect(v2.version).toBe(2);

    const mine = await s.principal.query(api.legal.mguAgreement.getMine, {});
    expect(mine).toMatchObject({ version: 2, signed: null, previousVersion: 1 });
    await expect(s.principal.mutation(api.legal.mguAgreement.sign, signArgs(v1.versionId))).rejects.toThrow(/just updated/);
    await s.principal.mutation(api.legal.mguAgreement.sign, signArgs(v2.versionId));
  });

  test("rejects a signature without the authority acknowledgment", async () => {
    const s = await setup();
    const { versionId } = await s.publish("MGU v1.pdf");
    await expect(
      s.principal.mutation(api.legal.mguAgreement.sign, { ...signArgs(versionId), acknowledged: false }),
    ).rejects.toThrow(/authorized/);
  });
});
