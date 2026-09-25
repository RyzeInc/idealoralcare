/**
 * PARTNER UPLINE OPTIONS
 *
 * Who may sit above a partner in `distributionPartners.parentId`.
 *
 * Any active partner qualifies — Program Manager, FMO, or Agency. The schema's
 * canonical shape is PM → FMO → Agency, but real recruiting doesn't respect it:
 * an agency that brings on another agency is its upline and earns the override.
 * `parentId` is a plain self-reference with no type constraint, and both promote
 * actions (`repOnboarding.approve`, `partnerKit.approveAsPartner`) accept any
 * partner id, so the only thing that ever blocked this was the admin dropdowns
 * filtering to `type === 'program_manager'`.
 *
 * Options are labelled with their type because a flat list of names gives the
 * admin no way to tell a PM from an agency.
 */

export interface UplineCandidate {
  _id: string;
  name: string;
  type: string;
  status?: string;
  agencyCode?: string;
}

export interface UplineOption {
  id: string;
  label: string;
}

const TYPE_LABEL: Record<string, string> = {
  program_manager: "Program Manager",
  fmo: "FMO",
  agency: "Agency",
};

/** Display order: broadest tier first, then alphabetical within a tier. */
const TYPE_RANK: Record<string, number> = {
  program_manager: 0,
  fmo: 1,
  agency: 2,
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

/**
 * Build the upline dropdown list.
 *
 * @param partners  All known partners.
 * @param excludeId Partner being edited — a partner can't be its own upline.
 */
export function buildUplineOptions(
  partners: UplineCandidate[],
  excludeId?: string,
): UplineOption[] {
  return partners
    .filter((p) => p._id !== excludeId)
    // Suspended/inactive partners shouldn't collect overrides on new downline.
    .filter((p) => p.status === undefined || p.status === "active")
    .sort((a, b) => {
      const rank = (TYPE_RANK[a.type] ?? 99) - (TYPE_RANK[b.type] ?? 99);
      return rank !== 0 ? rank : a.name.localeCompare(b.name);
    })
    .map((p) => ({
      id: p._id,
      label: `${p.name} — ${typeLabel(p.type)}${p.agencyCode ? ` (${p.agencyCode})` : ""}`,
    }));
}
