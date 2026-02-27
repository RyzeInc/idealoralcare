"use client";

/**
 * ACCOUNT PAYMENT STEP
 * Create account, add payment method, sign waivers
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment } from "@/components/enrollment/EnrollmentProvider";
import { ArrowRight, AlertCircle, Loader, CheckCircle } from "lucide-react";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import styles from "./steps.module.css";
import paymentStyles from "./account-payment-step.module.css";

export function AccountPaymentStep() {
  const { nextStep, setError, setLoading, isLoading, error } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const { isSignedIn } = useAuth();
  const [localError, setLocalError] = useState("");
  const [waiversSigned, setWaiversSigned] = useState<{ [key: string]: boolean }>({
    enrollment_terms: false,
    privacy_consent: false,
  });

  const [address, setAddress] = useState({
    line1: state.address?.line1 || "",
    line2: state.address?.line2 || "",
    city: state.address?.city || "",
    state: state.address?.state || "",
    zipCode: state.address?.zipCode || "",
  });

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress({
      ...address,
      [e.target.name]: e.target.value,
    });
    setLocalError("");
  };

  const handleWaiverChange = (waiverType: string) => {
    setWaiversSigned({
      ...waiversSigned,
      [waiverType]: !waiversSigned[waiverType],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSignedIn) {
      setLocalError("Please sign in or create an account first");
      return;
    }

    if (!waiversSigned.enrollment_terms || !waiversSigned.privacy_consent) {
      setLocalError("Please accept all required waivers");
      return;
    }

    try {
      setLoading(true);

      // Store address and waivers
      dispatch({
        type: "SET_ADDRESS",
        payload: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: "US",
        },
      });

      dispatch({ type: "ADD_SIGNED_WAIVER", payload: "enrollment_terms" });
      dispatch({ type: "ADD_SIGNED_WAIVER", payload: "privacy_consent" });

      dispatch({ type: "MARK_STEP_COMPLETED", payload: "payment" });
      nextStep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save payment info";
      setLocalError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2>Account & Payment</h2>
        <p className={styles.stepDescription}>
          Create your account, provide billing information, and review our terms.
        </p>
      </div>

      {!isSignedIn ? (
        <div className={paymentStyles.authContainer}>
          <div className={paymentStyles.signUpSection}>
            <h3>Create Your Account</h3>
            <SignUp
              routing="hash"
              signInUrl="/health/sign-in"
              appearance={{
                elements: {
                  card: paymentStyles.clerkCard,
                },
              }}
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Address Section */}
          <fieldset className={paymentStyles.section}>
            <legend className={paymentStyles.sectionTitle}>Billing Address</legend>

            <div className={styles.formGroup}>
              <label htmlFor="line1" className={styles.label}>
                Street Address *
              </label>
              <input
                id="line1"
                type="text"
                name="line1"
                placeholder="123 Main St"
                value={address.line1}
                onChange={handleAddressChange}
                disabled={isLoading}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="line2" className={styles.label}>
                Apartment, Suite, etc. (Optional)
              </label>
              <input
                id="line2"
                type="text"
                name="line2"
                placeholder="Apt 4B"
                value={address.line2}
                onChange={handleAddressChange}
                disabled={isLoading}
                className={styles.input}
              />
            </div>

            <div className={`${styles.threeColumnForm} ${paymentStyles.addressRow}`}>
              <div className={styles.formGroup}>
                <label htmlFor="city" className={styles.label}>
                  City *
                </label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  placeholder="New York"
                  value={address.city}
                  onChange={handleAddressChange}
                  disabled={isLoading}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="state" className={styles.label}>
                  State *
                </label>
                <input
                  id="state"
                  type="text"
                  name="state"
                  placeholder="NY"
                  value={address.state}
                  onChange={handleAddressChange}
                  disabled={isLoading}
                  className={styles.input}
                  maxLength={2}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="zipCode" className={styles.label}>
                  ZIP Code *
                </label>
                <input
                  id="zipCode"
                  type="text"
                  name="zipCode"
                  placeholder="10001"
                  value={address.zipCode}
                  onChange={handleAddressChange}
                  disabled={isLoading}
                  className={styles.input}
                  maxLength={5}
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Waivers Section */}
          <fieldset className={paymentStyles.section}>
            <legend className={paymentStyles.sectionTitle}>Review & Accept Terms</legend>

            <div className={paymentStyles.waiversList}>
              <label className={paymentStyles.waiverItem}>
                <input
                  type="checkbox"
                  checked={waiversSigned.enrollment_terms}
                  onChange={() => handleWaiverChange("enrollment_terms")}
                  disabled={isLoading}
                  className={styles.checkboxInput}
                  required
                />
                <div className={paymentStyles.waiverLabel}>
                  <span className={styles.itemLabelText}>I accept the Enrollment Terms and Conditions</span>
                  <a href="/health/terms" target="_blank" rel="noopener noreferrer" className={paymentStyles.link}>
                    View terms →
                  </a>
                </div>
              </label>

              <label className={paymentStyles.waiverItem}>
                <input
                  type="checkbox"
                  checked={waiversSigned.privacy_consent}
                  onChange={() => handleWaiverChange("privacy_consent")}
                  disabled={isLoading}
                  className={styles.checkboxInput}
                  required
                />
                <div className={paymentStyles.waiverLabel}>
                  <span className={styles.itemLabelText}>I accept the Privacy Policy and Data Collection</span>
                  <a href="/health/privacy" target="_blank" rel="noopener noreferrer" className={paymentStyles.link}>
                    View policy →
                  </a>
                </div>
              </label>
            </div>
          </fieldset>

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

          <button type="submit" disabled={isLoading} className={styles.primaryButton}>
            {isLoading ? (
              <>
                <Loader size={18} className={styles.spinner} />
                Processing...
              </>
            ) : (
              <>
                Continue to Review
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
