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

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { ArrowRight, Check, Loader, Heart, Smile, ShoppingCart, ChevronDown, ScanLine, Stethoscope, Phone, Video, Pill, FlaskConical, Brain } from "lucide-react";
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

const PLAN_DETAILS: Record<
  string,
  { icon: React.ReactNode; label: string; bullets: string[] }[]
> = {
  "essentials-": [
    {
      icon: <Video size={15} />,
      label: "Lyric Telehealth",
      bullets: [
        "No-Cost telehealth visits, unlimited for Virtual Primary and Urgent Care",
        "Virtual Primary Care — chronic-condition management, refills & screenings",
        "Virtual Dermatology — photo review, treatment plan within 72 hours",
        "Prescriptions sent electronically to your pharmacy",
      ],
    },
    {
      icon: <FlaskConical size={15} />,
      label: "QuestSelect Lab Services",
      bullets: [
        "No cost labs \u2014 complete blood work, panels & screenings at no cost",
        "Thousands of Quest patient service centers nationwide",
        "All at no cost \u2014 no pricing, no surprise bills",
        "Pairs with a Lyric visit for complete workups",
      ],
    },
    {
      icon: <Pill size={15} />,
      label: "RxValet Prescription Savings",
      bullets: [
        "Over 1,000 no cost Acute and Chronic Generic Medications",
        "Discounts on meds that are not included on this no-cost list",
        "GLP-1 meds starting at $249.95, lots of interest in this",
        "Discounts on Pet Medications",
      ],
    },
    {
      icon: <Brain size={15} />,
      label: "Balance for Life",
      bullets: [
        "Up to 10 no-cost counseling sessions (phone, video, or in-person)",
        "24/7 live counselor for crisis & support calls",
        "Zenn — AI mental-health companion via text, any time",
        "Tracks: Anxiety, Depression, Chronic Pain, Substance Use, Trauma & PTSD",
      ],
    },
  ],
  "oralcare-": [
    {
      icon: <ScanLine size={15} />,
      label: "AI Oral Scanning",
      bullets: [
        "Take photos with your smartphone — no appointment needed",
        "AI analyzes for signs of cavities, gum issues & wear",
        "Instant report with recommended next steps",
        "Results are informational and do not replace a clinical exam",
      ],
    },
    {
      icon: <Stethoscope size={15} />,
      label: "24/7 Teledentistry",
      bullets: [
        "Video consult with a licensed dentist any time, day or night",
        "Great for toothaches, sensitivity, broken teeth & prescriptions",
        "No waiting room — connect in minutes from your phone",
        "Dentist can send a prescription to your local pharmacy",
      ],
    },
    {
      icon: <Smile size={15} />,
      label: "Dental Discount Network",
      bullets: [
        "20\u201360% off at 100,000+ participating dentists nationwide",
        "Cleanings, X-rays, fillings, crowns, root canals & more",
        "No claim forms, no deductibles, no waiting periods",
        "Show your member card at any participating provider",
      ],
    },
    {
      icon: <Phone size={15} />,
      label: "Emergency Support",
      bullets: [
        "Same-day access to dental specialists for urgent pain",
        "Covers after-hours and weekend emergencies",
        "Team triages your situation and connects you to the right care",
        "Works alongside teledentistry for remote triage first",
      ],
    },
  ],
};

const PLAN_GROUPS = [
  {
    family: "Essentials Plan",
    slugPrefix: "essentials-",
    icon: <Heart size={18} />,
    color: "var(--primary-blue)",
    blurb:
      "Lyric Telehealth (urgent care, primary care & dermatology), RxValet prescription savings, QuestSelect lab services, and Balance for Life behavioral health support \u2014 the everyday-care bundle.",
    autoInclude: false,
  },
  {
    family: "Oral Care",
    slugPrefix: "oralcare-",
    icon: <Smile size={18} />,
    color: "#0d9488",
    blurb:
      "Dental savings at 20\u201360% off at 100,000+ participating dentists, plus hearing discounts \u2014 included with every Essentials membership.",
    autoInclude: true,
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
        padding: "14px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link href="/newideal" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <Image src="/newideal/logo.png" alt="Ideal Health" width={168} height={168} priority />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/newideal" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Overview
          </Link>
          <Link href="/newideal/essentials" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Essentials
          </Link>
          <Link href="/newideal/oralcare" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Oral Care
          </Link>
        </nav>
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
  slugPrefix,
  autoInclude = false,
}: {
  family: string;
  blurb: string;
  icon: React.ReactNode;
  color: string;
  products: any[];
  slugPrefix: string;
  autoInclude?: boolean;
}) {
  const { cart, addItem, removeItem, isInCart } = useCart();
  const [selectedSuffix, setSelectedSuffix] = useState<string>("employee");
  const [userRemoved, setUserRemoved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Track whether oral care was ever auto-added so we can detect X-button removal
  const hasBeenInCartRef = useRef(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.slug?.endsWith(selectedSuffix)),
    [products, selectedSuffix]
  );

  // Find which (if any) tier of this family is currently in the cart
  const cartProductForFamily = useMemo(
    () => products.find((p) => isInCart(p._id)),
    [products, isInCart]
  );

  // For autoInclude: detect the active essentials tier in cart and sync suffix
  const essentialsTierSuffix = useMemo(() => {
    if (!autoInclude) return null;
    const essentials = (cart.items as any[]).find((i) =>
      i.product.slug?.startsWith("essentials-")
    );
    if (!essentials) return null;
    const rawSuffix = TIERS.find((t) => essentials.product.slug?.endsWith(t.suffix))?.suffix ?? null;
    if (!rawSuffix) return null;
    // If oral care has this exact tier, use it; otherwise map multi-person → employee-family
    const hasExact = products.some((p) => p.slug?.endsWith(rawSuffix));
    if (hasExact) return rawSuffix;
    return rawSuffix === "employee" ? "employee" : "employee-family";
  }, [autoInclude, cart.items, products]);

  // Keep the selected tier in sync with essentials when autoInclude is on
  useEffect(() => {
    if (!autoInclude || !essentialsTierSuffix) return;
    if (essentialsTierSuffix !== selectedSuffix) {
      setSelectedSuffix(essentialsTierSuffix);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInclude, essentialsTierSuffix]);

  // Auto-add (opt-out logic): add product unless user explicitly removed it
  useEffect(() => {
    if (!autoInclude || userRemoved || !selectedProduct) return;
    if (cartProductForFamily?._id !== selectedProduct._id) {
      if (cartProductForFamily) removeItem(cartProductForFamily._id);
      addItem(selectedProduct);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInclude, selectedProduct?._id, userRemoved, cartProductForFamily?._id]);

  // Record when oral care first lands in cart
  useEffect(() => {
    if (autoInclude && cartProductForFamily) {
      hasBeenInCartRef.current = true;
    }
  }, [autoInclude, cartProductForFamily]);

  // Detect removal via the cart X button (cartProductForFamily becomes null externally)
  useEffect(() => {
    if (!autoInclude || userRemoved || !hasBeenInCartRef.current || cartProductForFamily) return;
    setUserRemoved(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInclude, cartProductForFamily]);

  const handleAdd = () => {
    if (!selectedProduct) return;
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

  const activeColor = autoInclude ? "#0d9488" : color;
  const headerBg = autoInclude
    ? "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)"
    : color === "var(--primary-blue)"
    ? "linear-gradient(135deg, #0066CC 0%, #3b82f6 100%)"
    : color;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Colored header */}
      <div style={{ background: headerBg, padding: "28px 28px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "white" }}>
            {icon}
          </div>
          {autoInclude && (
            <span
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 100,
                letterSpacing: "0.04em",
              }}
            >
              ✓ INCLUDED
            </span>
          )}
        </div>
        <h3
          style={{
            color: "white",
            fontSize: "1.3125rem",
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: "-0.01em",
          }}
        >
          {family}
        </h3>
        <p
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: "0.9375rem",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {blurb}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
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
          Coverage tier{autoInclude ? " — matches your Essentials selection" : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TIERS.map((tier) => {
            const product = products.find((p) => p.slug?.endsWith(tier.suffix));
            if (!product) return null;
            const price = product?.pricing?.monthlyCardCents ?? 0;
            const active = selectedSuffix === tier.suffix;
            return (
              <button
                key={tier.suffix}
                onClick={() => {
                  setSelectedSuffix(tier.suffix);
                  if (autoInclude) setUserRemoved(false);
                }}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: active ? `1.5px solid ${activeColor}` : "1.5px solid rgba(0,0,0,0.08)",
                  background: active
                    ? autoInclude
                      ? "rgba(13,148,136,0.06)"
                      : "rgba(0, 102, 204, 0.04)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: active ? activeColor : "var(--text-muted)",
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
                    color: active ? activeColor : "#0f172a",
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

      {/* Inclusions — feature names only; detail panel has the how-to */}
      {inclusions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
          {inclusions.slice(0, 6).map((item: string, i: number) => {
            // Show only the feature name (before " — ") to avoid duplicating detail panel
            const label = item.includes(" — ") ? item.split(" — ")[0] : item;
            return (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  fontSize: "0.9375rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                <Check size={16} style={{ color: activeColor, flexShrink: 0, marginTop: 2 }} />
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Expandable detail panel */}
      {PLAN_DETAILS[slugPrefix] && (
        <div>
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: activeColor,
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {detailsOpen ? "Hide how-to" : "How to use each benefit →"}
            <ChevronDown
              size={14}
              style={{
                transition: "transform 0.2s",
                transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {detailsOpen && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                border: `1px solid ${autoInclude ? "rgba(13,148,136,0.18)" : "rgba(0,102,204,0.14)"}`,
                overflow: "hidden",
              }}
            >
              {PLAN_DETAILS[slugPrefix].map((d, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    background: idx % 2 === 0 ? "rgba(0,0,0,0.015)" : "white",
                    borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: autoInclude ? "rgba(13,148,136,0.1)" : "rgba(0,102,204,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: activeColor,
                        flexShrink: 0,
                      }}
                    >
                      {d.icon}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>
                      {d.label}
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 38px", display: "grid", gap: 4 }}>
                    {d.bullets.map((b, bi) => (
                      <li key={bi} style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.5, display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ color: activeColor, marginTop: 2, flexShrink: 0 }}>·</span>
                        {b}
                      </li>
                    ))}
                  </ul>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      {autoInclude ? (
        inCart ? (
          <button
            onClick={() => { handleRemove(); setUserRemoved(true); }}
            style={{
              background: "none",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 10,
              padding: "10px 16px",
              color: "#94a3b8",
              fontSize: "0.875rem",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Remove Oral Care from package
          </button>
        ) : (
          <button
            onClick={() => { setUserRemoved(false); handleAdd(); }}
            style={{
              width: "100%",
              padding: "12px 20px",
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Check size={18} /> Add Oral Care back
          </button>
        )
      ) : (
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
      )}

      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
        {selectedProduct?.eligibilityRules?.disclosureText || "This is not insurance."}
      </p>
      </div>
    </div>
  );
}

function StickyCart() {
  const { cart, itemCount, subtotalCents, removeItem } = useCart();
  if (itemCount === 0) return null;

  return (
    <div style={{ position: "sticky", top: 100, background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.06)" }}>
      {/* Orange accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShoppingCart size={17} style={{ color: "#f97316" }} />
        </div>
        <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Your Cart</h4>
        <span
          style={{
            background: "#f97316",
            color: "white",
            fontSize: "0.6875rem",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 100,
            marginLeft: "auto",
            letterSpacing: "0.02em",
          }}
        >
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Items */}
      <div style={{ padding: "8px 0" }}>
        {cart.items.map((item) => (
          <div
            key={item.productId}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              gap: 12,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", lineHeight: 1.3 }}>{item.product.name}</div>
              <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: 2, fontWeight: 500 }}>
                {formatPrice(item.product.pricing.monthlyCardCents)}/mo
              </div>
            </div>
            <button
              onClick={() => removeItem(item.productId)}
              title="Remove"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.05)",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          background: "#fafafa",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly Total</span>
        <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "#f97316" }}>
          {formatPrice(subtotalCents)}<span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#94a3b8" }}>/mo</span>
        </span>
      </div>

      {/* Checkout button */}
      <div style={{ padding: "14px 20px 20px" }}>
        <Link
          href="/newideal/checkout"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "13px 20px",
            background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
            color: "white",
            textDecoration: "none",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: "0.9375rem",
            boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
            letterSpacing: "0.01em",
          }}
        >
          Checkout <ArrowRight size={16} />
        </Link>
        <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
          Secure checkout · Cancel anytime
        </p>
      </div>
    </div>
  );
}

export default function NewIdealPlansPage() {
  const { itemCount } = useCart();
  const products = useQuery(api.catalog.queries.list, {});
  const isLoading = products === undefined;

  const newidealProducts = useMemo(() => {
    if (!products) return [];
    return (products as any[]).filter(
      (p) => p.category === "newideal" && p.isVisible !== false
    );
  }, [products]);

  return (
    <div className="health-landing" style={{ background: "#f1f5f9" }}>
      <NewIdealHeader cartCount={itemCount} />

      <section
        style={{
          position: "relative",
          background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
          padding: "80px 0 60px",
          overflow: "hidden",
        }}
      >
        {/* Background image overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/newideal/site-files/multi-demographic.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
            opacity: 0.16,
          }}
        />
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-5%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="container" style={{ position: "relative" }}>
          <div style={{ marginBottom: "3rem" }}>
            <h1
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                fontWeight: 800,
                color: "#ffffff",
                margin: "0 0 1rem 0",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Choose your Ideal Health membership
            </h1>
            <p
              style={{
                fontSize: "1.0625rem",
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                lineHeight: 1.65,
                maxWidth: 680,
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
                      slugPrefix={group.slugPrefix}
                      products={groupProducts}
                      autoInclude={group.autoInclude}
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
