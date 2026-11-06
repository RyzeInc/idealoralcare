import { v } from "convex/values";

/** Presentation only. These switches never change a member's purchased benefits. */
export const SITE_MARKETING_FEATURES = [
  { key: "heroSlideshow", label: "Hero slideshow", group: "Landing sections" },
  { key: "problemBand", label: "Why oral health matters", group: "Landing sections" },
  { key: "serviceCards", label: "Service preview cards", group: "Landing sections" },
  { key: "benefitHighlights", label: "Benefit highlights", group: "Landing sections" },
  { key: "whyItWorks", label: "Why it works", group: "Landing sections" },
  { key: "trustAnchors", label: "Trust and provider highlights", group: "Landing sections" },
  { key: "teamCta", label: "Team enrollment promotion", group: "Landing sections" },
  { key: "oralScan", label: "Oral scan promotion", group: "Inside Oral Care" },
  { key: "teledentistry", label: "Teledentistry promotion", group: "Inside Oral Care" },
  { key: "dentalDiscount", label: "Dental discount promotion", group: "Inside Oral Care" },
  { key: "blog", label: "Blog links", group: "Resources" },
  { key: "faq", label: "FAQ links and landing section", group: "Resources" },
  { key: "howItWorks", label: "How it works links and landing section", group: "Resources" },
  { key: "telehealth", label: "Telehealth promotion", group: "Inside Essentials" },
  { key: "labServices", label: "Lab services promotion", group: "Inside Essentials" },
  { key: "rxSavings", label: "Prescription savings promotion", group: "Inside Essentials" },
  { key: "essentialsWellbeing", label: "Mental wellbeing promotion", group: "Inside Essentials" },
  { key: "bflAiCompanion", label: "AI companion promotion", group: "Inside Balance for Life" },
  { key: "bflCounseling", label: "Licensed counseling promotion", group: "Inside Balance for Life" },
  { key: "bflLiveSupport", label: "Live support promotion", group: "Inside Balance for Life" },
  { key: "bflCoaching", label: "Wellbeing resources, coaching and referrals", group: "Inside Balance for Life" },
] as const;

export type SiteMarketingFeature = (typeof SITE_MARKETING_FEATURES)[number]["key"];
export type SiteMarketing = Partial<Record<SiteMarketingFeature, boolean>>;

export const siteMarketingValidator = v.object({
  telehealth: v.optional(v.boolean()),
  labServices: v.optional(v.boolean()),
  rxSavings: v.optional(v.boolean()),
  essentialsWellbeing: v.optional(v.boolean()),
  bflAiCompanion: v.optional(v.boolean()),
  bflCounseling: v.optional(v.boolean()),
  bflLiveSupport: v.optional(v.boolean()),
  bflCoaching: v.optional(v.boolean()),

  heroSlideshow: v.optional(v.boolean()),
  problemBand: v.optional(v.boolean()),
  serviceCards: v.optional(v.boolean()),
  benefitHighlights: v.optional(v.boolean()),
  whyItWorks: v.optional(v.boolean()),
  trustAnchors: v.optional(v.boolean()),
  teamCta: v.optional(v.boolean()),
  oralScan: v.optional(v.boolean()),
  teledentistry: v.optional(v.boolean()),
  dentalDiscount: v.optional(v.boolean()),
  blog: v.optional(v.boolean()),
  faq: v.optional(v.boolean()),
  howItWorks: v.optional(v.boolean()),
});

/** Unset preserves the existing site. Only an explicit false hides marketing. */
export function isSiteMarketingEnabled(marketing: SiteMarketing | undefined, feature: SiteMarketingFeature) {
  return marketing?.[feature] !== false;
}

/** Service promotion flags never disable a membership or its purchased benefits. */
export const SERVICE_MARKETING_FEATURES = {
  "virtual-care": "telehealth", labs: "labServices", pharmacy: "rxSavings",
  "balance-for-life": "essentialsWellbeing", "oral-health-scan": "oralScan",
  teledentistry: "teledentistry", discount: "dentalDiscount",
} as const satisfies Record<string, SiteMarketingFeature>;
