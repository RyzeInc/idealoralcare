"use client";

/**
 * IDEAL HEALTH PLANS - DTC SELF-SERVE CATALOG
 * 
 * Single product focused page for direct-to-consumer enrollment
 * Simplified to show only the Ideal Oral Health Plan
 * Uses health.css classes for consistent glassmorphism
 */

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Check, Loader, Heart, ArrowRight, Lock, Zap, RotateCcw, MessageCircle, Users } from "lucide-react";
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

function PlanCard({ product }: { product: CatalogProduct }) {
  const { cart, addItem, removeItem, isInCart } = useCart();
  const inCart = isInCart(product._id);
  const isFamily = product.slug?.includes('family');
  const price = getPrice(product, cart.cadence, cart.paymentMethod);
  const periodLabel = cart.cadence === "monthly" ? "/mo" : "/yr";

  return (
    <div className="glass-card" style={{
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Header with Icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8125rem',
            fontWeight: '700',
            color: isFamily ? 'var(--primary-blue)' : 'var(--accent-teal)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
            background: isFamily ? 'rgba(0, 102, 204, 0.08)' : 'rgba(20, 184, 166, 0.1)',
            padding: '6px 12px',
            borderRadius: '100px'
          }}>
            {isFamily
              ? <Users size={14} style={{ color: 'var(--primary-blue)' }} />
              : <Heart size={14} style={{ color: 'var(--accent-teal)' }} />
            }
            {isFamily ? 'Family Plan' : 'Individual Plan'}
          </div>
          <h2 style={{
            fontSize: '1.875rem',
            fontWeight: '700',
            color: '#0f172a',
            margin: '0 0 8px 0',
            lineHeight: 1.2
          }}>
            {product.name}
          </h2>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '1rem',
        lineHeight: '1.6',
        color: 'var(--text-secondary)',
        margin: 0
      }}>
        {product.description}
      </p>

      {/* Key Benefits */}
      <div>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#0f172a',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          What's Included
        </h3>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: '8px'
        }}>
          {product.inclusions.slice(0, 5).map((item, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              <Check size={16} style={{
                color: 'var(--accent-teal)',
                flexShrink: 0,
                marginTop: '2px'
              }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pricing Section */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.08)',
        paddingTop: '20px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {/* Monthly Pricing */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: cart.cadence === 'monthly' ? 'rgba(0, 102, 204, 0.06)' : 'transparent',
            border: cart.cadence === 'monthly' ? '1.5px solid rgba(0, 102, 204, 0.2)' : '1.5px solid transparent',
            transition: 'all 0.2s',
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: cart.cadence === 'monthly' ? 'var(--primary-blue)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '6px'
            }}>
              Monthly
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: cart.cadence === 'monthly' ? 'var(--primary-blue)' : '#64748b',
              lineHeight: 1
            }}>
              ${(product.pricing.monthlyCardCents / 100).toFixed(2)}
            </div>
            {isFamily && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Primary + add family members
              </div>
            )}
          </div>

          {/* Annual Pricing */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: cart.cadence === 'annual' ? 'rgba(20, 184, 166, 0.06)' : 'transparent',
            border: cart.cadence === 'annual' ? '1.5px solid rgba(20, 184, 166, 0.25)' : '1.5px solid transparent',
            transition: 'all 0.2s',
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: cart.cadence === 'annual' ? 'var(--accent-teal)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '6px'
            }}>
              Annual
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: cart.cadence === 'annual' ? 'var(--accent-teal)' : '#64748b',
              lineHeight: 1
            }}>
              ${(product.pricing.annualCardCents / 100).toFixed(2)}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--accent-teal)',
              marginTop: '4px',
              fontWeight: '600'
            }}>
              1 Month Free
            </div>
            {isFamily && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Primary + add family members
              </div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => addItem(product)}
          disabled={inCart}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: inCart
              ? 'linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))'
              : 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: inCart ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            opacity: inCart ? 1 : undefined
          }}
          onMouseEnter={(e) => {
            if (!inCart) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 102, 204, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!inCart) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {inCart ? (
            <>
              <Check size={20} />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart size={20} />
              Choose Plan
            </>
          )}
        </button>
      </div>

      {/* Disclosure */}
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        margin: 0,
        lineHeight: '1.5',
        fontStyle: 'italic'
      }}>
        {product.eligibilityRules.disclosureText}
      </p>
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
          Save 1 Month Free
        </span>
      </button>
    </div>
  );
}

function TierToggle({ tier, setTier }: { tier: "individual" | "family"; setTier: (t: "individual" | "family") => void }) {
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
        onClick={() => setTier("individual")}
        style={{
          padding: '10px 20px',
          borderRadius: 'calc(var(--radius-md) - 4px)',
          border: 'none',
          background: tier === "individual"
            ? 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))'
            : 'transparent',
          color: tier === "individual" ? 'white' : 'var(--text-secondary)',
          fontWeight: '600',
          fontSize: '0.875rem',
          cursor: 'pointer',
          transition: 'var(--transition)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <Heart size={14} />
        Individual
      </button>
      <button
        onClick={() => setTier("family")}
        style={{
          padding: '10px 20px',
          borderRadius: 'calc(var(--radius-md) - 4px)',
          border: 'none',
          background: tier === "family"
            ? 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))'
            : 'transparent',
          color: tier === "family" ? 'white' : 'var(--text-secondary)',
          fontWeight: '600',
          fontSize: '0.875rem',
          cursor: 'pointer',
          transition: 'var(--transition)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <Users size={14} />
        Family
      </button>
    </div>
  );
}

function PlansContent() {
  const { itemCount, syncProductPricing, cart, addItem, removeItem, isInCart, setReferralCode } = useCart();
  const searchParams = useSearchParams();
  const initialTier = searchParams.get("tier") === "family" ? "family" : "individual";
  const [tier, setTier] = useState<"individual" | "family">(initialTier);
  const prevTierRef = useRef<"individual" | "family" | null>(null);
  
  // Capture ?ref= referral code from URL (e.g. /health/plans?ref=SMITH2026)
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams, setReferralCode]);
  
  // Fetch products from Convex catalog
  const products = useQuery(api.catalog.queries.list, {});
  const isLoading = products === undefined;
  
  // Find all dental/oral health plans from catalog
  const oralHealthPlans = useMemo(() => {
    if (!products) return [];
    const dental = (products as any[]).filter((p) => p.category === 'dental');
    return dental.length > 0 ? dental : (products as any[]).slice(0, 1);
  }, [products]);

  // Pick the plan matching the selected tier
  const selectedPlan = useMemo(() => {
    if (oralHealthPlans.length === 0) return null;
    const familyPlan = oralHealthPlans.find((p: any) => p.slug?.includes("family"));
    const individualPlan = oralHealthPlans.find((p: any) => !p.slug?.includes("family"));
    return tier === "family" ? (familyPlan || oralHealthPlans[0]) : (individualPlan || oralHealthPlans[0]);
  }, [oralHealthPlans, tier]);

  // When tier changes, swap the cart item to the correct plan
  useEffect(() => {
    // Guard: only execute the swap when tier *actually* changed.
    // Without this, the effect re-fires whenever isInCart/removeItem/addItem
    // get new references (after every cart state update), creating an infinite loop.
    if (prevTierRef.current === tier) return;
    prevTierRef.current = tier;

    if (!selectedPlan) return;
    const otherTierPlan = oralHealthPlans.find((p: any) => 
      tier === "family" ? !p.slug?.includes("family") : p.slug?.includes("family")
    );
    if (otherTierPlan && isInCart(otherTierPlan._id)) {
      removeItem(otherTierPlan._id);
      addItem(selectedPlan);
    }
  }, [tier, selectedPlan, oralHealthPlans, isInCart, removeItem, addItem]);

  // Keep cart item pricing in sync with live Convex data
  useEffect(() => {
    if (products && (products as any[]).length > 0) {
      syncProductPricing(products as any[]);
    }
  }, [products, syncProductPricing]);

  return (
    <div className="health-landing">
      <HealthHeader cartItemCount={itemCount} />
      
      {/* Cadence Modal */}
      <CadenceModal />
      
      {/* Plan Section */}
      <section className="section bg--blue" style={{ paddingTop: '7rem', paddingBottom: '4rem' }}>
        <div className="container">
          {/* Header + Cadence Toggle */}
          <div style={{ marginBottom: '3rem' }}>
            <h1 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: '700',
              color: '#0f172a',
              margin: '0 0 0.75rem 0',
              lineHeight: '1.2'
            }}>
              Affordable Oral Health Coverage
            </h1>
            <p style={{
              fontSize: '1rem',
              color: '#475569',
              margin: '0 0 2rem 0',
              lineHeight: '1.6',
              maxWidth: '500px'
            }}>
              Access dental savings, teledentistry, and AI oral scanning. Cancel anytime.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <TierToggle tier={tier} setTier={setTier} />
              <CadenceToggle />
            </div>
          </div>
          
          {/* Plan Card */}
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              color: 'var(--text-muted)'
            }}>
              <Loader size={24} style={{ marginRight: '12px', animation: 'spin 1s linear infinite' }} />
              Loading plan...
            </div>
          ) : selectedPlan ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 400px',
              gap: '3rem',
              alignItems: 'start'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <PlanCard key={selectedPlan._id} product={selectedPlan} />
              </div>
              
              {/* Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <StickyCart />
                
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    margin: '0 0 1rem 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Why Ideal Health?
                  </h3>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {[
                      'Activation within 24 hours',
                      'No enrollment fees',
                      'Cancel anytime',
                      '24/7 support'
                    ].map((item, i) => (
                      <li key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.9375rem',
                        color: 'var(--text-secondary)'
                      }}>
                        <Check size={16} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              color: 'var(--text-muted)'
            }}>
              Plan not available at the moment.
            </div>
          )}
        </div>
      </section>
      
      {/* Trust Indicators */}
      <section className="section bg--light">
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '2rem'
          }}>
            {[
              { icon: Lock, title: 'Secure Payments', desc: 'Your payment info is encrypted and protected' },
              { icon: Zap, title: 'Access Within 24 Hours', desc: 'Your plan is activated within 24 hours of enrollment' },
              { icon: RotateCcw, title: 'Flexible Billing', desc: 'Monthly or annual — switch anytime' },
              { icon: MessageCircle, title: '24/7 Support', desc: 'We\'re here to help whenever you need us' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
              <div key={i} style={{
                padding: '24px',
                textAlign: 'center'
              }}>
                <Icon size={32} style={{ color: 'var(--primary-blue)', marginBottom: '1rem' }} />
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#0f172a',
                  margin: '0 0 0.5rem 0'
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {item.desc}
                </p>
              </div>
            );
            })}
          </div>
        </div>
      </section>
      
      {/* Footer Note */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function PlansPage() {
  return (
    <CartProvider>
      <Suspense>
        <PlansContent />
      </Suspense>
    </CartProvider>
  );
}
