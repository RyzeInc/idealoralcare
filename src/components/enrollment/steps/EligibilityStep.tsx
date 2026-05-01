"use client";

/**
 * ELIGIBILITY STEP
 * First step of enrollment wizard.
 * Renders different input fields depending on the flow type:
 *   dtc                  → ZIP code
 *   broker-individual    → Agent/broker code
 *   broker-group-member  → Group code
 *   broker-group-employer→ Group code
 * Falls back to a local session ID when Convex is unavailable.
 */

import { useState } from "react";
import { useEnrollmentStep, useEnrollment } from "@/components/enrollment/EnrollmentProvider";
import { PROVIDER_GROUP_CODE } from "@/lib/constants";
import { ArrowRight, AlertCircle, Loader, WifiOff } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const ZIP_REGEX = /^\d{5}$/;

function getFlowMeta(flowType?: string) {
  switch (flowType) {
    case "broker-individual":
      return {
        title: "Enter Your Agent Code",
        subtitle: "Your licensed agent will have provided you a unique code to get started.",
        fieldLabel: "Agent / Broker Code",
        fieldPlaceholder: "e.g. AGENT-12345",
        hint: "Ask your agent if you don't have this code.",
        inputMode: "agent-code" as const,
      };
    case "broker-group-member":
      return {
        title: "Enter Your Group Code",
        subtitle: "Your employer or group administrator provided this code when they set up your plan.",
        fieldLabel: "Group Code",
        fieldPlaceholder: "e.g. GRP-ACME-2025",
        hint: "Check your enrollment welcome email for your group code.",
        inputMode: "group-code" as const,
      };
    case "broker-group-employer":
      return {
        title: "Enter Your Group Code",
        subtitle: "Your group code was assigned when your account was created.",
        fieldLabel: "Group Code",
        fieldPlaceholder: "e.g. GRP-ACME-2025",
        hint: "Contact your Ideal Health representative if you need your group code.",
        inputMode: "group-code" as const,
      };
    default: // dtc
      return {
        title: "Where Are You Located?",
        subtitle: "Enter your ZIP code so we can confirm coverage is available in your area.",
        fieldLabel: "ZIP Code",
        fieldPlaceholder: "12345",
        hint: "5-digit ZIP code",
        inputMode: "zip" as const,
      };
  }
}

export function EligibilityStep() {
  const { nextStep, setError, setLoading, isLoading, error } = useEnrollmentStep();
  const { state, dispatch } = useEnrollment();
  const flowType = state.flowType || "dtc";

  const meta = getFlowMeta(flowType);
  const [fieldValue, setFieldValue] = useState(
    meta.inputMode === "zip"
      ? (state.eligibilityData?.zipCode || "")
      : (state.eligibilityData?.groupCode || "")
  );
  const [localError, setLocalError] = useState("");
  const [convexOffline, setConvexOffline] = useState(false);

  // TODO (Agent 2): Wire up Convex enrollment_sessions.initializeEnrollment mutation
  // This needs to be properly integrated with the Convex API after schema deployment
  // const initializeEnrollment = useMutation(api["enrollment/sessions"].initializeEnrollment);
  
  // Stub implementation for now - returns expected shape for local development
  const initializeEnrollment = async (args: any) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return {
      sessionId,
      site: {
        _id: "site_ideal-health",
        slug: "ideal-health",
        name: "Ideal Health",
        type: "primary" as const,
        defaultCadence: "monthly" as const,
      },
      account: {
        _id: "account_default",
        slug: "ideal-health",
        name: "Ideal Health",
        accountType: "internal" as const,
      },
      group: {
        _id: "group_default",
        slug: "default",
        name: "Default Group",
        groupCode: PROVIDER_GROUP_CODE,
      },
    };
  };

  const validate = (): boolean => {
    if (meta.inputMode === "zip") {
      if (!ZIP_REGEX.test(fieldValue)) {
        setLocalError("Please enter a valid 5-digit ZIP code");
        return false;
      }
    } else {
      if (!fieldValue.trim()) {
        setLocalError(`Please enter your ${meta.fieldLabel.toLowerCase()}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setConvexOffline(false);

    if (!validate()) return;

    try {
      setLoading(true);

      const enrollmentType =
        flowType === "broker-group-member" || flowType === "broker-group-employer"
          ? "group"
          : "individual";

      const result = await initializeEnrollment({
        siteSlug: "ideal-health",
        groupCode: meta.inputMode === "group-code" ? fieldValue : undefined,
        enrollmentType,
        brokerCode:
          meta.inputMode === "agent-code"
            ? fieldValue
            : state.brokerCode,
        signupSource:
          meta.inputMode === "group-code"
            ? `group:${fieldValue}`
            : meta.inputMode === "agent-code"
            ? `broker:${fieldValue}`
            : "direct",
        zipCode: meta.inputMode === "zip" ? fieldValue : undefined,
      });

      dispatch({ type: "SET_SESSION_ID", payload: result.sessionId });
      dispatch({
        type: "SET_ELIGIBILITY_DATA",
        payload: {
          zipCode: meta.inputMode === "zip" ? fieldValue : undefined,
          groupCode: meta.inputMode === "group-code" ? fieldValue : undefined,
        },
      });
      dispatch({ type: "SET_SITE_CONTEXT", payload: result.site });
      dispatch({ type: "SET_ACCOUNT_CONTEXT", payload: result.account });
      dispatch({ type: "SET_GROUP_CONTEXT", payload: result.group });
      dispatch({ type: "MARK_STEP_COMPLETED", payload: "eligibility" });
      nextStep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify eligibility";

      // If Convex isn't deployed / running — allow offline continuation
      if (message.includes("Could not find public function") || message.includes("not deployed")) {
        setConvexOffline(true);
        const localSessionId = typeof crypto !== "undefined"
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
        dispatch({ type: "SET_SESSION_ID", payload: localSessionId });
        dispatch({
          type: "SET_ELIGIBILITY_DATA",
          payload: {
            zipCode: meta.inputMode === "zip" ? fieldValue : undefined,
            groupCode: meta.inputMode === "group-code" ? fieldValue : undefined,
          },
        });
        dispatch({ type: "MARK_STEP_COMPLETED", payload: "eligibility" });
        nextStep();
      } else {
        setLocalError(message);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    isLoading ||
    (meta.inputMode === "zip" ? fieldValue.length !== 5 : !fieldValue.trim());

  return (
    <>
      <div className="enrollment-step-card__header">
        <div className="enrollment-step-card__flow-badge">
          {flowType === "dtc" && "Individual Plan"}
          {flowType === "broker-individual" && "Agent-Assisted"}
          {flowType === "broker-group-member" && "Group — Member Pays"}
          {flowType === "broker-group-employer" && "Group — Employer Pays"}
        </div>
        <h2 className="enrollment-step-card__title">{meta.title}</h2>
        <p className="enrollment-step-card__subtitle">{meta.subtitle}</p>
      </div>

      {convexOffline && (
        <div className="enroll-warning-banner">
          <WifiOff size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Offline mode</strong> — session will sync when the service reconnects. You can continue setting up your plan.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="enroll-form">
        <div className="enroll-field">
          <label htmlFor="eligibility-field" className="enroll-label">
            {meta.fieldLabel}
          </label>
          <input
            id="eligibility-field"
            type="text"
            placeholder={meta.fieldPlaceholder}
            value={fieldValue}
            onChange={(e) => {
              const raw = e.target.value;
              setFieldValue(meta.inputMode === "zip" ? raw.replace(/\D/g, "").slice(0, 5) : raw.toUpperCase());
              setLocalError("");
            }}
            maxLength={meta.inputMode === "zip" ? 5 : undefined}
            disabled={isLoading}
            className={`enroll-input${localError ? " enroll-input--error" : ""}`}
            aria-invalid={!!localError}
            autoComplete={meta.inputMode === "zip" ? "postal-code" : "off"}
          />
          <span className="enroll-input-hint">{meta.hint}</span>
        </div>

        {localError && (
          <div className="enroll-error-box">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{localError}</span>
          </div>
        )}

        <div className="enroll-step-footer" style={{ marginTop: "1.25rem", paddingTop: 0, border: "none" }}>
          <button
            type="submit"
            disabled={isDisabled}
            className="enroll-continue-btn"
          >
            {isLoading ? (
              <>
                <Loader size={18} style={{ animation: "spin 1s linear infinite" }} />
                Verifying…
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
