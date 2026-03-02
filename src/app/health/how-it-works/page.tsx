"use client";

/**
 * HOW IT WORKS PAGE
 * 
 * Explains the Ideal Health enrollment process
 * Uses health.css design system for consistent styling
 */

import Link from "next/link";
import { ArrowRight, Check, ShoppingCart, CreditCard, Settings, Shield, Unlock, Scale, DollarSign, RotateCcw, Clock, Lock } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";

const STEPS = [
  {
    number: 1,
    title: "Browse Plans",
    description: "Explore our curated health plans. No account required — browse and compare at your own pace.",
    icon: <ShoppingCart size={28} />,
  },
  {
    number: 2,
    title: "Add to Cart",
    description: "Select the plans that work for you. Choose monthly or annual billing to lock in your rate.",
    icon: <Check size={28} />,
  },
  {
    number: 3,
    title: "Checkout & Pay",
    description: "Create your account and add payment info. We process payments securely with Stripe.",
    icon: <CreditCard size={28} />,
  },
  {
    number: 4,
    title: "Activation Within 24 Hours",
    description: "Your benefits are activated within 24 hours of enrollment with no waiting periods.",
    icon: <Check size={28} />,
  },
  {
    number: 5,
    title: "Manage Anytime",
    description: "View your active plans, update payment methods, or cancel anytime from your dashboard.",
    icon: <Settings size={28} />,
  },
];

const BENEFITS = [
  { icon: Unlock, text: "No sign-up required to browse" },
  { icon: Scale, text: "Compare plans side-by-side" },
  { icon: DollarSign, text: "Transparent pricing, no hidden fees" },
  { icon: RotateCcw, text: "Cancel anytime" },
  { icon: Clock, text: "24/7 access to your benefits" },
  { icon: Lock, text: "Secure Stripe payment processing" },
];

const WHAT_IS = [
  { title: "Discount Programs", desc: "Save 20-60% on oral health, vision, and other health services at participating providers." },
  { title: "Wellness Services", desc: "Access to telehealth, coaching, and clinical support for your health goals." },
  { title: "Access Within 24 Hours", desc: "Benefits are activated within 24 hours of enrollment with no waiting periods." },
  { title: "Flexible Plans", desc: "Mix and match plans based on your needs. Cancel individual plans anytime." },
];

const WHAT_ISNT = [
  { title: "Provider Discounts Vary", desc: "Savings depend on the provider and service — discounts are not guaranteed." },
  { title: "No Claims Processing", desc: "You pay the discounted price directly at the point of service." },
];

function HowItWorksContent() {
  const { itemCount } = useCart();

  return (
    <div className="health-landing">
      <HealthHeader cartItemCount={itemCount} />
      
      {/* Hero Section */}
      <section className="section" style={{ paddingBottom: '60px' }}>
        <div className="container">
          <div className="heading-block">
            <h1 style={{ marginBottom: '16px' }}>How Ideal Health Works</h1>
            <p className="heading-block__descr" style={{ fontSize: '1.125rem', maxWidth: '700px' }}>
              Simple, transparent, and straightforward. Browse, choose, and enroll in health plans that fit your lifestyle.
            </p>
          </div>
        </div>
      </section>
      
      {/* Steps Section */}
      <section className="section bg--blue" style={{ paddingTop: '64px', paddingBottom: '64px' }}>
        <div className="container">
          <div style={{ 
            display: 'grid', 
            gap: '24px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {STEPS.map((step, index) => (
              <div 
                key={step.number}
                style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'flex-start',
                  position: 'relative'
                }}
              >
                {/* Timeline */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  flexShrink: 0,
                  width: '64px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-light))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
                  }}>
                    {step.icon}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div style={{
                      width: '2px',
                      height: '100%',
                      minHeight: '40px',
                      background: 'linear-gradient(180deg, var(--primary-blue) 0%, rgba(59, 130, 246, 0.2) 100%)',
                      marginTop: '12px'
                    }} />
                  )}
                </div>
                
                {/* Content */}
                <div style={{ 
                  flex: 1, 
                  paddingTop: '8px',
                  paddingBottom: index < STEPS.length - 1 ? '32px' : '0'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--accent-teal)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '4px'
                  }}>
                    Step {step.number}
                  </div>
                  <h3 style={{ 
                    marginBottom: '8px',
                    fontSize: '1.375rem'
                  }}>
                    {step.title}
                  </h3>
                  <p style={{ 
                    marginBottom: 0,
                    color: 'var(--text-secondary)',
                    lineHeight: '1.7'
                  }}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* What It Is / Isn't Section */}
      <section className="section" style={{ paddingTop: '80px' }}>
        <div className="container">
          <div className="heading-block">
            <h2>What These Plans Are (and Aren&apos;t)</h2>
            <p className="heading-block__descr">
              Understanding our plans helps you get the most value from your membership.
            </p>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '32px'
          }}>
            {/* What It Is */}
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Check size={24} />
                </div>
                <h3 style={{ margin: 0 }}>What You Get</h3>
              </div>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                {WHAT_IS.map((item, i) => (
                  <div key={i} style={{
                    padding: '16px',
                    background: 'rgba(20, 184, 166, 0.06)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--accent-teal)'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '1rem',
                      color: 'var(--text-primary)'
                    }}>
                      {item.title}
                    </h4>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* What It Isn't */}
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Shield size={24} />
                </div>
                <h3 style={{ margin: 0 }}>Important to Know</h3>
              </div>
              
              <div style={{ display: 'grid', gap: '16px' }}>
                {WHAT_ISNT.map((item, i) => (
                  <div key={i} style={{
                    padding: '16px',
                    background: 'rgba(245, 158, 11, 0.06)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid #f59e0b'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '1rem',
                      color: 'var(--text-primary)'
                    }}>
                      {item.title}
                    </h4>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Benefits Grid */}
      <section className="section">
        <div className="container">
          <div className="heading-block">
            <h2>Why Choose Ideal Health</h2>
          </div>
          
          <ul className="benefits__list">
            {BENEFITS.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
              <li key={i}>
                <Icon size={24} style={{ color: 'var(--accent-teal)', marginRight: '12px', display: 'inline-block' }} />
                {benefit.text}
              </li>
            );
            })}
          </ul>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section className="section bg--white">
        <div className="container">
          <div className="heading-block">
            <h2>Frequently Asked Questions</h2>
          </div>
          
          <div style={{
            display: 'grid',
            gap: '24px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {[
              {
                q: "When can I start using my benefits?",
                a: "Your plans are active immediately upon payment. All benefits and features are accessible immediately."
              },
              {
                q: "Can I cancel anytime?",
                a: "Absolutely. You can cancel your plans anytime from your dashboard. Your access continues through the end of your current billing period."
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards and bank transfers (ACH). Pay by bank to save $2/month on most plans. All payments are processed securely through Stripe."
              }
            ].map((faq, i) => (
              <div key={i} className="service">
                <h4 style={{ color: 'var(--text-primary)' }}>{faq.q}</h4>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="section" style={{ paddingBottom: '100px' }}>
        <div className="container">
          <div className="glass-card" style={{
            padding: '64px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(20, 184, 166, 0.08) 100%)'
          }}>
            <h2 style={{ marginBottom: '16px' }}>Ready to Get Started?</h2>
            <p style={{ 
              fontSize: '1.0625rem', 
              color: 'var(--text-secondary)',
              marginBottom: '32px',
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Browse our plans and find the right fit for your health goals. No commitment required.
            </p>
            <Link href="/health/plans" className="button button--primary" style={{ padding: '16px 32px' }}>
              Browse Plans
              <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <CartProvider>
      <HowItWorksContent />
    </CartProvider>
  );
}
