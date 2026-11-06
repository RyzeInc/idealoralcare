"use client";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans";
import type { CatalogProduct } from "@/lib/health-plans/types";
import { domainSite } from "@/lib/site-domains";
import { secureCheckoutUrl, shoppingUrl } from "@/lib/checkout-transfer";
import { AssureLink as Link } from "./AssureLink";
import { UnifiedCheckout } from "./UnifiedCheckout";
import styles from "./experience.module.css";
export default function SharedCheckout() {
  const { cart, isLoaded, syncProductPricing } = useCart();
  const catalog = useQuery(api.catalog.queries.list, {});
  useEffect(() => {
    if (catalog) syncProductPricing(catalog as CatalogProduct[]);
  }, [catalog, syncProductPricing]);
  useEffect(() => {
    if (isLoaded && cart.items.length && domainSite(window.location.hostname))
      window.location.replace(secureCheckoutUrl(cart));
  }, [isLoaded, cart]);
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
            Choose your memberships, then review your order before creating an
            account or paying.
          </p>
          <Link className={styles.button} href={shoppingUrl(cart)}>
            Explore memberships
          </Link>
        </div>
      </main>
    );
  return <UnifiedCheckout />;
}
