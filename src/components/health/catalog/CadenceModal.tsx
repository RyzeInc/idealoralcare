"use client";

/**
 * CADENCE SELECTION MODAL
 * 
 * Shown on first cart add to lock cadence:
 * - Monthly option
 * - Annual option (with savings badge)
 * - Explanation of what this means
 * - Confirm button
 */

import { useCart } from "@/lib/health-plans";
import type { Cadence } from "@/lib/health-plans/types";
import styles from "./catalog.module.css";

export function CadenceModal() {
  const { cart, showCadenceModal, setCadence, confirmCadence } = useCart();
  
  if (!showCadenceModal) return null;
  
  const handleSelect = (cadence: Cadence) => {
    setCadence(cadence);
  };
  
  return (
    <div className={styles.cadenceModal}>
      <div className={styles.cadenceModalContent}>
        <h2 className={styles.cadenceModalTitle}>Choose Billing Cadence</h2>
        <p className={styles.cadenceModalDescription}>
          Select how often you'd like to be billed. All plans in your cart will use the same billing cycle.
        </p>
        
        <div className={styles.cadenceModalOptions}>
          {/* Monthly Option */}
          <button
            className={`${styles.cadenceModalOption} ${
              cart.cadence === "monthly" ? styles.cadenceModalOptionActive : ""
            }`}
            onClick={() => handleSelect("monthly")}
          >
            <div className={styles.cadenceModalOptionHeader}>
              <span className={styles.cadenceModalOptionTitle}>Monthly</span>
            </div>
            <p className={styles.cadenceModalOptionDescription}>
              Pay month-to-month with maximum flexibility
            </p>
          </button>
          
          {/* Annual Option */}
          <button
            className={`${styles.cadenceModalOption} ${
              cart.cadence === "annual" ? styles.cadenceModalOptionActive : ""
            }`}
            onClick={() => handleSelect("annual")}
          >
            <div className={styles.cadenceModalOptionHeader}>
              <span className={styles.cadenceModalOptionTitle}>Annual</span>
              <span className={styles.cadenceModalOptionSavings}>1 Month Free</span>
            </div>
            <p className={styles.cadenceModalOptionDescription}>
              Pay once per year and save on every plan
            </p>
          </button>
        </div>
        
        <p className={styles.cadenceModalNote}>
          You can change your cadence later at the end of your billing period.
        </p>
        
        <button
          className={styles.cadenceModalConfirmBtn}
          onClick={confirmCadence}
        >
          Continue with {cart.cadence === "monthly" ? "Monthly" : "Annual"} Billing
        </button>
      </div>
    </div>
  );
}
