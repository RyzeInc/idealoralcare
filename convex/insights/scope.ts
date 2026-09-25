/**
 * VIEWER SCOPE — the security spine for every insights query.
 *
 * Insights are read by three kinds of people, and they must never see each
 * other's books:
 *
 *   admin    — internal staff (`adminUsers`). Sees everything.
 *   partner  — a Program Manager / FMO / Agency (`distributionPartners`).
 *              Sees itself plus every partner beneath it in the upline tree.
 *   rep      — a front-line agent (`partnerLeaders`). Sees only its own book.
 *
 * Every exported query in `convex/insights/*` MUST call `resolveViewerScope`
 * first and constrain its reads to what the returned scope allows. Convex
 * functions are callable directly over the wire, so the `/admin` layout
 * redirect and the portal sidebar are UX, never authorization.
 *
 * Two shapes of the data model force care here:
 *
 *   1. `distributionPartners.parentId` is an unconstrained self-reference —
 *      any partner may parent any partner, at any depth. Writes are cycle-
 *      guarded (see admin/distributionPartners.ts) but a reader must not
 *      trust that, so the descendant walk carries a visited set and caps.
 *
 *   2. Identity lives in two parallel systems: the legacy Clerk-keyed
 *      `adminUsers`, and the canonical Clerk-free `distributionPartners` /
 *      `partnerLeaders` pair. We read both, admin first.
 */

import { Doc, Id } from "../_generated/dataModel";
import { query, QueryCtx } from "../_generated/server";
import { requireAuth } from "../lib/authGuards";

/** Upline trees are shallow in practice; this only exists to bound a cycle. */
export const MAX_DESCENDANT_DEPTH = 10;
/** Belt-and-braces bound on a pathological tree. */
export const MAX_DESCENDANT_PARTNERS = 500;

export type PartnerType = "program_manager" | "fmo" | "agency";

export interface AdminScope {
  kind: "admin";
  clerkUserId: string;
  role: "owner" | "editor";
}

export interface PartnerScope {
  kind: "partner";
  clerkUserId: string;
  partnerId: Id<"distributionPartners">;
  partnerType: PartnerType;
  partnerName: string;
  /** Override rate as a percentage (e.g. 5 for 5%), if configured. */
  overrideRate: number | null;
  /** Partners strictly beneath this one. Excludes `partnerId` itself. */
  descendantPartnerIds: Id<"distributionPartners">[];
  /** `partnerId` + `descendantPartnerIds`. The agency ids this scope may read. */
  allPartnerIds: Id<"distributionPartners">[];
  /** Every rep belonging to any partner in `allPartnerIds`. */
  leaderIds: Id<"partnerLeaders">[];
  /** Every tracking code owned by any of `leaderIds`. */
  codes: string[];
}

export interface RepScope {
  kind: "rep";
  clerkUserId: string;
  leaderId: Id<"partnerLeaders">;
  leaderName: string;
  partnerId: Id<"distributionPartners">;
  codes: string[];
}

export type ViewerScope = AdminScope | PartnerScope | RepScope;

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Walk `distributionPartners.parentId` downward from `rootId`.
 *
 * Breadth-first with a visited set, a depth cap and a total cap, so a cycle
 * introduced outside the write-time guard degrades into a truncated tree
 * rather than an unbounded read.
 */
export async function collectDescendantPartnerIds(
  ctx: QueryCtx,
  rootId: Id<"distributionPartners">,
): Promise<Id<"distributionPartners">[]> {
  const visited = new Set<string>([String(rootId)]);
  const found: Id<"distributionPartners">[] = [];
  let frontier: Id<"distributionPartners">[] = [rootId];

  for (let depth = 0; depth < MAX_DESCENDANT_DEPTH && frontier.length > 0; depth++) {
    const next: Id<"distributionPartners">[] = [];
    for (const parentId of frontier) {
      const children = await ctx.db
        .query("distributionPartners")
        .withIndex("by_parent", (q) => q.eq("parentId", parentId))
        .collect();
      for (const child of children) {
        const key = String(child._id);
        if (visited.has(key)) continue;
        visited.add(key);
        found.push(child._id);
        next.push(child._id);
        if (found.length >= MAX_DESCENDANT_PARTNERS) return found;
      }
    }
    frontier = next;
  }

  return found;
}

/** Every rep belonging to any of the given partners. */
async function collectLeaders(
  ctx: QueryCtx,
  partnerIds: Id<"distributionPartners">[],
): Promise<Doc<"partnerLeaders">[]> {
  const leaders: Doc<"partnerLeaders">[] = [];
  for (const partnerId of partnerIds) {
    const rows = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", partnerId))
      .collect();
    leaders.push(...rows);
  }
  return leaders;
}

/**
 * Tracking codes owned by the given reps.
 *
 * `brokerTrackingCodes.brokerId` holds a `partnerLeaders._id` under the
 * current model, but legacy rows may still hold a Clerk user ID — so we look
 * up by both keys rather than assuming the migration is complete.
 */
async function collectCodes(
  ctx: QueryCtx,
  leaders: Doc<"partnerLeaders">[],
): Promise<string[]> {
  const codes = new Set<string>();
  for (const leader of leaders) {
    const keys = [String(leader._id)];
    if (leader.clerkUserId) keys.push(leader.clerkUserId);
    for (const key of keys) {
      const rows = await ctx.db
        .query("brokerTrackingCodes")
        .withIndex("by_broker", (q) => q.eq("brokerId", key))
        .collect();
      for (const row of rows) codes.add(row.code);
    }
  }
  return [...codes];
}

/**
 * Resolve the calling user's scope. Throws if they are not authenticated or
 * hold none of the three identities.
 */
export async function resolveViewerScope(ctx: QueryCtx): Promise<ViewerScope> {
  const scope = await tryResolveViewerScope(ctx);
  if (!scope) {
    throw new Error("Unauthorized: no insights scope for this user");
  }
  return scope;
}

/**
 * Non-throwing variant. Returns null when the user is unauthenticated or has
 * no admin / partner / rep identity.
 */
export async function tryResolveViewerScope(
  ctx: QueryCtx,
): Promise<ViewerScope | null> {
  const identity = await requireAuth(ctx);
  const clerkUserId = identity.clerkUserId;

  // 1. Internal staff.
  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (admin) {
    return { kind: "admin", clerkUserId, role: admin.role };
  }

  // 2. Program Manager / FMO / Agency. Suspended and inactive partners get
  //    nothing — a revoked partner must not keep reading its old book.
  const partner = await ctx.db
    .query("distributionPartners")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (partner && partner.status === "active") {
    const descendantPartnerIds = await collectDescendantPartnerIds(ctx, partner._id);
    const allPartnerIds = [partner._id, ...descendantPartnerIds];
    const leaders = await collectLeaders(ctx, allPartnerIds);
    const codes = await collectCodes(ctx, leaders);
    return {
      kind: "partner",
      clerkUserId,
      partnerId: partner._id,
      partnerType: partner.type,
      partnerName: partner.name,
      overrideRate: partner.overrideRate ?? null,
      descendantPartnerIds,
      allPartnerIds,
      leaderIds: leaders.map((l) => l._id),
      codes,
    };
  }

  // 3. Front-line rep.
  const leader = await ctx.db
    .query("partnerLeaders")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (leader) {
    // A rep whose agency has been deactivated loses access with it.
    const owningPartner = await ctx.db.get(leader.partnerId);
    if (owningPartner && owningPartner.status === "active") {
      return {
        kind: "rep",
        clerkUserId,
        leaderId: leader._id,
        leaderName: leader.name,
        partnerId: leader.partnerId,
        codes: await collectCodes(ctx, [leader]),
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Applying a scope
// ---------------------------------------------------------------------------

export function isAdminScope(scope: ViewerScope): scope is AdminScope {
  return scope.kind === "admin";
}

/**
 * Rep ids this scope may read, or `null` for unrestricted (admin).
 *
 * `null` means "no filter" and is deliberately distinct from `[]`, which means
 * "this viewer owns no reps and must therefore see nothing".
 */
export function scopeRepIds(scope: ViewerScope): string[] | null {
  switch (scope.kind) {
    case "admin":
      return null;
    case "partner":
      return scope.leaderIds.map(String);
    case "rep":
      return [String(scope.leaderId)];
  }
}

/** Agency ids this scope may read, or `null` for unrestricted (admin). */
export function scopeAgencyIds(scope: ViewerScope): string[] | null {
  switch (scope.kind) {
    case "admin":
      return null;
    case "partner":
      return scope.allPartnerIds.map(String);
    case "rep":
      return [String(scope.partnerId)];
  }
}

/**
 * Defence in depth: assert a row belongs to the scope before returning it.
 *
 * Reads should already be constrained by index, but any row assembled from a
 * join or a snapshot (`invoicePeriods.memberLines`, say) passes through here
 * so a widening bug shows up as missing data rather than a leak.
 */
export function attributionInScope(
  scope: ViewerScope,
  attribution: { repId?: string | null; agencyId?: string | null },
): boolean {
  if (scope.kind === "admin") return true;

  const repIds = scopeRepIds(scope);
  if (repIds && attribution.repId && repIds.includes(attribution.repId)) {
    return true;
  }

  // Fall back to the agency when member-level attribution is missing — a
  // Scenario B (employer deal) member has no rep of its own.
  const agencyIds = scopeAgencyIds(scope);
  if (agencyIds && attribution.agencyId && agencyIds.includes(attribution.agencyId)) {
    return true;
  }

  return false;
}

/** Human-readable label for the scope, used in portal breadcrumbs. */
export function scopeLabel(scope: ViewerScope): string {
  switch (scope.kind) {
    case "admin":
      return "All partners";
    case "partner":
      return scope.partnerName;
    case "rep":
      return scope.leaderName;
  }
}

/* ------------------------------------------------------------------ */
/* Exported query                                                     */
/* ------------------------------------------------------------------ */

/**
 * The caller's own scope, summarized.
 *
 * Used by the /partner layout to decide whether to admit someone, and by the
 * portal chrome to say whose book is on screen. Returns null rather than
 * throwing for a signed-in user with no partner identity, since "you are not a
 * partner" is a routing decision, not an error.
 *
 * Deliberately returns no ids beyond the viewer's own: this is an
 * authorization probe, not a data surface.
 */
export const getMyScope = query({
  args: {},
  handler: async (ctx) => {
    const scope = await tryResolveViewerScope(ctx).catch(() => null);
    if (!scope) return null;

    return {
      kind: scope.kind,
      label: scopeLabel(scope),
      partnerId: scope.kind === "partner" ? String(scope.partnerId) : null,
      partnerType: scope.kind === "partner" ? scope.partnerType : null,
      repId: scope.kind === "rep" ? String(scope.leaderId) : null,
      downlineCount: scope.kind === "partner" ? scope.descendantPartnerIds.length : 0,
      repCount: scope.kind === "partner" ? scope.leaderIds.length : scope.kind === "rep" ? 1 : 0,
      codeCount: scope.kind === "admin" ? null : scope.codes.length,
      canSeeDownline: scope.kind === "partner" && scope.descendantPartnerIds.length > 0,
    };
  },
});
