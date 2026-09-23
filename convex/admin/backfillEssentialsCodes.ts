import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  generateEssentialsGroupNumber,
  generateEssentialsMemberNumber,
} from "../lib/essentialsCodes";

/**
 * BACKFILL ESSENTIALS VENDOR CODES
 *
 * Populates `essentialsMemberNumber` on memberProfiles and `essentialsGroupNumber`
 * on groups for records created before those fields existed.
 *
 * The resolvers in lib/essentialsCodes.ts already fall back to the same derived
 * value, so an unbackfilled record is never *wrong* — but persisting it means
 * the number is stable even if the derivation ever changes, and makes the
 * uniqueness check in createMemberProfile meaningful.
 *
 * Run from the CLI (paged — re-run until processed === 0):
 *   npx convex run admin/backfillEssentialsCodes:run '{"batchSize": 200}'
 *   npx convex run admin/backfillEssentialsCodes:run '{"dryRun": true}'
 */
export const run = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 200;
    const dryRun = args.dryRun ?? false;

    // ── Groups ────────────────────────────────────────────────────────
    const groups = await ctx.db.query("groups").collect();
    const takenGroupNumbers = new Set(
      groups.map((g) => g.essentialsGroupNumber).filter(Boolean) as string[],
    );

    let groupsUpdated = 0;
    for (const group of groups) {
      if (group.essentialsGroupNumber) continue;
      const seed = group.groupCode || group.organizationCode || group.slug;
      if (!seed) continue;

      let candidate = generateEssentialsGroupNumber(seed);
      for (let attempt = 1; takenGroupNumbers.has(candidate) && attempt <= 10; attempt++) {
        candidate = generateEssentialsGroupNumber(`${seed}#${attempt}`);
      }
      takenGroupNumbers.add(candidate);
      if (!dryRun) {
        await ctx.db.patch(group._id, { essentialsGroupNumber: candidate });
      }
      groupsUpdated++;
    }

    // ── Members (paged) ───────────────────────────────────────────────
    const pending = await ctx.db
      .query("memberProfiles")
      .withIndex("by_essentials_member_number", (q) =>
        q.eq("essentialsMemberNumber", undefined),
      )
      .take(batchSize);

    let membersUpdated = 0;
    let collisionsResolved = 0;

    for (const member of pending) {
      let candidate = generateEssentialsMemberNumber(member.memberId);
      for (let attempt = 1; attempt <= 10; attempt++) {
        const clash = await ctx.db
          .query("memberProfiles")
          .withIndex("by_essentials_member_number", (q) =>
            q.eq("essentialsMemberNumber", candidate),
          )
          .first();
        if (!clash) break;
        candidate = generateEssentialsMemberNumber(`${member.memberId}#${attempt}`);
        collisionsResolved++;
      }
      if (!dryRun) {
        await ctx.db.patch(member._id, { essentialsMemberNumber: candidate });
      }
      membersUpdated++;
    }

    return {
      dryRun,
      groupsUpdated,
      membersUpdated,
      collisionsResolved,
      processed: pending.length,
      moreRemaining: pending.length === batchSize,
    };
  },
});
