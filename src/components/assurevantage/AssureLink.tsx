"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore, type ComponentProps } from "react";
import { ASSURE_URL } from "@/lib/assure-content";
import { PRIMARY_AUTH_ORIGIN, domainSite } from "@/lib/site-domains";
import { useCartOptional } from "@/lib/health-plans/cart-context";
import { secureCheckoutUrl } from "@/lib/checkout-transfer";
const subscribe = () => () => {};
export function AssureLink({ href, ...props }: ComponentProps<typeof Link>) {
  const params = useSearchParams();
  const pathname = usePathname();
  const store = useCartOptional();
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  let target = href;
  if (
    typeof href === "string" &&
    (href.startsWith("/") ||
      href.startsWith(ASSURE_URL + "/") ||
      href === ASSURE_URL)
  ) {
    const url = new URL(href, ASSURE_URL);
    const ref = params?.get("ref");
    if (ref && !url.searchParams.has("ref")) url.searchParams.set("ref", ref);
    const checkoutOrigin =
      origin === PRIMARY_AUTH_ORIGIN &&
      /^\/assurevantage\/program-(checkout|success)$/.test(pathname || "");
    const shoppingTarget =
      url.origin === ASSURE_URL &&
      (url.pathname === "/" || url.pathname.startsWith("/assurevantage/")) &&
      !/^\/assurevantage\/(program-checkout|program-success|dashboard|manage-plans|sign-in|sign-up|forgot-password|sso-callback|claim-invite)(?:\/|$)/.test(
        url.pathname,
      );
    if (
      domainSite(origin.replace(/^https?:\/\//, "")) &&
      url.pathname === "/assurevantage/program-checkout" &&
      store?.isLoaded &&
      store.cart.items.length
    ) {
      target = secureCheckoutUrl(store.cart);
    } else if (checkoutOrigin && shoppingTarget && store?.isLoaded) {
      url.searchParams.set(
        "cart",
        new URL(secureCheckoutUrl(store.cart)).searchParams.get("cart")!,
      );
      target = url.href;
    } else
      target =
        href === "/"
          ? ASSURE_URL + url.search + url.hash
          : href.startsWith("https:")
            ? url.href
            : url.pathname + url.search + url.hash;
  }
  return <Link {...props} href={target} />;
}
