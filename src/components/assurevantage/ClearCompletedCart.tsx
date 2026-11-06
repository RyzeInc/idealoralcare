"use client";
import { useEffect } from "react";
import { useCart } from "@/lib/health-plans";
/** Mounted only after the server verifies the current purchaser's completed Stripe session. */
export function ClearCompletedCart() {
  const { clearCart, isLoaded } = useCart();
  useEffect(() => {
    if (isLoaded) clearCart();
  }, [clearCart, isLoaded]);
  return null;
}
