"use client";

import { HeartPulse, Brain, Smile, Check } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans";
import { formatPrice, type CatalogProduct } from "@/lib/health-plans/types";
import { isEssentialsSlug, isBflSlug } from "@/convex/lib/productSlugs";
import styles from "./platform.module.css";

export default function OfferingCatalog() {
  const products = useQuery(api.catalog.queries.list, {});
  const { cart, addItem, isInCart, monthlyOnly, setCadence, isLoaded, syncProductPricing } = useCart();
  useEffect(() => { if (products) syncProductPricing(products as CatalogProduct[]); }, [products, syncProductPricing]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const visible = ((products ?? []) as CatalogProduct[]).filter(p => p.isVisible !== false);
  const groups = [
    { key: "essentials", icon: HeartPulse, name: "Essentials", description: "Everyday care in one membership. Includes Balance for Life, telehealth, prescription savings and lab services.", match: (p: CatalogProduct) => isEssentialsSlug(p.slug), href: "essentials" },
    { key: "bfl", icon: Brain, name: "Balance for Life", description: "Mental wellbeing support on its own. Already included when you choose Essentials.", match: (p: CatalogProduct) => isBflSlug(p.slug), href: "balance-for-life" },
    { key: "oral", icon: Smile, name: "Oral Care", description: "Dental savings, oral scanning and teledentistry. Choose it on its own or add it to your membership.", match: (p: CatalogProduct) => p.category === "dental", href: "oralcare" },
  ];
  return <main className={styles.catalog}>
    <p className={styles.eyebrow}>The AssureVantage platform</p>
    <h1>Three offerings. One shared checkout.</h1>
    <p>Choose what fits your life. Explore any offering and your cart stays with you.</p>
    <p>Essentials includes Balance for Life, so you’ll only pay for one. Both use simple monthly billing.</p>
    {products === undefined ? <p role="status">Loading offerings…</p> : <>
      {!monthlyOnly && <div className={styles.billing} aria-label="Billing frequency">
        {(["monthly", "annual"] as const).map(cadence => <button key={cadence} aria-pressed={cart.cadence === cadence} onClick={() => setCadence(cadence)}>{cadence === "monthly" ? "Monthly" : "Annual"}</button>)}
      </div>}
      {monthlyOnly && <p>Monthly billing · Essentials and Balance for Life</p>}
      <div className={styles.cards}>{groups.map(group => {
        const options = visible.filter(group.match).sort((a, b) => a.order - b.order);
        const product = options.find(p => p._id === selected[group.key]) ?? options[0];
        const included = group.key === "bfl" && cart.items.some(i => isEssentialsSlug(i.product.slug));
        const added = product && isInCart(product._id);
        return <article className={`${styles.card} ${added || included ? styles.selected : ""}`} data-offering={group.key} key={group.key}>
          <span className={styles.icon}><group.icon size={28} /></span>
          <h2>{group.name}</h2><p>{group.description}</p>
          {added && <span className={styles.badge}><Check size={16} /> Selected in your cart</span>}
          <Link href={`/assurevantage/${group.href}`}>Explore {group.name} →</Link>
          {options.length > 1 && <label>Choose your membership<select value={product?._id ?? ""} onChange={event => setSelected(prev => ({ ...prev, [group.key]: event.target.value }))}>{options.map(p => <option key={p._id} value={p._id}>{p.name.replace(/Ideal Health/g, "AssureVantage")}</option>)}</select></label>}
          {product && <strong>{formatPrice(group.key !== "oral" || cart.cadence === "monthly" ? product.pricing.monthlyCardCents : product.pricing.annualCardCents)}{group.key !== "oral" || cart.cadence === "monthly" ? "/mo" : "/yr"}</strong>}
          <button disabled={!isLoaded || !product || included || added} onClick={() => {
            if (!product) return;
            const replacing = group.key === "essentials" && cart.items.some(i => isBflSlug(i.product.slug));
            addItem(product);
            setNotice(replacing ? "Essentials added. Standalone Balance for Life was removed because it’s included." : `${group.name} added to your shared cart.`);
          }}>{included ? "Included with Essentials" : added ? "In your cart ✓" : product ? `Add ${group.name}` : "Currently unavailable"}</button>
        </article>;
      })}</div>
    </>}
    <p role="status" aria-live="polite">{notice}</p>
    <Link className={styles.checkout} href="/assurevantage/program-checkout">Review your shared cart ({cart.items.length}) →</Link>
    <p>Membership programs, not insurance.</p>
  </main>;
}
