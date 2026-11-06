"use client";

import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
import { useCart } from "@/lib/health-plans";
import { isMembershipProgramSlug } from "@/convex/lib/productSlugs";
import { SatelliteAuthRedirect } from "@/components/auth/SatelliteAuthRedirect";
import ProgramCheckout from "@/app/newideal/checkout/page.client";
import { CheckoutContent } from "@/app/health/checkout/page.client";

export default function SharedCheckout() {
  const { cart, isLoaded } = useCart();
  if (!isLoaded)
    return (
      <p role="status" className="p-8 text-center">
        Loading your cart…
      </p>
    );
  if (!cart.items.length)
    return (
      <main className={styles.section}>
        <div className={`${styles.container} ${styles.narrow}`}>
          <h1>Your cart is ready when you are.</h1>
          <p>
            Explore the memberships and choose what fits. You can review your
            total before enrollment.
          </p>
          <Link className={styles.button} href="/assurevantage/program-plans">
            Explore memberships
          </Link>
        </div>
      </main>
    );
  const content = cart.items.some(
    (item) =>
      isMembershipProgramSlug(item.product.slug) ||
      item.product.slug.startsWith("oralcare-"),
  ) ? (
    <ProgramCheckout />
  ) : (
    <CheckoutContent />
  );
  return (
    <SatelliteAuthRedirect mode="checkout">{content}</SatelliteAuthRedirect>
  );
}
