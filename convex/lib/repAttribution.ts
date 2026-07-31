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
import { QueryCtx } from "../_generated/server";

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

  static async create(ctx: QueryCtx): Promise<RepAttributionResolver> {
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
  ctx: QueryCtx,
  memberProfileId: Id<"memberProfiles">,
  groupId?: Id<"groups"> | null,
): Promise<RepAttribution> {
  const sessions = await ctx.db
    .query("enrollmentSessions")
    .withIndex("by_member", (q) => q.eq("memberId", memberProfileId))
    .collect();
  const session = pickAttributedSession(sessions);
  if (session) {
    const leader = session.brokerId
      ? await ctx.db.get(session.brokerId as Id<"partnerLeaders">)
      : null;
    const agencyId = session.agencyId ?? (leader ? String(leader.partnerId) : null);
    const agency = agencyId
      ? await ctx.db.get(agencyId as Id<"distributionPartners">)
      : null;
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
    const leader = group.brokerId
      ? await ctx.db.get(group.brokerId as Id<"partnerLeaders">)
      : null;
    const agencyId = leader ? String(leader.partnerId) : null;
    const agency = agencyId
      ? await ctx.db.get(agencyId as Id<"distributionPartners">)
      : null;
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
