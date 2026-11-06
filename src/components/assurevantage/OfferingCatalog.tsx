"use client";
import { HeartPulse, Brain, Smile, Check, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans";
import {
  formatPrice,
  getPrice,
  type CatalogProduct,
} from "@/lib/health-plans/types";
import { isEssentialsSlug, isBflSlug } from "@/convex/lib/productSlugs";
import { assureProductName, START_DATE_NOTE } from "@/lib/assure-content";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
import { MembershipPhoto } from "./MembershipPhoto";
const GROUPS = [
  {
    key: "essentials",
    icon: HeartPulse,
    name: "Essentials",
    description: "Four everyday benefits in one monthly membership.",
    items: [
      "Lyric virtual medical care",
      "Eligible QuestSelect lab services",
      "RxValet prescription savings",
      "Balance for Life included",
    ],
    match: (p: CatalogProduct) => isEssentialsSlug(p.slug),
    href: "essentials",
  },
  {
    key: "bfl",
    icon: Brain,
    name: "Balance for Life",
    description: "Mental wellbeing support on its own.",
    items: [
      "Short-term counseling under program terms",
      "Live support and wellbeing resources",
      "Zenn in the Balance for Life app",
      "Already included with Essentials",
    ],
    match: (p: CatalogProduct) => isBflSlug(p.slug),
    href: "balance-for-life",
  },
  {
    key: "oral",
    icon: Smile,
    name: "Oral Care",
    description: "Oral health benefits, purchased separately.",
    items: [
      "AI oral screening",
      "Virtual dental consultations",
      "Participating dental network discounts",
      "Choose alone or add to another membership",
    ],
    match: (p: CatalogProduct) => p.category === "dental",
    href: "oralcare",
  },
];
function tierName(p: CatalogProduct) {
  if (p.category === "dental")
    return p.slug.includes("family") ? "Family" : "Individual";
  if (isEssentialsSlug(p.slug))
    return p.slug.endsWith("employee-family")
      ? "Individual + family"
      : p.slug.endsWith("employee-spouse")
        ? "Individual + spouse"
        : p.slug.endsWith("employee-child")
          ? "Individual + child(ren)"
          : "Individual";
  return assureProductName(p.name);
}
export default function OfferingCatalog({ focus }: { focus?: "oral" }) {
  const products = useQuery(api.catalog.queries.list, {});
  const theme = useSiteThemeOptional();
  const {
    cart,
    addItem,
    isInCart,
    monthlyOnly,
    setCadence,
    isLoaded,
    syncProductPricing,
  } = useCart();
  useEffect(() => {
    if (products) syncProductPricing(products as CatalogProduct[]);
  }, [products, syncProductPricing]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const allowed = theme?.site?.allowedPlanIds;
  const visible = ((products ?? []) as CatalogProduct[]).filter(
    (p) =>
      p.isVisible !== false && (!allowed?.length || allowed.includes(p._id)),
  );
  const groups = focus ? GROUPS.filter((g) => g.key === focus) : GROUPS;
  return (
    <main>
      <section className={styles.pageHero}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Memberships & pricing</p>
          <h1>
            {focus
              ? "Find your Oral Care membership."
              : "Choose the support that fits your life."}
          </h1>
          <p className={styles.lead}>
            Compare what’s included, choose your household option and see your
            total before enrollment.
          </p>
          <p>
            Essentials includes Balance for Life. Oral Care is a separate
            purchase and adds to your total.
          </p>
          <Link href="/assurevantage/compare" className={styles.textLink}>
            Compare included benefits <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.container}>
          {products === undefined ? (
            <p role="status">Loading memberships…</p>
          ) : (
            <>
              {!monthlyOnly && (
                <div
                  className={styles.billing}
                  aria-label="Oral Care billing period"
                >
                  {(["monthly", "annual"] as const).map((cadence) => (
                    <button
                      key={cadence}
                      aria-pressed={cart.cadence === cadence}
                      onClick={() => setCadence(cadence)}
                    >
                      {cadence === "monthly" ? "Monthly" : "Annual"}
                    </button>
                  ))}
                </div>
              )}
              <p className={styles.fine}>
                {monthlyOnly
                  ? "Monthly billing applies to your selection. Essentials and Balance for Life are monthly memberships."
                  : "Monthly or annual selection applies to Oral Care. Adding Essentials or Balance for Life switches your selections to monthly billing."}
              </p>
              <div className={focus ? styles.gridTwo : styles.grid}>
                {groups.map((group) => {
                  const options = visible
                    .filter(group.match)
                    .sort((a, b) => a.order - b.order);
                  const inCart = options.find((p) => isInCart(p._id));
                  const product =
                    options.find((p) => p._id === selected[group.key]) ??
                    inCart ??
                    options[0];
                  const included =
                    group.key === "bfl" &&
                    cart.items.some((i) => isEssentialsSlug(i.product.slug));
                  const added = !!product && isInCart(product._id);
                  const cadence =
                    group.key !== "oral" ? "monthly" : cart.cadence;
                  return (
                    <article
                      className={`${styles.planCard} ${added || included ? styles.selected : ""}`}
                      data-offering={group.key}
                      key={group.key}
                    >
                      <MembershipPhoto
                        program={group.key as "essentials" | "bfl" | "oral"}
                      />
                      <span className={styles.icon}>
                        <group.icon size={25} />
                      </span>
                      <h2 style={{ fontSize: "1.7rem", margin: 0 }}>
                        {group.name}
                      </h2>
                      <p>{group.description}</p>
                      <ul className={styles.list}>
                        {group.items.map((item) => (
                          <li key={item}>
                            <Check size={16} />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/assurevantage/${group.href}`}
                        className={styles.textLink}
                      >
                        Explore {group.name} <ArrowRight size={16} />
                      </Link>
                      {options.length > 1 && (
                        <label className={styles.selectLabel}>
                          Choose your membership
                          <select
                            value={product?._id ?? ""}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [group.key]: e.target.value,
                              }))
                            }
                          >
                            {options.map((p) => (
                              <option key={p._id} value={p._id}>
                                {tierName(p)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {product && (
                        <div className={styles.price}>
                          {formatPrice(
                            getPrice(product, cadence, cart.paymentMethod),
                          )}
                          <span>{cadence === "monthly" ? "/mo" : "/yr"}</span>
                        </div>
                      )}
                      <button
                        className={styles.button}
                        disabled={!isLoaded || !product || included || added}
                        onClick={() => {
                          if (!product) return;
                          const replacing =
                            group.key === "essentials" &&
                            cart.items.some((i) => isBflSlug(i.product.slug));
                          addItem(product);
                          setNotice(
                            replacing
                              ? "Essentials added. Standalone Balance for Life was removed because it’s included."
                              : `${group.name} added to your cart.`,
                          );
                        }}
                      >
                        {included
                          ? "Included with Essentials"
                          : added
                            ? "In your cart ✓"
                            : product
                              ? `Add ${group.name}`
                              : "Currently unavailable"}
                      </button>
                      {group.key === "oral" && (
                        <p className={styles.fine}>
                          The dental discount program is not available in
                          Vermont or Washington.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
          <p role="status" aria-live="polite" className={styles.status}>
            {notice}
          </p>
          <div className={styles.actions}>
            <Link
              className={styles.button}
              href="/assurevantage/program-checkout"
            >
              Review your shared cart ({cart.items.length}){" "}
              <ArrowRight size={18} />
            </Link>
            {focus && (
              <Link
                className={styles.secondary}
                href="/assurevantage/program-plans"
              >
                All memberships
              </Link>
            )}
          </div>
          <div className={styles.notice}>
            <h3>Before you enroll</h3>
            <p>{START_DATE_NOTE}</p>
            <p>
              Membership programs, not insurance. Review your selected agreement
              for family eligibility, provider rules and cancellation rights.
              The final billing method and total are confirmed before payment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
