"use client";

/**
 * DEPENDENTS STEP
 *
 * Allows the primary member to add family members (spouse, children, etc.)
 * during enrollment. Each dependent will receive an email invite to claim
 * their own Clerk account. They get full plan access but no billing control.
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment } from "@/components/enrollment/EnrollmentProvider";
import { Plus, Trash2, Users, ArrowRight, AlertCircle } from "lucide-react";
import styles from "./steps.module.css";

type Relationship = "spouse" | "child" | "domestic_partner" | "other";

interface DependentForm {
  id: string; // local key only (not persisted)
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  relationship: Relationship;
}

const BLANK_DEPENDENT = (): DependentForm => ({
  id: crypto.randomUUID(),
  firstName: "",
  lastName: "",
  email: "",
  dateOfBirth: "",
  relationship: "child",
});

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  spouse: "Spouse / Partner",
  child: "Child",
  domestic_partner: "Domestic Partner",
  other: "Other",
};

export function DependentsStep() {
  const { nextStep } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();

  const [dependents, setDependents] = useState<DependentForm[]>(
    () =>
      (state.personalInfo?.dependents ?? []).map((d) => ({
        id: crypto.randomUUID(),
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email ?? "",
        dateOfBirth: d.dateOfBirth ?? "",
        relationship: (d.relationship as Relationship) ?? "child",
      }))
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // -----------------------------------------------------------------------
  // Local mutation helpers
  // -----------------------------------------------------------------------

  const addDependent = () => {
    setDependents((prev) => [...prev, BLANK_DEPENDENT()]);
  };

  const removeDependent = (id: string) => {
    setDependents((prev) => prev.filter((d) => d.id !== id));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next)
        .filter((k) => k.startsWith(id))
        .forEach((k) => delete next[k]);
      return next;
    });
  };

  const updateDependent = (
    id: string,
    field: keyof Omit<DependentForm, "id">,
    value: string
  ) => {
    setDependents((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
    // Clear field-level error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}_${field}`];
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    dependents.forEach((dep) => {
      if (!dep.firstName.trim()) newErrors[`${dep.id}_firstName`] = "Required";
      if (!dep.lastName.trim()) newErrors[`${dep.id}_lastName`] = "Required";
      if (!dep.email.trim()) {
        newErrors[`${dep.id}_email`] = "Required";
      } else if (!dep.email.includes("@")) {
        newErrors[`${dep.id}_email`] = "Invalid email";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleContinue = () => {
    if (!validate()) return;

    // Persist dependents into wizard state
    dispatch({
      type: "SET_DEPENDENTS",
      payload: dependents.map(({ firstName, lastName, email, dateOfBirth, relationship }) => ({
        firstName,
        lastName,
        email,
        dateOfBirth: dateOfBirth || undefined,
        relationship,
      })),
    });

    nextStep();
  };

  const handleSkip = () => {
    dispatch({ type: "SET_DEPENDENTS", payload: [] });
    nextStep();
  };

  // -----------------------------------------------------------------------
  // Pricing preview
  // -----------------------------------------------------------------------
  const planCount = Object.keys(state.selectedPlans ?? {}).length;
  const cadence = planCount > 0 ? Object.values(state.selectedPlans)[0]?.cadence : "monthly";
  const paymentMethod = planCount > 0 ? Object.values(state.selectedPlans)[0]?.paymentMethod : "card";
  const primaryTotal = state.subtotal;

  // Dependent add-on pricing (these match the defaults in the Stripe checkout route)
  const DEP_PRICE: Record<string, number> = {
    monthly_card: 999,
    monthly_ach: 899,
    annual_card: 9999,
    annual_ach: 8999,
  };
  const depPriceKey = `${cadence}_${paymentMethod}`;
  const perDepCents = DEP_PRICE[depPriceKey] ?? 999;
  const depTotalCents = dependents.length * perDepCents;
  const grandTotalCents = primaryTotal + depTotalCents;

  const fmt = (cents: number) =>
    `$${(cents / 100).toFixed(2)}`;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={styles.stepContent}>
      {/* Header */}
      <div className={styles.stepHeader}>
        <h2>Add Family Members</h2>
        <p className={styles.stepDescription}>
          Add a spouse, children, or other dependents to your plan. Each person
          gets full access to all your plan benefits. They will receive an email
          invite to create their own login — but only you control billing.
        </p>
      </div>

      {/* Dependent cards */}
      {dependents.map((dep, index) => (
        <div key={dep.id} className={styles.dependentCard}>
          <div className={styles.dependentCardHeader}>
            <span className={styles.dependentCardTitle}>
              <Users size={16} />
              Dependent {index + 1}
            </span>
            <button
              type="button"
              className={styles.removeDependentBtn}
              onClick={() => removeDependent(dep.id)}
              aria-label="Remove dependent"
            >
              <Trash2 size={16} />
              Remove
            </button>
          </div>

          <div className={styles.dependentFields}>
            {/* Row 1: Name */}
            <div className={styles.fieldRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor={`${dep.id}_firstName`}>
                  First Name *
                </label>
                <input
                  id={`${dep.id}_firstName`}
                  className={`${styles.input} ${errors[`${dep.id}_firstName`] ? styles.inputError : ""}`}
                  value={dep.firstName}
                  onChange={(e) => updateDependent(dep.id, "firstName", e.target.value)}
                  placeholder="First name"
                />
                {errors[`${dep.id}_firstName`] && (
                  <span className={styles.fieldError}>{errors[`${dep.id}_firstName`]}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor={`${dep.id}_lastName`}>
                  Last Name *
                </label>
                <input
                  id={`${dep.id}_lastName`}
                  className={`${styles.input} ${errors[`${dep.id}_lastName`] ? styles.inputError : ""}`}
                  value={dep.lastName}
                  onChange={(e) => updateDependent(dep.id, "lastName", e.target.value)}
                  placeholder="Last name"
                />
                {errors[`${dep.id}_lastName`] && (
                  <span className={styles.fieldError}>{errors[`${dep.id}_lastName`]}</span>
                )}
              </div>
            </div>

            {/* Row 2: Email + Relationship */}
            <div className={styles.fieldRow}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor={`${dep.id}_email`}>
                  Email Address *
                </label>
                <input
                  id={`${dep.id}_email`}
                  type="email"
                  className={`${styles.input} ${errors[`${dep.id}_email`] ? styles.inputError : ""}`}
                  value={dep.email}
                  onChange={(e) => updateDependent(dep.id, "email", e.target.value)}
                  placeholder="their@email.com"
                />
                {errors[`${dep.id}_email`] && (
                  <span className={styles.fieldError}>{errors[`${dep.id}_email`]}</span>
                )}
                <span className={styles.inputHint}>
                  An invite will be sent to this address.
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor={`${dep.id}_relationship`}>
                  Relationship
                </label>
                <select
                  id={`${dep.id}_relationship`}
                  className={styles.select}
                  value={dep.relationship}
                  onChange={(e) =>
                    updateDependent(dep.id, "relationship", e.target.value as Relationship)
                  }
                >
                  {(Object.entries(RELATIONSHIP_LABELS) as [Relationship, string][]).map(
                    ([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Row 3: Date of Birth (optional) */}
            <div className={styles.formGroup} style={{ maxWidth: "220px" }}>
              <label className={styles.label} htmlFor={`${dep.id}_dob`}>
                Date of Birth (optional)
              </label>
              <input
                id={`${dep.id}_dob`}
                type="date"
                className={styles.input}
                value={dep.dateOfBirth}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => updateDependent(dep.id, "dateOfBirth", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add dependent button */}
      <button
        type="button"
        className={styles.addDependentBtn}
        onClick={addDependent}
      >
        <Plus size={18} />
        Add {dependents.length === 0 ? "a Family Member" : "Another Family Member"}
      </button>

      {/* Pricing summary */}
      {dependents.length > 0 && (
        <div className={styles.dependentPricing}>
          <div className={styles.pricingRow}>
            <span>Your plan</span>
            <span>{fmt(primaryTotal)}/{cadence === "annual" ? "yr" : "mo"}</span>
          </div>
          <div className={styles.pricingRow}>
            <span>
              {dependents.length} dependent{dependents.length > 1 ? "s" : ""} ×{" "}
              {fmt(perDepCents)}
            </span>
            <span>{fmt(depTotalCents)}/{cadence === "annual" ? "yr" : "mo"}</span>
          </div>
          <div className={`${styles.pricingRow} ${styles.pricingTotal}`}>
            <span>Total</span>
            <span>{fmt(grandTotalCents)}/{cadence === "annual" ? "yr" : "mo"}</span>
          </div>
        </div>
      )}

      {/* Notice */}
      <div className={styles.dependentNotice}>
        <AlertCircle size={15} />
        <p>
          Each family member will receive an email invite to create their own
          login. They will have access to all plan benefits but cannot view or
          change billing information.
        </p>
      </div>

      {/* Actions */}
      <div className={styles.stepActions}>
        <button
          type="button"
          className={styles.skipBtn}
          onClick={handleSkip}
        >
          Continue without dependents
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleContinue}
          disabled={dependents.some(
            (d) => !d.firstName.trim() || !d.lastName.trim() || !d.email.trim()
          )}
        >
          Continue
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
