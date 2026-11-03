"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { domainSite } from "@/lib/site-domains";
import { safeReturnPath } from "@/lib/safe-redirect";
import { replaceAuthLocation } from "@/lib/auth-return";

const subscribe = () => () => {};
const getHost = () => window.location.hostname;
const getServerHost = () => "";

/** Clerk credentials are entered on the primary domain; cart stays on the satellite. */
export function SatelliteAuthRedirect({ children, mode }: { children: ReactNode; mode: "sign-in" | "sign-up" | "checkout" }) {
  const host = useSyncExternalStore(subscribe, getHost, getServerHost);
  const site = useMemo(() => domainSite(host), [host]);
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const pathname = usePathname();
  const params = useSearchParams();
  const redirectNeeded = Boolean(site) && (mode !== "checkout" || !isSignedIn);

  useEffect(() => {
    if (!site || !isLoaded || !redirectNeeded) return;
    const returnPath = mode === "checkout"
      ? `${pathname}${params.size ? `?${params.toString()}` : ""}`
      : safeReturnPath(params.get("redirect_url"), `/${site.slug}/dashboard`);
    // A return path must stay within this brand; a URL parameter cannot select another site.
    const path = returnPath === `/${site.slug}` || returnPath.startsWith(`/${site.slug}/`)
      ? returnPath : `/${site.slug}/dashboard`;
    const redirectUrl = new URL(path, site.origin).href;
    const target = mode === "sign-up" ? clerk.buildSignUpUrl({ redirectUrl }) : clerk.buildSignInUrl({ redirectUrl });
    replaceAuthLocation(target);
  }, [site, isLoaded, redirectNeeded, mode, clerk, pathname, params]);

  if (redirectNeeded) return <div role="status" className="p-8 text-center">Opening secure sign-in…</div>;
  return <>{children}</>;
}
