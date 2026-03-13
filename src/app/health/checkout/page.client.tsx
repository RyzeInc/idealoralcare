"use client";

/**
 * HEALTH CHECKOUT PAGE
 * 
 * Complete checkout flow:
 * 1. Review cart items
 * 2. Confirm cadence and payment method
 * 3. Create account (if not logged in)
 * 4. Enter payment (Stripe)
 * 5. Confirm and complete
 * 
 * Follows the flow from catalog-flow-details.md:
 * - Everything summarized
 * - No surprises
 * - Clear policy acknowledgments
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
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
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { CatalogHeader } from "@/components/health/catalog";
import { MembershipAgreementModal, TermsAndConditionsModal } from "@/components/legal";
import styles from "./checkout.module.css";

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
  const [clerkTimeout, setClerkTimeout] = useState(false);
  
  // Legal modal states
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [membershipAgreed, setMembershipAgreed] = useState(false);
  const [membershipSignature, setMembershipSignature] = useState<string>("");
  
  // Fallback: if Clerk JS is blocked by CSP or slow, stop showing Loading... after 5s
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [isLoaded]);
  
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
    // 1. Create Stripe Checkout Session
    // 2. Redirect to Stripe
    // 3. On success, create subscription in Convex
    // 4. Redirect to /health/dashboard
    
    // Placeholder: simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    
    // For now, redirect to dashboard
    window.location.href = "/health/dashboard";
  };
  
  // Handle membership agreement modal acceptance
  const handleMembershipAccept = (signature: string) => {
    setMembershipSignature(signature);
    setMembershipAgreed(true);
    setAgreedToTerms(true);
    setMembershipModalOpen(false);
  };
  
  // Handle terms and conditions modal acceptance
  const handleTermsAccept = () => {
    setAgreedToNotInsurance(true);
    setTermsModalOpen(false);
  };
  
  // Handlers to open modals when user tries to interact with checkboxes
  const handleMembershipCheckboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!membershipAgreed) {
      setMembershipModalOpen(true);
    }
  };
  
  const handleTermsCheckboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!agreedToNotInsurance) {
      setTermsModalOpen(true);
    }
  };
  
  // Empty cart
  if (itemCount === 0) {
    return (
      <div className={styles.checkoutContainer}>
        <div className={styles.emptyCart}>
          <ShoppingCart className={styles.emptyCartIcon} />
          <h2 className={styles.emptyCartTitle}>Your cart is empty</h2>
          <p className={styles.emptyCartText}>
            Browse our health plans and add what you need.
          </p>
          <Link href="/health/plans" className={styles.emptyCartCta}>
            Browse Plans
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.checkoutContainer}>
      {/* Header */}
      <div className={styles.checkoutHeader}>
        <Link href="/health/plans" className={styles.backLink}>
          <ArrowLeft size={18} />
          Back to Plans
        </Link>
        <h1 className={styles.checkoutTitle}>Checkout</h1>
        <p className={styles.checkoutSubtitle}>
          Review your order and complete your purchase
        </p>
      </div>
      
      <div className={styles.checkoutGrid}>
        {/* Left Column: Steps */}
        <div className={styles.checkoutMain}>
          {/* Step 1: Review Order */}
          <div className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNumber}>1</span>
              <h2 className={styles.cardTitle}>Review Your Order</h2>
            </div>
            
            <div className={styles.orderItems}>
              {cart.items.map((item) => {
                const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
                return (
                  <div key={item.productId} className={styles.orderItem}>
                    <div className={styles.orderItemInfo}>
                      <span className={styles.orderItemCategory}>{item.product.category}</span>
                      <span className={styles.orderItemName}>{item.product.name}</span>
                    </div>
                    <div className={styles.orderItemPrice}>
                      <span>{formatPrice(itemPrice)}{periodShort}</span>
                      <button 
                        className={styles.orderItemRemove}
                        onClick={() => removeItem(item.productId)}
                        aria-label="Remove"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Cadence Info */}
            <div className={styles.billingInfo}>
              <div className={styles.billingRow}>
                <span className={styles.billingLabel}>Billing Cycle</span>
                <span className={styles.billingValue}>{periodLabel}</span>
              </div>
              <div className={styles.billingRow}>
                <span className={styles.billingLabel}>Renews On</span>
                <span className={styles.billingValue}>{formattedRenewal}</span>
              </div>
            </div>
          </div>
          
          {/* Step 2: Payment Method */}
          <div className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNumber}>2</span>
              <h2 className={styles.cardTitle}>Payment Method</h2>
            </div>
            
            <div className={styles.paymentOptions}>
              <button
                className={`${styles.paymentOption} ${
                  cart.paymentMethod === "card" ? styles.paymentOptionActive : ""
                }`}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className={styles.paymentOptionIcon} />
                <div className={styles.paymentOptionContent}>
                  <span className={styles.paymentOptionTitle}>Credit/Debit Card</span>
                </div>
                {cart.paymentMethod === "card" && (
                  <Check className={styles.paymentOptionCheck} />
                )}
              </button>
              
              <button
                className={`${styles.paymentOption} ${
                  cart.paymentMethod === "ach" ? styles.paymentOptionActive : ""
                }`}
                onClick={() => setPaymentMethod("ach")}
              >
                <Building2 className={styles.paymentOptionIcon} />
                <div className={styles.paymentOptionContent}>
                  <span className={styles.paymentOptionTitle}>Bank Transfer (ACH)</span>
                  <span className={styles.paymentOptionSavings}>
                    ACH Discount: Save {formatPrice(achSavings)}{periodShort}
                  </span>
                </div>
                {cart.paymentMethod === "ach" && (
                  <Check className={styles.paymentOptionCheck} />
                )}
              </button>
            </div>
          </div>
          
          {/* Step 3: Account */}
          <div className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNumber}>3</span>
              <h2 className={styles.cardTitle}>Account</h2>
            </div>
            
            {!isLoaded && !clerkTimeout ? (
              <div className={styles.accountLoading}>Loading...</div>
            ) : isSignedIn ? (
              <div className={styles.accountInfo}>
                <div className={styles.accountAvatar}>
                  {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]}
                </div>
                <div className={styles.accountDetails}>
                  <span className={styles.accountName}>
                    {user?.fullName || "Account"}
                  </span>
                  <span className={styles.accountEmail}>
                    {user?.emailAddresses[0]?.emailAddress}
                  </span>
                </div>
                <Check className={styles.accountCheck} />
              </div>
            ) : (
              <div className={styles.accountSignup}>
                <p className={styles.accountSignupText}>
                  Create an account or sign in to complete your purchase
                </p>
                <div className={styles.accountSignupButtons}>
                  <Link
                    href="/health/sign-up"
                    className={styles.signupBtn}
                    style={{ textDecoration: "none", display: "inline-block" }}
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/health/sign-in"
                    className={styles.signinBtn}
                    style={{ textDecoration: "none", display: "inline-block" }}
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
          
          {/* Step 4: Confirm */}
          <div className={styles.checkoutCard}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNumber}>4</span>
              <h2 className={styles.cardTitle}>Confirm & Pay</h2>
            </div>
            
            {/* Agreements */}
            <div className={styles.agreements}>
              {/* Membership Agreement Modal Trigger */}
              <div
                className={styles.agreement}
                onClick={handleMembershipCheckboxClick}
                style={{ cursor: "pointer", position: "relative" }}
              >
                <input
                  type="checkbox"
                  checked={membershipAgreed}
                  readOnly
                  className={styles.agreementCheckbox}
                  style={{ cursor: "pointer" }}
                />
                <span className={styles.agreementText}>
                  I understand that I will be billed {formatPrice(totalDueToday)} today 
                  and {formatPrice(totalDueToday)}{periodShort} on renewal. I can cancel 
                  anytime and keep access until the end of my billing period.
                  {!membershipAgreed && (
                    <span style={{ display: "block", fontSize: "0.85rem", color: "#14b8a6", marginTop: "0.5rem", fontWeight: 500 }}>
                      ✓ Click to review and sign agreement
                    </span>
                  )}
                </span>
              </div>
              
              {/* Terms and Conditions Modal Trigger */}
              <div
                className={styles.agreement}
                onClick={handleTermsCheckboxClick}
                style={{ cursor: "pointer", position: "relative" }}
              >
                <input
                  type="checkbox"
                  checked={agreedToNotInsurance}
                  readOnly
                  className={styles.agreementCheckbox}
                  style={{ cursor: "pointer" }}
                />
                <span className={styles.agreementText}>
                  <strong>I understand this is NOT insurance.</strong> These plans provide 
                  discounts and access to services, not insurance coverage.
                  {!agreedToNotInsurance && (
                    <span style={{ display: "block", fontSize: "0.85rem", color: "#14b8a6", marginTop: "0.5rem", fontWeight: 500 }}>
                      ✓ Click to review and accept terms
                    </span>
                  )}
                </span>
              </div>
            </div>
            

          </div>
        </div>
        
        {/* Right Column: Order Summary */}
        <div className={styles.checkoutSidebar}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Order Summary</h3>
            
            {/* Items */}
            <div className={styles.summaryItems}>
              {cart.items.map((item) => {
                const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
                return (
                  <div key={item.productId} className={styles.summaryItem}>
                    <span className={styles.summaryItemName}>{item.product.name}</span>
                    <span className={styles.summaryItemPrice}>
                      {formatPrice(itemPrice)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* ACH Savings Banner */}
            {cart.paymentMethod === "ach" && achSavings > 0 && (
              <div className={styles.savingsBanner}>
                ACH discount: You&apos;re saving {formatPrice(achSavings)}{periodShort}!
              </div>
            )}
            
            {/* Totals */}
            <div className={styles.summaryTotals}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              {cart.paymentMethod === "ach" && achSavings > 0 && (
                <div className={styles.summaryRow} style={{ color: "#16a34a" }}>
                  <span>ACH Discount</span>
                  <span>-{formatPrice(achSavings)}</span>
                </div>
              )}
              <div className={styles.summaryRowTotal}>
                <span>Due Today</span>
                <span>{formatPrice(totalDueToday)}</span>
              </div>
            </div>
            
            {/* Renewal Info */}
            <div className={styles.renewalInfo}>
              <Calendar size={18} />
              <div>
                <span className={styles.renewalLabel}>Renews on</span>
                <span className={styles.renewalDate}>{formattedRenewal}</span>
              </div>
            </div>
            
            {/* Complete Button */}
            <button
              className={styles.completeBtn}
              disabled={!isSignedIn || !agreedToTerms || !agreedToNotInsurance || isProcessing}
              onClick={handleCheckout}
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
            <p className={styles.pricingNote}>
              Prices shown reflect your selected payment method.
            </p>
            
            {/* Security Note */}
            <div className={styles.securityNote}>
              <Shield size={16} />
              <span>256-bit SSL encrypted. Your information is secure.</span>
            </div>
            
            {/* Cancellation Policy */}
            <p className={styles.cancellationPolicy}>
              Cancel anytime. You&apos;ll keep access until the end of your billing period.
              <strong> This is not insurance.</strong>
            </p>
          </div>
        </div>
      </div>
      
      {/* Legal Modal Components */}
      <MembershipAgreementModal
        isOpen={membershipModalOpen}
        onClose={() => setMembershipModalOpen(false)}
        onAccept={handleMembershipAccept}
        memberData={{
          memberId: user?.id || "TBD",
          memberName: user?.fullName || user?.emailAddresses[0]?.emailAddress || "Member",
          memberAddress: "Address TBD",
          email: user?.emailAddresses[0]?.emailAddress || "email@example.com",
          planName: cart.items[0]?.product?.name || "Ideal Oral Health Plan",
          groupCode: "IOHP",
          effectiveDate: new Date().toISOString().split('T')[0],
        }}
      />
      
      <TermsAndConditionsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={handleTermsAccept}
      />
    </div>
  );
}

export default function CheckoutPageClient() {
  return (
    <CartProvider>
      <CatalogHeader />
      <CheckoutContent />
    </CartProvider>
  );
}
