"use client";

import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";

interface BrandNameProps {
  fallback?: string;
}

export function BrandName({ fallback = "Ideal Oral Health" }: BrandNameProps) {
  const theme = useSiteThemeOptional();
  return <>{theme?.site?.name ?? fallback}</>;
}
