export const SITE_CONFIG = {
  name: "Ideal",
  tagline: "We launch and scale products people can trust.",
  description:
    "Ideal is a venture studio that builds, launches, and scales trustworthy products.",
  url: "https://idealhealth.com",
} as const

export const CORE_VALUES = [
  {
    name: "Stewardship",
    description: "We treat every venture as if it were our own, with care and responsibility.",
  },
  {
    name: "Ingenuity",
    description: "We solve complex problems with creative, practical solutions.",
  },
  {
    name: "Clarity",
    description: "We communicate with precision and purpose, eliminating ambiguity.",
  },
  {
    name: "Transparency",
    description: "We operate openly, building trust through honest communication.",
  },
  {
    name: "Security",
    description: "We prioritize protection and reliability in everything we build.",
  },
] as const

export const NAVIGATION_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Team", href: "/team" },
  { name: "Work With Us", href: "/get-involved" },
  { name: "Contact", href: "/contact" },
] as const

export const SOCIAL_LINKS = {
  twitter: "https://twitter.com/idealhealth",
  linkedin: "https://linkedin.com/company/idealhealth",
  github: "https://github.com/idealhealth",
} as const

export const CONTACT_INFO = {
  email: "hello@idealhealth.com",
  supportEmail: "support@idealhealth.com",
} as const

// ============================================
// CARRIER / PARTNER VENDOR / PROVIDER CONSTANTS
// Single source of truth for the (currently fixed) carrier/vendor stack.
// If we ever support multiple providers these become per-Organization fields.
// ============================================

/**
 * The provider group code embedded on every member ID card and on every row
 * of every outbound vendor (Careington / DialCare / Dental Discount Network)
 * eligibility file. The carrier requires a single code so members can be
 * identified at point of service regardless of which Organization they came
 * through. DO NOT inline the literal string anywhere — import this.
 */
export const PROVIDER_GROUP_CODE = "IDEALDO" as const

/** Display name of the carrier (top of the hierarchy). */
export const CARRIER_NAME = "Ryze Nexus" as const

/** Display name of the partner vendor (Ideal Health stack). */
export const PARTNER_VENDOR_NAME = "Ideal Health" as const

/**
 * Default Direct-To-Consumer organization code. Used as the Subscriber ID
 * fallback for self-enrolled members who don't belong to an employer org.
 */
export const DTC_ORGANIZATION_CODE = "IDC-0001" as const

