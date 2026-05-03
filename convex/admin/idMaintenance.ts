/**
 * ID MAINTENANCE — Careington / DialCare Unique ID Health & Backfill
 *
 * PURPOSE:
 *   The Careington/DialCare Unique ID is assigned by Ideal Health (not by Careington).
 *   We submit it in outbound eligibility files AND display it to members on their ID
 *   card, PDF, and in emails. These two values MUST always match.
 *
 *   The canonical value is `memberProfiles.careingtonUniqueId`. When it is absent, the
 *   system falls back to stripping non-numeric chars from `memberId` (see toUniqueId in
 *   vendorFiles.ts). This fallback can produce a short or non-unique numeric string for
 *   members whose `memberId` is alphanumeric (e.g. "FFS829D4B" → "8294").
 *
 *   This module provides:
 *   1. `getMemberIdHealthReport` — aggregated stats on ID completeness
 *   2. `getMembersNeedingIdBackfill` — list of individual problem members
 *   3. `backfillCareingtonUniqueIds` — assigns proper sequential numeric IDs to members
 *      that are missing them, then writes the value back to the profile so all future
 *      eligibility files and member-facing displays are consistent.
 *
 * NUMERIC ID FORMAT:
 *   Sequential 9-digit integers starting at 100000001.
 *   Format: 100000001, 100000002, … 999999999 (max ~900 M members).
 *   Max 12 chars per Careington spec — 9 digits is well within that limit.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/** Strip non-numeric chars — the fallback uniqueId derivation (mirrors vendorFiles.ts). */
function toUniqueId(memberId: string): string {
  return memberId.replace(/[^0-9]/g, "").slice(0, 12);
}

/**
 * Returns true when a member's derived uniqueId (from memberId) is "problematic":
 * fewer than 6 digits, which means it's too short to be unique across all members.
 */
function isDerivedIdProblematic(memberId: string): boolean {
  const derived = toUniqueId(memberId);
  return derived.length < 6;
}

// ---------------------------------------------------------------------------
// QUERY: Health report
// ---------------------------------------------------------------------------

export const getMemberIdHealthReport = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) =>
        q.or(
          q.eq(q.field("memberType"), "active"),
          q.eq(q.field("memberType"), "eligible"),
          q.eq(q.field("memberType"), "enrolling"),
        )
      )
      .collect();

    let withCareingtonId = 0;
    let missingCareingtonId = 0;
    let problematicDerived = 0;  // missing + short fallback
    let goodFallback = 0;         // missing but fallback is OK

    // Track how many members share each fallback-derived ID (collision detection)
    const fallbackIdCounts = new Map<string, number>();

    for (const m of members) {
      if ((m as any).careingtonUniqueId) {
        withCareingtonId++;
      } else {
        missingCareingtonId++;
        if (isDerivedIdProblematic(m.memberId ?? "")) {
          problematicDerived++;
        } else {
          goodFallback++;
          const derived = toUniqueId(m.memberId ?? "");
          fallbackIdCounts.set(derived, (fallbackIdCounts.get(derived) ?? 0) + 1);
        }
      }
    }

    // collisionCount = number of members affected by a shared fallback ID
    const collisionCount = [...fallbackIdCounts.values()]
      .filter((c) => c > 1)
      .reduce((sum, c) => sum + c, 0);

    // "Finalized" = has an explicit careingtonUniqueId. Fallbacks are not finalized.
    const finalizedCount = withCareingtonId;
    const needsLockIn = goodFallback; // valid fallback but not yet stored
    const totalIssues = problematicDerived + collisionCount;

    return {
      total: members.length,
      withCareingtonId,
      finalizedCount,
      missingCareingtonId,
      problematicDerived,
      goodFallback,
      needsLockIn,
      collisionCount,
      totalIssues,
      healthPercent:
        members.length === 0
          ? 100
          : Math.round((finalizedCount / members.length) * 100),
    };
  },
});

// ---------------------------------------------------------------------------
// QUERY: Full resolved-ID roster — every active member with their actual ID
// ---------------------------------------------------------------------------

export const getAllMembersWithResolvedIds = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) =>
        q.or(
          q.eq(q.field("memberType"), "active"),
          q.eq(q.field("memberType"), "eligible"),
          q.eq(q.field("memberType"), "enrolling"),
        )
      )
      .collect();

    const allGroups = await ctx.db.query("groups").collect();
    const groupById = new Map(allGroups.map((g) => [g._id, g]));

    return members
      .map((m) => {
        const group = m.groupId ? groupById.get(m.groupId as any) : null;
        const careingtonUniqueId = (m as any).careingtonUniqueId ?? null;
        const derived = toUniqueId(m.memberId ?? "");
        const resolvedId = careingtonUniqueId ?? derived;
        const idSource: "explicit" | "fallback" | "problematic" = careingtonUniqueId
          ? "explicit"
          : isDerivedIdProblematic(m.memberId ?? "")
          ? "problematic"
          : "fallback";
        return {
          _id: m._id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email ?? null,
          memberType: m.memberType,
          careingtonUniqueId,
          derivedId: derived,
          resolvedId,   // ← what the member card & eligibility file will actually use
          idSource,
          groupName: (group as any)?.name ?? (group as any)?.slug ?? null,
          groupCode: (group as any)?.groupCode ?? null,
        };
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  },
});

// ---------------------------------------------------------------------------
// QUERY: Problem members list
// ---------------------------------------------------------------------------

export const getMembersNeedingIdBackfill = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) =>
        q.or(
          q.eq(q.field("memberType"), "active"),
          q.eq(q.field("memberType"), "eligible"),
          q.eq(q.field("memberType"), "enrolling"),
        )
      )
      .collect();

    const allGroups = await ctx.db.query("groups").collect();
    const groupById = new Map(allGroups.map((g) => [g._id, g]));

    return members
      .filter((m) => {
        const hasId = !!(m as any).careingtonUniqueId;
        if (hasId) return false;
        // Flag members whose fallback derivation is problematic
        return isDerivedIdProblematic(m.memberId ?? "");
      })
      .map((m) => {
        const group = m.groupId ? groupById.get(m.groupId as any) : null;
        return {
          _id: m._id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email ?? null,
          memberType: m.memberType,
          careingtonUniqueId: (m as any).careingtonUniqueId ?? null,
          derivedId: toUniqueId(m.memberId ?? ""),
          groupName: (group as any)?.name ?? (group as any)?.slug ?? null,
          groupCode: (group as any)?.groupCode ?? null,
        };
      })
      .sort((a, b) => a.memberId.localeCompare(b.memberId));
  },
});

// ---------------------------------------------------------------------------
// MUTATION: Backfill careingtonUniqueId for all members missing a good one
// ---------------------------------------------------------------------------

export const backfillCareingtonUniqueIds = mutation({
  args: {
    /** If true, only members flagged as problematic are assigned new IDs.
     *  If false, ALL members missing a careingtonUniqueId are processed:
     *    - Non-collision good fallbacks → their derived ID is stored as-is (no visible change)
     *    - Collision members and problematic members → assigned a new sequential ID. */
    problematicOnly: v.optional(v.boolean()),
    /** Optional: dry-run mode — returns what would be changed without writing. */
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const problematicOnly = args.problematicOnly ?? true;
    const dryRun = args.dryRun ?? false;

    // Collect all active/eligible/enrolling profiles
    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) =>
        q.or(
          q.eq(q.field("memberType"), "active"),
          q.eq(q.field("memberType"), "eligible"),
          q.eq(q.field("memberType"), "enrolling"),
        )
      )
      .collect();

    // Build the set of members that need processing
    const needsId = members.filter((m) => {
      if ((m as any).careingtonUniqueId) return false;
      if (problematicOnly && !isDerivedIdProblematic(m.memberId ?? "")) return false;
      return true;
    });

    if (needsId.length === 0) {
      return { assigned: 0, dryRun, changes: [] };
    }

    // All member profiles (across all statuses) — for ID uniqueness checks
    const allMembers = await ctx.db.query("memberProfiles").collect();

    // IDs already claimed via careingtonUniqueId
    const claimedIds = new Set<string>(
      allMembers.map((m) => (m as any).careingtonUniqueId).filter(Boolean)
    );

    // Detect collisions among the fallback group (members we're about to process)
    // A collision = two different members whose toUniqueId(memberId) produces the same string.
    const fallbackIdUsage = new Map<string, number>();
    for (const m of needsId) {
      const derived = toUniqueId(m.memberId ?? "");
      if (derived.length >= 6) {
        fallbackIdUsage.set(derived, (fallbackIdUsage.get(derived) ?? 0) + 1);
      }
    }

    // Find the next sequential ID to start from
    let counter = 100000000;
    for (const m of allMembers) {
      const cid = (m as any).careingtonUniqueId;
      if (cid) {
        const n = parseInt(cid, 10);
        if (!isNaN(n) && n > counter) counter = n;
      }
    }

    const changes: Array<{
      memberId: string;
      name: string;
      assignedId: string;
      action: "locked-in" | "collision-resolved" | "new-id";
    }> = [];

    for (const m of needsId) {
      const derived = toUniqueId(m.memberId ?? "");
      const isProblematic = isDerivedIdProblematic(m.memberId ?? "");
      const hasCollision = !isProblematic && (fallbackIdUsage.get(derived) ?? 0) > 1;

      let assignedId: string;
      let action: "locked-in" | "collision-resolved" | "new-id";

      if (!isProblematic && !hasCollision) {
        // Safe to lock in the derived ID — it's already what the member sees.
        assignedId = derived;
        action = "locked-in";
      } else {
        // Need a brand-new sequential ID (collision or too short).
        do {
          counter++;
        } while (claimedIds.has(String(counter)));
        assignedId = String(counter);
        claimedIds.add(assignedId);
        action = hasCollision ? "collision-resolved" : "new-id";
      }

      changes.push({
        memberId: m.memberId,
        name: `${m.firstName} ${m.lastName}`.trim(),
        assignedId,
        action,
      });

      if (!dryRun) {
        await ctx.db.patch(m._id, {
          careingtonUniqueId: assignedId,
          careingtonSeqNum: (m as any).careingtonSeqNum ?? "00",
        } as any);
      }
    }

    return { assigned: changes.length, dryRun, changes };
  },
});
