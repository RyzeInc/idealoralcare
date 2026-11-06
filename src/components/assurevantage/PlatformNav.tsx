"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ShoppingBag } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/health-plans";
import { formatPrice } from "@/lib/health-plans/types";
import { assureProductName } from "@/lib/assure-content";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import { isSiteMarketingEnabled } from "@/convex/lib/siteMarketing";
import MemberPortalButton from "@/components/auth/MemberPortalButton";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
export function PlatformNav() {
  const pathname = usePathname();
  const theme = useSiteThemeOptional();
  const globalShop = useQuery(api.shop.queries.isEnabled);
  const { cart, itemCount, subtotalCents, removeItem } = useCart();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    header.current
      ?.querySelectorAll("details[open]")
      .forEach((node) => node.removeAttribute("open"));
  }, [pathname]);
  const benefits = [
    { path: "virtual-care", label: "Virtual care", feature: "telehealth" as const },
    { path: "labs", label: "Lab services", feature: "labServices" as const },
    { path: "pharmacy", label: "Prescription savings", feature: "rxSavings" as const },
    { path: "balance-for-life", label: "Mental wellbeing" },
    { path: "oralcare", label: "Oral Care" },
    {
      path: "oral-health-scan",
      label: "Oral Health Scan",
      feature: "oralScan" as const,
    },
    {
      path: "teledentistry",
      label: "Teledentistry",
      feature: "teledentistry" as const,
    },
    {
      path: "discount",
      label: "Dental Discount Network",
      feature: "dentalDiscount" as const,
    },
  ];
  const visible = benefits.filter(
    (link) =>
      !link.feature ||
      (!theme?.isLoading &&
        isSiteMarketingEnabled(theme?.site?.marketing, link.feature)),
  );
  return (
    <header
      className={styles.header}
      ref={header}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpenPath(null);
          header.current
            ?.querySelectorAll("details[open]")
            .forEach((node) => node.removeAttribute("open"));
        }
      }}
    >
      <div className={`${styles.container} ${styles.navRow}`}>
        <Link className={styles.logo} href="/" aria-label="AssureVantage home">
          <Image
            src="/brands/assurevantage/logo.png"
            alt="AssureVantage"
            width={185}
            height={62}
            priority
          />
        </Link>
        <nav
          id="assure-navigation"
          className={`${styles.navLinks} ${open ? styles.navOpen : ""}`}
          aria-label="Main navigation"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpenPath(null);
          }}
        >
          <details>
            <summary>Explore services</summary>
            <div className={styles.dropdown}>
              {visible.map((link) => (
                <Link
                  href={`/assurevantage/${link.path}`}
                  key={link.path}
                  aria-current={
                    pathname === `/assurevantage/${link.path}`
                      ? "page"
                      : undefined
                  }
                >
                  {link.label}
                </Link>
              ))}
              {globalShop !== false && theme?.site?.shopEnabled === true && (
                <Link href="/assurevantage/shop">Shop</Link>
              )}
            </div>
          </details>
          <Link
            href="/assurevantage/program-plans"
            aria-current={
              pathname.endsWith("/program-plans") ? "page" : undefined
            }
          >
            Memberships & pricing
          </Link>
          <Link href="/assurevantage/how-it-works">How it works</Link>
          <Link href="/assurevantage/help">Help</Link>
          {open && (
            <>
              <Link href="/assurevantage/dashboard">Member portal</Link>
              <Link href="/assurevantage/for-employers">
                Employers & brokers
              </Link>
              {isSiteMarketingEnabled(theme?.site?.marketing, "blog") && (
                <Link href="/assurevantage/blog">Guides & resources</Link>
              )}
            </>
          )}
        </nav>
        <div className={styles.navActions}>
          <MemberPortalButton />
          <Link
            href="/assurevantage/program-checkout"
            className={styles.cart}
            aria-label={`Cart (${itemCount}) · ${formatPrice(subtotalCents)} ${cart.cadence === "monthly" ? "per month" : "per year"}`}
          >
            <ShoppingBag size={17} aria-hidden="true" />
            Cart ({itemCount})<span> · {formatPrice(subtotalCents)}</span>
          </Link>
          <button
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="assure-navigation"
            onClick={() => setOpenPath(open ? null : pathname)}
          >
            {open ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {itemCount > 0 && (
        <div className={styles.container}>
          <details className={styles.cartSummary}>
            <summary>
              Your selections · {formatPrice(subtotalCents)}
              {cart.cadence === "monthly" ? "/month" : "/year"}
            </summary>
            {cart.items.map((item) => (
              <div key={item.productId}>
                {assureProductName(item.product.name)}
                <button
                  aria-label={`Remove ${assureProductName(item.product.name)}`}
                  onClick={() => removeItem(item.productId)}
                >
                  Remove
                </button>
              </div>
            ))}
            <Link href="/assurevantage/program-checkout">
              Review your cart →
            </Link>
          </details>
        </div>
      )}
    </header>
  );
}
