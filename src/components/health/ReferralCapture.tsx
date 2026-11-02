"use client";

/**
 * ReferralCapture
 *
 * Reads ?ref= from the URL and writes it into the cart context + a 90-day
 * first-party cookie so attribution persists across navigations, tab-reopens,
 * and localStorage clears.
 *
 * Mount this (wrapped in <Suspense>) on every public landing page that may
 * receive a ?ref= parameter. It is safe to render multiple times — subsequent
 * calls are no-ops when the code hasn't changed.
 */

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/health-plans/cart-context";

const COOKIE_NAME = "ideal_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export function ReferralCapture() {
  const params = useSearchParams();
  const { setReferralCode, cart, isLoaded } = useCart();

  useEffect(() => {
    // Storage hydration must finish first or it can overwrite this landing's code.
    if (!isLoaded) return;
    const fromUrl = params.get("ref")?.trim();
    if (!fromUrl) return;

    if (fromUrl !== cart.referralCode || cart.referralCodeSource !== "url") {
      setReferralCode(fromUrl, "url");
    }

    // Mirror to cookie for cross-tab / localStorage-cleared recovery
    const secure = window.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(fromUrl)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax${secure}`;
  }, [params, isLoaded, cart.referralCode, cart.referralCodeSource, setReferralCode]);

  return null;
}
