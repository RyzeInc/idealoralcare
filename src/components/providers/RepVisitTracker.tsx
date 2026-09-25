"use client";

import { useEffect } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "ideal-visit-session";
const SENT_PREFIX = "ideal-visit-sent:";

/**
 * Fires a one-shot beacon when a visitor lands on a page carrying a rep code.
 *
 * The vanity-URL entry point (`/{slug}`) is already recorded server-side in
 * src/proxy.ts. This covers the other way in — a link shared with `?ref=CODE`
 * already attached, which never passes through that redirect.
 *
 * Deduped per (session, code) via sessionStorage, so a visitor clicking around
 * a rep's funnel counts as one visit rather than one per page. Client-side
 * dedupe is a courtesy, not a guarantee; `repLinkVisits` also stores the
 * session id so reads can dedupe properly.
 */
export function RepVisitTracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useParams();

  useEffect(() => {
    const code = searchParams?.get("ref");
    if (!code) return;

    let sessionId: string;
    try {
      sessionId = window.sessionStorage.getItem(SESSION_KEY) ?? crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, sessionId);

      const sentKey = SENT_PREFIX + code;
      if (window.sessionStorage.getItem(sentKey)) return;
      window.sessionStorage.setItem(sentKey, "1");
    } catch {
      // Private browsing or storage disabled — record the visit anyway rather
      // than losing it; the server dedupes on session id where it can.
      sessionId = "";
    }

    const siteSlug =
      typeof params?.siteSlug === "string" ? params.siteSlug : undefined;

    const payload = JSON.stringify({
      code,
      siteSlug,
      path: pathname ?? "/",
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      sessionId: sessionId || undefined,
    });

    try {
      // sendBeacon survives the page being navigated away from; fetch may not.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/track/rep-visit",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        void fetch("/api/track/rep-visit", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        });
      }
    } catch {
      // Best-effort by design.
    }
  }, [searchParams, pathname, params]);

  return null;
}
