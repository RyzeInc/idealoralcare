/**
 * BROKER KEY RESOLUTION — turning whatever we were handed into real IDs.
 *
 * Attribution reaches us as one of three things, depending on how old the
 * caller is and which surface it came from:
 *
 *   - a `partnerLeaders._id`          (current model)
 *   - a rep tracking CODE string      (URLs, Stripe metadata, legacy payables)
 *   - a Clerk user ID                 (pre-migration rows)
 *
 * Everything downstream — commissions, insights, downline rollups — needs the
 * first form. This resolves the other two by LOOKUP, never by guessing at the
 * shape of the string, so an unrecognised value comes back as null rather than
 * being coerced into a plausible-looking wrong answer.
 *
 * Unlike the batch resolver in admin/repAttributionBackfill.ts, this takes
 * three indexed reads instead of collecting whole tables — it is meant to be
 * called on the hot path (a Stripe webhook), not in a migration.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

export interface ResolvedBroker {
  leaderId: string;
  agencyId: string | null;
  /** The tracking code, when the value we resolved from was one. */
  code: string | null;
  /** Which lookup succeeded — useful when auditing where attribution came from. */
  via: "leader_id" | "tracking_code" | "clerk_user_id";
}

/** `ctx.db.get` throws on a malformed id; a legacy value is not an error. */
async function safeGetLeader(
  ctx: ReadCtx,
  id: string,
): Promise<Doc<"partnerLeaders"> | null> {
  try {
    // Convex ids are table-branded, so an id belonging to another table
    // resolves to null here rather than a wrong-shaped document.
    return await ctx.db.get(id as Id<"partnerLeaders">);
  } catch {
    return null;
  }
}

/**
 * Resolve any broker-ish value to `{ leaderId, agencyId }`, or null when it
 * matches nothing we know about.
 */
export async function resolveBrokerKey(
  ctx: ReadCtx,
  value: string | null | undefined,
): Promise<ResolvedBroker | null> {
  if (!value || !value.trim()) return null;
  const raw = value.trim();

  // 1. Already a rep id.
  const asLeader = await safeGetLeader(ctx, raw);
  if (asLeader) {
    return {
      leaderId: String(asLeader._id),
      agencyId: asLeader.partnerId ? String(asLeader.partnerId) : null,
      code: null,
      via: "leader_id",
    };
  }

  // 2. A tracking code. Codes are stored as issued; try the exact string then
  //    the uppercased form, matching how they are handed out in URLs.
  for (const candidate of raw === raw.toUpperCase() ? [raw] : [raw, raw.toUpperCase()]) {
    const codeRow = await ctx.db
      .query("brokerTrackingCodes")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .first();
    if (codeRow) {
      const leader = await safeGetLeader(ctx, codeRow.brokerId);
      return {
        leaderId: codeRow.brokerId,
        agencyId:
          codeRow.agencyId ??
          (leader?.partnerId ? String(leader.partnerId) : null),
        code: codeRow.code,
        via: "tracking_code",
      };
    }
  }

  // 3. A Clerk user ID belonging to a rep.
  const byClerk = await ctx.db
    .query("partnerLeaders")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", raw))
    .first();
  if (byClerk) {
    return {
      leaderId: String(byClerk._id),
      agencyId: byClerk.partnerId ? String(byClerk.partnerId) : null,
      code: null,
      via: "clerk_user_id",
    };
  }

  return null;
}
