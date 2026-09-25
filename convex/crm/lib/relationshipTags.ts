/**
 * RELATIONSHIP TYPE — the taxonomy that lets prospects, brokers, enrolled
 * members and vendors coexist in one contact table without the list becoming
 * meaningless.
 *
 * THE PROBLEM THIS SOLVES. crmContacts already receives people from five
 * different worlds: cold-imported prospects, inbound leads, partner-kit
 * signatories who have ALREADY signed an agreement, rep applicants, and
 * account contacts. Treating them all as "leads" makes every funnel number a
 * lie — a signed broker partner sitting in the prospect count inflates it, and
 * "unresponsive" means something completely different for a vendor than for a
 * cold prospect.
 *
 * WHY A TAG CATEGORY RATHER THAN A COLUMN. Three reasons: the tag system
 * already has the filtering, segmenting, bulk-apply and colour-chip UI built;
 * a non-exclusive category lets one person legitimately be both an
 * Enrolled-Member Contact and a Broker Partner, which a single enum column
 * could not express; and it requires no schema migration, so it works on
 * existing rows the moment it is seeded.
 *
 * WHAT THIS IS NOT. It does not merge distributionPartners, partnerLeaders or
 * memberProfiles into the CRM, and it grants nobody new read access. Those
 * records stay in their own tables behind their own guards — this is a LABEL
 * on the CRM's own row, plus the soft-link pointers that were already there.
 * The CRM remains internal-staff-only (see guards.ts).
 */

export const RELATIONSHIP_CATEGORY_SLUG = "relationship-type";

export interface RelationshipTagSeed {
  slug: string;
  name: string;
  description: string;
  color: string;
}

export const RELATIONSHIP_TAG_SEED: RelationshipTagSeed[] = [
  {
    slug: "prospect",
    name: "Prospect",
    description: "Not yet a counterparty — the default sales relationship.",
    color: "blue",
  },
  {
    slug: "broker-partner",
    name: "Broker Partner",
    description: "Has signed a partner agreement. Counts as a counterparty, not a prospect.",
    color: "green",
  },
  {
    slug: "rep-partner-lead",
    name: "Rep / Partner Lead",
    description: "A named person at an agency or FMO, usually from rep onboarding.",
    color: "teal",
  },
  {
    slug: "enrolled-member-contact",
    name: "Enrolled-Member Contact",
    description: "Linked to a member profile — treat outreach as service, not sales.",
    color: "purple",
  },
  {
    slug: "employer-group-contact",
    name: "Employer Group Contact",
    description: "Benefits decision-maker at an employer group.",
    color: "amber",
  },
  {
    slug: "vendor",
    name: "Vendor",
    description: "Supplier or service provider. Never a campaign target.",
    color: "slate",
  },
];
