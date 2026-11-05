"use client";

import { useCart } from "@/lib/health-plans";
import { isMembershipProgramSlug } from "@/convex/lib/productSlugs";
import ProgramCheckout from "@/app/newideal/checkout/page.client";
import { CheckoutContent } from "@/app/health/checkout/page.client";

export default function SharedCheckout() {
  const { cart, isLoaded } = useCart();
  if (!isLoaded) return <p role="status" className="p-8 text-center">Loading your cart…</p>;
  return cart.items.some(item => isMembershipProgramSlug(item.product.slug) || item.product.slug.startsWith("oralcare-"))
    ? <ProgramCheckout /> : <CheckoutContent />;
}
