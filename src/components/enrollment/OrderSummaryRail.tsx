"use client";

/**
 * ORDER SUMMARY RAIL
 * Floating/sticky order summary matching Crunch pattern
 * Desktop: Sticky sidebar | Mobile: Bottom drawer
 */

import { useEnrollmentPricing, useHierarchy } from "@/components/enrollment/EnrollmentProvider";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import styles from "./order-summary-rail.module.css";

export function OrderSummaryRail() {
  const { selectedPlans, subtotal, discount, tax, total } = useEnrollmentPricing();
  const { config } = useHierarchy();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const planCount = Object.keys(selectedPlans || {}).length;

  return (
    <>
      {/* Desktop */}
      <aside className={styles.desktopRail}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h3>Order Summary</h3>
          </div>

          {planCount === 0 ? (
            <p className={styles.empty}>Select plans to see pricing</p>
          ) : (
            <>
              <div className={styles.plansList}>
                {Object.entries(selectedPlans || {}).map(([productId, plan]) => (
                  <div key={productId} className={styles.planItem}>
                    <div className={styles.planName}>{plan.name}</div>
                    <div className={styles.planPrice}>
                      ${(plan.price / 100).toFixed(2)}/{plan.cadence === "monthly" ? "mo" : "yr"}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.breakdown}>
                <div className={styles.breakdownRow}>
                  <span>Subtotal</span>
                  <span>${(subtotal / 100).toFixed(2)}</span>
                </div>

                {!config.requirePayment && (
                  <div className={styles.breakdownRow}>
                    <span className={styles.highlight}>Employer Paid</span>
                    <span className={styles.highlight}>-${(subtotal / 100).toFixed(2)}</span>
                  </div>
                )}

                {discount > 0 && (
                  <div className={styles.breakdownRow}>
                    <span>Discount</span>
                    <span>-${(discount / 100).toFixed(2)}</span>
                  </div>
                )}

                {tax > 0 && (
                  <div className={styles.breakdownRow}>
                    <span>Tax</span>
                    <span>${(tax / 100).toFixed(2)}</span>
                  </div>
                )}

                <div className={styles.total}>
                  <span>You Pay</span>
                  <span>${(total / 100).toFixed(2)}/mo</span>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Sheet */}
      <div className={styles.mobileContainer}>
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileExpanded(!mobileExpanded)}
        >
          <div className={styles.mobileToggleLabel}>
            <span>Order Summary</span>
            {planCount > 0 && <span className={styles.badge}>${(total / 100).toFixed(2)}</span>}
          </div>
          <ChevronDown
            size={20}
            className={mobileExpanded ? styles.chevronExpanded : ""}
          />
        </button>

        {mobileExpanded && (
          <div className={styles.mobileContent}>
            {planCount === 0 ? (
              <p className={styles.empty}>Select plans to see pricing</p>
            ) : (
              <>
                <div className={styles.plansList}>
                  {Object.entries(selectedPlans || {}).map(([productId, plan]) => (
                    <div key={productId} className={styles.planItem}>
                      <div className={styles.planName}>{plan.name}</div>
                      <div className={styles.planPrice}>
                        ${(plan.price / 100).toFixed(2)}/{plan.cadence === "monthly" ? "mo" : "yr"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.breakdown}>
                  <div className={styles.breakdownRow}>
                    <span>Subtotal</span>
                    <span>${(subtotal / 100).toFixed(2)}</span>
                  </div>

                  {!config.requirePayment && (
                    <div className={styles.breakdownRow}>
                      <span className={styles.highlight}>Employer Paid</span>
                      <span className={styles.highlight}>-${(subtotal / 100).toFixed(2)}</span>
                    </div>
                  )}

                  {discount > 0 && (
                    <div className={styles.breakdownRow}>
                      <span>Discount</span>
                      <span>-${(discount / 100).toFixed(2)}</span>
                    </div>
                  )}

                  {tax > 0 && (
                    <div className={styles.breakdownRow}>
                      <span>Tax</span>
                      <span>${(tax / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className={styles.total}>
                    <span>You Pay</span>
                    <span>${(total / 100).toFixed(2)}/mo</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
