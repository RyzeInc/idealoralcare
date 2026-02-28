"use client";

/**
 * PLAN CARD COMPONENT
 * 
 * Displays a single health plan with:
 * - Plan name, category, and icon
 * - Price (dynamic based on cadence/payment method)
 * - ACH savings note
 * - Key inclusions (3 max)
 * - "Best for" tags
 * - Add to cart / Compare actions
 */

import { Check, Plus, ShoppingCart, Scale } from "lucide-react";
import { useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import type { CatalogProduct } from "@/lib/health-plans/types";
import styles from "./catalog.module.css";
import Link from "next/link";

interface PlanCardProps {
  product: CatalogProduct;
}

export function PlanCard({ product }: PlanCardProps) {
  const {
    cart,
    addItem,
    removeItem,
    isInCart,
    addToCompare,
    removeFromCompare,
    isInCompare,
  } = useCart();
  
  const inCart = isInCart(product._id);
  const inCompare = isInCompare(product._id);
  
  // Calculate prices
  const currentPrice = getPrice(product, cart.cadence, cart.paymentMethod);
  const cardPrice = getPrice(product, cart.cadence, "card");
  const achPrice = getPrice(product, cart.cadence, "ach");
  const achSavings = cardPrice - achPrice;
  
  const periodLabel = cart.cadence === "monthly" ? "/mo" : "/yr";
  
  // Get top 3 inclusions
  const topInclusions = product.inclusions.slice(0, 3);
  
  // Get best for tags
  const bestFor = product.metadata?.bestFor || [];
  
  // Category color mapping
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      dental: "rgba(59, 130, 246, 0.12)",
      wellness: "rgba(16, 185, 129, 0.12)",
      vision: "rgba(139, 92, 246, 0.12)",
      telehealth: "rgba(6, 182, 212, 0.12)",
      chronic: "rgba(239, 68, 68, 0.12)",
      rx: "rgba(245, 158, 11, 0.12)",
      coaching: "rgba(99, 102, 241, 0.12)",
    };
    return colors[category] || "rgba(100, 116, 139, 0.12)";
  };
  
  const handleCartAction = () => {
    if (inCart) {
      removeItem(product._id);
    } else {
      addItem(product);
    }
  };
  
  const handleCompareAction = () => {
    if (inCompare) {
      removeFromCompare(product._id);
    } else {
      addToCompare(product._id);
    }
  };
  
  return (
    <div className={`${styles.planCard} ${product.isFeatured ? styles.planCardFeatured : ""}`}>
      {/* Header */}
      <div className={styles.planCardHeader}>
        <div>
          <span
            className={styles.planCardCategory}
            style={{ background: getCategoryColor(product.category) }}
          >
            {product.category}
          </span>
          <h3 className={styles.planCardTitle}>{product.name}</h3>
        </div>
      </div>
      
      {/* Pricing */}
      <div className={styles.planCardPricing}>
        <span className={styles.planCardPrice}>{formatPrice(currentPrice)}</span>
        <span className={styles.planCardPeriod}>{periodLabel}</span>
      </div>
      
      {/* ACH Savings Note */}
      {cart.paymentMethod === "card" && achSavings > 0 && (
        <div className={styles.planCardACHNote}>
          Pay by bank to save {formatPrice(achSavings)}{periodLabel}
        </div>
      )}
      
      {/* Inclusions */}
      <ul className={styles.planCardInclusions}>
        {topInclusions.map((inclusion, idx) => (
          <li key={idx} className={styles.planCardInclusion}>
            <Check className={styles.planCardInclusionIcon} />
            <span>{inclusion}</span>
          </li>
        ))}
      </ul>
      
      {/* Best For Tags */}
      {bestFor.length > 0 && (
        <div className={styles.planCardBestFor}>
          {bestFor.map((tag, idx) => (
            <span key={idx} className={styles.planCardBestForTag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* Actions */}
      <div className={styles.planCardActions}>
        <button
          className={`${styles.planCardAddBtn} ${inCart ? styles.planCardAddBtnInCart : ""}`}
          onClick={handleCartAction}
        >
          {inCart ? (
            <>
              <ShoppingCart size={18} />
              In Cart
            </>
          ) : (
            <>
              <Plus size={18} />
              Add
            </>
          )}
        </button>
        
        <button
          className={`${styles.planCardCompareBtn} ${inCompare ? styles.planCardCompareBtnActive : ""}`}
          onClick={handleCompareAction}
          title="Compare"
        >
          <Scale size={18} />
        </button>
        
        <Link
          href={`/health/plans/${product.slug}`}
          className={styles.planCardSecondaryBtn}
        >
          Details
        </Link>
      </div>
    </div>
  );
}
