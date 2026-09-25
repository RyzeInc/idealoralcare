/**
 * REP / BROKER ATTRIBUTION — shared resolver
 *
 * "Who gets paid for this member?" is answered in two places in the data
 * model, and both are Clerk-free (ids point at `partnerLeaders._id`):
 *
 *   Scenario A — a rep sold directly to an individual. Attribution lives on
 *     the member's `enrollmentSessions` row (`brokerId` /
 *     `brokerTrackingCode`).
 *   Scenario B — a rep owns an employer deal. Attribution lives on the
 *     member's `groups` row. Eligibility-file and list-bill members never run
 *     an enrollment session, so this is the only signal they have.
 *
 * Member-level attribution wins over group-level: a rep who personally
 * enrolled someone inside another rep's group is still the one who sold it.
 * The resolved `source` is always reported so a payout can be traced back to
 * the record it came from rather than taken on faith.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

/** Reads work the same from a query or a mutation. */
type ReadCtx = QueryCtx | MutationCtx;

/**
 * `ctx.db.get` throws on a malformed id rather than returning null, and
 * legacy attribution rows can still hold a Clerk user ID ("user_xxx") where a
 * Convex id is expected. Those are data we have to read past, not crash on —
 * the backfill in admin/repAttributionBackfill.ts is what re-keys them.
 */
async function safeGet<T extends "partnerLeaders" | "distributionPartners">(
  ctx: ReadCtx,
  table: T,
  id: string | null | undefined,
): Promise<Doc<T> | null> {
  if (!id) return null;
  try {
    const doc = await ctx.db.get(id as Id<T>);
    return (doc as Doc<T> | null) ?? null;
  } catch {
    return null;
  }
}

export type AttributionSource = "enrollment" | "group" | "none";

export interface RepAttribution {
  source: AttributionSource;
  repId: string | null;
  repName: string | null;
  repCode: string | null;
  repEmail: string | null;
  agencyId: string | null;
  agencyName: string | null;
}

export const NO_ATTRIBUTION: RepAttribution = {
  source: "none",
  repId: null,
  repName: null,
  repCode: null,
  repEmail: null,
  agencyId: null,
  agencyName: null,
};

/**
 * Pick the enrollment session that owns a member's attribution: a completed
 * session beats an abandoned one, and among equals the most recent wins.
 */
export function pickAttributedSession(
  sessions: Doc<"enrollmentSessions">[],
): Doc<"enrollmentSessions"> | null {
  return (
    sessions
      .filter((s) => s.brokerId || s.brokerTrackingCode)
      .sort((a, b) => {
        if ((a.status === "completed") !== (b.status === "completed")) {
          return a.status === "completed" ? -1 : 1;
        }
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      })[0] ?? null
  );
}

/**
 * Batch resolver. Building the lookup maps once and reusing them keeps a
 * whole-book pass (e.g. closing a month) to three table reads instead of
 * three per member.
 */
export class RepAttributionResolver {
  private constructor(
    private readonly sessionsByMember: Map<string, Doc<"enrollmentSessions">[]>,
    private readonly leaderById: Map<string, Doc<"partnerLeaders">>,
    private readonly agencyById: Map<string, Doc<"distributionPartners">>,
  ) {}

  static async create(ctx: ReadCtx): Promise<RepAttributionResolver> {
    const [sessions, leaders, agencies] = await Promise.all([
      ctx.db.query("enrollmentSessions").collect(),
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("distributionPartners").collect(),
    ]);
    const sessionsByMember = new Map<string, Doc<"enrollmentSessions">[]>();
    for (const session of sessions) {
      if (!session.memberId) continue;
      const key = String(session.memberId);
      const list = sessionsByMember.get(key) ?? [];
      list.push(session);
      sessionsByMember.set(key, list);
    }
    return new RepAttributionResolver(
      sessionsByMember,
      new Map(leaders.map((l) => [String(l._id), l])),
      new Map(agencies.map((a) => [String(a._id), a])),
    );
  }

  private hydrate(
    source: AttributionSource,
    brokerId: string | undefined,
    trackingCode: string | undefined,
    agencyIdHint?: string,
  ): RepAttribution {
    const leader = brokerId ? this.leaderById.get(brokerId) : undefined;
    const agencyId = agencyIdHint ?? (leader ? String(leader.partnerId) : null);
    const agency = agencyId ? this.agencyById.get(agencyId) : undefined;
    return {
      source,
      repId: brokerId ?? null,
      repName: leader?.name ?? null,
      repCode: trackingCode ?? null,
      repEmail: leader?.email ?? null,
      agencyId: agencyId ?? null,
      agencyName: agency?.name ?? null,
    };
  }

  /** Member-level attribution first, then the group deal, then nothing. */
  resolve(
    memberProfileId: Id<"memberProfiles">,
    group?: Doc<"groups"> | null,
  ): RepAttribution {
    const sessions = this.sessionsByMember.get(String(memberProfileId)) ?? [];
    const session = pickAttributedSession(sessions);
    if (session) {
      return this.hydrate(
        "enrollment",
        session.brokerId,
        session.brokerTrackingCode,
        session.agencyId,
      );
    }
    if (group?.brokerId || group?.brokerTrackingCode) {
      return this.hydrate("group", group.brokerId, group.brokerTrackingCode);
    }
    return NO_ATTRIBUTION;
  }
}

/**
 * Single-member convenience wrapper. Use the resolver directly for anything
 * that touches more than a handful of members.
 */
export async function resolveRepAttribution(
  ctx: ReadCtx,
  memberProfileId: Id<"memberProfiles">,
  groupId?: Id<"groups"> | null,
): Promise<RepAttribution> {
  const sessions = await ctx.db
    .query("enrollmentSessions")
    .withIndex("by_member", (q) => q.eq("memberId", memberProfileId))
    .collect();
  const session = pickAttributedSession(sessions);
  if (session) {
    const leader = await safeGet(ctx, "partnerLeaders", session.brokerId);
    const agencyId = session.agencyId ?? (leader ? String(leader.partnerId) : null);
    const agency = await safeGet(ctx, "distributionPartners", agencyId);
    return {
      source: "enrollment",
      repId: session.brokerId ?? null,
      repName: leader?.name ?? null,
      repCode: session.brokerTrackingCode ?? null,
      repEmail: leader?.email ?? null,
      agencyId: agencyId ?? null,
      agencyName: agency?.name ?? null,
    };
  }

  const group = groupId ? await ctx.db.get(groupId) : null;
  if (group?.brokerId || group?.brokerTrackingCode) {
    const leader = await safeGet(ctx, "partnerLeaders", group.brokerId);
    const agencyId = leader ? String(leader.partnerId) : null;
    const agency = await safeGet(ctx, "distributionPartners", agencyId);
    return {
      source: "group",
      repId: group.brokerId ?? null,
      repName: leader?.name ?? null,
      repCode: group.brokerTrackingCode ?? null,
      repEmail: leader?.email ?? null,
      agencyId: agencyId ?? null,
      agencyName: agency?.name ?? null,
    };
  }

  return NO_ATTRIBUTION;
}


/* ------------------------------------------------------------------ */
/* Denormalized stamp                                                 */
/* ------------------------------------------------------------------ */

/**
 * The subset of an attribution that gets cached onto `memberProfiles` so
 * insights queries can read by index instead of scanning enrollmentSessions
 * and groups. See the DENORMALIZED REP ATTRIBUTION block in schema.ts.
 */
export interface AttributionStamp {
  attributedRepId: string | undefined;
  attributedAgencyId: string | undefined;
  attributedCode: string | undefined;
  attributionSource: AttributionSource;
  attributionUpdatedAt: number;
}

/** Project a resolved attribution into the stamped form. */
export function stampFromAttribution(
  attribution: RepAttribution,
  now: number = Date.now(),
): AttributionStamp {
  return {
    attributedRepId: attribution.repId ?? undefined,
    attributedAgencyId: attribution.agencyId ?? undefined,
    attributedCode: attribution.repCode ?? undefined,
    attributionSource: attribution.source,
    attributionUpdatedAt: now,
  };
}

/** True when a stamp no longer agrees with a freshly resolved attribution. */
export function stampDiffersFrom(
  stamp: Partial<AttributionStamp> | undefined,
  attribution: RepAttribution,
): boolean {
  return (
    (stamp?.attributedRepId ?? null) !== attribution.repId ||
    (stamp?.attributedAgencyId ?? null) !== attribution.agencyId ||
    (stamp?.attributedCode ?? null) !== attribution.repCode ||
    (stamp?.attributionSource ?? null) !== attribution.source
  );
}

/**
 * Resolve attribution for a member that does not exist yet.
 *
 * `resolveRepAttribution` starts from a member id so it can find that
 * member's enrollment sessions. At creation time there is no member row, but
 * the caller usually knows which session drove the signup — so we read that
 * session directly and fall back to the group deal exactly as the normal
 * resolver does.
 */
export async function resolveAttributionForNewMember(
  ctx: ReadCtx,
  opts: {
    enrollmentSessionId?: Id<"enrollmentSessions"> | null;
    group?: Doc<"groups"> | null;
  },
): Promise<RepAttribution> {
  const session = opts.enrollmentSessionId
    ? await ctx.db.get(opts.enrollmentSessionId)
    : null;

  if (session && (session.brokerId || session.brokerTrackingCode)) {
    const leader = await safeGet(ctx, "partnerLeaders", session.brokerId);
    const agencyId = session.agencyId ?? (leader ? String(leader.partnerId) : null);
    const agency = await safeGet(ctx, "distributionPartners", agencyId);
    return {
      source: "enrollment",
      repId: session.brokerId ?? null,
      repName: leader?.name ?? null,
      repCode: session.brokerTrackingCode ?? null,
      repEmail: leader?.email ?? null,
      agencyId: agencyId ?? null,
      agencyName: agency?.name ?? null,
    };
  }

  const group = opts.group;
  if (group?.brokerId || group?.brokerTrackingCode) {
    const leader = await safeGet(ctx, "partnerLeaders", group.brokerId);
    const agencyId = leader ? String(leader.partnerId) : null;
    const agency = await safeGet(ctx, "distributionPartners", agencyId);
    return {
      source: "group",
      repId: group.brokerId ?? null,
      repName: leader?.name ?? null,
      repCode: group.brokerTrackingCode ?? null,
      repEmail: leader?.email ?? null,
      agencyId: agencyId ?? null,
      agencyName: agency?.name ?? null,
    };
  }

  return NO_ATTRIBUTION;
}

/* ------------------------------------------------------------------ */
/* Keeping the stamp fresh                                            */
/* ------------------------------------------------------------------ */

/** Bounded so a single mutation cannot blow past Convex's write limits. */
export const RESTAMP_BATCH_LIMIT = 500;

/**
 * Re-resolve one member's attribution and patch the stamp if it moved.
 * Returns true when a write happened.
 */
export async function restampMemberAttribution(
  ctx: MutationCtx,
  memberProfileId: Id<"memberProfiles">,
): Promise<boolean> {
  const member = await ctx.db.get(memberProfileId);
  if (!member) return false;

  const attribution = await resolveRepAttribution(
    ctx,
    memberProfileId,
    member.groupId,
  );
  if (!stampDiffersFrom(member, attribution)) return false;

  await ctx.db.patch(memberProfileId, stampFromAttribution(attribution));
  return true;
}

/**
 * Re-stamp every member of a group — used when the group's broker deal
 * changes, since that is Scenario B attribution for its whole roster.
 *
 * Members who carry their own enrollment-level attribution resolve to the
 * same answer and are skipped, so this is safe to run broadly.
 *
 * Bounded by RESTAMP_BATCH_LIMIT. When `remaining` comes back non-zero the
 * caller should surface that; admin/repAttributionBackfill.ts is the
 * cursor-batched path that finishes the job for very large rosters.
 */
export async function restampGroupAttribution(
  ctx: MutationCtx,
  groupId: Id<"groups">,
): Promise<{ scanned: number; updated: number; remaining: number }> {
  const members = await ctx.db
    .query("memberProfiles")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .take(RESTAMP_BATCH_LIMIT + 1);

  const batch = members.slice(0, RESTAMP_BATCH_LIMIT);
  const remaining = members.length > RESTAMP_BATCH_LIMIT ? 1 : 0;

  // One resolver for the whole batch: three table reads instead of three per
  // member.
  const resolver = await RepAttributionResolver.create(ctx);
  const group = await ctx.db.get(groupId);

  let updated = 0;
  for (const member of batch) {
    const attribution = resolver.resolve(member._id, group);
    if (!stampDiffersFrom(member, attribution)) continue;
    await ctx.db.patch(member._id, stampFromAttribution(attribution));
    updated++;
  }

  return { scanned: batch.length, updated, remaining };
}
