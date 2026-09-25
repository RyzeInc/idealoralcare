/**
 * LIFECYCLE BACKFILL — reconstructing when members left.
 *
 * `terminatedAt` is new (see convex/lib/memberLifecycle.ts). Members who
 * already left carry no exit timestamp, which means every retention cohort
 * older than this deploy would read as 100% retained.
 *
 * We cannot know the true exit date, but we can recover a defensible one from
 * three existing traces, in descending order of trustworthiness:
 *
 *   1. subscriptionBundles.cancelledAt — Stripe told us, to the second.
 *   2. memberActivities — a logged plan_cancelled / status_changed event.
 *   3. listBillTermedAt — the member left an employer's payroll deduction.
 *
 * Anything left over falls back to `updatedAt`, which is only an upper bound.
 * Every row records which source won in `resolvedFrom` so a cohort built on
 * this data can be read with the right amount of confidence — a report backed
 * mostly by "updated_at_fallback" should not be presented as precise.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import { hasExited } from "../lib/memberLifecycle";

const BATCH_SIZE = 200;

type Source =
  | "bundle_cancelled_at"
  | "activity_log"
  | "list_bill_termed_at"
  | "updated_at_fallback";

/** Exit-shaped activities, most trustworthy first. */
const EXIT_ACTIVITY_TYPES = new Set(["plan_cancelled", "status_changed"]);

async function resolveTerminatedAt(
  ctx: any,
  member: any,
): Promise<{ at: number; from: Source }> {
  // 1. Stripe cancellation on any of this customer's bundles.
  if (member.customerId) {
    const bundles = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q: any) => q.eq("customerId", member.customerId))
      .collect();
    const cancelled = bundles
      .map((b: any) => b.cancelledAt)
      .filter((t: any): t is number => typeof t === "number");
    if (cancelled.length > 0) {
      return { at: Math.max(...cancelled), from: "bundle_cancelled_at" };
    }
  }

  // 2. The member's own timeline. Take the most recent exit-shaped entry.
  const activities = await ctx.db
    .query("memberActivities")
    .withIndex("by_member", (q: any) => q.eq("memberProfileId", member._id))
    .collect();
  const exitEvents = activities
    .filter((a: any) => {
      if (!EXIT_ACTIVITY_TYPES.has(a.activityType)) return false;
      // A status_changed row only counts if it moved INTO an exited state.
      if (a.activityType === "status_changed") {
        return hasExited(a.metadata?.newStatus);
      }
      return true;
    })
    .map((a: any) => a.createdAt)
    .filter((t: any): t is number => typeof t === "number");
  if (exitEvents.length > 0) {
    return { at: Math.max(...exitEvents), from: "activity_log" };
  }

  // 3. Left an employer's payroll deduction.
  if (typeof member.listBillTermedAt === "number") {
    return { at: member.listBillTermedAt, from: "list_bill_termed_at" };
  }

  // 4. Upper bound only — the member was definitely gone by their last write.
  return { at: member.updatedAt ?? member.createdAt ?? Date.now(), from: "updated_at_fallback" };
}

/**
 * Populate `terminatedAt` for members who already exited, one page at a time.
 * Pass the returned `cursor` back in to continue.
 */
export const backfillTerminatedAt = mutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = args.dryRun === true;
    const numItems = Math.min(args.batchSize ?? BATCH_SIZE, BATCH_SIZE);

    const page = await ctx.db
      .query("memberProfiles")
      .paginate({ numItems, cursor: args.cursor ?? null });

    let updated = 0;
    let skippedOnBook = 0;
    let skippedAlreadySet = 0;
    const bySource: Record<string, number> = {};

    for (const member of page.page) {
      if (!hasExited(member.memberType)) {
        skippedOnBook++;
        continue;
      }
      if (typeof member.terminatedAt === "number") {
        skippedAlreadySet++;
        continue;
      }

      const { at, from } = await resolveTerminatedAt(ctx, member);
      bySource[from] = (bySource[from] ?? 0) + 1;
      updated++;
      if (!dryRun) {
        await ctx.db.patch(member._id, { terminatedAt: at });
      }
    }

    return {
      dryRun,
      scanned: page.page.length,
      updated,
      skippedOnBook,
      skippedAlreadySet,
      bySource,
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * How much of the book is missing an exit timestamp, and how confident the
 * reconstructed ones are. Read this before trusting a retention cohort.
 */
export const getLifecycleHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const members = await ctx.db.query("memberProfiles").collect();

    let exited = 0;
    let exitedWithTimestamp = 0;
    let statusMismatch = 0;

    for (const m of members) {
      if (hasExited(m.memberType)) {
        exited++;
        if (typeof m.terminatedAt === "number") exitedWithTimestamp++;
      }
      // A row whose coarse status disagrees with its lifecycle position means
      // some writer is still bypassing lifecyclePatchFor.
      const expectExited = hasExited(m.memberType);
      const statusSaysExited = m.status === "terminated" || m.status === "inactive";
      if (expectExited !== statusSaysExited && m.status !== "suspended") {
        statusMismatch++;
      }
    }

    return {
      totalMembers: members.length,
      exited,
      exitedWithTimestamp,
      exitedMissingTimestamp: exited - exitedWithTimestamp,
      statusMismatch,
    };
  },
});
