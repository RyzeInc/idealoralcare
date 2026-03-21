"use client";

/**
 * PLAN SELECTION STEP
 * Browse and select health plan(s)
 * Shows plans with pricing, allows cadence and payment method selection
 */

import { useState, useEffect } from "react";
import { useEnrollmentStep, useEnrollment, useEnrollmentPricing } from "@/components/enrollment/EnrollmentProvider";
import { Check, ArrowRight, Loader } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import styles from "./steps.module.css";
import planStyles from "./plan-selection-step.module.css";

interface Product {
  _id: string;
  slug: string;
  name: string;
  description: string;
  pricing: {
    monthlyCardCents: number;
    monthlyACHCents: number;
    annualCardCents: number;
    annualACHCents: number;
  };
  inclusions: string[];
  metadata?: {
    icon?: string;
    bestFor?: string[];
  };
  isFeatured?: boolean;
  order?: number;
}

export function PlanSelectionStep() {
  const { nextStep, setError, setLoading, isLoading, error } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const { selectedPlans, updatePricing } = useEnrollmentPricing();
  
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");
  
  // TODO (Agent 2): Wire up Convex catalog.queries.list query
  // const catalogProducts = useQuery(api.catalog.queries.list, {}) || [];
  
  // Stub implementation with sample products for development
  const catalogProducts = [
    {
      _id: "product_ideal_health_oral",
      slug: "ideal-health-oral",
      name: "Ideal Oral Health Plan",
      description: "Comprehensive dental coverage including preventive, basic, and major services",
      category: "oral_health",
      pricing: {
        monthlyCardCents: 1499,  // $14.99
        monthlyACHCents: 1299,   // $12.99
        annualCardCents: 16499,  // $164.99
        annualACHCents: 14999,   // $149.99
      },
      inclusions: [
        "Preventive care (cleanings, exams)",
        "Basic care (fillings, extractions)",
        "Major care (crowns, bridges)",
        "Teledentistry consultations",
        "Dental discount network",
      ],
      metadata: {
        icon: "tooth",
        bestFor: ["Individual", "Family"],
      },
      isFeatured: true,
      order: 1,
      eligibilityRules: {
        disclosureText: "This is a discount dental plan, not insurance.",
        requiresAgeVerification: false,
        minimumAge: 0,
        maximumAge: 150,
      },
    },
  ];
  
  // Transform catalog products to Product interface
  const products: Product[] = (catalogProducts || []).map((p: any) => ({
    _id: p._id || "",
    slug: p.slug || "",
    name: p.name || "",
    description: p.description || "",
    pricing: {
      monthlyCardCents: p.pricing?.monthlyCardCents || 0,
      monthlyACHCents: p.pricing?.monthlyACHCents || p.pricing?.monthlyCardCents || 0,
      annualCardCents: p.pricing?.annualCardCents || 0,
      annualACHCents: p.pricing?.annualACHCents || p.pricing?.annualCardCents || 0,
    },
    inclusions: p.inclusions || [],
    metadata: p.metadata,
    isFeatured: p.isFeatured || false,
    order: p.order || 0,
  }));

  const getPrice = (product: Product) => {
    const key = `${cadence === "monthly" ? "monthly" : "annual"}${
      paymentMethod === "card" ? "Card" : "ACH"
    }Cents`;
    return product.pricing[key as keyof Product["pricing"]] || 0;
  };

  const togglePlan = (product: Product) => {
    const price = getPrice(product);
    if (selectedPlans && selectedPlans[product._id]) {
      dispatch({ type: "DESELECT_PLAN", payload: product._id });
    } else {
      dispatch({
        type: "SELECT_PLAN",
        payload: {
          productId: product._id,
          name: product.name,
          price,
          cadence,
          paymentMethod,
        },
      });
    }
  };

  // Update pricing
  useEffect(() => {
    if (!selectedPlans || Object.keys(selectedPlans).length === 0) {
      updatePricing(0, 0, 0);
      return;
    }

    const subtotal = Object.values(selectedPlans).reduce((sum, plan) => sum + plan.price, 0);
    const achDiscount = paymentMethod === "ach" ? Math.round(subtotal * 0.01) : 0;
    updatePricing(subtotal, achDiscount, 0);
  }, [selectedPlans, paymentMethod, updatePricing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlans || Object.keys(selectedPlans).length === 0) {
      setError("Please select at least one plan");
      return;
    }

    try {
      setLoading(true);
      dispatch({ type: "SET_CADENCE", payload: cadence });
      dispatch({ type: "SET_PAYMENT_METHOD", payload: paymentMethod });
      dispatch({ type: "MARK_STEP_COMPLETED", payload: "plans" });
      nextStep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save plan selection";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.stepHeader}>
        <h2>Choose Your Plans</h2>
        <p className={styles.stepDescription}>
          Select the plans that best fit your health needs. You can choose one or multiple plans.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={planStyles.planSelectionForm}>
        {/* Cadence & Payment Method Selector */}
        <div className={planStyles.controls}>
          <div className={planStyles.controlGroup}>
            <label className={planStyles.controlLabel}>Billing Cadence</label>
            <div className={planStyles.toggleButtons}>
              <button
                type="button"
                className={`${planStyles.toggle} ${cadence === "monthly" ? planStyles.toggleActive : ""}`}
                onClick={() => setCadence("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`${planStyles.toggle} ${cadence === "annual" ? planStyles.toggleActive : ""}`}
                onClick={() => setCadence("annual")}
              >
                Annual
              </button>
            </div>
          </div>

          <div className={planStyles.controlGroup}>
            <label className={planStyles.controlLabel}>Payment Method</label>
            <div className={planStyles.toggleButtons}>
              <button
                type="button"
                className={`${planStyles.toggle} ${paymentMethod === "card" ? planStyles.toggleActive : ""}`}
                onClick={() => setPaymentMethod("card")}
              >
                Card
              </button>
              <button
                type="button"
                className={`${planStyles.toggle} ${paymentMethod === "ach" ? planStyles.toggleActive : ""}`}
                onClick={() => setPaymentMethod("ach")}
              >
                ACH
              </button>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className={planStyles.plansGrid}>
          {products.map((product) => {
            const isSelected = selectedPlans && selectedPlans[product._id];
            const price = getPrice(product);

            return (
              <button
                key={product._id}
                type="button"
                onClick={() => togglePlan(product)}
                className={`${planStyles.planCard} ${isSelected ? planStyles.planCardSelected : ""} ${
                  product.isFeatured ? planStyles.planCardFeatured : ""
                }`}
              >
                <div className={planStyles.planHeader}>
                  <div>
                    <h3 className={planStyles.planName}>{product.name}</h3>
                    {product.isFeatured && <span className={planStyles.badge}>Popular</span>}
                  </div>
                  <div className={planStyles.checkbox}>
                    {isSelected && <Check size={20} />}
                  </div>
                </div>

                <p className={planStyles.planDescription}>{product.description}</p>

                <div className={planStyles.price}>
                  <span className={planStyles.amount}>
                    ${(price / 100).toFixed(2)}
                  </span>
                  <span className={planStyles.period}>
                    /{cadence === "monthly" ? "mo" : "yr"}
                  </span>
                </div>

                <ul className={planStyles.inclusions}>
                  {product.inclusions.slice(0, 3).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedPlans || Object.keys(selectedPlans).length === 0 || isLoading}
          className={styles.primaryButton}
        >
          {isLoading ? (
            <>
              <Loader size={18} className={styles.spinner} />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
