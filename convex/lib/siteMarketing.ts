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
  { key: "oralScan", label: "Oral scan promotion", group: "Services" },
  { key: "teledentistry", label: "Teledentistry promotion", group: "Services" },
  { key: "dentalDiscount", label: "Dental discount promotion", group: "Services" },
  { key: "blog", label: "Blog links", group: "Resources" },
  { key: "faq", label: "FAQ links and landing section", group: "Resources" },
  { key: "howItWorks", label: "How it works links and landing section", group: "Resources" },
] as const;

export type SiteMarketingFeature = (typeof SITE_MARKETING_FEATURES)[number]["key"];
export type SiteMarketing = Partial<Record<SiteMarketingFeature, boolean>>;

export const siteMarketingValidator = v.object({
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
