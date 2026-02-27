/**
 * CART DRAWER COMPONENT
 *
 * Sticky right-side cart showing:
 * - Items
 * - Cadence selector
 * - Payment method toggle
 * - Pricing totals
 * - Checkout CTA
 */

"use client";

import { useHealthPlans, useCartItems, useCartCadence, usePaymentMethod } from "@/contexts/HealthPlansContext";
import { calculateCartPrice, formatPrice } from "@/lib/pricing-calculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
// import { api } from "@/convex/_generated/api"; // Generated after convex deploy

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ isOpen, onClose, onCheckout }: CartDrawerProps) {
  const { state, dispatch } = useHealthPlans();
  const cartItems = useCartItems();
  const cadence = useCartCadence();
  const paymentMethod = usePaymentMethod();
  
  const [pricing, setPricing] = useState<any>(null);

  // Fetch product details for items in cart
  const cartProductIds = cartItems.map((item: any) => item.productId);
  
  useEffect(() => {
    if (cartItems.length === 0) {
      setPricing(null);
      return;
    }

    // Calculate pricing (in real app, fetch from server)
    // For now, use client-side calculation
    const calculation = calculateCartPrice(
      cartItems.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: {} as any, // TODO: fetch product data
      })),
      cadence,
      paymentMethod || "card"
    );

    setPricing(calculation);
  }, [cartItems, cadence, paymentMethod]);

  if (!isOpen) return null;

  const itemCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + (cadence === "annual" ? 12 : 1));

  return (
    <div className="fixed inset-0 z-40">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Cadence & Payment Method */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-900">Billing Cycle</label>
              <div className="flex gap-2 mt-2">
                {(["monthly", "annual"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => dispatch({ type: "SET_CADENCE", payload: opt })}
                    className={`flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors ${
                      cadence === opt
                        ? "border-blue-600 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt === "monthly" ? "Monthly" : "Annual"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-900">Payment Method</label>
              <div className="flex gap-2 mt-2">
                {(["card", "ach"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => dispatch({ type: "SET_PAYMENT_METHOD", payload: method })}
                    className={`flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors ${
                      paymentMethod === method
                        ? "border-blue-600 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {method === "card" ? "💳 Card" : "🏦 Bank (ACH)"}
                  </button>
                ))}
              </div>
              {paymentMethod === "ach" && (
                <p className="text-xs text-green-600 mt-2">Discount applies while paying by bank transfer</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Plans ({itemCount})</h3>
            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-600">No items in cart</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item: any) => (
                  <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">
                      {item.productId} {item.quantity > 1 && `× ${item.quantity}`}
                    </span>
                    <button
                      onClick={() => dispatch({ type: "REMOVE_ITEM", payload: item.productId })}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing */}
          {pricing && (
            <div className="space-y-2 p-4 bg-blue-50 rounded">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatPrice(pricing.subtotalCents)}</span>
              </div>
              {pricing.discountCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">ACH Discount</span>
                  <span className="font-medium text-green-600">-{formatPrice(pricing.discountCents)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-base font-semibold">
                <span>Due Today</span>
                <span className="text-blue-600">{formatPrice(pricing.totalCents)}</span>
              </div>
              <div className="text-xs text-gray-600">
                Renews on {renewalDate.toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Policies */}
          <div className="text-xs text-gray-600 space-y-1">
            <p>✓ Cancel anytime. Keep access through period end.</p>
            <p>✓ Not insurance. See full disclosures.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t sticky bottom-0 bg-white">
          <Button
            onClick={onCheckout}
            disabled={cartItems.length === 0 || !paymentMethod}
            className="w-full"
            size="lg"
          >
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
