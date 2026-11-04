"use client";

import Link from "next/link";
import { rebrand } from "@/lib/branding";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { MAIN_BRAND, programLink } from "@/lib/program-brand";

export function useProgramBrand() {
  const pathname = usePathname();
  const mainBrand = pathname === "/assurevantage" || pathname.startsWith("/assurevantage/");
  return {
    mainBrand,
    name: mainBrand ? MAIN_BRAND.name : "Ideal Health",
    logo: mainBrand ? MAIN_BRAND.branding.logoUrl : "/newideal/logo.png",
    siteSlug: mainBrand ? MAIN_BRAND.slug : "newideal",
    productName: (name: string) => mainBrand ? rebrand(name, MAIN_BRAND.name) : name,
    link: (href: string) => programLink(href, mainBrand),
  };
}

export function ProgramLink({ href, ...props }: ComponentProps<typeof Link>) {
  const brand = useProgramBrand();
  return <Link {...props} href={typeof href === "string" ? brand.link(href) : href} />;
}
