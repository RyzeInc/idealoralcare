import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { domainClerkOptions, domainSite, SATELLITE_ORIGINS } from "@/lib/site-domains";

export async function DomainClerkProvider({ children }: { children: ReactNode }) {
  const host = (await headers()).get("host");
  const site = domainSite(host);
  const options = domainClerkOptions(host);
  const basePath = site ? `${site.origin}/${site.slug}` : "/health";
  return <ClerkProvider dynamic
    signInUrl="/health/sign-in" signUpUrl="/health/sign-up"
    {...options}
    allowedRedirectOrigins={SATELLITE_ORIGINS}
    signInFallbackRedirectUrl={`${basePath}/dashboard`}
    signUpFallbackRedirectUrl={`${basePath}/dashboard`}>
    {children}
  </ClerkProvider>;
}
