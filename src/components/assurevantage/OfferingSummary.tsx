"use client";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import {
  isSiteMarketingEnabled,
  type SiteMarketingFeature,
} from "@/convex/lib/siteMarketing";

const PROMOTIONS: Record<
  "essentials" | "oralcare" | "bfl",
  Array<[SiteMarketingFeature, string]>
> = {
  essentials: [
    ["telehealth", "virtual medical care"],
    ["labServices", "eligible lab services"],
    ["rxSavings", "prescription savings"],
    ["essentialsWellbeing", "mental wellbeing support"],
  ],
  oralcare: [
    ["oralScan", "AI oral screening"],
    ["teledentistry", "virtual dental consultations"],
    ["dentalDiscount", "participating dental network discounts"],
  ],
  bfl: [
    ["bflCounseling", "short-term counseling"],
    ["bflLiveSupport", "live support"],
    ["bflAiCompanion", "Zenn in the Balance for Life app"],
    ["bflCoaching", "wellbeing resources and coaching"],
  ],
};

/** Promotional summaries follow the same switches as the cards; the memberships stay available. */
export function OfferingSummary({
  program,
}: {
  program: keyof typeof PROMOTIONS;
}) {
  const theme = useSiteThemeOptional();
  const labels = theme?.isLoading
    ? []
    : PROMOTIONS[program]
        .filter(([feature]) =>
          isSiteMarketingEnabled(theme?.site?.marketing, feature),
        )
        .map(([, label]) => label);
  if (!labels.length)
    return (
      <>Explore this membership and find the options that fit your life.</>
    );
  const text =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
  return <>{text.charAt(0).toUpperCase() + text.slice(1)} in one membership.</>;
}
