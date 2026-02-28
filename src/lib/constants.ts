export const SITE_CONFIG = {
  name: "Ryze Inc",
  tagline: "We launch and scale products people can trust.",
  description:
    "Ryze Inc is a venture studio that builds, launches, and scales trustworthy products.",
  url: "https://ryzeinc.com",
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
  twitter: "https://twitter.com/ryzeinc",
  linkedin: "https://linkedin.com/company/ryzeinc",
  github: "https://github.com/ryzeinc",
} as const

export const CONTACT_INFO = {
  email: "hello@ryzeinc.com",
  supportEmail: "support@ryzeinc.com",
} as const
