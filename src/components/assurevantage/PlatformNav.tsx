"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import { isSiteMarketingEnabled } from "@/convex/lib/siteMarketing";
import MemberPortalButton from "@/components/auth/MemberPortalButton";
import { usesAssurePlatformNavigation } from "@/lib/program-brand";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/health-plans";
import { formatPrice } from "@/lib/health-plans/types";
import styles from "./platform.module.css";

export function PlatformNav() {
  const pathname = usePathname();
  const theme = useSiteThemeOptional();
  const globalShop = useQuery(api.shop.queries.isEnabled);
  const links = [
    { feature: "oralScan", path: "oral-health-scan", label: "Oral Health Scan" },
    { feature: "teledentistry", path: "teledentistry", label: "Teledentistry" },
    { feature: "dentalDiscount", path: "discount", label: "Dental Discount Network" },
    { feature: "blog", path: "blog", label: "Blog" },
    { feature: "faq", path: "faq", label: "FAQ" },
    { feature: "howItWorks", path: "how-it-works", label: "How It Works" },
  ] as const;
  const visibleLinks = theme?.isLoading ? [] : links.filter(link => isSiteMarketingEnabled(theme?.site?.marketing, link.feature));
  const showShop = globalShop !== false && theme?.site?.shopEnabled === true;
  const { cart, itemCount, subtotalCents, removeItem } = useCart();
  if (!usesAssurePlatformNavigation(pathname)) return null;
  return <div className={styles.platform}>
    <nav aria-label="AssureVantage offerings" className={styles.nav}>
      <Link href="/">AssureVantage</Link>
      {[["program-plans", "All offerings"], ["essentials", "Essentials"], ["balance-for-life", "Balance for Life"], ["plans", "Oral Care"]].map(([path, label]) => <Link key={path} href={`/assurevantage/${path}`} aria-current={pathname === `/assurevantage/${path}` ? "page" : undefined}>{label}</Link>)}
      {(visibleLinks.length > 0 || showShop) && <details className={styles.explore}>
        <summary>Explore services</summary>
        <div>{visibleLinks.map(link => <Link key={link.path} href={`/assurevantage/${link.path}`}>{link.label}</Link>)}
          {showShop && <Link href="/assurevantage/shop">Shop</Link>}
        </div>
      </details>}
      <MemberPortalButton />
      <Link className={styles.cartLink} href="/assurevantage/program-checkout">Cart ({itemCount}) · {formatPrice(subtotalCents)}{cart.cadence === "monthly" ? "/mo" : "/yr"}</Link>
    </nav>
    {itemCount > 0 && <details className={styles.summary}><summary>Review your shared cart · {itemCount} {itemCount === 1 ? "membership" : "memberships"}</summary>
      {cart.items.map(item => <div key={item.productId}>{item.product.name.replace(/Ideal Health/g, "AssureVantage")} <button aria-label={`Remove ${item.product.name}`} onClick={() => removeItem(item.productId)}>Remove</button></div>)}
      <Link href="/assurevantage/program-checkout">Continue to checkout →</Link>
    </details>}
  </div>;
}
