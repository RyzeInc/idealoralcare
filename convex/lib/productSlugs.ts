/**
 * PRODUCT FAMILIES, by catalog slug prefix.
 *
 *   essentials-*  Essentials Plan (Lyric, RxValet, QuestSelect, Balance for Life)
 *   bfl-*         Balance for Life on its own — the behavioral-health piece of
 *                 Essentials sold standalone at $19.95/mo
 *   oralcare-*    Oral Care add-on sold on the /newideal site
 *
 * Essentials already includes Balance for Life, so the two are never bought
 * together. Shared by Convex and Next code so both sides agree on what a slug is.
 */

export const BFL_SLUG = "bfl-individual" as const;
export const BFL_MONTHLY_CENTS = 1995;

export function isEssentialsSlug(slug?: string | null): boolean {
  return typeof slug === "string" && slug.startsWith("essentials-");
}

export function isBflSlug(slug?: string | null): boolean {
  return typeof slug === "string" && slug.startsWith("bfl-");
}

/** Programs sold under the Ideal Health Essentials membership agreement. */
export function isMembershipProgramSlug(slug?: string | null): boolean {
  return isEssentialsSlug(slug) || isBflSlug(slug);
}

/** Essentials + standalone BFL in one order is a double charge for BFL. */
export function hasConflictingPrograms(slugs: Array<string | null | undefined>): boolean {
  return slugs.some(isEssentialsSlug) && slugs.some(isBflSlug);
}
