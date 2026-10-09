/**
 * The bootstrap paths must not be a way for an ordinary signed-in user to
 * become an admin once the deployment already has one.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ subject: id, tokenIdentifier: `https://test.clerk.dev|${id}` });

describe("bootstrapFirstAdmin", () => {
  test("a member cannot make themselves admin once an admin exists", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "owner_1", email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
      });
    });
    await expect(
      t.withIdentity(tok("member_1")).mutation(api.admin.grantFreeAccess.bootstrapFirstAdmin, {}),
    ).rejects.toThrow(/already set up/);
    const admins = await t.run(async (ctx) => ctx.db.query("adminUsers").collect());
    expect(admins.map((a) => a.clerkUserId)).toEqual(["owner_1"]);
  });

  test("the first signed-in user on an empty deployment still becomes owner", async () => {
    const t = convexTest(schema);
    await t.withIdentity(tok("first_user")).mutation(api.admin.grantFreeAccess.bootstrapFirstAdmin, {});
    const admins = await t.run(async (ctx) => ctx.db.query("adminUsers").collect());
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({ clerkUserId: "first_user", role: "owner" });
  });
});
