"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowRight, Loader } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans/cart-context";
import { BFL_SLUG, isEssentialsSlug } from "@/convex/lib/productSlugs";
import { BFL_BRAND as B } from "@/convex/lib/bflBrand";

/**
 * Enroll in standalone Balance for Life: put it in the cart and go to
 * checkout. Essentials already includes Balance for Life, so a cart holding
 * Essentials is pointed back at it instead of being charged twice.
 * Styled as Balance for Life's primary pill button.
 */
export function BflEnrollButton({
  label = "Get your membership — $19.95/mo",
  onDark = false,
}: {
  label?: string;
  /** Lighter treatment for use on the midnight CTA band. */
  onDark?: boolean;
}) {
  const router = useRouter();
  const { cart, addItem, isInCart } = useCart();
  const product = useQuery(api.catalog.queries.getBySlug, { slug: BFL_SLUG });
  const [going, setGoing] = useState(false);
  const [hover, setHover] = useState(false);

  const hasEssentials = cart.items.some((i) => isEssentialsSlug(i.product.slug));

  if (hasEssentials) {
    return (
      <p style={{ color: onDark ? B.violet100 : B.ink, fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
        Balance for Life is already included in the Essentials Plan in your cart.{" "}
        <Link href="/newideal/checkout" style={{ color: onDark ? "white" : B.violet600, fontWeight: 700 }}>
          Continue to checkout →
        </Link>
      </p>
    );
  }

  const enroll = () => {
    if (!product) return;
    setGoing(true);
    if (!isInCart(product._id)) addItem(product);
    router.push("/newideal/checkout");
  };

  const ready = !!product;
  return (
    <button
      type="button"
      onClick={enroll}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={!ready || going}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 56,
        padding: "0 28px",
        borderRadius: 9999,
        border: "none",
        background: onDark ? (hover ? B.violet100 : "white") : hover ? B.violet600 : B.violet500,
        color: onDark ? B.midnight : "white",
        fontWeight: 600,
        fontSize: "1rem",
        whiteSpace: "nowrap",
        cursor: ready ? "pointer" : "default",
        opacity: ready ? 1 : 0.7,
        boxShadow: B.shadowSm,
        transition: "background-color 0.2s",
      }}
    >
      {product === undefined || going ? <Loader size={18} className="animate-spin" /> : null}
      {product === null ? "Enrollment opening soon" : label}
      {ready ? <ArrowRight size={18} /> : null}
    </button>
  );
}
