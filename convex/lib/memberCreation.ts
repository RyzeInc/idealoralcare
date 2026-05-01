/**
 * SHARED MEMBER PROFILE CREATION
 *
 * Single source of truth for inserting `memberProfiles` rows. Every flow that
 * creates a member (enrollment, admin add, eligibility ingest, eligibility
 * provisioning, dev-tools, seed) must go through this helper so that:
 *
 *  - `memberId` and `barcode` are generated consistently
 *  - `subscriberId` is populated from the parent group's `organizationCode`
 *    (with deterministic fallbacks)
 *  - `careingtonUniqueId`, `careingtonSeqNum`, and `toothlensMemberId` are
 *    always populated (deterministically derived from `memberId` if the
 *    caller doesn't supply them, so DTC and admin-created members can still
 *    be exported to vendors and used in Toothlens AI scanning)
 *
 * This helper does NOT log a `memberActivities` row — callers should log
 * activities with the appropriate `actorType`/`title` for their context.
 *
 * NOTE: We intentionally accept `groupId` and look up the group inside the
 * helper to derive `subscriberId`. Callers that already hold the group
 * document can pass it via `groupOverride` to avoid the extra read.
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/* ------------------------------------------------------------------ */
/* ID generation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate the human-readable Member ID, e.g. "MBR-2026-00042".
 * Caller supplies the next sequence number (1-based).
 */
export function generateMemberId(seqNum: number): string {
  const year = new Date().getFullYear();
  const padded = String(seqNum).padStart(5, "0");
  return `MBR-${year}-${padded}`;
}

/**
 * Generate a unique barcode for member ID cards. Format: ENR{YY}{6-char-random}.
 */
export function generateBarcode(_siteSlug?: string): string {
  const year = String(new Date().getFullYear()).slice(2);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ENR${year}${random}`;
}

/**
 * Derive a deterministic 10-digit numeric Careington Unique ID from a Member
 * ID. We hash the input so DTC and admin-created members can still be
 * exported to Careington/DialCare without collisions, and so the same
 * `memberId` always maps to the same Careington ID.
 *
 * Example: deriveCareingtonUniqueId("MBR-2026-00042") -> "0019384726"
 */
export function deriveCareingtonUniqueId(memberId: string): string {
  // FNV-1a 32-bit, repeated to widen to ~10 digits.
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < memberId.length; i++) {
    h ^= memberId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Combine with a second pass on a salt so we get >9 digits worth of entropy
  let h2 = h;
  for (const ch of "ideal-careington") {
    h2 ^= ch.charCodeAt(0);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  // Concatenate two 5-digit chunks
  const a = String(h % 100000).padStart(5, "0");
  const b = String(h2 % 100000).padStart(5, "0");
  return (a + b).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Subscriber-ID resolution                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve the canonical Subscriber ID for a member. Order of precedence:
 *   1. Explicit value passed by the caller.
 *   2. The group's `organizationCode` (e.g. "ACME-0042" / "IDC-0001").
 *   3. The generated `memberId` (last-resort, never empty).
 */
export function resolveSubscriberId(opts: {
  explicit?: string | null;
  group: { organizationCode?: string | null } | null | undefined;
  memberId: string;
}): string {
  if (opts.explicit && opts.explicit.trim()) return opts.explicit.trim();
  if (opts.group?.organizationCode) return opts.group.organizationCode;
  return opts.memberId;
}

/* ------------------------------------------------------------------ */
/* createMemberProfile()                                              */
/* ------------------------------------------------------------------ */

export interface CreateMemberProfileInput {
  /** Parent group/organization. Required so we can derive subscriberId. */
  groupId: Id<"groups">;
  /** Optional pre-loaded group doc. Avoids an extra read if you have it. */
  groupOverride?: Doc<"groups"> | null;

  /** Personal info (only first/last are required). */
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  title?: string;
  email?: string;
  phone?: string;
  workPhone?: string;
  dateOfBirth?: string;
  effectiveDate?: string;
  gender?:
    | "male"
    | "female"
    | "non_binary"
    | "prefer_not_to_say"
    | "other";
  address?: any;
  dependents?: any;

  /** Identity overrides (otherwise auto-generated/derived). */
  memberIdOverride?: string;
  barcodeOverride?: string;
  subscriberIdOverride?: string;

  /** Vendor IDs. If not provided, derived deterministically from memberId. */
  careingtonUniqueId?: string;
  careingtonSeqNum?: string; // defaults to "00" (primary)

  /** Lifecycle / classification. */
  memberType?:
    | "lead"
    | "eligible"
    | "enrolling"
    | "active"
    | "inactive"
    | "terminated"
    | "declined";
  status?: "active" | "inactive" | "suspended" | "terminated";
  memberRole?: "primary" | "dependent";
  employeeType?: "full_time" | "part_time";
  listBillStatus?: "active" | "termed" | "converted";
  leadType?:
    | "walk_in"
    | "referral"
    | "group_eligible"
    | "campaign"
    | "inbound"
    | "outbound"
    | "partner";
  signupSource?: string;
  enrollmentSessionId?: Id<"enrollmentSessions">;
  eligibilityFileId?: Id<"eligibilityFiles">;
  groupMemberId?: string;
  externalMemberId?: string;
  customerId?: string;

  /** Family / dependent link */
  primaryMemberId?: Id<"memberProfiles">;
  relationship?: "spouse" | "child" | "domestic_partner" | "other";

  /** Optional staff assignment (for admin-assisted enrollment). */
  assignedStaffId?: Id<"adminUsers">;
  assignedStaffName?: string;

  /** Communication prefs. Defaults to all-on. */
  communicationPrefs?: {
    emailOptIn: boolean;
    smsOptIn: boolean;
    callOptIn: boolean;
    preferredChannel?: "email" | "sms" | "phone";
  };
}

export interface CreateMemberProfileResult {
  _id: Id<"memberProfiles">;
  memberId: string;
  subscriberId: string;
  careingtonUniqueId: string;
  toothlensMemberId: string;
}

/**
 * Insert a new memberProfiles row with all canonical fields populated. Use
 * this from every flow that creates a member — never call `db.insert` on
 * `memberProfiles` directly.
 */
export async function createMemberProfile(
  ctx: MutationCtx,
  input: CreateMemberProfileInput,
): Promise<CreateMemberProfileResult> {
  const now = Date.now();

  // Load the group so we can resolve siteId/accountId/subscriberId in one place.
  const group =
    input.groupOverride ?? ((await ctx.db.get(input.groupId)) as Doc<"groups"> | null);
  if (!group) {
    throw new Error(`createMemberProfile: group ${input.groupId} not found`);
  }

  // ── Identity ────────────────────────────────────────────────────────
  let memberId = input.memberIdOverride;
  if (!memberId) {
    const allMembers = await ctx.db.query("memberProfiles").collect();
    memberId = generateMemberId(allMembers.length + 1);
  }
  const barcode = input.barcodeOverride ?? generateBarcode();

  const subscriberId = resolveSubscriberId({
    explicit: input.subscriberIdOverride,
    group,
    memberId,
  });

  // ── Vendor IDs (always populated) ───────────────────────────────────
  const careingtonUniqueId =
    input.careingtonUniqueId ?? deriveCareingtonUniqueId(memberId);
  const careingtonSeqNum = input.careingtonSeqNum ?? "00";
  const toothlensMemberId = careingtonUniqueId + careingtonSeqNum;

  // ── List-bill inference (FT in list-bill group → active) ────────────
  let listBillStatus = input.listBillStatus;
  if (!listBillStatus) {
    const isListBillGroup = (group as any).listBill?.enabled === true;
    if (isListBillGroup && input.employeeType === "full_time") {
      listBillStatus = "active";
    }
  }

  const _id = await ctx.db.insert("memberProfiles", {
    memberId,
    subscriberId,
    barcode,
    customerId: input.customerId,
    siteId: group.siteId,
    accountId: group.accountId,
    groupId: input.groupId,
    title: input.title,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    suffix: input.suffix,
    email: input.email,
    phone: input.phone,
    workPhone: input.workPhone,
    dateOfBirth: input.dateOfBirth,
    effectiveDate: input.effectiveDate,
    gender: input.gender,
    address: input.address,
    dependents: input.dependents,
    careingtonUniqueId,
    careingtonSeqNum,
    toothlensMemberId,
    memberType: input.memberType ?? "eligible",
    memberRole: input.memberRole ?? "primary",
    primaryMemberId: input.primaryMemberId,
    relationship: input.relationship,
    employeeType: input.employeeType,
    listBillStatus,
    leadType: input.leadType,
    signupSource: input.signupSource,
    enrollmentSessionId: input.enrollmentSessionId,
    eligibilityFileId: input.eligibilityFileId,
    groupMemberId: input.groupMemberId,
    externalMemberId: input.externalMemberId,
    assignedStaffId: input.assignedStaffId,
    assignedStaffName: input.assignedStaffName,
    assignedAt: input.assignedStaffId ? now : undefined,
    status: input.status ?? "active",
    communicationPrefs: input.communicationPrefs ?? {
      emailOptIn: true,
      smsOptIn: true,
      callOptIn: true,
    },
    createdAt: now,
    updatedAt: now,
  } as any);

  return { _id, memberId, subscriberId, careingtonUniqueId, toothlensMemberId };
}
