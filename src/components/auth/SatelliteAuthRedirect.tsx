"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isLegacyHost,
  LEGACY_ORIGIN,
  PRIMARY_AUTH_ORIGIN,
} from "@/lib/site-domains";
import { safeReturnPath } from "@/lib/safe-redirect";
import { isSatelliteAuthReturn, replaceAuthLocation } from "@/lib/auth-return";

const subscribe = () => () => {};
const getHost = () => window.location.hostname;
const getServerHost = () => "";

/** Clerk credentials are entered on the primary domain (assurevantage.com); getidealoh.com visitors return afterwards. */
export function SatelliteAuthRedirect({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "sign-in" | "sign-up" | "checkout" | "reset";
}) {
  const host = useSyncExternalStore(subscribe, getHost, getServerHost);
  const satellite = isLegacyHost(host);
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const clerkLoaded = clerk.loaded;
  const pathname = usePathname();
  const params = useSearchParams();
  const redirectNeeded = satellite && (mode !== "checkout" || !isSignedIn);

  useEffect(() => {
    // Server auth may be loaded before the browser's URL builders are ready.
    if (!satellite || !isLoaded || !clerkLoaded || !redirectNeeded) return;
    const raw = params.get("redirect_url");
    // A return path must stay on this host; a URL parameter cannot select another site.
    const path =
      mode === "checkout"
        ? `${pathname}${params.size ? `?${params.toString()}` : ""}`
        : isSatelliteAuthReturn(raw) && new URL(raw!).origin === LEGACY_ORIGIN
          ? new URL(raw!).pathname + new URL(raw!).search
          : safeReturnPath(raw, "/health/dashboard");
    const redirectUrl = new URL(path, LEGACY_ORIGIN).href;
    const options = {
      signInForceRedirectUrl: redirectUrl,
      signUpForceRedirectUrl: redirectUrl,
    };
    const target =
      mode === "sign-up"
        ? clerk.buildSignUpUrl(options)
        : clerk.buildSignInUrl(options);
    if (target) {
      const authUrl = new URL(target, PRIMARY_AUTH_ORIGIN);
      // Our custom forms read redirect_url; keep Clerk's sync parameters too.
      authUrl.searchParams.set("redirect_url", redirectUrl);
      if (mode === "reset") authUrl.pathname = "/assurevantage/forgot-password";
      replaceAuthLocation(authUrl.href);
    }
  }, [
    satellite,
    isLoaded,
    clerkLoaded,
    redirectNeeded,
    mode,
    clerk,
    pathname,
    params,
  ]);

  if (redirectNeeded)
    return (
      <div role="status" className="p-8 text-center">
        Opening secure sign-in…
      </div>
    );
  return <>{children}</>;
}
