"use client";

/**
 * STICKY CART COMPONENT (Right Rail)
 * 
 * Persistent cart showing:
 * - Current cadence with change option
 * - Payment method selector (Card vs ACH)
 * - Cart items with remove option
 * - Totals (due today, renewal date, recurring total)
 * - Checkout CTA
 * - Policy disclosures
 */

import { ShoppingCart, X, Calendar, CreditCard, Building2, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import styles from "./catalog.module.css";
import Link from "next/link";

export function StickyCart() {
  const {
    cart,
    itemCount,
    removeItem,
    setPaymentMethod,
    requestCadenceChange,
    subtotalCents,
    achSavingsCents,
  } = useCart();
  
  const periodLabel = cart.cadence === "monthly" ? "Monthly" : "Annual";
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + (cart.cadence === "monthly" ? 1 : 12));
  const formattedRenewal = renewalDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  
  return (
    <div className={styles.stickyCart}>
      {/* Header */}
      <div className={styles.stickyCartHeader}>
        <h2 className={styles.stickyCartTitle}>
          <ShoppingCart size={20} />
          Your Cart
          {itemCount > 0 && (
            <span className={styles.stickyCartCount}>{itemCount}</span>
          )}
        </h2>
      </div>
      
      {/* Cadence Display */}
      <div className={styles.stickyCartCadence}>
        <span className={styles.stickyCartCadenceLabel}>Billing:</span>
        <span className={styles.stickyCartCadenceValue}>{periodLabel}</span>
        <button
          className={styles.stickyCartCadenceChange}
          onClick={requestCadenceChange}
        >
          Change
        </button>
      </div>
      
      {/* Payment Method Selector */}
      <div className={styles.stickyCartPaymentMethod}>
        <span className={styles.stickyCartPaymentLabel}>Payment Method</span>
        <div className={styles.stickyCartPaymentOptions}>
          <button
            className={`${styles.stickyCartPaymentOption} ${
              cart.paymentMethod === "card" ? styles.stickyCartPaymentOptionActive : ""
            }`}
            onClick={() => setPaymentMethod("card")}
          >
            <CreditCard size={16} style={{ marginBottom: 4 }} />
            <div className={styles.stickyCartPaymentOptionLabel}>Card</div>
          </button>
          <button
            className={`${styles.stickyCartPaymentOption} ${
              cart.paymentMethod === "ach" ? styles.stickyCartPaymentOptionActive : ""
            }`}
            onClick={() => setPaymentMethod("ach")}
          >
            <Building2 size={16} style={{ marginBottom: 4 }} />
            <div className={styles.stickyCartPaymentOptionLabel}>Bank</div>
            <div className={styles.stickyCartPaymentOptionSavings}>
              Save {formatPrice(achSavingsCents > 0 ? achSavingsCents : 200)}
              {cart.cadence === "monthly" ? "/mo" : "/yr"}
            </div>
          </button>
        </div>
      </div>
      
      {/* Cart Items */}
      {itemCount === 0 ? (
        <div className={styles.stickyCartEmpty}>
          <ShoppingCart className={styles.stickyCartEmptyIcon} />
          <p>Your cart is empty</p>
          <p style={{ fontSize: "0.8125rem", marginTop: 4 }}>
            Browse plans and add what you need
          </p>
        </div>
      ) : (
        <div className={styles.stickyCartItems}>
          {cart.items.map((item) => {
            const itemPrice = getPrice(
              item.product,
              cart.cadence,
              cart.paymentMethod
            );
            return (
              <div key={item.productId} className={styles.stickyCartItem}>
                <div className={styles.stickyCartItemInfo}>
                  <span className={styles.stickyCartItemName}>
                    {item.product.name}
                  </span>
                  <span className={styles.stickyCartItemPrice}>
                    {formatPrice(itemPrice)}
                    {cart.cadence === "monthly" ? "/mo" : "/yr"}
                  </span>
                </div>
                <button
                  className={styles.stickyCartItemRemove}
                  onClick={() => removeItem(item.productId)}
                  aria-label="Remove item"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Totals */}
      {itemCount > 0 && (
        <>
          <div className={styles.stickyCartTotals}>
            <div className={styles.stickyCartTotalRow}>
              <span className={styles.stickyCartTotalLabel}>Due Today</span>
              <span className={styles.stickyCartTotalDue}>
                {formatPrice(subtotalCents)}
              </span>
            </div>
            <div className={styles.stickyCartTotalRow}>
              <span className={styles.stickyCartTotalLabel}>Recurring Total</span>
              <span className={styles.stickyCartTotalValue}>
                {formatPrice(subtotalCents)}
                {cart.cadence === "monthly" ? "/mo" : "/yr"}
              </span>
            </div>
          </div>
          
          {/* Renewal Info */}
          <div className={styles.stickyCartRenewal}>
            <Calendar size={16} />
            Renews on {formattedRenewal}
          </div>
          
          {/* Checkout Button */}
          <Link href="/health/checkout" style={{ textDecoration: "none" }}>
            <button className={styles.stickyCartCheckoutBtn}>
              Checkout
              <ArrowRight size={18} />
            </button>
          </Link>
        </>
      )}
      
      {itemCount === 0 && (
        <button className={styles.stickyCartCheckoutBtn} disabled>
          Checkout
          <ArrowRight size={18} />
        </button>
      )}
      
      {/* Disclosure */}
      <p className={styles.stickyCartDisclosure}>
        Cancel a plan anytime — keeps access through period end.
        <br />
        <strong>Not insurance.</strong>
      </p>
    </div>
  );
}
