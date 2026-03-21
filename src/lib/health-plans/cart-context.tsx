"use client";

/**
 * IDEAL HEALTH PLANS - Shopping Cart Context
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

const STORAGE_KEY = "ideal-health-cart";
const CADENCE_SELECTED_KEY = "ideal-cadence-selected";
const SESSION_ID_KEY = "ideal-cart-session-id";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // TODO: Wire Convex mutations when checkout API is ready
  // const createSession = useMutation(api.subscriptions.cartMutations.createSession);
  // const addToSession = useMutation(api.subscriptions.cartMutations.addItem);
  // const removeFromSession = useMutation(api.subscriptions.cartMutations.removeItem);
  // const updateSessionPricing = useMutation(api.subscriptions.cartMutations.updatePricing);
  
  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const cadenceSelected = localStorage.getItem(CADENCE_SELECTED_KEY) === "true";
      const savedSessionId = localStorage.getItem(SESSION_ID_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setCart(parsed);
      }
      
      if (cadenceSelected) {
        setHasSelectedCadence(true);
      }
      
      if (savedSessionId) {
        setSessionId(savedSessionId);
      }
    } catch {
      // Invalid storage, reset
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CADENCE_SELECTED_KEY);
      localStorage.removeItem(SESSION_ID_KEY);
    }
    setIsLoaded(true);
  }, []);
  
  // Persist to localStorage on changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      
      // TODO: Sync to Convex cartSessions when checkout API is ready
      // if (sessionId) {
      //   try {
      //     updateSessionPricing({
      //       sessionId,
      //       subtotal: subtotalCents,
      //       discount: achSavingsCents,
      //       items: cart.items.map(i => ({ productId: i.productId, quantity: 1 })),
      //     });
      //   } catch (err) {
      //     console.warn('Failed to sync cart to Convex:', err);
      //     // Continue with localStorage fallback
      //   }
      // }
    }
  }, [cart, isLoaded, sessionId]);
  
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
      const newCart = {
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
      
      // TODO: Call Convex addItem mutation when checkout API is ready
      // if (sessionId) {
      //   try {
      //     addToSession({
      //       sessionId,
      //       productId: product._id,
      //     });
      //   } catch (err) {
      //     console.warn('Failed to sync to Convex:', err);
      //   }
      // }
      
      return newCart;
    });
  }, [hasSelectedCadence, sessionId]);
  
  // Remove item from cart
  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const newCart = {
        ...prev,
        items: prev.items.filter((item) => item.productId !== productId),
      };
      
      // TODO: Call Convex removeItem mutation when checkout API is ready
      // if (sessionId) {
      //   try {
      //     removeFromSession({
      //       sessionId,
      //       productId,
      //     });
      //   } catch (err) {
      //     console.warn('Failed to sync to Convex:', err);
      //   }
      // }
      
      return newCart;
    });
  }, [sessionId]);
  
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
    const pendingAdd = localStorage.getItem("ideal-pending-add");
    if (pendingAdd) {
      localStorage.removeItem("ideal-pending-add");
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

  // Refresh cart item pricing from fresh Convex product data (fixes stale localStorage)
  const syncProductPricing = useCallback((freshProducts: CatalogProduct[]) => {
    setCart((prev) => {
      const updated = prev.items.map((item) => {
        const fresh = freshProducts.find((p) => p._id === item.productId);
        if (fresh && fresh.pricing) {
          return { ...item, product: { ...item.product, pricing: fresh.pricing } };
        }
        return item;
      });
      if (updated.every((u, i) => u === prev.items[i])) return prev;
      return { ...prev, items: updated };
    });
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
        syncProductPricing,
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
