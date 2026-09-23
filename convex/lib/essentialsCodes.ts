/**
 * ESSENTIALS VENDOR CODES
 *
 * Single source of truth for the two identifiers the Essentials program submits
 * to its vendors:
 *
 *   essentialsMemberNumber — 9 numeric digits, unique per member. Lyric Telehealth
 *                            and QuestSelect both look members up by this value.
 *   essentialsGroupNumber  — 6 numeric digits, per group, used for tracking.
 *
 * Both are read by the outbound eligibility files (convex/admin/essentialsEligibility.ts)
 * AND printed on the member packet and ID card. They must never drift, so every
 * caller resolves them through this module rather than deriving its own value.
 *
 * Members created before these fields existed fall back to a deterministic value
 * derived from their memberId, so an unbackfilled member still resolves to the
 * same number everywhere.
 */

/* ------------------------------------------------------------------ */
/* Deterministic derivation                                           */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit. Same approach as deriveCareingtonUniqueId in memberCreation.ts. */
function fnv1a(input: string, salt: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  for (const ch of salt) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mix(h);
}

/**
 * Murmur3 finalizer. FNV-1a avalanches poorly in its low bits, and `% 10^n`
 * reads exactly those bits — without this step sequential member IDs collide
 * at a rate of roughly 1 in 4 across 50k members.
 */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Build a fixed-length numeric string with a non-zero leading digit.
 *
 * Each 5-digit chunk comes from its own independently-salted hash, so the full
 * digit range is used. Deriving later digits from earlier ones instead would
 * collapse the space to the width of a single chunk and produce collisions at a
 * few thousand members.
 *
 * Leading zeros matter here: vendors ingest these files as CSV and spreadsheet
 * tools silently strip a leading zero, turning a 9-digit number into 8. Forcing
 * the first digit to 1-9 removes that whole class of bug.
 */
function numericId(input: string, salt: string, digits: number): string {
  let out = "";
  let chunk = 0;
  while (out.length < digits) {
    const take = Math.min(5, digits - out.length);
    const h = fnv1a(input, `${salt}|${chunk}`);
    out += String(h % Math.pow(10, take)).padStart(take, "0");
    chunk++;
  }
  if (out[0] === "0") {
    out = String(1 + (fnv1a(input, `${salt}|lead`) % 9)) + out.slice(1);
  }
  return out;
}

/**
 * Generate the 9-digit Essentials Member Number.
 *
 * Example: generateEssentialsMemberNumber("MBR-2026-00042") -> "473920186"
 */
export function generateEssentialsMemberNumber(memberId: string): string {
  return numericId(memberId, "ideal-essentials-member", 9);
}

/**
 * Generate the 6-digit Essentials Group Number from whatever stable group
 * identifier is available (groupCode, organizationCode or slug).
 */
export function generateEssentialsGroupNumber(groupSeed: string): string {
  return numericId(groupSeed, "ideal-essentials-group", 6);
}

/* ------------------------------------------------------------------ */
/* Resolution (stored value wins, derivation is the fallback)          */
/* ------------------------------------------------------------------ */

interface MemberLike {
  memberId?: string;
  essentialsMemberNumber?: string;
}

interface GroupLike {
  slug?: string;
  groupCode?: string;
  organizationCode?: string;
  essentialsGroupNumber?: string;
}

/**
 * The member number to print on the packet and submit to Lyric / QuestSelect.
 * Returns "" only when the member has no memberId at all.
 */
export function resolveEssentialsMemberNumber(member: MemberLike): string {
  if (member.essentialsMemberNumber) return member.essentialsMemberNumber;
  if (!member.memberId) return "";
  return generateEssentialsMemberNumber(member.memberId);
}

/** The group number to print on the packet and submit in the eligibility files. */
export function resolveEssentialsGroupNumber(group: GroupLike | null | undefined): string {
  if (!group) return "";
  if (group.essentialsGroupNumber) return group.essentialsGroupNumber;
  const seed = group.groupCode || group.organizationCode || group.slug;
  if (!seed) return "";
  return generateEssentialsGroupNumber(seed);
}
