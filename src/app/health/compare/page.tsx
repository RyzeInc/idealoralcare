"use client";

/**
 * COMPARE PLANS PAGE
 * 
 * Side-by-side comparison using health.css design system
 */

import Link from "next/link";
import { ArrowLeft, Check, X, ShoppingCart, Plus } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";
import type { CatalogProduct } from "@/lib/health-plans/types";
import { formatPrice, getPrice } from "@/lib/health-plans/types";

// Comparison data
const COMPARE_PRODUCTS: CatalogProduct[] = [
  {
    _id: "oral-health-individual",
    slug: "oral-health-individual",
    name: "Oral Health — Individual",
    category: "dental",
    description: "AI scanning + teledentistry + dental discounts for one member",
    inclusions: ["AI Oral Scanning", "24/7 Teledentistry", "140,000+ Dental Specialists", "20-60% Discounts", "No Waiting Period", "Same-Day Activation"],
    exclusions: ["Discount program — not insurance", "No claims processing"],
    eligibilityRules: { requiresVerification: false, disclosureText: "Discount program." },
    activationBehavior: "immediate",
    pricing: { monthlyCardCents: 1499, monthlyACHCents: 1499, annualCardCents: 16499, annualACHCents: 16499 },
    metadata: { icon: "Smile" },
    isVisible: true,
    isFeatured: true,
    order: 0,
  },
  {
    _id: "oral-health-family",
    slug: "oral-health-family",
    name: "Oral Health — Family",
    category: "dental",
    description: "AI scanning + teledentistry + dental discounts for the whole family",
    inclusions: ["Everything in Individual", "Unlimited Dependents", "AI Oral Scanning", "24/7 Teledentistry", "140,000+ Dental Specialists", "20-60% Discounts"],
    exclusions: ["Discount program — not insurance", "No claims processing"],
    eligibilityRules: { requiresVerification: false, disclosureText: "Discount program." },
    activationBehavior: "immediate",
    pricing: { monthlyCardCents: 2499, monthlyACHCents: 2499, annualCardCents: 27499, annualACHCents: 27499 },
    metadata: { icon: "Users" },
    isVisible: true,
    isFeatured: true,
    order: 1,
  },
  {
    _id: "wellness-glp-1",
    slug: "wellness-glp",
    name: "Wellness GLP",
    category: "wellness",
    description: "Weight management + clinical support (coming soon)",
    inclusions: ["24/7 Clinical Support", "GLP-1 Medications", "Treatment Plans", "Nutrition Coaching", "Lab Testing", "Provider Support"],
    exclusions: ["Requires assessment", "Medications billed separately"],
    eligibilityRules: { requiresVerification: true, disclosureText: "Requires assessment." },
    activationBehavior: "verified_then_immediate",
    pricing: { monthlyCardCents: 9999, monthlyACHCents: 9999, annualCardCents: 99999, annualACHCents: 99999 },
    metadata: { icon: "Pill" },
    isVisible: false,
    isFeatured: false,
    order: 2,
  },
];

// Comparison features
const COMPARISON_FEATURES = [
  { key: "activation", label: "Activation" },
  { key: "network", label: "Provider Network" },
  { key: "support", label: "Support Access" },
  { key: "discounts", label: "Savings Type" },
  { key: "waiting", label: "Waiting Period" },
  { key: "family", label: "Family Included" },
];

// Feature values by product
const FEATURE_VALUES: Record<string, Record<string, string | boolean>> = {
  "oral-health-individual": {
    activation: "Same Day",
    network: "140,000+ Dentists",
    support: "24/7 Teledentistry",
    discounts: "20–60% Off",
    waiting: "None",
    family: false,
  },
  "oral-health-family": {
    activation: "Same Day",
    network: "140,000+ Dentists",
    support: "24/7 Teledentistry",
    discounts: "20–60% Off",
    waiting: "None",
    family: true,
  },
  "wellness-glp-1": {
    activation: "After Assessment",
    network: "Licensed Clinicians",
    support: "24/7/365 Clinical",
    discounts: "Program Access",
    waiting: "Assessment Required",
    family: false,
  },
};

function CompareContent() {
  const { cart, addItem, removeItem, isInCart, itemCount, subtotalCents } = useCart();
  
  const periodLabel = cart.cadence === "monthly" ? "/mo" : "/yr";

  return (
    <div className="health-landing">
      <HealthHeader cartItemCount={itemCount} />
      
      {/* Breadcrumb */}
      <div className="container" style={{ paddingTop: '24px' }}>
        <Link 
          href="/health/plans" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <ArrowLeft size={16} />
          Back to Plans
        </Link>
      </div>
      
      {/* Hero */}
      <section className="section" style={{ paddingTop: '32px', paddingBottom: '48px' }}>
        <div className="container">
          <div className="heading-block">
            <h2>Compare Plans</h2>
            <p className="heading-block__descr">
              See all plans side-by-side to find the right fit for your needs.
            </p>
          </div>
        </div>
      </section>
      
      {/* Comparison Table */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                minWidth: '800px'
              }}>
                {/* Header Row - Plan Names & Prices */}
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '24px',
                      textAlign: 'left',
                      borderBottom: '1px solid rgba(0,0,0,0.08)',
                      width: '180px',
                      verticalAlign: 'bottom'
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Plans
                      </span>
                    </th>
                    {COMPARE_PRODUCTS.map((product) => {
                      const inCart = isInCart(product._id);
                      const price = getPrice(product, cart.cadence, cart.paymentMethod);
                      
                      return (
                        <th key={product._id} style={{ 
                          padding: '24px',
                          textAlign: 'center',
                          borderBottom: '1px solid rgba(0,0,0,0.08)',
                          borderLeft: '1px solid rgba(0,0,0,0.06)',
                          minWidth: '180px',
                          background: inCart ? 'rgba(20, 184, 166, 0.05)' : 'transparent'
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: '1.5rem' }}>
                            {product.metadata?.icon}
                          </div>
                          <div style={{ 
                            fontWeight: '700', 
                            fontSize: '1.125rem',
                            marginBottom: '4px',
                            color: 'var(--text-primary)'
                          }}>
                            {product.name}
                          </div>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: inCart ? 'var(--accent-teal)' : 'var(--primary-blue)',
                            marginBottom: '16px'
                          }}>
                            {formatPrice(price)}
                            <span style={{ 
                              fontSize: '0.875rem', 
                              fontWeight: '500',
                              color: 'var(--text-muted)'
                            }}>
                              {periodLabel}
                            </span>
                          </div>
                          <button
                            onClick={() => inCart ? removeItem(product._id) : addItem(product)}
                            className={inCart ? "button button--accent" : "button button--primary"}
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.8125rem',
                              width: '100%'
                            }}
                          >
                            {inCart ? (
                              <>
                                <Check size={14} style={{ marginRight: '4px' }} />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus size={14} style={{ marginRight: '4px' }} />
                                Add
                              </>
                            )}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                
                {/* Feature Rows */}
                <tbody>
                  {COMPARISON_FEATURES.map((feature, index) => (
                    <tr key={feature.key}>
                      <td style={{ 
                        padding: '16px 24px',
                        fontWeight: '500',
                        fontSize: '0.9375rem',
                        borderBottom: index < COMPARISON_FEATURES.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                        color: 'var(--text-primary)'
                      }}>
                        {feature.label}
                      </td>
                      {COMPARE_PRODUCTS.map((product) => {
                        const value = FEATURE_VALUES[product._id]?.[feature.key];
                        const inCart = isInCart(product._id);
                        
                        return (
                          <td key={product._id} style={{ 
                            padding: '16px 24px',
                            textAlign: 'center',
                            borderBottom: index < COMPARISON_FEATURES.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            borderLeft: '1px solid rgba(0,0,0,0.06)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem',
                            background: inCart ? 'rgba(20, 184, 166, 0.03)' : 'transparent'
                          }}>
                            {typeof value === 'boolean' ? (
                              value ? (
                                <Check size={18} style={{ color: 'var(--accent-teal)' }} />
                              ) : (
                                <X size={18} style={{ color: 'var(--text-muted)' }} />
                              )
                            ) : (
                              value || '—'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  
                  {/* What's Included Row */}
                  <tr>
                    <td style={{ 
                      padding: '20px 24px',
                      fontWeight: '500',
                      verticalAlign: 'top',
                      borderTop: '2px solid rgba(0,0,0,0.08)'
                    }}>
                      Key Features
                    </td>
                    {COMPARE_PRODUCTS.map((product) => {
                      const inCart = isInCart(product._id);
                      
                      return (
                        <td key={product._id} style={{ 
                          padding: '20px 24px',
                          borderLeft: '1px solid rgba(0,0,0,0.06)',
                          borderTop: '2px solid rgba(0,0,0,0.08)',
                          background: inCart ? 'rgba(20, 184, 166, 0.03)' : 'transparent'
                        }}>
                          <ul style={{ 
                            listStyle: 'none', 
                            padding: 0, 
                            margin: 0,
                            fontSize: '0.8125rem'
                          }}>
                            {product.inclusions.slice(0, 4).map((item, i) => (
                              <li key={i} style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '6px',
                                marginBottom: '8px',
                                color: 'var(--text-secondary)'
                              }}>
                                <Check size={12} style={{ 
                                  color: 'var(--accent-teal)', 
                                  flexShrink: 0,
                                  marginTop: '3px'
                                }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      
      {/* Cart Summary */}
      {itemCount > 0 && (
        <section className="section">
          <div className="container" style={{ maxWidth: '600px' }}>
            <div className="glass-card" style={{
              padding: '32px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(20, 184, 166, 0.06) 100%)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <ShoppingCart size={20} style={{ color: 'var(--primary-blue)' }} />
                <span style={{ fontWeight: '600' }}>
                  {itemCount} {itemCount === 1 ? 'plan' : 'plans'} in cart
                </span>
              </div>
              
              <div style={{ 
                fontSize: '2rem', 
                fontWeight: '700',
                color: 'var(--primary-blue)',
                marginBottom: '24px'
              }}>
                {formatPrice(subtotalCents)}
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: '500',
                  color: 'var(--text-muted)'
                }}>
                  {periodLabel}
                </span>
              </div>
              
              <Link 
                href="/health/checkout" 
                className="button button--primary"
                style={{ padding: '14px 40px' }}
              >
                Continue to Checkout
              </Link>
              
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '16px',
                marginBottom: 0
              }}>
                Cancel anytime, no hidden fees.
              </p>
            </div>
          </div>
        </section>
      )}
      
      {/* Bottom CTA */}
      <section className="section" style={{ paddingBottom: '80px' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            Need help deciding?
          </p>
          <Link href="/health/how-it-works" className="button button--glass">
            Learn How It Works
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function ComparePage() {
  return (
    <CartProvider>
      <CompareContent />
    </CartProvider>
  );
}
