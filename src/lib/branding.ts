import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";

export const DEFAULT_BRAND_NAME = "Ideal Oral Health";

/**
 * Replace the hardcoded "Ideal" brand tokens in a string with the active
 * site's brand name. Catalog product names, plan labels, etc. are stored in
 * the DB with the default Ideal branding; this re-brands them at display time
 * for white-label sites. Longest tokens are matched first so "Ideal Oral"
 * collapses to just the brand name (e.g. "Ideal Oral Savings Plan" →
 * "Flourish XV Savings Plan").
 */
export function rebrand(text: string, brandName: string): string {
  if (!text) return text;
  const name = brandName || DEFAULT_BRAND_NAME;
  return text
    .replace(/Ideal Oral Health/g, name)
    .replace(/Ideal Oral/g, name)
    .replace(/Ideal/g, name);
}

/** Current site's brand name, falling back to the default Ideal name. */
export function useBrandName(): string {
  const theme = useSiteThemeOptional();
  return theme?.site?.name ?? DEFAULT_BRAND_NAME;
}
