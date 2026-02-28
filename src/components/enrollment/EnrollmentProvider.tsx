"use client";

/**
 * ENROLLMENT PROVIDER
 * Manages enrollment wizard state and provides context to all steps
 */

import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect } from "react";
import {
  EnrollmentWizardState,
  EnrollmentAction,
  DEFAULT_ENROLLMENT_CONFIG,
  SiteContext,
  AccountContext,
  GroupContext,
  EnrollmentConfig,
} from "@/lib/enrollment/types";

// Create context
const EnrollmentContext = createContext<
  {
    state: EnrollmentWizardState;
    dispatch: (action: EnrollmentAction) => void;
    goToStep: (step: EnrollmentWizardState["currentStep"]) => void;
    nextStep: () => void;
    prevStep: () => void;
  } | undefined
>(undefined);

// Initial state
const INITIAL_STATE: EnrollmentWizardState = {
  sessionId: "",
  currentStep: "eligibility",
  completedSteps: [],
  selectedPlans: {},
  personalInfo: {
    firstName: "",
    lastName: "",
    email: "",
    dependents: [],
  },
  signedWaivers: [],
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  isLoading: false,
};

// Reducer
function enrollmentReducer(state: EnrollmentWizardState, action: EnrollmentAction): EnrollmentWizardState {
  switch (action.type) {
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.payload };

    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.payload };

    case "MARK_STEP_COMPLETED":
      return {
        ...state,
        completedSteps: [...new Set([...state.completedSteps, action.payload])],
      };

    case "SET_ELIGIBILITY_DATA":
      return { ...state, eligibilityData: action.payload };

    case "SET_SITE_CONTEXT":
      return { ...state, site: action.payload };

    case "SET_ACCOUNT_CONTEXT":
      return { ...state, account: action.payload };

    case "SET_GROUP_CONTEXT":
      return { ...state, group: action.payload };

    case "SET_RESOLVED_CONFIG":
      return { ...state, resolvedConfig: action.payload };

    case "SELECT_PLAN": {
      const { productId, name, price, cadence, paymentMethod } = action.payload;
      return {
        ...state,
        selectedPlans: {
          ...state.selectedPlans,
          [productId]: { name, price, cadence, paymentMethod },
        },
      };
    }

    case "DESELECT_PLAN": {
      const { [action.payload]: _, ...remainingPlans } = state.selectedPlans || {};
      return {
        ...state,
        selectedPlans: remainingPlans,
      };
    }

    case "SET_CADENCE":
      return {
        ...state,
        selectedPlans: Object.fromEntries(
          Object.entries(state.selectedPlans || {}).map(([id, plan]) => [
            id,
            { ...plan, cadence: action.payload },
          ])
        ),
      };

    case "SET_PAYMENT_METHOD":
      return {
        ...state,
        selectedPlans: Object.fromEntries(
          Object.entries(state.selectedPlans || {}).map(([id, plan]) => [
            id,
            { ...plan, paymentMethod: action.payload },
          ])
        ),
      };

    case "SET_PERSONAL_INFO": {
      const payload = action.payload as any; // payload is Partial so fields are optional
      return {
        ...state,
        personalInfo: {
          firstName: payload.firstName ?? state.personalInfo?.firstName ?? '',
          lastName: payload.lastName ?? state.personalInfo?.lastName ?? '',
          email: payload.email ?? state.personalInfo?.email ?? '',
          phone: payload.phone ?? state.personalInfo?.phone,
          dateOfBirth: payload.dateOfBirth ?? state.personalInfo?.dateOfBirth,
          employeeId: payload.employeeId ?? state.personalInfo?.employeeId,
          dependents: payload.dependents ?? state.personalInfo?.dependents ?? [],
        },
      };
    }

    case "SET_ADDRESS":
      return { ...state, address: action.payload };

    case "SET_PAYMENT_INFO":
      return { ...state, paymentInfo: action.payload };

    case "ADD_SIGNED_WAIVER":
      return {
        ...state,
        signedWaivers: [...new Set([...state.signedWaivers, action.payload])],
      };

    case "SET_MEMBER_PROFILE_ID":
      return { ...state, memberProfileId: action.payload };

    case "SET_BROKER_CODE":
      return { ...state, brokerCode: action.payload };

    case "UPDATE_PRICING":
      return {
        ...state,
        subtotal: action.payload.subtotal,
        discount: action.payload.discount,
        tax: action.payload.tax,
        total: action.payload.total,
      };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: undefined };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "RESET":
      return INITIAL_STATE;

    default:
      return state;
  }
}

// Provider component
export function EnrollmentProvider({
  children,
  brokerCode,
  groupCode,
}: {
  children: ReactNode;
  brokerCode?: string;
  groupCode?: string;
}) {
  const [state, dispatch] = useReducer(enrollmentReducer, INITIAL_STATE);

  // Initialize with broker/group codes if provided
  useEffect(() => {
    if (brokerCode) {
      dispatch({ type: "SET_BROKER_CODE", payload: brokerCode });
    }
    // TODO: On group code, call Convex to resolve hierarchy and set group context
    // This will be done in EligibilityStep or in a separate initialization step
  }, [brokerCode, groupCode]);

  const steps: EnrollmentWizardState["currentStep"][] = [
    "eligibility",
    "plans",
    "personal-info",
    "payment",
    "review",
    "confirmation",
  ];

  const currentStepIndex = steps.indexOf(state.currentStep);

  const goToStep = useCallback((step: EnrollmentWizardState["currentStep"]) => {
    dispatch({ type: "SET_CURRENT_STEP", payload: step });
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      dispatch({ type: "MARK_STEP_COMPLETED", payload: state.currentStep });
      dispatch({ type: "SET_CURRENT_STEP", payload: steps[currentStepIndex + 1] });
    }
  }, [currentStepIndex, state.currentStep, steps]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      dispatch({ type: "SET_CURRENT_STEP", payload: steps[currentStepIndex - 1] });
    }
  }, [currentStepIndex, steps]);

  return (
    <EnrollmentContext.Provider value={{ state, dispatch, goToStep, nextStep, prevStep }}>
      {children}
    </EnrollmentContext.Provider>
  );
}

// Hook to use enrollment context
export function useEnrollment() {
  const context = useContext(EnrollmentContext);
  if (!context) {
    throw new Error("useEnrollment must be used within EnrollmentProvider");
  }
  return context;
}

// Helper hook for current step
export function useEnrollmentStep() {
  const { state, dispatch, goToStep, nextStep, prevStep } = useEnrollment();
  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    goToStep,
    nextStep,
    prevStep,
    isLoading: state.isLoading,
    error: state.error,
    setError: (msg: string) => dispatch({ type: "SET_ERROR", payload: msg }),
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    setLoading: (loading: boolean) => dispatch({ type: "SET_LOADING", payload: loading }),
  };
}

// Helper hook for pricing
export function useEnrollmentPricing() {
  const { state, dispatch } = useEnrollment();
  return {
    selectedPlans: state.selectedPlans || {},
    subtotal: state.subtotal,
    discount: state.discount,
    tax: state.tax,
    total: state.total,
    updatePricing: (subtotal: number, discount: number, tax: number) => {
      dispatch({
        type: "UPDATE_PRICING",
        payload: { subtotal, discount, tax, total: subtotal - discount + tax },
      });
    },
  };
}

// Helper hook for hierarchy
export function useHierarchy() {
  const { state } = useEnrollment();
  return {
    site: state.site,
    account: state.account,
    group: state.group,
    config: state.resolvedConfig || DEFAULT_ENROLLMENT_CONFIG,
  };
}
