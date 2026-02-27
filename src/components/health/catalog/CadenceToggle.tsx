"use client";

/**
 * CADENCE TOGGLE COMPONENT
 * 
 * Toggle switch between Monthly and Annual billing
 * Shows savings percentage for annual
 */

import { useCart } from "@/lib/health-plans";
import type { Cadence } from "@/lib/health-plans/types";
import styles from "./catalog.module.css";

export function CadenceToggle() {
  const { cart, setCadence, itemCount, requestCadenceChange } = useCart();
  
  const handleChange = (cadence: Cadence) => {
    if (itemCount > 0 && cadence !== cart.cadence) {
      // If cart has items, show warning modal
      requestCadenceChange();
    } else {
      setCadence(cadence);
    }
  };
  
  return (
    <div className={styles.cadenceToggle}>
      <button
        className={`${styles.cadenceOption} ${
          cart.cadence === "monthly" ? styles.cadenceOptionActive : ""
        }`}
        onClick={() => handleChange("monthly")}
      >
        Monthly
      </button>
      <button
        className={`${styles.cadenceOption} ${
          cart.cadence === "annual" ? styles.cadenceOptionActive : ""
        }`}
        onClick={() => handleChange("annual")}
      >
        Annual
        <span className={styles.cadenceSavings}>Save 15%</span>
      </button>
    </div>
  );
}
