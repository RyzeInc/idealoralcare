"use client";

/**
 * ELIGIBILITY STEP
 * First step of enrollment wizard
 * DTC mode: ZIP code only → auto-resolves to default site/account/group
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment } from "@/components/enrollment/EnrollmentProvider";
import { ArrowRight, AlertCircle, Loader } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import styles from "./steps.module.css";

const ZIP_REGEX = /^\d{5}$/;

export function EligibilityStep() {
  const { nextStep, setError, setLoading, isLoading, error } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const [zipCode, setZipCode] = useState(state.eligibilityData?.zipCode || "");
  const [localError, setLocalError] = useState("");

  // @ts-ignore - hierarchy module will be available after convex dev regenerates API
  const resolveSite = useMutation(api.hierarchy?.resolveSiteBySlug || (() => Promise.resolve(null)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    // Validation
    if (!ZIP_REGEX.test(zipCode)) {
      setLocalError("Please enter a valid 5-digit ZIP code");
      return;
    }

    try {
      setLoading(true);
      
      // For Phase 1 DTC, auto-resolve to default site (Ryze Oral Health)
      // In Phase 2, we'll add group code resolution
      const site = await resolveSite({ slug: "ryze-health" });

      if (!site) {
        setLocalError("Unable to resolve site. Please try again.");
        return;
      }

      // Store eligibility data
      dispatch({
        type: "SET_ELIGIBILITY_DATA",
        payload: { zipCode },
      });

      // Store resolved hierarchy (simplified for Phase 1)
      dispatch({
        type: "SET_SITE_CONTEXT",
        payload: site,
      });

      // Mark step as completed and advance
      dispatch({ type: "MARK_STEP_COMPLETED", payload: "eligibility" });
      nextStep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify eligibility";
      setLocalError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2>Verify Your Eligibility</h2>
        <p className={styles.stepDescription}>
          Let's start by confirming your service area. Enter your ZIP code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="zipCode" className={styles.label}>
            ZIP Code
          </label>
          <input
            id="zipCode"
            type="text"
            placeholder="12345"
            value={zipCode}
            onChange={(e) => {
              setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5));
              setLocalError("");
            }}
            maxLength={5}
            disabled={isLoading}
            className={`${styles.input} ${localError ? styles.inputError : ""}`}
            aria-invalid={!!localError}
          />
          <span className={styles.inputHint}>5-digit ZIP code</span>
        </div>

        {localError && (
          <div className={styles.errorBox}>
            <AlertCircle size={18} />
            <span>{localError}</span>
          </div>
        )}

        {error && error !== localError && (
          <div className={styles.errorBox}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={zipCode.length !== 5 || isLoading}
          className={styles.primaryButton}
        >
          {isLoading ? (
            <>
              <Loader size={18} className={styles.spinner} />
              Verifying...
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className={styles.info}>
        <p>This information helps us ensure you're in our service area and show you the right plans.</p>
      </div>
    </div>
  );
}
