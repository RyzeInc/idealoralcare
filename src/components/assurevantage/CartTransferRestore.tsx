"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans";
import type { CatalogProduct } from "@/lib/health-plans/types";
import {
  readCheckoutTransfer,
  transferProducts,
} from "@/lib/checkout-transfer";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import styles from "./experience.module.css";
export function CartTransferRestore({ children }: { children: ReactNode }) {
  const store = useCart();
  const params = useSearchParams();
  const raw = params.get("cart");
  const transfer = readCheckoutTransfer(raw);
  const catalog = useQuery(api.catalog.queries.list, raw ? {} : "skip");
  const theme = useSiteThemeOptional();
  const applied = useRef<string | null>(null);
  const selection =
    transfer && catalog
      ? transferProducts(
          transfer,
          catalog as CatalogProduct[],
          theme?.site?.allowedPlanIds,
        )
      : null;
  useEffect(() => {
    if (
      !store.isLoaded ||
      !raw ||
      !transfer ||
      !selection ||
      theme?.isLoading ||
      applied.current === raw
    )
      return;
    applied.current = raw;
    store.clearCart();
    selection.products.forEach(store.addItem);
    store.setCadence(selection.cadence);
    store.setPaymentMethod(transfer.paymentMethod);
    store.setReferralCode(transfer.referralCode, transfer.referralSource);
    const url = new URL(window.location.href);
    url.searchParams.delete("cart");
    url.searchParams.delete("ref");
    if (transfer.referralSource === "url" && transfer.referralCode)
      url.searchParams.set("ref", transfer.referralCode);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [store, raw, transfer, selection, theme?.isLoading]);
  if (raw && (!transfer || (catalog && !theme?.isLoading && !selection)))
    return (
      <main className={styles.section}>
        <div className={styles.container}>
          <h1>Review your membership selection.</h1>
          <p>
            One or more selected memberships are unavailable. Choose your
            memberships again to see current pricing.
          </p>
          <a
            className={styles.button}
            href="https://www.assurevantage.com/assurevantage/program-plans"
          >
            Choose memberships
          </a>
        </div>
      </main>
    );
  if (raw)
    return (
      <p role="status" className="p-8 text-center">
        Loading your cart…
      </p>
    );
  return <>{children}</>;
}
