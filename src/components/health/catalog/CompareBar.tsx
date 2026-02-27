"use client";

/**
 * COMPARE BAR COMPONENT
 * 
 * Fixed bar that appears when user has items in compare list
 * - Shows selected plans
 * - Quick remove option
 * - Compare button to go to comparison page
 * - Clear all option
 */

import { X, Scale } from "lucide-react";
import { useCart } from "@/lib/health-plans";
import styles from "./catalog.module.css";
import Link from "next/link";

interface CompareBarProps {
  products: { _id: string; name: string }[];
}

export function CompareBar({ products }: CompareBarProps) {
  const { cart, removeFromCompare, clearCompare } = useCart();
  
  if (cart.compareItems.length === 0) return null;
  
  // Get product names for compare items
  const compareProducts = cart.compareItems
    .map((id) => products.find((p) => p._id === id))
    .filter(Boolean) as { _id: string; name: string }[];
  
  return (
    <div className={styles.compareBar}>
      <Scale size={20} style={{ color: "#0066CC" }} />
      
      <div className={styles.compareBarPlans}>
        {compareProducts.map((product) => (
          <div key={product._id} className={styles.compareBarPlan}>
            {product.name}
            <button
              className={styles.compareBarPlanRemove}
              onClick={() => removeFromCompare(product._id)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      
      <Link href="/health/compare">
        <button className={styles.compareBarBtn}>
          Compare {compareProducts.length} Plans
        </button>
      </Link>
      
      <button className={styles.compareBarClear} onClick={clearCompare}>
        Clear
      </button>
    </div>
  );
}
