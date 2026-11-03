import { ASSUREVANTAGE_PRESET } from "@/convex/lib/sitePresets";

export const MAIN_BRAND = ASSUREVANTAGE_PRESET;
export const MAIN_ORIGIN = "https://www.assurevantage.com";

/** Existing /newideal URLs remain the Ideal program experience for legacy groups. */
export function programLink(href: string, mainBrand: boolean) {
  if (!mainBrand || !/^\/newideal(?:\/|\?|$)/.test(href)) return href;
  return href.replace(/^\/newideal(?=\/|\?|$)/, "/assurevantage")
    .replace(/^\/assurevantage\/plans(?=\?|$)/, "/assurevantage/program-plans")
    .replace(/^\/assurevantage\/checkout(?=\?|$)/, "/assurevantage/program-checkout")
    .replace(/^\/assurevantage\/success(?=\?|$)/, "/assurevantage/program-success");
}
