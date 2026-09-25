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

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  };
  allowedPlanIds?: string[];
  /**
   * Third-party offers rendered on this site's public pages. Mirrors
   * `promoLinks` on the sites table — see convex/lib/promoLinks.ts.
   */
  promoLinks?: SitePromoLink[];
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
  const [siteSlug, setSiteSlug] = useState(defaultSlug ?? "");
  const [isLoading, setIsLoading] = useState(true);

  // Only query when we have a slug
  const site = useQuery(
    api.hierarchy.resolveSiteBySlug,
    siteSlug ? { slug: siteSlug } : "skip"
  );

  const siteTheme = site as unknown as SiteTheme | null | undefined;

  // If no explicit slug was passed, try to resolve from the URL path
  useEffect(() => {
    if (!defaultSlug) {
      const segment = window.location.pathname.split("/")[1];
      if (segment && !NON_SITE_SEGMENTS.has(segment)) {
        setSiteSlug(segment);
      }
    }
    setIsLoading(false);
  }, [defaultSlug]);

  // Inject CSS custom properties when site loads
  useEffect(() => {
    if (siteTheme) {
      const root = document.documentElement;

      root.style.setProperty("--brand-primary", siteTheme.branding?.primaryColor || "#1e3a5f");
      root.style.setProperty("--brand-secondary", siteTheme.branding?.secondaryColor || "#14b8a6");
      root.style.setProperty("--brand-accent", siteTheme.branding?.accentColor || "#0ea5e9");

      if (siteTheme.branding?.logoUrl) {
        root.style.setProperty("--brand-logo-url", `url('${siteTheme.branding.logoUrl}')`);
      }

      if (siteTheme.branding?.faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = siteTheme.branding.faviconUrl;
      }

      if (siteTheme.branding?.customCSS) {
        const styleId = "site-custom-styles";
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
          style = document.createElement("style");
          style.id = styleId;
          document.head.appendChild(style);
        }
        style.textContent = siteTheme.branding.customCSS;
      }

      if (siteTheme.name) {
        document.title = siteTheme.name;
      }
    }
  }, [siteTheme]);

  return (
    <SiteThemeContext.Provider
      value={{
        site: siteTheme || null,
        isLoading: isLoading && !siteTheme,
        error: siteTheme === undefined && !isLoading ? "Site not found" : undefined,
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
