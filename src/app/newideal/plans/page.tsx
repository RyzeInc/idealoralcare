"use client";

/**
 * NEW IDEAL HEALTH — PLANS CATALOG
 *
 * Essentials Plan priced across 4 coverage tiers
 * (Employee, Employee + Spouse, Employee + Child, Employee + Family).
 *
 * Each tier is its own catalogProduct (slug: `essentials-employee-family` etc).
 * Picking a tier adds that specific product to the cart.
 * Monthly only — no cadence toggle.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { ArrowRight, Check, Loader, Heart, ShoppingCart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/health-plans/cart-context";
import { formatPrice } from "@/lib/health-plans/types";

type Tier = {
  suffix: string;
  label: string;
  short: string;
};

const TIERS: Tier[] = [
  { suffix: "employee", label: "Employee", short: "EE" },
  { suffix: "employee-spouse", label: "Employee + Spouse", short: "EE+SP" },
  { suffix: "employee-child", label: "Employee + Child", short: "EE+CH" },
  { suffix: "employee-family", label: "Employee + Family", short: "EE+FAM" },
];

const PLAN_GROUPS = [
  {
    family: "Essentials Plan",
    slugPrefix: "essentials-",
    icon: <Heart size={18} />,
    color: "var(--primary-blue)",
    blurb:
      "Telehealth, pharmacy savings, lab discounts, and mental wellness support \u2014 the everyday-care bundle.",
  },
];

function NewIdealHeader({ cartCount }: { cartCount: number }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "16px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/newideal/plans" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/newideal/logo.png" alt="New Ideal Health" width={40} height={40} priority />
          <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>
            New Ideal Health
          </span>
        </Link>
        <Link
          href="/newideal/checkout"
          className="button button--primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <ShoppingCart size={16} /> Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>
    </header>
  );
}

function TierPlanCard({
  family,
  blurb,
  icon,
  color,
  products,
}: {
  family: string;
  blurb: string;
  icon: React.ReactNode;
  color: string;
  products: any[];
}) {
  const { addItem, removeItem, isInCart } = useCart();
  const [selectedSuffix, setSelectedSuffix] = useState<string>("employee");

  const selectedProduct = useMemo(
    () => products.find((p) => p.slug?.endsWith(selectedSuffix)),
    [products, selectedSuffix]
  );

  // Find which (if any) tier of this family is currently in the cart
  const cartProductForFamily = useMemo(
    () => products.find((p) => isInCart(p._id)),
    [products, isInCart]
  );

  const handleAdd = () => {
    if (!selectedProduct) return;
    // Remove any other tier for this same family first (only one tier per family)
    if (cartProductForFamily && cartProductForFamily._id !== selectedProduct._id) {
      removeItem(cartProductForFamily._id);
    }
    addItem(selectedProduct);
  };

  const handleRemove = () => {
    if (cartProductForFamily) removeItem(cartProductForFamily._id);
  };

  const inCart = !!cartProductForFamily && cartProductForFamily._id === selectedProduct?._id;
  const inclusions: string[] = selectedProduct?.inclusions || [];

  return (
    <div
      className="glass-card"
      style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color,
          background: "rgba(0,0,0,0.04)",
          padding: "6px 12px",
          borderRadius: 100,
          fontSize: "0.8125rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          alignSelf: "flex-start",
        }}
      >
        {icon} {family}
      </div>

      <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--text-secondary)", margin: 0 }}>
        {blurb}
      </p>

      {/* Tier picker */}
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          Coverage tier
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TIERS.map((tier) => {
            const product = products.find((p) => p.slug?.endsWith(tier.suffix));
            const price = product?.pricing?.monthlyCardCents ?? 0;
            const active = selectedSuffix === tier.suffix;
            return (
              <button
                key={tier.suffix}
                onClick={() => setSelectedSuffix(tier.suffix)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: active ? `1.5px solid ${color}` : "1.5px solid rgba(0,0,0,0.08)",
                  background: active ? "rgba(0, 102, 204, 0.04)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: active ? color : "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {tier.label}
                </div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: active ? color : "#0f172a",
                    marginTop: 4,
                  }}
                >
                  {formatPrice(price)}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 500,
                      marginLeft: 4,
                    }}
                  >
                    /mo
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inclusions */}
      {inclusions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {inclusions.slice(0, 6).map((item: string, i: number) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: "0.9375rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <Check size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CTA */}
      <button
        onClick={inCart ? handleRemove : handleAdd}
        disabled={!selectedProduct}
        style={{
          width: "100%",
          padding: "12px 20px",
          background: inCart
            ? "linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))"
            : "linear-gradient(135deg, var(--primary-blue), var(--primary-light))",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-md)",
          fontWeight: 600,
          fontSize: "1rem",
          cursor: selectedProduct ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {inCart ? (
          <>
            <Check size={18} /> Added — click to remove
          </>
        ) : (
          <>
            <ShoppingCart size={18} /> Add {family} ({TIERS.find((t) => t.suffix === selectedSuffix)?.short})
          </>
        )}
      </button>

      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
        {selectedProduct?.eligibilityRules?.disclosureText || "This is not insurance."}
      </p>
    </div>
  );
}

function StickyCart() {
  const { cart, itemCount, subtotalCents, removeItem } = useCart();
  if (itemCount === 0) return null;

  return (
    <div className="glass-card" style={{ position: "sticky", top: 100, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <ShoppingCart size={20} style={{ color: "var(--primary-blue)" }} />
        <h4 style={{ margin: 0 }}>Your Cart</h4>
        <span
          style={{
            background: "var(--primary-blue)",
            color: "white",
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 100,
            marginLeft: "auto",
          }}
        >
          {itemCount}
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        {cart.items.map((item) => (
          <div
            key={item.productId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{item.product.name}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                {formatPrice(item.product.pricing.monthlyCardCents)}/mo
              </div>
            </div>
            <button
              onClick={() => removeItem(item.productId)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "0.8125rem",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 16,
          borderTop: "2px solid rgba(0,0,0,0.08)",
          marginBottom: 20,
        }}
      >
        <span style={{ fontWeight: 600 }}>Total</span>
        <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary-blue)" }}>
          {formatPrice(subtotalCents)}/mo
        </span>
      </div>

      <Link
        href="/newideal/checkout"
        className="button button--primary"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Checkout
        <ArrowRight size={18} style={{ marginLeft: 8 }} />
      </Link>
    </div>
  );
}

export default function NewIdealPlansPage() {
  const { itemCount } = useCart();
  const products = useQuery(api.catalog.queries.list, {});
  const isLoading = products === undefined;

  const newidealProducts = useMemo(() => {
    if (!products) return [];
    return (products as any[]).filter((p) => p.category === "newideal");
  }, [products]);

  return (
    <div className="health-landing">
      <NewIdealHeader cartCount={itemCount} />

      <section
        className="section bg--blue"
        style={{ paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div className="container">
          <div style={{ marginBottom: "3rem" }}>
            <h1
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 0.75rem 0",
                lineHeight: 1.2,
              }}
            >
              Choose your New Ideal Health membership
            </h1>
            <p
              style={{
                fontSize: "1rem",
                color: "#475569",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              Pick a plan and your coverage tier. Cancel anytime. All memberships are monthly
              and billed directly through our secure payment processor.
            </p>
          </div>

          {isLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 400,
                color: "var(--text-muted)",
              }}
            >
              <Loader
                size={24}
                style={{ marginRight: 12, animation: "spin 1s linear infinite" }}
              />
              Loading plans…
            </div>
          ) : newidealProducts.length === 0 ? (
            <div
              className="glass-card"
              style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}
            >
              <p style={{ margin: 0 }}>
                Plans are not seeded yet. Run{" "}
                <code>npx convex run admin/seedNewIdeal:seedNewIdeal</code> from the project root.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px",
                gap: "2.5rem",
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: "1.5rem" }}>
                {PLAN_GROUPS.map((group) => {
                  const groupProducts = newidealProducts.filter((p) =>
                    p.slug?.startsWith(group.slugPrefix)
                  );
                  if (groupProducts.length === 0) return null;
                  return (
                    <TierPlanCard
                      key={group.family}
                      family={group.family}
                      blurb={group.blurb}
                      icon={group.icon}
                      color={group.color}
                      products={groupProducts}
                    />
                  );
                })}
              </div>
              <div>
                <StickyCart />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
