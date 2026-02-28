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

export interface SiteTheme {
  _id?: string;
  slug: string;
  name: string;
  type: "primary" | "whitelabel" | "channel";
  domain?: string;
  branding?: {
    logoUrl?: string;
    logoStorageId?: string;
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
  defaultSlug?: string; // Default to "ideal-health" if not provided
}

/**
 * Provider component - wraps the app and resolves site theme
 */
export function SiteThemeProvider({
  children,
  defaultSlug = "ideal-health",
}: SiteThemeProviderProps) {
  const [siteSlug, setSiteSlug] = useState(defaultSlug);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve site by slug
  const site = useQuery(api.hierarchy.resolveSiteBySlug, { slug: siteSlug });

  // Load site from URL or defaults on mount
  useEffect(() => {
    // Try to resolve from URL path or domain
    const pathMatch = window.location.pathname.split("/")[1];
    if (pathMatch && pathMatch !== "health") {
      setSiteSlug(pathMatch);
    }

    setIsLoading(false);
  }, []);

  // Inject CSS custom properties when site loads
  useEffect(() => {
    if (site) {
      const root = document.documentElement;

      // Brand colors
      root.style.setProperty(
        "--brand-primary",
        site.branding?.primaryColor || "#1e3a5f"
      );
      root.style.setProperty(
        "--brand-secondary",
        site.branding?.secondaryColor || "#14b8a6"
      );
      root.style.setProperty(
        "--brand-accent",
        site.branding?.accentColor || "#0ea5e9"
      );

      // Logo URL (for img elements)
      root.style.setProperty(
        "--brand-logo-url",
        `url('${site.branding?.logoUrl || "/ideal-health-logo.png"}')`
      );

      // Favicon
      if (site.branding?.faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = site.branding.faviconUrl;
        }
      }

      // Custom CSS injections (if site has custom styles)
      if (site.branding?.customCSS) {
        const styleId = "site-custom-styles";
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
          style = document.createElement("style");
          style.id = styleId;
          document.head.appendChild(style);
        }
        style.textContent = site.branding.customCSS;
      }

      // Update document title
      if (site.name) {
        document.title = `${site.name} | Modern Health Plans Made Simple`;
      }
    }
  }, [site]);

  return (
    <SiteThemeContext.Provider
      value={{
        site: site || null,
        isLoading: isLoading && !site,
        error: site === undefined && !isLoading ? "Site not found" : undefined,
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
