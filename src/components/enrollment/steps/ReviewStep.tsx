"use client";

/**
 * REVIEW STEP
 * Final review before completion
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment, useEnrollmentPricing } from "@/components/enrollment/EnrollmentProvider";
import { ArrowRight, AlertCircle, Loader, ChevronDown } from "lucide-react";
import styles from "./steps.module.css";
import reviewStyles from "./review-step.module.css";

export function ReviewStep() {
  const { nextStep, setError, setLoading, isLoading } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const { selectedPlans, total } = useEnrollmentPricing();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    plans: true,
    personal: true,
    address: true,
    payment: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Get the first selected plan
      const planEntries = Object.entries(state?.selectedPlans || {});
      if (planEntries.length === 0) {
        throw new Error("No plans selected");
      }

      const [planId] = planEntries[0];

      // Call Stripe checkout API
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          cadence: "monthly", // TODO: Get from state
          paymentMethod: "card", // TODO: Get from state
          enrollmentSessionId: state?.sessionId || "" + Date.now(),
          brokerCode: state?.brokerCode,
          groupId: state?.group?._id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate checkout");
      }

      const { url } = await response.json();
      if (!url) {
        throw new Error("No checkout URL returned");
      }

      // Mark as completed and redirect
      dispatch({ type: "MARK_STEP_COMPLETED", payload: "review" });
      window.location.href = url; // Redirect to Stripe Checkout

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2>Review Your Enrollment</h2>
        <p className={styles.stepDescription}>
          Please review all information before completing your enrollment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={reviewStyles.reviewForm}>
        {/* Selected Plans */}
        <div className={reviewStyles.section}>
          <button
            type="button"
            className={reviewStyles.sectionHeader}
            onClick={() => toggleSection("plans")}
          >
            <h3>Selected Plans</h3>
            <ChevronDown
              size={20}
              className={expandedSections.plans ? reviewStyles.chevronOpen : ""}
            />
          </button>

          {expandedSections.plans && (
            <div className={reviewStyles.sectionContent}>
              {selectedPlans && Object.entries(selectedPlans).map(([productId, plan]) => (
                <div key={productId} className={reviewStyles.item}>
                  <div className={reviewStyles.itemLabel}>{plan.name}</div>
                  <div className={reviewStyles.itemValue}>
                    ${(plan.price / 100).toFixed(2)}/{plan.cadence === "monthly" ? "mo" : "yr"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal Information */}
        <div className={reviewStyles.section}>
          <button
            type="button"
            className={reviewStyles.sectionHeader}
            onClick={() => toggleSection("personal")}
          >
            <h3>Personal Information</h3>
            <ChevronDown
              size={20}
              className={expandedSections.personal ? reviewStyles.chevronOpen : ""}
            />
          </button>

          {expandedSections.personal && (
            <div className={reviewStyles.sectionContent}>
              <div className={reviewStyles.item}>
                <div className={reviewStyles.itemLabel}>Name</div>
                <div className={reviewStyles.itemValue}>
                  {state.personalInfo?.firstName} {state.personalInfo?.lastName}
                </div>
              </div>
              <div className={reviewStyles.item}>
                <div className={reviewStyles.itemLabel}>Email</div>
                <div className={reviewStyles.itemValue}>{state.personalInfo?.email}</div>
              </div>
              {state.personalInfo?.phone && (
                <div className={reviewStyles.item}>
                  <div className={reviewStyles.itemLabel}>Phone</div>
                  <div className={reviewStyles.itemValue}>{state.personalInfo.phone}</div>
                </div>
              )}
              <div className={reviewStyles.item}>
                <div className={reviewStyles.itemLabel}>Date of Birth</div>
                <div className={reviewStyles.itemValue}>{state.personalInfo?.dateOfBirth}</div>
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        {state.address && (
          <div className={reviewStyles.section}>
            <button
              type="button"
              className={reviewStyles.sectionHeader}
              onClick={() => toggleSection("address")}
            >
              <h3>Billing Address</h3>
              <ChevronDown
                size={20}
                className={expandedSections.address ? reviewStyles.chevronOpen : ""}
              />
            </button>

            {expandedSections.address && (
              <div className={reviewStyles.sectionContent}>
                <div className={reviewStyles.addressBlock}>
                  {state.address.line1}
                  {state.address.line2 && <>, {state.address.line2}</> }
                  <br />
                  {state.address.city}, {state.address.state} {state.address.zipCode}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pricing Summary */}
        <div className={reviewStyles.pricingSummary}>
          <div className={reviewStyles.pricingRow}>
            <span>Total Monthly:</span>
            <strong className={reviewStyles.price}>${(total / 100).toFixed(2)}</strong>
          </div>
          <div className={reviewStyles.pricingNote}>
            First payment will be charged to your card immediately
          </div>
        </div>

        <button type="submit" disabled={isLoading} className={styles.primaryButton}>
          {isLoading ? (
            <>
              <Loader size={18} className={styles.spinner} />
              Processing...
            </>
          ) : (
            <>
              Complete Enrollment
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
