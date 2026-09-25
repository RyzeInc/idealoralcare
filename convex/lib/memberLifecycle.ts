/**
 * MEMBER LIFECYCLE — keeping `memberType` and `status` honest.
 *
 * `memberProfiles` carries two status fields that mean different things:
 *
 *   memberType — the funnel/lifecycle position (lead → … → active → terminated).
 *                This is the field every real code path reads.
 *   status     — the coarse record state (active/inactive/suspended/terminated).
 *
 * Historically only `memberType` was patched on a transition, so the two
 * drifted apart and `status` became meaningless. Both are now derived together
 * here, so any writer that goes through `lifecyclePatchFor` keeps them in step.
 *
 * This module also owns `terminatedAt`. Without an exit timestamp there is no
 * way to build a retention cohort — you cannot ask "of the members who joined
 * in March, how many are still here?" if leaving left no trace.
 */

export type MemberType =
  | "lead"
  | "eligible"
  | "enrolling"
  | "active"
  | "inactive"
  | "terminated"
  | "declined";

export type MemberStatus = "active" | "inactive" | "suspended" | "terminated";

/**
 * Lifecycle positions that count as having left the book.
 *
 * `inactive` is included deliberately: it means "no active plans", which for
 * retention purposes is the same event as terminating. Cohort charts that
 * ignored it would overstate retention.
 */
export const EXITED_MEMBER_TYPES: ReadonlySet<MemberType> = new Set<MemberType>([
  "inactive",
  "terminated",
]);

export function hasExited(memberType: MemberType | undefined): boolean {
  return !!memberType && EXITED_MEMBER_TYPES.has(memberType);
}

/**
 * The record state implied by a lifecycle position.
 *
 * `suspended` is not reachable from any `memberType` — it is an independent
 * administrative hold — so a suspended member keeps that status unless they
 * are being terminated outright. Deriving it away would silently un-suspend
 * people.
 */
export function statusForMemberType(
  memberType: MemberType,
  currentStatus: MemberStatus | undefined,
): MemberStatus {
  if (memberType === "terminated") return "terminated";
  if (currentStatus === "suspended") return "suspended";

  switch (memberType) {
    case "lead":
    case "eligible":
    case "enrolling":
    case "active":
      return "active";
    case "inactive":
    case "declined":
      return "inactive";
  }
}

export interface LifecyclePatch {
  memberType: MemberType;
  status: MemberStatus;
  /** Present only when the value changes; `undefined` clears it. */
  terminatedAt?: number | undefined;
  updatedAt: number;
}

/**
 * Build the patch for a lifecycle transition: the new `memberType`, the
 * `status` that follows from it, and `terminatedAt` set or cleared.
 *
 * Re-entering an exited state does NOT move an existing `terminatedAt` — the
 * first exit is the one a cohort cares about, and a later admin edit that
 * re-saves "terminated" should not silently restate history.
 */
export function lifecyclePatchFor(
  memberType: MemberType,
  current: {
    memberType?: MemberType;
    status?: MemberStatus;
    terminatedAt?: number;
  },
  now: number = Date.now(),
): LifecyclePatch {
  const patch: LifecyclePatch = {
    memberType,
    status: statusForMemberType(memberType, current.status),
    updatedAt: now,
  };

  const exitingNow = hasExited(memberType);
  const exitedBefore = hasExited(current.memberType);

  if (exitingNow && !exitedBefore) {
    patch.terminatedAt = now;
  } else if (!exitingNow && current.terminatedAt !== undefined) {
    // Reactivation — the member is back on the book.
    patch.terminatedAt = undefined;
  }

  return patch;
}
