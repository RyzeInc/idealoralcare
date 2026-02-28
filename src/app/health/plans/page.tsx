"use client";

/**
 * NEXUS HEALTH PLANS - CATALOG PAGE
 * 
 * Rebuilt to match existing /health design system
 * Uses health.css classes for consistent glassmorphism
 * Fetches products from Convex catalog
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Check, ArrowRight, Sparkles, Loader } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { CadenceModal } from "@/components/health/catalog";

// Extended product type for catalog page
interface CatalogProduct {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  inclusions: string[];
  exclusions: string[];
  eligibilityRules: {
    minAge?: number;
    maxAge?: number;
    requiresVerification: boolean;
    disclosureText: string;
  };
  activationBehavior: "immediate" | "next_renewal" | "verified_then_immediate";
  pricing: {
    monthlyCardCents: number;
    monthlyACHCents: number;
    annualCardCents: number;
    annualACHCents: number;
  };
  metadata?: {
    icon?: string;
    color?: string;
    bestFor?: string[];
    recommendedAddOns?: string[];
    image?: string;
  };
  isVisible: boolean;
  isFeatured: boolean;
  order: number;
}

// Products are now fetched from Convex: api.catalog.queries.list

const CATEGORIES = [
  { slug: "all", name: "All Plans" },
  { slug: "dental", name: "Oral Health" },
  { slug: "wellness", name: "Wellness" },
  { slug: "vision", name: "Vision" },
  { slug: "telehealth", name: "Telehealth" },
];

function PlanCard({ product }: { product: CatalogProduct }) {
  const { cart, addItem, removeItem, isInCart } = useCart();
  const inCart = isInCart(product._id);
  const price = getPrice(product, cart.cadence, cart.paymentMethod);
  const periodLabel = cart.cadence === "monthly" ? "/mo" : "/yr";

  return (
    <div className="related-posts__card" style={{ cursor: 'default' }}>
      {product.metadata?.image && (
        <Image 
          src={product.metadata.image} 
          alt={product.name} 
          width={400} 
          height={220}
          style={{ objectFit: 'cover' }}
        />
      )}
      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Category Tag */}
        <div style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: 'var(--accent-teal)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px'
        }}>
          <span>{product.metadata?.icon}</span>
          {product.category}
          {product.isFeatured && (
            <span style={{
              background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '100px',
              fontSize: '0.625rem',
              marginLeft: '8px'
            }}>
              <Sparkles size={10} style={{ display: 'inline', marginRight: '3px' }} />
              FEATURED
            </span>
          )}
        </div>
        
        {/* Plan Name */}
        <h4 style={{ marginBottom: '8px', fontSize: '1.25rem' }}>{product.name}</h4>
        
        {/* Description */}
        <p style={{ 
          fontSize: '0.9375rem', 
          marginBottom: '16px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          flex: 1
        }}>
          {product.description}
        </p>
        
        {/* Key Inclusions */}
        <ul style={{ 
          listStyle: 'none', 
          padding: 0, 
          margin: '0 0 20px 0',
          display: 'grid',
          gap: '6px'
        }}>
          {product.inclusions.slice(0, 3).map((item, i) => (
            <li key={i} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              <Check size={14} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
              {item}
            </li>
          ))}
        </ul>
        
        {/* Price & Actions */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0,0,0,0.06)'
        }}>
          <div>
            <span style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: 'var(--primary-blue)'
            }}>
              {formatPrice(price)}
            </span>
            <span style={{ 
              fontSize: '0.875rem', 
              color: 'var(--text-muted)',
              marginLeft: '2px'
            }}>
              {periodLabel}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link 
              href={`/health/plans/${product.slug}`}
              className="button button--glass"
              style={{ padding: '10px 16px', fontSize: '0.875rem' }}
            >
              Details
            </Link>
            <button
              onClick={() => inCart ? removeItem(product._id) : addItem(product)}
              className={inCart ? "button button--accent" : "button button--primary"}
              style={{ padding: '10px 16px', fontSize: '0.875rem' }}
            >
              {inCart ? (
                <>
                  <Check size={16} style={{ marginRight: '4px' }} />
                  Added
                </>
              ) : (
                "Add"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StickyCart() {
  const { cart, itemCount, subtotalCents, removeItem } = useCart();
  
  if (itemCount === 0) return null;
  
  const periodLabel = cart.cadence === "monthly" ? "Monthly" : "Annual";
  
  return (
    <div className="glass-card" style={{
      position: 'sticky',
      top: '100px',
      padding: '24px',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        marginBottom: '20px'
      }}>
        <ShoppingCart size={20} style={{ color: 'var(--primary-blue)' }} />
        <h4 style={{ margin: 0 }}>Your Cart</h4>
        <span style={{
          background: 'var(--primary-blue)',
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: '600',
          padding: '2px 8px',
          borderRadius: '100px',
          marginLeft: 'auto'
        }}>
          {itemCount} {itemCount === 1 ? 'plan' : 'plans'}
        </span>
      </div>
      
      {/* Cadence Badge */}
      <div style={{
        background: 'rgba(20, 184, 166, 0.1)',
        border: '1px solid rgba(20, 184, 166, 0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        marginBottom: '20px',
        fontSize: '0.875rem',
        color: 'var(--accent-teal)',
        fontWeight: '500'
      }}>
        {periodLabel} billing selected
      </div>
      
      {/* Cart Items */}
      <div style={{ marginBottom: '20px' }}>
        {cart.items.map((item) => (
          <div key={item.productId} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid rgba(0,0,0,0.06)'
          }}>
            <div>
              <div style={{ fontWeight: '500', fontSize: '0.9375rem' }}>{item.product.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {formatPrice(getPrice(
                  item.product, 
                  cart.cadence, 
                  cart.paymentMethod
                ))}
              </div>
            </div>
            <button
              onClick={() => removeItem(item.productId)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '0.8125rem'
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      
      {/* Total */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '16px',
        borderTop: '2px solid rgba(0,0,0,0.08)',
        marginBottom: '20px'
      }}>
        <span style={{ fontWeight: '600' }}>Total</span>
        <span style={{ 
          fontSize: '1.25rem', 
          fontWeight: '700',
          color: 'var(--primary-blue)'
        }}>
          {formatPrice(subtotalCents)}/{cart.cadence === "monthly" ? "mo" : "yr"}
        </span>
      </div>
      
      {/* Checkout Button */}
      <Link 
        href="/health/checkout" 
        className="button button--primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Checkout
        <ArrowRight size={18} style={{ marginLeft: '8px' }} />
      </Link>
      
      {/* Policy Note */}
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        marginTop: '16px',
        marginBottom: 0,
        lineHeight: '1.5'
      }}>
        Cancel anytime. Access continues through billing period end.
      </p>
    </div>
  );
}

function CadenceToggle() {
  const { cart, setCadence } = useCart();
  
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      padding: '4px'
    }}>
      <button
        onClick={() => setCadence("monthly")}
        style={{
          padding: '10px 20px',
          borderRadius: 'calc(var(--radius-md) - 4px)',
          border: 'none',
          background: cart.cadence === "monthly" 
            ? 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))' 
            : 'transparent',
          color: cart.cadence === "monthly" ? 'white' : 'var(--text-secondary)',
          fontWeight: '600',
          fontSize: '0.875rem',
          cursor: 'pointer',
          transition: 'var(--transition)'
        }}
      >
        Monthly
      </button>
      <button
        onClick={() => setCadence("annual")}
        style={{
          padding: '10px 20px',
          borderRadius: 'calc(var(--radius-md) - 4px)',
          border: 'none',
          background: cart.cadence === "annual" 
            ? 'linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))' 
            : 'transparent',
          color: cart.cadence === "annual" ? 'white' : 'var(--text-secondary)',
          fontWeight: '600',
          fontSize: '0.875rem',
          cursor: 'pointer',
          transition: 'var(--transition)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        Annual
        <span style={{
          background: cart.cadence === "annual" ? 'rgba(255,255,255,0.2)' : 'rgba(20, 184, 166, 0.15)',
          color: cart.cadence === "annual" ? 'white' : 'var(--accent-teal)',
          padding: '2px 8px',
          borderRadius: '100px',
          fontSize: '0.6875rem',
          fontWeight: '700'
        }}>
          Save 17%
        </span>
      </button>
    </div>
  );
}

function PlansContent() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { itemCount } = useCart();
  
  // Fetch products from Convex catalog
  const products = useQuery(api.catalog.queries.list, {});
  const isLoading = products === undefined;
  
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (selectedCategory === "all") return products;
    return products.filter((p: any) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="health-landing">
      <HealthHeader cartItemCount={itemCount} />
      
      {/* Cadence Modal */}
      <CadenceModal />
      
      {/* Hero Section */}
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="heading-block">
            <h2>Find Your Plan</h2>
            <p className="heading-block__descr">
              Browse our health plans and add what you need. Cancel anytime — keep access until period end.
            </p>
          </div>
          
          {/* Controls Row */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {/* Category Filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(cat.slug)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: selectedCategory === cat.slug 
                      ? 'var(--primary-blue)' 
                      : 'var(--glass-border)',
                    background: selectedCategory === cat.slug 
                      ? 'rgba(59, 130, 246, 0.1)' 
                      : 'var(--glass-bg)',
                    color: selectedCategory === cat.slug 
                      ? 'var(--primary-blue)' 
                      : 'var(--text-secondary)',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            
            {/* Cadence Toggle */}
            <CadenceToggle />
          </div>
        </div>
      </section>
      
      {/* Catalog Grid with Sticky Cart */}
      <section className="related-posts" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: '1440px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: '32px',
            alignItems: 'start'
          }}>
            {/* Plan Cards Grid */}
            <div className="related-posts__grid" style={{ marginBottom: 0 }}>
              {isLoading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  color: 'var(--text-muted)'
                }}>
                  <Loader size={24} style={{ marginRight: '12px', animation: 'spin 1s linear infinite' }} />
                  Loading plans...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '200px',
                  color: 'var(--text-muted)'
                }}>
                  No plans available in this category.
                </div>
              ) : (
                filteredProducts.map((product: CatalogProduct) => (
                  <PlanCard key={product._id} product={product} />
                ))
              )}
            </div>
            
            {/* Sticky Cart */}
            <StickyCart />
          </div>
        </div>
      </section>
      
      {/* Trust Strip */}
      <section className="section" style={{ paddingTop: '40px' }}>
        <div className="container">
          <div className="glass-card" style={{ 
            padding: '32px 48px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px'
          }}>
            {[
              { icon: '🔒', text: 'Secure Payments' },
              { icon: '✨', text: 'Instant Access' },
              { icon: '🔄', text: 'Cancel Anytime' },
              { icon: '💬', text: '24/7 Support' },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                fontSize: '0.9375rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer Note */}
      <section className="section" style={{ paddingTop: '24px', paddingBottom: '64px' }}>
        <div className="container">
          <p style={{ 
            textAlign: 'center', 
            fontSize: '0.8125rem', 
            color: 'var(--text-muted)',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            These plans provide discounts and access to health services. Cancel anytime — your access continues through the end of your billing period.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function PlansPage() {
  return (
    <CartProvider>
      <PlansContent />
    </CartProvider>
  );
}
