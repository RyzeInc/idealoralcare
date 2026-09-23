/**
 * Carrier / Partner Vendor / Provider constants — Convex-side mirror of
 * src/lib/constants.ts. Keep these two files in sync. Convex modules cannot
 * import from `src/` so we duplicate the values here.
 */

/** Provider group code (Careington/DialCare/Dental Discount Network). */
export const PROVIDER_GROUP_CODE = "IDEALDO" as const;

/**
 * Essentials RxValet Rx Group.
 *
 * This is also the value ARK and RxValet expect in the `GroupID` column of the
 * Essentials eligibility file — their own spreadsheet template ships with
 * GIH1000 there, so we submit it as-is rather than substituting an identifier
 * of our own. Not to be confused with the 6-digit Essentials group number,
 * which is Benefits Horizon's internal tracking value.
 */
export const ESSENTIALS_RX_GROUP = "GIH1000" as const;

/** Essentials RxValet pharmacy BIN. */
export const ESSENTIALS_RX_BIN = "006053" as const;

/** Essentials RxValet pharmacy PCN. */
export const ESSENTIALS_RX_PCN = "MSC" as const;

/** Balance for Life group number — the same for every enrolling member. */
export const ESSENTIALS_BFL_GROUP_NUMBER = "CMG" as const;

/** Balance for Life member code, as printed on the BFL welcome letter. */
export const ESSENTIALS_BFL_MEMBER_CODE = "Ideal" as const;


/** Carrier display name (top of hierarchy). */
export const CARRIER_NAME = "Ryze Nexus" as const;

/** Partner vendor display name. */
export const PARTNER_VENDOR_NAME = "Ideal Health" as const;

/** Default DTC organization code (Subscriber ID for self-enrolled members). */
export const DTC_ORGANIZATION_CODE = "IDC-0001" as const;
