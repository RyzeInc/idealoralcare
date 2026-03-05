"use client";

/**
 * PLAN DETAIL PAGE
 * 
 * Full plan information using health.css design system
 * Includes: Description, inclusions, exclusions, pricing, FAQ
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, X, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";

// Extended product type for detail page with additional fields
interface DetailProduct {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  longDescription?: string;
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
  howToUse?: string[];
  faqs?: { q: string; a: string }[];
  relatedSlugs?: string[];
}

// Extended mock product data
const MOCK_PRODUCTS: Record<string, DetailProduct> = {
  "dental-savings": {
    _id: "dental-savings-1",
    slug: "dental-savings",
    name: "Oral Health Savings Plan",
    category: "dental",
    description: "AI Oral Scanning, teledentistry consultations, and access to our nationwide provider network with discount offerings.",
    longDescription: "The Oral Health Savings Plan gives you and your family immediate access to significant savings on all oral health care. Unlike traditional coverage, there are no waiting periods, no annual maximums, and no claim forms to fill out. Simply show your membership card at any participating provider and receive instant discounts on exams, cleanings, fillings, crowns, and more.",
    inclusions: [
      "AI Oral Scanning",
      "24/7 Teledentistry Consultations",
      "Access to 140,000+ Specialists Nationwide",
      "20-60% Discount on Procedures",
      "Emergency Support",
      "No Annual Maximums",
      "Cosmetic Dentistry Included",
      "Orthodontics Discounts Available",
    ],
    exclusions: [
      "Does not pay providers directly — you pay discounted rates",
      "Discounts only available at participating providers",
      "Pre-existing conditions treated same as new",
    ],
    howToUse: [
      "Use AI Oral Scanning to scan your teeth anytime",
      "Book teledentistry consultations through your dashboard",
      "Find participating dentists using the provider directory",
      "Show your digital membership card at appointments",
      "Pay the discounted rate directly to the provider",
    ],
    eligibilityRules: { requiresVerification: false, disclosureText: "Discount program." },
    activationBehavior: "immediate",
    pricing: { monthlyCardCents: 2999, monthlyACHCents: 2799, annualCardCents: 29999, annualACHCents: 27999 },
    metadata: { icon: "Smile", bestFor: ["Individuals", "Families"], image: "/health-assets/smilescan_1086x1024.jpg" },
    faqs: [
      { q: "How much can I save?", a: "Members typically save 20-60% on procedures including cleanings, fillings, crowns, and more." },
      { q: "Are there waiting periods?", a: "Your benefits are active immediately upon enrollment. Benefits are immediately available for use." },
    ],
    relatedSlugs: ["vision-care", "telehealth-unlimited"],
    isVisible: true,
    isFeatured: true,
    order: 0,
  },
  "wellness-glp": {
    _id: "wellness-glp-1",
    slug: "wellness-glp",
    name: "Wellness GLP Plan",
    category: "wellness",
    description: "24/7/365 clinical support, GLP-1 and weight management medications, personalized treatment plans, and nutrition coaching.",
    longDescription: "Our comprehensive weight management program provides everything you need to achieve your health goals. Get access to GLP-1 medications, personalized treatment plans developed by licensed clinicians, ongoing nutrition coaching, and 24/7 support from our care team.",
    inclusions: [
      "24/7/365 Clinical Support Team",
      "GLP-1 & Weight Loss Medications",
      "Personalized Treatment Plans",
      "Initial Health Assessment",
      "Lab Testing & Monitoring",
      "Nutrition & Dietary Coaching",
      "Goal Setting & Education",
      "Ongoing Provider Support",
    ],
    exclusions: [
      "Requires initial health assessment",
      "Medication costs billed separately",
      "Not suitable for everyone — clinical approval required",
      "Results vary by individual",
    ],
    howToUse: [
      "Complete your initial health assessment",
      "Schedule a consultation with our clinical team",
      "Receive your personalized treatment plan",
      "Get medications shipped to your door (if approved)",
      "Connect with your coach for ongoing support",
    ],
    eligibilityRules: { requiresVerification: true, disclosureText: "Requires health assessment. Medication eligibility determined by licensed provider." },
    activationBehavior: "verified_then_immediate",
    pricing: { monthlyCardCents: 9999, monthlyACHCents: 9799, annualCardCents: 99999, annualACHCents: 97999 },
    metadata: { icon: "Pill", bestFor: ["Weight Management", "Wellness"], image: "/health-assets/oral-health_1086x1024.jpg" },
    faqs: [
      { q: "How do I get started?", a: "After enrollment, you'll complete a health assessment. Our clinical team will review and create your personalized plan." },
      { q: "Is medication included?", a: "The plan includes clinical support and treatment planning. Medication costs are billed separately based on your prescription." },
      { q: "How soon will I see results?", a: "Results vary, but many members see progress within the first few weeks of starting their treatment plan." },
    ],
    relatedSlugs: ["telehealth-unlimited"],
    isVisible: true,
    isFeatured: true,
    order: 1,
  },
  "vision-care": {
    _id: "vision-care-1",
    slug: "vision-care",
    name: "Vision Care Plus",
    category: "vision",
    description: "Discounts on eye exams, glasses, contacts, and LASIK procedures at participating providers nationwide.",
    longDescription: "Save on all your vision needs with discounts at thousands of participating providers. Get comprehensive eye exams, prescription glasses, contact lenses, and even LASIK surgery at reduced rates.",
    inclusions: [
      "40-50% Off Eye Exams",
      "20-60% Off Frames & Lenses",
      "15-40% Off Contact Lenses",
      "LASIK Discounts Available",
      "Online Retailer Discounts",
      "No Waiting Periods",
      "Unlimited Use",
    ],
    exclusions: [
      "Discounts vary by provider",
      "Not all providers participate",
    ],
    howToUse: [
      "Find participating providers in your area",
      "Schedule your appointment",
      "Show your membership card",
      "Pay the discounted rate at checkout",
    ],
    eligibilityRules: { requiresVerification: false, disclosureText: "Discount program." },
    activationBehavior: "immediate",
    pricing: { monthlyCardCents: 1499, monthlyACHCents: 1299, annualCardCents: 14999, annualACHCents: 12999 },
    metadata: { icon: "Eye", bestFor: ["Individuals", "Families"], image: "/health-assets/talk-live_1086x1024.jpg" },
    faqs: [
      { q: "Which brands are included?", a: "Most major frame and lens brands are available through participating providers." },
      { q: "Can I use online retailers?", a: "Yes! Many online eyewear retailers participate in our discount network." },
    ],
    relatedSlugs: ["dental-savings", "telehealth-unlimited"],
    isVisible: true,
    isFeatured: false,
    order: 2,
  },
  "telehealth-unlimited": {
    _id: "telehealth-1",
    slug: "telehealth-unlimited",
    name: "Telehealth Unlimited",
    category: "telehealth",
    description: "Unlimited 24/7 virtual doctor visits for common conditions, prescriptions, and health questions.",
    longDescription: "Get medical care from the comfort of home with unlimited virtual visits. Our network of licensed physicians can diagnose common conditions, prescribe medications, and answer your health questions anytime, day or night.",
    inclusions: [
      "Unlimited Virtual Visits",
      "24/7 Availability",
      "Prescription Services",
      "Mental Health Support",
      "No Per-Visit Fees",
      "Board-Certified Physicians",
      "Quick Response Times",
    ],
    exclusions: [
      "Does not replace emergency care",
      "Some prescriptions excluded (controlled substances)",
      "Virtual care only — no in-person visits",
    ],
    howToUse: [
      "Download the telehealth app or log into your dashboard",
      "Request a visit — available 24/7",
      "Connect with a licensed physician via video or phone",
      "Get prescriptions sent to your pharmacy",
    ],
    eligibilityRules: { requiresVerification: false, disclosureText: "Virtual care only. Call 911 for emergencies." },
    activationBehavior: "immediate",
    pricing: { monthlyCardCents: 1999, monthlyACHCents: 1799, annualCardCents: 19999, annualACHCents: 17999 },
    metadata: { icon: "Smartphone", bestFor: ["Individuals", "Families"], image: "/health-assets/talk-live_1086x1024.jpg" },
    faqs: [
      { q: "What conditions can be treated?", a: "Common conditions like cold/flu, allergies, skin issues, UTIs, and more. Our doctors will refer you if needed." },
      { q: "How fast can I see a doctor?", a: "Most visits connect within minutes, 24/7/365." },
    ],
    relatedSlugs: ["dental-savings", "wellness-glp"],
    isVisible: true,
    isFeatured: false,
    order: 3,
  },
};

function PlanDetailContent({ slug }: { slug: string }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const { cart, addItem, removeItem, isInCart, itemCount } = useCart();
  
  const product = MOCK_PRODUCTS[slug];
  
  if (!product) {
    return (
      <div className="health-landing">
        <HealthHeader />
        <section className="section">
          <div className="container" style={{ textAlign: 'center' }}>
            <h1>Plan Not Found</h1>
            <p>The plan you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Link href="/health/plans" className="button button--primary" style={{ marginTop: '24px' }}>
              <ArrowLeft size={18} style={{ marginRight: '8px' }} />
              Back to Plans
            </Link>
          </div>
        </section>
      </div>
    );
  }
  
  const inCart = isInCart(product._id);
  const monthlyPrice = getPrice(product, "monthly", cart.paymentMethod);
  const annualPrice = getPrice(product, "annual", cart.paymentMethod);
  const annualSavings = (monthlyPrice * 12) - annualPrice;

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
      
      {/* Hero Section */}
      <section className="section" style={{ paddingTop: '32px', paddingBottom: '48px' }}>
        <div className="container">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 400px',
            gap: '48px',
            alignItems: 'start'
          }}>
            {/* Main Content */}
            <div>
              {/* Category & Featured Badge */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--accent-teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  background: 'rgba(20, 184, 166, 0.1)',
                  borderRadius: '100px'
                }}>
                  {product.metadata?.icon} {product.category}
                </span>
                {product.isFeatured && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '100px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#0066CC', flexShrink: 0, marginRight: '6px' }} />
                    Featured
                  </span>
                )}
              </div>
              
              <h1 style={{ marginBottom: '16px' }}>{product.name}</h1>
              <p style={{ 
                fontSize: '1.125rem', 
                color: 'var(--text-secondary)',
                marginBottom: '32px',
                lineHeight: '1.7'
              }}>
                {product.longDescription || product.description}
              </p>
              
              {/* Image */}
              {product.metadata?.image && (
                <div style={{ 
                  borderRadius: 'var(--radius-lg)', 
                  overflow: 'hidden',
                  marginBottom: '48px'
                }}>
                  <Image 
                    src={product.metadata.image} 
                    alt={product.name} 
                    width={800} 
                    height={400}
                    style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
            
            {/* Sticky Pricing Card */}
            <div className="glass-card" style={{
              position: 'sticky',
              top: '100px',
              padding: '32px'
            }}>
              <h3 style={{ marginBottom: '24px' }}>Choose Your Plan</h3>
              
              {/* Monthly Option */}
              <div 
                onClick={() => cart.cadence !== "monthly" && addItem(product)}
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: cart.cadence === "monthly" ? '2px solid var(--primary-blue)' : '1px solid var(--glass-border)',
                  background: cart.cadence === "monthly" ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Monthly</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Billed monthly</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-blue)' }}>
                      {formatPrice(monthlyPrice)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/month</div>
                  </div>
                </div>
              </div>
              
              {/* Annual Option */}
              <div 
                onClick={() => cart.cadence !== "annual" && addItem(product)}
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: cart.cadence === "annual" ? '2px solid var(--accent-teal)' : '1px solid var(--glass-border)',
                  background: cart.cadence === "annual" ? 'rgba(20, 184, 166, 0.05)' : 'transparent',
                  marginBottom: '24px',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  position: 'relative'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))',
                  color: 'white',
                  fontSize: '0.6875rem',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '100px'
                }}>
                  Save {formatPrice(annualSavings)}/yr
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Annual</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Billed yearly</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-teal)' }}>
                      {formatPrice(annualPrice)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/year</div>
                  </div>
                </div>
              </div>
              
              {/* Add/Remove Button */}
              <button
                onClick={() => inCart ? removeItem(product._id) : addItem(product)}
                className={inCart ? "button button--accent" : "button button--primary"}
                style={{ width: '100%', justifyContent: 'center', marginBottom: '16px' }}
              >
                {inCart ? (
                  <>
                    <Check size={18} style={{ marginRight: '8px' }} />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} style={{ marginRight: '8px' }} />
                    Add to Cart
                  </>
                )}
              </button>
              
              {inCart && (
                <Link 
                  href="/health/checkout" 
                  className="button button--glass"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Continue to Checkout
                </Link>
              )}
              
              {/* Disclosure */}
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '20px',
                marginBottom: 0,
                lineHeight: '1.5'
              }}>
                {product.eligibilityRules?.disclosureText}
                <br />
                Cancel anytime — access until period end.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* What You Get Section */}
      <section className="section bg--blue">
        <div className="container">
          <div className="heading-block">
            <h2>What&apos;s Included</h2>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {product.inclusions.map((item, i) => (
              <div key={i} style={{
                padding: '20px 24px',
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--accent-teal)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Check size={18} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
                <span style={{ fontWeight: '500' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* What's Not Included */}
      <section className="section">
        <div className="container">
          <div className="heading-block">
            <h2>Important Limitations</h2>
            <p className="heading-block__descr">Please review these limitations before enrolling.</p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            {product.exclusions.map((item, i) => (
              <div key={i} style={{
                padding: '20px 24px',
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <X size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* How to Use */}
      {product.howToUse && (
        <section className="section bg--white">
          <div className="container">
            <div className="heading-block">
              <h2>How to Use Your Plan</h2>
            </div>
            
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              {product.howToUse.map((step, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '20px',
                  marginBottom: i < product.howToUse!.length - 1 ? '24px' : 0
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </div>
                  <p style={{ margin: 0, paddingTop: '6px' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* FAQ Section */}
      {product.faqs && (
        <section className="section">
          <div className="container">
            <div className="heading-block">
              <h2>Frequently Asked Questions</h2>
            </div>
            
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              {product.faqs.map((faq, i) => (
                <div 
                  key={i}
                  className="glass-card"
                  style={{ 
                    marginBottom: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <div style={{
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>{faq.q}</h4>
                    {expandedFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                  {expandedFaq === i && (
                    <div style={{
                      padding: '0 24px 20px',
                      color: 'var(--text-secondary)'
                    }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* CTA Section */}
      <section className="section" style={{ paddingBottom: '100px' }}>
        <div className="container">
          <div className="glass-card" style={{
            padding: '48px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(20, 184, 166, 0.08) 100%)'
          }}>
            <h2 style={{ marginBottom: '16px' }}>Ready to Get Started?</h2>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
              Add this plan to your cart and start using your benefits today.
            </p>
            <button
              onClick={() => inCart ? removeItem(product._id) : addItem(product)}
              className={inCart ? "button button--accent" : "button button--primary"}
              style={{ padding: '16px 32px' }}
            >
              {inCart ? "Added to Cart" : "Add to Cart"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PlanDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  return (
    <CartProvider>
      <PlanDetailContent slug={slug} />
    </CartProvider>
  );
}
