/**
 * Carrier / Partner Vendor / Provider constants — Convex-side mirror of
 * src/lib/constants.ts. Keep these two files in sync. Convex modules cannot
 * import from `src/` so we duplicate the values here.
 */

/** Provider group code (Careington/DialCare/Dental Discount Network). */
export const PROVIDER_GROUP_CODE = "IDEALDO" as const;

/** Carrier display name (top of hierarchy). */
export const CARRIER_NAME = "Ryze Nexus" as const;

/** Partner vendor display name. */
export const PARTNER_VENDOR_NAME = "Ideal Health" as const;

/** Default DTC organization code (Subscriber ID for self-enrolled members). */
export const DTC_ORGANIZATION_CODE = "IDC-0001" as const;
