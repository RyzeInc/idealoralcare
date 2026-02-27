"use client";

/**
 * HEALTH CHECKOUT PAGE
 * 
 * Complete checkout flow using health.css design system:
 * 1. Review cart items
 * 2. Select payment method  
 * 3. Create account (if not logged in)
 * 4. Confirm and complete purchase
 */

import { useState } from "react";
import Link from "next/link";
import { useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import { 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  Check, 
  Lock, 
  Calendar, 
  ShoppingCart,
  ChevronRight,
  Shield,
  X
} from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { CadenceModal } from "@/components/health/catalog";
import "@/app/health/health.css";

function CheckoutContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { 
    cart, 
    itemCount, 
    subtotalCents, 
    setPaymentMethod,
    removeItem 
  } = useCart();
  
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNotInsurance, setAgreedToNotInsurance] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const periodLabel = cart.cadence === "monthly" ? "Monthly" : "Annual";
  const periodShort = cart.cadence === "monthly" ? "/mo" : "/yr";
  
  // Calculate renewal date
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + (cart.cadence === "monthly" ? 1 : 12));
  const formattedRenewal = renewalDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  
  // Calculate ACH savings
  const cardTotal = cart.items.reduce((sum, item) => {
    return sum + getPrice(item.product, cart.cadence, "card");
  }, 0);
  const achTotal = cart.items.reduce((sum, item) => {
    return sum + getPrice(item.product, cart.cadence, "ach");
  }, 0);
  const achSavings = cardTotal - achTotal;
  
  // Calculate actual total (subtotal is always card price, then apply ACH discount if applicable)
  const totalDueToday = cart.paymentMethod === "ach" ? achTotal : cardTotal;
  
  const handleCheckout = async () => {
    if (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) return;
    
    setIsProcessing(true);
    // TODO: Implement Stripe checkout
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    window.location.href = "/health/dashboard";
  };
  
  // Empty cart state
  if (itemCount === 0) {
    return (
      <div className="health-landing">
        <HealthHeader />
        
        <section className="section bg--white" style={{ paddingTop: "8rem", minHeight: "70vh" }}>
          <div className="container" style={{ textAlign: "center", maxWidth: "500px" }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0066CC20, #14b8a620)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem"
            }}>
              <ShoppingCart size={36} color="#0066CC" />
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#0f172a" }}>
              Your cart is empty
            </h2>
            <p style={{ color: "#64748b", marginBottom: "2rem", lineHeight: 1.7 }}>
              Browse our health plans and add what you need to get started.
            </p>
            <Link href="/health/plans" className="button button--primary">
              Browse Plans
            </Link>
          </div>
        </section>
      </div>
    );
  }
  
  return (
    <div className="health-landing">
      <HealthHeader />
      
      {/* Cadence Modal */}
      <CadenceModal />
      
      {/* Hero Section */}
      <section className="section bg--blue" style={{ paddingTop: "7rem", paddingBottom: "2rem" }}>
        <div className="container">
          <Link 
            href="/health/plans" 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "0.5rem",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              marginBottom: "1rem",
              fontSize: "0.9375rem"
            }}
          >
            <ArrowLeft size={18} />
            Back to Plans
          </Link>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
            Checkout
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem" }}>
            Review your order and complete your purchase
          </p>
        </div>
      </section>
      
      {/* Main Checkout Grid */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "1200px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 400px",
            gap: "2.5rem",
            alignItems: "start"
          }}>
            
            {/* Left Column - Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Step 1: Review Order */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>1</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Review Your Order
                  </h2>
                </div>
                
                {/* Order Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {cart.items.map((item) => {
                    const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
                    return (
                      <div key={item.productId} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        background: "#f8fafc",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <div>
                          <span style={{ 
                            display: "block",
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "#0066CC",
                            marginBottom: "0.25rem"
                          }}>
                            {item.product.category}
                          </span>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>
                            {item.product.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ fontWeight: 700, color: "#0066CC" }}>
                            {formatPrice(itemPrice)}{periodShort}
                          </span>
                          <button
                            onClick={() => removeItem(item.productId)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#94a3b8",
                              padding: "4px",
                              borderRadius: "6px",
                              transition: "all 0.2s"
                            }}
                            aria-label="Remove item"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Billing Info */}
                <div style={{ 
                  marginTop: "1.5rem", 
                  paddingTop: "1.5rem", 
                  borderTop: "1px solid #e2e8f0",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem"
                }}>
                  <div>
                    <span style={{ fontSize: "0.875rem", color: "#64748b", display: "block" }}>Billing Cycle</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{periodLabel}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.875rem", color: "#64748b", display: "block" }}>Renews On</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{formattedRenewal}</span>
                  </div>
                </div>
              </div>
              
              {/* Step 2: Payment Method */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>2</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Payment Method
                  </h2>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Card Option */}
                  <button
                    onClick={() => setPaymentMethod("card")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      border: cart.paymentMethod === "card" 
                        ? "2px solid #0066CC" 
                        : "1px solid #e2e8f0",
                      background: cart.paymentMethod === "card" 
                        ? "linear-gradient(135deg, #0066CC08, #14b8a608)" 
                        : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left"
                    }}
                  >
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <CreditCard size={22} color="#64748b" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        Credit/Debit Card
                      </span>
                    </div>
                    {cart.paymentMethod === "card" && (
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#0066CC",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Check size={14} color="#fff" />
                      </div>
                    )}
                  </button>
                  
                  {/* ACH Option */}
                  <button
                    onClick={() => setPaymentMethod("ach")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      border: cart.paymentMethod === "ach" 
                        ? "2px solid #14b8a6" 
                        : "1px solid #e2e8f0",
                      background: cart.paymentMethod === "ach" 
                        ? "linear-gradient(135deg, #14b8a608, #0066CC08)" 
                        : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left"
                    }}
                  >
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#f0fdfa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Building2 size={22} color="#14b8a6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        Bank Transfer (ACH)
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "#14b8a6", fontWeight: 600 }}>
                        ACH Discount: Save {formatPrice(achSavings)}{periodShort}
                      </span>
                    </div>
                    {cart.paymentMethod === "ach" && (
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#14b8a6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Check size={14} color="#fff" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Step 3: Account */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>3</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Account
                  </h2>
                </div>
                
                {!isLoaded ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                    Loading...
                  </div>
                ) : isSignedIn ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "1rem",
                    background: "#f0fdf4",
                    borderRadius: "12px",
                    border: "1px solid #bbf7d0"
                  }}>
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #0066CC, #14b8a6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1.125rem"
                    }}>
                      {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        {user?.fullName || "Account"}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {user?.emailAddresses[0]?.emailAddress}
                      </span>
                    </div>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Check size={16} color="#fff" />
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "1.5rem" }}>
                    <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
                      Create an account or sign in to complete your purchase
                    </p>
                    <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                      <SignUpButton 
                        mode="modal"
                        appearance={{
                          elements: {
                            modalContent: "rounded-2xl",
                            card: "shadow-2xl rounded-2xl",
                            headerTitle: "text-xl font-bold text-slate-900",
                            headerSubtitle: "text-slate-600",
                            formButtonPrimary: 
                              "bg-gradient-to-r from-[#0066CC] to-[#0052a3] hover:from-[#0052a3] hover:to-[#003d7a] text-white font-semibold py-3 rounded-xl transition-all duration-200",
                            formFieldInput: 
                              "rounded-xl border-slate-200 focus:border-[#0066CC] focus:ring-[#0066CC]/20",
                            footerActionLink: "text-[#0066CC] hover:text-[#0052a3] font-semibold",
                            socialButtonsBlockButton: 
                              "border-slate-200 hover:bg-slate-50 rounded-xl transition-all",
                          },
                        }}
                      >
                        <button className="button button--primary">
                          Create Account
                        </button>
                      </SignUpButton>
                      <SignInButton 
                        mode="modal"
                        appearance={{
                          elements: {
                            modalContent: "rounded-2xl",
                            card: "shadow-2xl rounded-2xl",
                            headerTitle: "text-xl font-bold text-slate-900",
                            headerSubtitle: "text-slate-600",
                            formButtonPrimary: 
                              "bg-gradient-to-r from-[#0066CC] to-[#0052a3] hover:from-[#0052a3] hover:to-[#003d7a] text-white font-semibold py-3 rounded-xl transition-all duration-200",
                            formFieldInput: 
                              "rounded-xl border-slate-200 focus:border-[#0066CC] focus:ring-[#0066CC]/20",
                            footerActionLink: "text-[#0066CC] hover:text-[#0052a3] font-semibold",
                            socialButtonsBlockButton: 
                              "border-slate-200 hover:bg-slate-50 rounded-xl transition-all",
                          },
                        }}
                      >
                        <button className="button button--glass">
                          Sign In
                        </button>
                      </SignInButton>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Step 4: Confirm */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>4</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Confirm & Pay
                  </h2>
                </div>
                
                {/* Agreements */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <label style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: agreedToTerms ? "#f0fdf4" : "transparent",
                    transition: "background 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      I understand that I will be billed <strong>{formatPrice(totalDueToday)}</strong> today 
                      and {formatPrice(totalDueToday)}{periodShort} on renewal. I can cancel 
                      anytime and keep access until the end of my billing period.
                    </span>
                  </label>
                  
                  <label style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: agreedToNotInsurance ? "#fef3c7" : "transparent",
                    transition: "background 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={agreedToNotInsurance}
                      onChange={(e) => setAgreedToNotInsurance(e.target.checked)}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      <strong style={{ color: "#d97706" }}>I understand this is NOT insurance.</strong> These plans provide 
                      discounts and access to services, not insurance coverage.
                    </span>
                  </label>
                </div>
                
                {/* Secure Payment Note */}
                {isSignedIn && agreedToTerms && agreedToNotInsurance && (
                  <div style={{
                    marginTop: "1.5rem",
                    padding: "1rem",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem"
                  }}>
                    <Lock size={20} color="#64748b" />
                    <div>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>
                        Secure payment powered by Stripe
                      </span>
                      <span style={{ display: "block", fontSize: "0.8125rem", color: "#94a3b8", marginTop: "2px" }}>
                        Payment integration coming soon. For demo, click Complete Purchase.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Column - Order Summary */}
            <div style={{ position: "sticky", top: "100px" }}>
              <div className="glass-card" style={{ 
                padding: "2rem",
                background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))"
              }}>
                <h3 style={{ 
                  fontSize: "1.25rem", 
                  fontWeight: 700, 
                  marginBottom: "1.5rem",
                  color: "#0f172a" 
                }}>
                  Order Summary
                </h3>
                
                {/* Items List */}
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.75rem",
                  paddingBottom: "1.25rem",
                  borderBottom: "1px solid #e2e8f0"
                }}>
                  {cart.items.map((item) => {
                    const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
                    return (
                      <div key={item.productId} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ color: "#475569" }}>{item.product.name}</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>
                          {formatPrice(itemPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* ACH Savings Banner */}
                {cart.paymentMethod === "ach" && achSavings > 0 && (
                  <div style={{
                    margin: "1rem 0",
                    padding: "0.75rem 1rem",
                    background: "linear-gradient(135deg, #f0fdfa, #ecfdf5)",
                    borderRadius: "10px",
                    border: "1px solid #99f6e4",
                    textAlign: "center",
                    fontSize: "0.9375rem",
                    color: "#0d9488",
                    fontWeight: 600
                  }}>
                    💰 ACH discount: You're saving {formatPrice(achSavings)}{periodShort}!
                  </div>
                )}
                
                {/* Totals */}
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Subtotal</span>
                    <span style={{ color: "#0f172a" }}>{formatPrice(subtotalCents)}</span>
                  </div>
                  {cart.paymentMethod === "ach" && achSavings > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#16a34a" }}>ACH Discount</span>
                      <span style={{ color: "#16a34a" }}>-{formatPrice(achSavings)}</span>
                    </div>
                  )}
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    paddingTop: "0.75rem",
                    borderTop: "2px solid #0066CC",
                    marginTop: "0.5rem"
                  }}>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Due Today</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0066CC" }}>
                      {formatPrice(totalDueToday)}
                    </span>
                  </div>
                </div>
                
                {/* Renewal Info */}
                <div style={{
                  marginTop: "1.5rem",
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem"
                }}>
                  <Calendar size={20} color="#64748b" />
                  <div>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Renews on
                    </span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{formattedRenewal}</span>
                  </div>
                </div>
                
                {/* Complete Button */}
                <button
                  onClick={handleCheckout}
                  disabled={!isSignedIn || !agreedToTerms || !agreedToNotInsurance || isProcessing}
                  className="button button--primary"
                  style={{
                    width: "100%",
                    marginTop: "1.5rem",
                    padding: "1rem 1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    opacity: (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) ? 0.5 : 1,
                    cursor: (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) ? "not-allowed" : "pointer"
                  }}
                >
                  {isProcessing ? (
                    "Processing..."
                  ) : (
                    <>
                      Complete Purchase
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
                
                {/* Pricing Clarification */}
                <p style={{
                  marginTop: "0.75rem",
                  textAlign: "center",
                  fontSize: "0.8125rem",
                  color: "#64748b"
                }}>
                  Prices shown reflect your selected payment method.
                </p>
                
                {/* Security Note */}
                <div style={{
                  marginTop: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  color: "#94a3b8",
                  fontSize: "0.8125rem"
                }}>
                  <Shield size={14} />
                  <span>256-bit SSL encrypted. Your information is secure.</span>
                </div>
                
                {/* Cancellation Policy */}
                <p style={{
                  marginTop: "1rem",
                  textAlign: "center",
                  fontSize: "0.8125rem",
                  color: "#64748b",
                  lineHeight: 1.6
                }}>
                  Cancel anytime. You'll keep access until the end of your billing period.
                  <strong style={{ color: "#d97706" }}> This is not insurance.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Trust Section */}
      <section className="section bg--light" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        <div className="container" style={{ maxWidth: "800px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "3rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <Shield size={20} />
              <span>Secure Checkout</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <Lock size={20} />
              <span>SSL Encrypted</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <CreditCard size={20} />
              <span>Multiple Payment Options</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
}
