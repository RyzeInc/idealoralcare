/**
 * HEALTH PLANS CONTEXT - DEPRECATED
 *
 * ⚠️ DEPRECATION NOTICE: This context is being phased out in favor of CartProvider.
 * 
 * CartProvider (src/lib/health-plans/cart-context.tsx) now manages:
 * - Cart items
 * - Cadence selection (monthly/annual)
 * - Payment method selection
 * - Comparison lists
 * - Persistence (localStorage + Convex sync)
 *
 * Current usage: CartDrawer.tsx - SHOULD BE REFACTORED to use CartProvider
 *
 * TODO: Migrate CartDrawer to CartProvider and remove this context entirely.
 */

"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { Cadence, PaymentMethod, CartSession, CatalogProduct, Entitlement, SubscriptionBundle } from "@/types/health-plans";

// STATE SHAPE
interface HealthPlansState {
  // Catalog
  products: CatalogProduct[];
  productsLoading: boolean;
  productsError?: string;

  // Current session
  cartSession: CartSession | null;
  sessionId: string; // Always present (browser session)
  customerId?: string; // Present if authenticated

  // Cart state
  cadence: Cadence;
  paymentMethod: PaymentMethod | null;

  // Customer state (if logged in)
  currentBundle: SubscriptionBundle | null;
  entitlements: Entitlement[];
  entitlementsLoading: boolean;

  // UI state
  showCart: boolean;
  checkoutInProgress: boolean;
}

// ACTIONS
type Action =
  | { type: "SET_PRODUCTS"; payload: CatalogProduct[] }
  | { type: "SET_PRODUCTS_LOADING"; payload: boolean }
  | { type: "SET_PRODUCTS_ERROR"; payload?: string }
  | { type: "SET_SESSION_ID"; payload: string }
  | { type: "SET_CUSTOMER_ID"; payload?: string }
  | { type: "SET_CADENCE"; payload: Cadence }
  | { type: "SET_PAYMENT_METHOD"; payload: PaymentMethod }
  | { type: "SET_CART_SESSION"; payload: CartSession }
  | { type: "REMOVE_ITEM"; payload: string } // productId
  | { type: "TOGGLE_CART" }
  | { type: "SET_CHECKOUT_IN_PROGRESS"; payload: boolean }
  | { type: "SET_BUNDLE"; payload: SubscriptionBundle | null }
  | { type: "SET_ENTITLEMENTS"; payload: Entitlement[] }
  | { type: "SET_ENTITLEMENTS_LOADING"; payload: boolean }
  | { type: "RESET_CART" };

// INITIAL STATE
const initialState: HealthPlansState = {
  products: [],
  productsLoading: true,
  cartSession: null,
  sessionId: "", // Will be set on mount
  cadence: "monthly",
  paymentMethod: null,
  currentBundle: null,
  entitlements: [],
  entitlementsLoading: false,
  showCart: false,
  checkoutInProgress: false,
};

// CONTEXT
const HealthPlansContext = createContext<
  | { state: HealthPlansState; dispatch: React.Dispatch<Action> }
  | undefined
>(undefined);

// REDUCER
function healthPlansReducer(state: HealthPlansState, action: Action): HealthPlansState {
  switch (action.type) {
    case "SET_PRODUCTS":
      return { ...state, products: action.payload, productsLoading: false };
    case "SET_PRODUCTS_LOADING":
      return { ...state, productsLoading: action.payload };
    case "SET_PRODUCTS_ERROR":
      return { ...state, productsError: action.payload };
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.payload };
    case "SET_CUSTOMER_ID":
      return { ...state, customerId: action.payload };
    case "SET_CADENCE":
      return { ...state, cadence: action.payload };
    case "SET_PAYMENT_METHOD":
      return { ...state, paymentMethod: action.payload };
    case "SET_CART_SESSION":
      return { ...state, cartSession: action.payload };
    case "REMOVE_ITEM":
      return {
        ...state,
        cartSession: state.cartSession
          ? {
              ...state.cartSession,
              items: state.cartSession.items.filter(
                (item: any) => item.productId !== action.payload
              ),
            }
          : null,
      };
    case "TOGGLE_CART":
      return { ...state, showCart: !state.showCart };
    case "SET_CHECKOUT_IN_PROGRESS":
      return { ...state, checkoutInProgress: action.payload };
    case "SET_BUNDLE":
      return { ...state, currentBundle: action.payload };
    case "SET_ENTITLEMENTS":
      return { ...state, entitlements: action.payload };
    case "SET_ENTITLEMENTS_LOADING":
      return { ...state, entitlementsLoading: action.payload };
    case "RESET_CART":
      return {
        ...state,
        cartSession: null,
        paymentMethod: null,
        checkoutInProgress: false,
      };
    default:
      return state;
  }
}

// PROVIDER
export function HealthPlansProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(healthPlansReducer, initialState);

  return (
    <HealthPlansContext.Provider value={{ state, dispatch }}>
      {children}
    </HealthPlansContext.Provider>
  );
}

// HOOK
export function useHealthPlans() {
  const context = useContext(HealthPlansContext);
  if (!context) {
    throw new Error("useHealthPlans must be used within HealthPlansProvider");
  }
  return context;
}

// SELECTOR HOOKS (for common queries)
export function useCartItems() {
  const { state } = useHealthPlans();
  return state.cartSession?.items || [];
}

export function useIsCartOpen() {
  const { state } = useHealthPlans();
  return state.showCart;
}

export function useCartCadence() {
  const { state } = useHealthPlans();
  return state.cadence;
}

export function usePaymentMethod() {
  const { state } = useHealthPlans();
  return state.paymentMethod;
}

export function useProducts() {
  const { state } = useHealthPlans();
  return {
    products: state.products,
    loading: state.productsLoading,
    error: state.productsError,
  };
}

export function useCustomerSubscription() {
  const { state } = useHealthPlans();
  return {
    bundle: state.currentBundle,
    entitlements: state.entitlements,
    loading: state.entitlementsLoading,
  };
}

export function useActiveEntitlements() {
  const { state } = useHealthPlans();
  return state.entitlements.filter((e) => e.status === "active");
}

export function useCancelledEntitlements() {
  const { state } = useHealthPlans();
  return state.entitlements.filter((e) => e.status === "cancel_at_period_end");
}
