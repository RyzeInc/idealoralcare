/**
 * DRIP ENROLLMENT — the things that must never regress.
 *
 * THE BUG THESE EXIST FOR. crmDripEnrollments is the source of truth for
 * campaign membership, and crmContacts.dripStatus/dripStep are a CACHE of it
 * (see lib/dripCache.ts). It is therefore not enough for a reply or a bounce to
 * write the cached column: syncPrimaryDripCache recomputes that column from the
 * enrollment on the next write, so a cache-only update is silently reverted —
 * and the send path reads the enrollment, not the cache. The practical
 * consequence of getting this wrong is a contact who replied continuing to
 * receive phases 3, 4 and 5, which is the exact harm the model exists to stop.
 *
 * The monotonic rule asserted below ("a reply is an exit, and nothing
 * re-advances it") is the same one Odoo's mailing.trace enforces, where an
 * open never overwrites a reply.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { insertActivity } from "./activities";
import { advanceEnrollmentForSend } from "./lib/dripAdvance";
import { recordEmailBlocked } from "./lib/emailProgress";
import { syncPrimaryDripCache } from "./lib/dripCache";
import type { Id } from "../_generated/dataModel";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

/**
 * Fully-typed handles — deriving the type from an actual `convexTest(schema)`
 * call keeps table names, index names and document shapes checked inside every
 * helper. `ReturnType<typeof convexTest>` without the schema silently degrades
 * to an `any`-shaped data model and switches type checking off.
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

async function seedContact(t: TestCtx, email = "jamie@acme.test"): Promise<Id<"crmContacts">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("crmContacts", {
      firstName: "Jamie", lastName: "Example", fullName: "Jamie Example",
      email, emailLower: email.toLowerCase(),
      status: "prospect", statusChangedAt: now, tagIds: [],
      emailOptOut: false, callOptOut: false,
      emailStatus: "unknown", phoneStatus: "unknown",
      source: "manual",
      emailsSentCount: 0, callsMadeCount: 0, callsConnectedCount: 0,
      isArchived: false, searchText: "jamie example",
      createdAt: now, updatedAt: now,
    });
  });
}

/** A contact enrolled on a 5-phase campaign, already two phases in. */
async function seedEnrolled(t: TestCtx, startPhase = 2) {
  const asStaff = await seedStaff(t);
  const contactId = await seedContact(t);
  const dripCampaignId = await asStaff.mutation(api.crm.dripCampaigns.createDripCampaign, {
    name: "Broker Outreach 2026",
    phaseCount: 5,
  });
  await asStaff.mutation(api.crm.dripCampaigns.enrollContacts, {
    contactIds: [contactId], dripCampaignId, startPhase,
  });
  return { asStaff, contactId, dripCampaignId };
}

async function getEnrollment(t: TestCtx, dripCampaignId: Id<"crmDripCampaigns">, contactId: Id<"crmContacts">) {
  return await t.run(async (ctx) =>
    await ctx.db
      .query("crmDripEnrollments")
      .withIndex("by_campaign_contact", (q) => q.eq("dripCampaignId", dripCampaignId).eq("contactId", contactId))
      .first(),
  );
}

async function recordReply(t: TestCtx, contactId: Id<"crmContacts">) {
  await t.run(async (ctx) => {
    await insertActivity(ctx, {
      contactId,
      activityType: "email_inbound",
      title: "Re: quick question",
      isTouch: true,
      direction: "inbound",
      actorType: "contact",
    });
  });
}

describe("enrolling", () => {
  test("puts the contact on the campaign and caches it onto the contact row", async () => {
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t, 2);

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.status).toBe("active");
    expect(enrollment?.phase).toBe(2);

    const contact = await t.run(async (ctx) => await ctx.db.get(contactId));
    expect(contact?.primaryDripCampaignId).toBe(dripCampaignId);
    expect(contact?.dripCampaignIds).toEqual([dripCampaignId]);
    // The cached column is a projection of the enrollment, not a second source.
    expect(contact?.dripStep).toBe(2);
    expect(contact?.dripStatus).toBe("in_progress");
  });

  test("re-enrolling keeps the phase already reached rather than starting over", async () => {
    const t = convexTest(schema);
    const { asStaff, contactId, dripCampaignId } = await seedEnrolled(t, 3);

    const result = await asStaff.mutation(api.crm.dripCampaigns.enrollContacts, {
      contactIds: [contactId], dripCampaignId,
    });

    expect(result.reactivated).toBe(1);
    expect(result.enrolled).toBe(0);
    expect((await getEnrollment(t, dripCampaignId, contactId))?.phase).toBe(3);
  });
});

describe("a reply exits the sequence", () => {
  test("marks the ENROLLMENT replied, not just the cached column", async () => {
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t);

    await recordReply(t, contactId);

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.status).toBe("replied");
    expect(enrollment?.exitedAt).toBeTypeOf("number");

    const contact = await t.run(async (ctx) => await ctx.db.get(contactId));
    expect(contact?.hasReplied).toBe(true);
    expect(contact?.dripStatus).toBe("replied_removed");
  });

  test("survives a later cache re-sync", async () => {
    // THE REGRESSION. Writing "replied_removed" onto the contact alone left the
    // enrollment active, so the next syncPrimaryDripCache — triggered by any
    // enrollment write anywhere — recomputed the column straight back to
    // "in progress" and the reply vanished from the list.
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t);
    await recordReply(t, contactId);

    await t.run(async (ctx) => {
      await syncPrimaryDripCache(ctx, contactId);
    });

    const contact = await t.run(async (ctx) => await ctx.db.get(contactId));
    expect(contact?.dripStatus).toBe("replied_removed");
    expect((await getEnrollment(t, dripCampaignId, contactId))?.status).toBe("replied");
  });

  test("a later send cannot advance someone who already replied", async () => {
    // The harm this whole fix exists for: phases 3, 4 and 5 continuing to a
    // person who answered email 2.
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t, 2);
    await recordReply(t, contactId);

    await t.run(async (ctx) => {
      await advanceEnrollmentForSend(ctx, { contactId, dripCampaignId, phase: 3 });
    });

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.status).toBe("replied");
    expect(enrollment?.phase).toBe(2);
  });

  test("exits every campaign the contact is running, not just one", async () => {
    const t = convexTest(schema);
    const { asStaff, contactId, dripCampaignId } = await seedEnrolled(t);
    const second = await asStaff.mutation(api.crm.dripCampaigns.createDripCampaign, {
      name: "Employer Q1", phaseCount: 3,
    });
    await asStaff.mutation(api.crm.dripCampaigns.enrollContacts, {
      contactIds: [contactId], dripCampaignId: second, startPhase: 1,
    });

    await recordReply(t, contactId);

    expect((await getEnrollment(t, dripCampaignId, contactId))?.status).toBe("replied");
    expect((await getEnrollment(t, second, contactId))?.status).toBe("replied");
  });
});

describe("a bad address pauses the sequence", () => {
  test("a hard bounce pauses the enrollment itself", async () => {
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t);

    await t.run(async (ctx) => {
      await recordEmailBlocked(ctx, contactId, { emailStatus: "bounced_hard", optOut: true });
    });

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.status).toBe("paused");

    const contact = await t.run(async (ctx) => await ctx.db.get(contactId));
    expect(contact?.emailStatus).toBe("bounced_hard");
    expect(contact?.dripStatus).toBe("paused");
  });

  test("a bounce never overwrites a reply", async () => {
    // "They answered us" is the more important fact and the harder one to undo,
    // so a late bounce webhook must not downgrade it to a mere pause.
    const t = convexTest(schema);
    const { contactId, dripCampaignId } = await seedEnrolled(t);
    await recordReply(t, contactId);

    await t.run(async (ctx) => {
      await recordEmailBlocked(ctx, contactId, { emailStatus: "bounced_soft" });
    });

    expect((await getEnrollment(t, dripCampaignId, contactId))?.status).toBe("replied");
  });
});

describe("mass operations", () => {
  test("moving contacts exits the old campaign and starts the new one", async () => {
    const t = convexTest(schema);
    const { asStaff, contactId, dripCampaignId } = await seedEnrolled(t, 4);
    const target = await asStaff.mutation(api.crm.dripCampaigns.createDripCampaign, {
      name: "Employer Q1", phaseCount: 3,
    });

    const result = await asStaff.mutation(api.crm.dripCampaigns.moveToCampaign, {
      contactIds: [contactId], fromDripCampaignId: dripCampaignId, toDripCampaignId: target,
    });

    expect(result.moved).toBe(1);
    expect((await getEnrollment(t, dripCampaignId, contactId))?.status).toBe("removed");

    const moved = await getEnrollment(t, target, contactId);
    expect(moved?.status).toBe("active");
    // A new campaign starts at zero — carrying phase 4 across would claim they
    // had received four emails they never got.
    expect(moved?.phase).toBe(0);
  });

  test("advancing past the final phase completes the enrollment", async () => {
    const t = convexTest(schema);
    const { asStaff, contactId, dripCampaignId } = await seedEnrolled(t, 4);

    await asStaff.mutation(api.crm.dripCampaigns.advancePhase, {
      contactIds: [contactId], dripCampaignId,
    });

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.phase).toBe(5);
    expect(enrollment?.status).toBe("completed");
    expect((await t.run(async (ctx) => await ctx.db.get(contactId)))?.dripStatus).toBe("completed");
  });

  test("removing keeps the row so the history survives a re-enrolment", async () => {
    const t = convexTest(schema);
    const { asStaff, contactId, dripCampaignId } = await seedEnrolled(t, 3);

    await asStaff.mutation(api.crm.dripCampaigns.removeFromCampaign, {
      contactIds: [contactId], dripCampaignId, reason: "Asked to stop",
    });

    const enrollment = await getEnrollment(t, dripCampaignId, contactId);
    expect(enrollment?.status).toBe("removed");
    expect(enrollment?.exitReason).toBe("Asked to stop");

    const contact = await t.run(async (ctx) => await ctx.db.get(contactId));
    expect(contact?.dripCampaignIds).toEqual([]);
    expect(contact?.primaryDripCampaignId).toBeUndefined();
  });
});
