"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { domainSite, PRIMARY_AUTH_ORIGIN } from "@/lib/site-domains";
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
  const clerkLoaded = clerk.loaded;
  const pathname = usePathname();
  const params = useSearchParams();
  const redirectNeeded = Boolean(site) && (mode !== "checkout" || !isSignedIn);

  useEffect(() => {
    // Server auth may be loaded before the browser's URL builders are ready.
    if (!site || !isLoaded || !clerkLoaded || !redirectNeeded) return;
    const returnPath = mode === "checkout"
      ? `${pathname}${params.size ? `?${params.toString()}` : ""}`
      : safeReturnPath(params.get("redirect_url"), `/${site.slug}/dashboard`);
    // A return path must stay within this brand; a URL parameter cannot select another site.
    const path = returnPath === `/${site.slug}` || returnPath.startsWith(`/${site.slug}/`)
      ? returnPath : `/${site.slug}/dashboard`;
    const redirectUrl = new URL(path, site.origin).href;
    const options = { signInForceRedirectUrl: redirectUrl, signUpForceRedirectUrl: redirectUrl };
    const target = mode === "sign-up" ? clerk.buildSignUpUrl(options) : clerk.buildSignInUrl(options);
    if (target) {
      const authUrl = new URL(target, PRIMARY_AUTH_ORIGIN);
      // Our custom forms read redirect_url; keep Clerk's sync parameters too.
      authUrl.searchParams.set("redirect_url", redirectUrl);
      replaceAuthLocation(authUrl.href);
    }
  }, [site, isLoaded, clerkLoaded, redirectNeeded, mode, clerk, pathname, params]);

  if (redirectNeeded) return <div role="status" className="p-8 text-center">Opening secure sign-in…</div>;
  return <>{children}</>;
}
