/**
 * VIEWER SCOPE — resolution and isolation tests.
 *
 * The scope resolver is the only thing standing between one broker's book and
 * another's, so these tests care less about happy paths than about the shapes
 * that could widen access: a cyclic upline, a deactivated agency, a rep with
 * no codes, a partner nobody recognises.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import {
  resolveViewerScope,
  tryResolveViewerScope,
  collectDescendantPartnerIds,
  scopeRepIds,
  scopeAgencyIds,
  attributionInScope,
  MAX_DESCENDANT_DEPTH,
} from "./scope";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

async function seedPartner(
  t: ReturnType<typeof convexTest>,
  opts: {
    name: string;
    type?: "program_manager" | "fmo" | "agency";
    parentId?: any;
    clerkUserId?: string;
    status?: "active" | "inactive" | "suspended";
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("distributionPartners", {
      name: opts.name,
      type: opts.type ?? "agency",
      parentId: opts.parentId,
      contactName: `${opts.name} Contact`,
      contactEmail: `${opts.name.replace(/\s/g, "").toLowerCase()}@test.dev`,
      clerkUserId: opts.clerkUserId,
      status: opts.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedLeader(
  t: ReturnType<typeof convexTest>,
  opts: { partnerId: any; name: string; clerkUserId?: string },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("partnerLeaders", {
      partnerId: opts.partnerId,
      name: opts.name,
      email: `${opts.name.replace(/\s/g, "").toLowerCase()}@test.dev`,
      isPrimary: true,
      clerkUserId: opts.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedCode(
  t: ReturnType<typeof convexTest>,
  opts: { brokerId: string; code: string; agencyId?: string },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("brokerTrackingCodes", {
      brokerId: opts.brokerId,
      agencyId: opts.agencyId,
      code: opts.code,
      usageCount: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("resolveViewerScope", () => {
  test("internal staff resolve to an unrestricted admin scope", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_1",
        email: "staff@test.dev",
        name: "Staff",
        role: "owner",
        createdAt: Date.now(),
      });
    });

    const scope = await t
      .withIdentity(tok("staff_1"))
      .run(async (ctx) => await resolveViewerScope(ctx as any));

    expect(scope.kind).toBe("admin");
    // null means "no filter" — distinct from [] which would mean "see nothing".
    expect(scopeRepIds(scope)).toBeNull();
    expect(scopeAgencyIds(scope)).toBeNull();
  });

  test("a partner sees itself plus its whole downline, and their codes", async () => {
    const t = convexTest(schema);
    const fmo = await seedPartner(t, { name: "Apex", type: "fmo", clerkUserId: "fmo_1" });
    const agency = await seedPartner(t, { name: "Coastal", parentId: fmo });
    const subAgency = await seedPartner(t, { name: "Harbor", parentId: agency });

    const repA = await seedLeader(t, { partnerId: agency, name: "Rep A" });
    const repB = await seedLeader(t, { partnerId: subAgency, name: "Rep B" });
    await seedCode(t, { brokerId: String(repA), code: "100001" });
    await seedCode(t, { brokerId: String(repB), code: "100002" });

    const scope: any = await t
      .withIdentity(tok("fmo_1"))
      .run(async (ctx) => await resolveViewerScope(ctx as any));

    expect(scope.kind).toBe("partner");
    expect(scope.descendantPartnerIds).toHaveLength(2);
    expect(scope.allPartnerIds).toHaveLength(3);
    expect(scope.leaderIds.map(String).sort()).toEqual(
      [String(repA), String(repB)].sort(),
    );
    expect(scope.codes.sort()).toEqual(["100001", "100002"]);
  });

  test("a rep sees only itself, never a sibling", async () => {
    const t = convexTest(schema);
    const agency = await seedPartner(t, { name: "Coastal" });
    const me = await seedLeader(t, { partnerId: agency, name: "Me", clerkUserId: "rep_1" });
    const sibling = await seedLeader(t, { partnerId: agency, name: "Sibling" });
    await seedCode(t, { brokerId: String(me), code: "MINE" });
    await seedCode(t, { brokerId: String(sibling), code: "THEIRS" });

    const scope: any = await t
      .withIdentity(tok("rep_1"))
      .run(async (ctx) => await resolveViewerScope(ctx as any));

    expect(scope.kind).toBe("rep");
    expect(scopeRepIds(scope)).toEqual([String(me)]);
    expect(scope.codes).toEqual(["MINE"]);
    expect(scope.codes).not.toContain("THEIRS");
  });

  test("a suspended partner resolves to nothing", async () => {
    const t = convexTest(schema);
    await seedPartner(t, { name: "Revoked", clerkUserId: "gone_1", status: "suspended" });

    const scope = await t
      .withIdentity(tok("gone_1"))
      .run(async (ctx) => await tryResolveViewerScope(ctx as any));

    expect(scope).toBeNull();
  });

  test("a rep whose agency was deactivated loses access with it", async () => {
    const t = convexTest(schema);
    const agency = await seedPartner(t, { name: "Dead", status: "inactive" });
    await seedLeader(t, { partnerId: agency, name: "Orphan", clerkUserId: "rep_orphan" });

    const scope = await t
      .withIdentity(tok("rep_orphan"))
      .run(async (ctx) => await tryResolveViewerScope(ctx as any));

    expect(scope).toBeNull();
  });

  test("an unknown user is refused", async () => {
    const t = convexTest(schema);
    await expect(
      t.withIdentity(tok("nobody")).run(async (ctx) => await resolveViewerScope(ctx as any)),
    ).rejects.toThrow(/no insights scope/i);
  });
});

describe("collectDescendantPartnerIds", () => {
  test("a parentId cycle terminates instead of hanging", async () => {
    const t = convexTest(schema);
    const a = await seedPartner(t, { name: "A" });
    const b = await seedPartner(t, { name: "B", parentId: a });
    // Close the loop behind the write-time cycle guard's back.
    await t.run(async (ctx) => {
      await ctx.db.patch(a, { parentId: b });
    });

    const found = await t.run(
      async (ctx) => await collectDescendantPartnerIds(ctx as any, a),
    );

    // B is a descendant; A must not reappear as its own descendant.
    expect(found.map(String)).toEqual([String(b)]);
  });

  test("depth is capped on a pathological chain", async () => {
    const t = convexTest(schema);
    let parent: any = undefined;
    const chain: any[] = [];
    for (let i = 0; i < MAX_DESCENDANT_DEPTH + 5; i++) {
      parent = await seedPartner(t, { name: `Level${i}`, parentId: parent });
      chain.push(parent);
    }

    const found = await t.run(
      async (ctx) => await collectDescendantPartnerIds(ctx as any, chain[0]),
    );

    expect(found.length).toBeLessThanOrEqual(MAX_DESCENDANT_DEPTH);
  });
});

describe("attributionInScope", () => {
  test("admin passes everything; a rep passes only its own", async () => {
    const admin = { kind: "admin" as const, clerkUserId: "x", role: "owner" as const };
    expect(attributionInScope(admin, { repId: "anything" })).toBe(true);

    const rep = {
      kind: "rep" as const,
      clerkUserId: "r",
      leaderId: "leader_me" as any,
      leaderName: "Me",
      partnerId: "agency_me" as any,
      codes: [],
    };
    expect(attributionInScope(rep, { repId: "leader_me" })).toBe(true);
    expect(attributionInScope(rep, { repId: "leader_other" })).toBe(false);
  });

  test("group-attributed members fall back to the agency", async () => {
    const rep = {
      kind: "rep" as const,
      clerkUserId: "r",
      leaderId: "leader_me" as any,
      leaderName: "Me",
      partnerId: "agency_me" as any,
      codes: [],
    };
    // No rep on the member, but the employer deal belongs to their agency.
    expect(attributionInScope(rep, { repId: null, agencyId: "agency_me" })).toBe(true);
    expect(attributionInScope(rep, { repId: null, agencyId: "agency_other" })).toBe(false);
  });

  test("an unattributed member belongs to nobody but admin", async () => {
    const rep = {
      kind: "rep" as const,
      clerkUserId: "r",
      leaderId: "leader_me" as any,
      leaderName: "Me",
      partnerId: "agency_me" as any,
      codes: [],
    };
    expect(attributionInScope(rep, { repId: null, agencyId: null })).toBe(false);
  });
});
