import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const memberBrandFields = {
  name: v.optional(v.string()), fromName: v.optional(v.string()),
  fromEmail: v.optional(v.string()), replyToEmail: v.optional(v.string()),
  supportEmail: v.optional(v.string()), supportPhone: v.optional(v.string()),
  portalUrl: v.optional(v.string()), logoUrl: v.optional(v.string()),
};
export type MemberBrand = { name?: string; fromName?: string; fromEmail?: string; replyToEmail?: string; supportEmail?: string; supportPhone?: string; portalUrl?: string; logoUrl?: string };

export function siteOrigin(domain: string | undefined, fallback: string): string {
  if (!domain?.trim()) return new URL(fallback).origin;
  if (domain.trim().startsWith("/")) throw new Error("Use a website domain without a path");
  const url = new URL(domain.includes("://") ? domain : `https://${domain}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use a website domain without a path");
  return url.origin;
}

/** Membership ownership selects the brand; the host a visitor opens never does. */
export function resolveMemberBrand(site: Doc<"sites"> | null): MemberBrand | undefined {
  if (!site?.memberBrandingEnabled) return undefined;
  const origin = siteOrigin(site.domain, "https://www.getidealoh.com");
  const basePath = ["ideal-health", "ryze-health"].includes(site.slug) ? "/health" : `/${encodeURIComponent(site.slug)}`;
  return {
    name: site.name,
    portalUrl: `${origin}${basePath}/dashboard`,
    logoUrl: site.branding.logoUrl,
    supportEmail: site.enrollmentDefaults.supportEmail || "support@getidealoh.com",
    supportPhone: site.enrollmentDefaults.supportPhone || "(844) 679-9367",
  };
}

export function memberPlanName(name: string, brand: MemberBrand | undefined) {
  return brand?.name ? name.replace(/Ideal Oral Health|Ideal Oral|Ideal Health|Ideal/g, () => brand.name!) : name;
}

export function memberDocumentPrefix(brand?: MemberBrand) {
  return brand?.name?.replace(/[^a-zA-Z0-9_-]/g, "_") || "Ideal_Oral_Health";
}
