"use client";

/**
 * NEXUS HEALTH PLANS - Shopping Cart Context
 * 
 * Manages:
 * - Cart items (add/remove plans)
 * - Cadence selection (monthly/annual) - locked early
 * - Payment method (card/ACH) - affects pricing
 * - Compare list (up to 4 plans)
 * - Persistence to localStorage
 * 
 * Flow:
 * 1. First visit → show cadence selection modal
 * 2. User selects monthly or annual
 * 3. All prices lock to that cadence
 * 4. User can add plans, adjust payment method
 * 5. Cart persists across sessions
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CartState, CartItem, CatalogProduct, Cadence, PaymentMethod } from "@/lib/health-plans/types";

const STORAGE_KEY = "nexus-health-cart";
const CADENCE_SELECTED_KEY = "nexus-cadence-selected";
const MAX_COMPARE_ITEMS = 4;

interface CartContextType {
  // State
  cart: CartState;
  isLoaded: boolean;
  showCadenceModal: boolean;
  
  // Cart actions
  addItem: (product: CatalogProduct) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  
  // Cadence actions
  setCadence: (cadence: Cadence) => void;
  confirmCadence: () => void;
  requestCadenceChange: () => void;
  
  // Payment method
  setPaymentMethod: (method: PaymentMethod) => void;
  
  // Compare actions
  addToCompare: (productId: string) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
  
  // Computed values
  itemCount: number;
  subtotalCents: number;
  achSavingsCents: number;
}

const defaultCart: CartState = {
  items: [],
  cadence: "monthly",
  paymentMethod: "card",
  compareItems: [],
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(defaultCart);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCadenceModal, setShowCadenceModal] = useState(false);
  const [hasSelectedCadence, setHasSelectedCadence] = useState(false);
  
  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const cadenceSelected = localStorage.getItem(CADENCE_SELECTED_KEY) === "true";
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setCart(parsed);
      }
      
      if (cadenceSelected) {
        setHasSelectedCadence(true);
      }
    } catch {
      // Invalid storage, reset
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CADENCE_SELECTED_KEY);
    }
    setIsLoaded(true);
  }, []);
  
  // Persist to localStorage on changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, isLoaded]);
  
  // Add item to cart
  const addItem = useCallback((product: CatalogProduct) => {
    // If cadence not selected yet, automatically set to monthly and mark as selected
    if (!hasSelectedCadence) {
      setHasSelectedCadence(true);
      localStorage.setItem(CADENCE_SELECTED_KEY, "true");
      setShowCadenceModal(false);
      // Continue to add the item below
    }
    
    setCart((prev) => {
      // Don't add duplicates
      if (prev.items.some((item) => item.productId === product._id)) {
        return prev;
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product._id,
            product,
            addedAt: Date.now(),
          },
        ],
      };
    });
  }, [hasSelectedCadence]);
  
  // Remove item from cart
  const removeItem = useCallback((productId: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.productId !== productId),
    }));
  }, []);
  
  // Clear cart
  const clearCart = useCallback(() => {
    setCart((prev) => ({ ...prev, items: [] }));
  }, []);
  
  // Check if in cart
  const isInCart = useCallback(
    (productId: string) => cart.items.some((item) => item.productId === productId),
    [cart.items]
  );
  
  // Set cadence
  const setCadence = useCallback((cadence: Cadence) => {
    setCart((prev) => ({ ...prev, cadence }));
  }, []);
  
  // Confirm cadence selection
  const confirmCadence = useCallback(() => {
    setHasSelectedCadence(true);
    localStorage.setItem(CADENCE_SELECTED_KEY, "true");
    setShowCadenceModal(false);
    
    // Check for pending add
    const pendingAdd = localStorage.getItem("nexus-pending-add");
    if (pendingAdd) {
      localStorage.removeItem("nexus-pending-add");
      // Note: caller should re-trigger addItem with the product
    }
  }, []);
  
  // Request cadence change (shows warning if cart not empty)
  const requestCadenceChange = useCallback(() => {
    setShowCadenceModal(true);
  }, []);
  
  // Set payment method
  const setPaymentMethod = useCallback((method: PaymentMethod) => {
    setCart((prev) => ({ ...prev, paymentMethod: method }));
  }, []);
  
  // Compare list management
  const addToCompare = useCallback((productId: string) => {
    setCart((prev) => {
      if (prev.compareItems.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      if (prev.compareItems.includes(productId)) {
        return prev;
      }
      return {
        ...prev,
        compareItems: [...prev.compareItems, productId],
      };
    });
  }, []);
  
  const removeFromCompare = useCallback((productId: string) => {
    setCart((prev) => ({
      ...prev,
      compareItems: prev.compareItems.filter((id) => id !== productId),
    }));
  }, []);
  
  const clearCompare = useCallback(() => {
    setCart((prev) => ({ ...prev, compareItems: [] }));
  }, []);
  
  const isInCompare = useCallback(
    (productId: string) => cart.compareItems.includes(productId),
    [cart.compareItems]
  );
  
  // Computed values
  const itemCount = cart.items.length;
  
  // Subtotal is ALWAYS based on card pricing (the base price)
  const subtotalCents = cart.items.reduce((total, item) => {
    const { pricing } = item.product;
    const { cadence } = cart;
    
    if (cadence === "monthly") {
      return total + pricing.monthlyCardCents;
    }
    return total + pricing.annualCardCents;
  }, 0);
  
  const achSavingsCents = cart.items.reduce((total, item) => {
    const { pricing } = item.product;
    const { cadence } = cart;
    
    if (cadence === "monthly") {
      return total + (pricing.monthlyCardCents - pricing.monthlyACHCents);
    }
    return total + (pricing.annualCardCents - pricing.annualACHCents);
  }, 0);
  
  return (
    <CartContext.Provider
      value={{
        cart,
        isLoaded,
        showCadenceModal,
        addItem,
        removeItem,
        clearCart,
        isInCart,
        setCadence,
        confirmCadence,
        requestCadenceChange,
        setPaymentMethod,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        itemCount,
        subtotalCents,
        achSavingsCents,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
