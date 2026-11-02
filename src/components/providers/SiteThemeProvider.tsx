"use client";

/**
 * SITE THEME PROVIDER
 * 
 * Manages dynamic white-label branding by resolving the current site
 * from Convex and injecting branding CSS custom properties.
 * 
 * Usage:
 * <SiteThemeProvider>
 *   <App />
 * </SiteThemeProvider>
 * 
 * In components:
 * const site = useSiteTheme();
 * console.log(site.name); // "Ideal Health"
 */

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { SiteMarketing } from "@/convex/lib/siteMarketing";

// Path segments that are never site slugs
const NON_SITE_SEGMENTS = new Set([
  "health", "admin", "api", "_next", "static", "public",
  "register", "partner", "newideal", "debug", "bootstrap", "unsubscribe",
  "404", "500", "favicon.ico",
]);

export type SitePromoPlacement = "landing" | "plans";

export interface SitePromoLink {
  text: string;
  ctaText: string;
  url: string;
  disclosure?: string;
  placements: SitePromoPlacement[];
  enabled: boolean;
}

export interface SiteTheme {
  _id?: string;
  slug: string;
  name: string;
  type: "primary" | "whitelabel" | "channel";
  domain?: string;
  basePath?: string;
  branding?: {
    logoUrl?: string;
    logoStorageId?: string;
    logoWidth?: number;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    heroHeadline?: string;
    heroSubtext?: string;
    heroImageUrl?: string;
    customCSS?: string;
    footerText?: string;
    informationEmail?: string;
  };
  allowedPlanIds?: string[];
  /**
   * Third-party offers rendered on this site's public pages. Mirrors
   * `promoLinks` on the sites table — see convex/lib/promoLinks.ts.
   */
  promoLinks?: SitePromoLink[];
  marketing?: SiteMarketing;
  shopEnabled?: boolean;
  defaultCadence?: "monthly" | "annual";
  defaultPaymentMethod?: "card" | "ach";
  enrollmentDefaults?: {
    requireGroupCode: boolean;
    requireEligibilityMatch: boolean;
    allowSelfEnrollment: boolean;
    requirePayment: boolean;
    autoActivate: boolean;
    collectAddress: boolean;
    collectPhone: boolean;
    collectEmployeeId: boolean;
    collectDependents?: boolean;
    termsDocumentUrl?: string;
    privacyPolicyUrl?: string;
    welcomeMessage?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  status?: "onboarding" | "active" | "suspended" | "terminated";
}

interface SiteThemeContextValue {
  site: SiteTheme | null;
  isLoading: boolean;
  error?: string;
}

const SiteThemeContext = createContext<SiteThemeContextValue | undefined>(undefined);

interface SiteThemeProviderProps {
  children: ReactNode;
  defaultSlug?: string;
}

export function SiteThemeProvider({
  children,
  defaultSlug,
}: SiteThemeProviderProps) {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1];
  const siteSlug = defaultSlug ?? (segment && !NON_SITE_SEGMENTS.has(segment) ? segment : "");

  // Only query when we have a slug
  const site = useQuery(
    api.hierarchy.resolveSiteBySlug,
    siteSlug ? { slug: siteSlug } : "skip"
  );

  const siteTheme = site as unknown as SiteTheme | null | undefined;

  // Inject CSS custom properties when site loads
  useEffect(() => {
    if (siteTheme) {
      const root = document.documentElement;
      const propertyNames = ["--brand-primary", "--brand-secondary", "--brand-accent", "--brand-logo-url"];
      const previousProperties = propertyNames.map(name => [name, root.style.getPropertyValue(name), root.style.getPropertyPriority(name)]);
      const previousTitle = document.title;
      const icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      const previousIcon = icon?.getAttribute("href");
      let customStyle: HTMLStyleElement | undefined;

      root.style.setProperty("--brand-primary", siteTheme.branding?.primaryColor || "#1e3a5f");
      root.style.setProperty("--brand-secondary", siteTheme.branding?.secondaryColor || "#14b8a6");
      root.style.setProperty("--brand-accent", siteTheme.branding?.accentColor || "#0ea5e9");

      if (siteTheme.branding?.logoUrl) {
        root.style.setProperty("--brand-logo-url", `url('${siteTheme.branding.logoUrl}')`);
      }

      if (siteTheme.branding?.faviconUrl) {
        if (icon) icon.href = siteTheme.branding.faviconUrl;
      }

      if (siteTheme.branding?.customCSS) {
        customStyle = document.createElement("style");
        customStyle.dataset.siteTheme = siteTheme.slug;
        customStyle.textContent = siteTheme.branding.customCSS;
        document.head.appendChild(customStyle);
      }

      if (siteTheme.name) {
        document.title = siteTheme.name;
      }

      return () => {
        for (const [name, value, priority] of previousProperties) {
          if (value) root.style.setProperty(name, value, priority);
          else root.style.removeProperty(name);
        }
        customStyle?.remove();
        if (icon && previousIcon != null) icon.setAttribute("href", previousIcon);
        else if (icon) icon.removeAttribute("href");
        document.title = previousTitle;
      };
    }
  }, [siteTheme]);

  return (
    <SiteThemeContext.Provider
      value={{
        site: siteTheme || null,
        isLoading: Boolean(siteSlug) && siteTheme === undefined,
        error: siteTheme === null ? "Site not found" : undefined,
      }}
    >
      {children}
    </SiteThemeContext.Provider>
  );
}

/**
 * Hook to access the current site theme
 */
export function useSiteTheme(): SiteThemeContextValue {
  const context = useContext(SiteThemeContext);
  if (!context) {
    throw new Error("useSiteTheme must be used within SiteThemeProvider");
  }
  return context;
}

/**
 * Hook to safely access site theme (returns null if not available)
 */
export function useSiteThemeOptional(): SiteThemeContextValue | null {
  const context = useContext(SiteThemeContext);
  return context || null;
}
