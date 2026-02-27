/**
 * PLAN CARD COMPONENT
 *
 * Reusable card for displaying a product in the catalog.
 * Shows name, price, key inclusions, and action buttons.
 */

"use client";

import { CatalogProduct, getProductPrice, Cadence, PaymentMethod } from "@/types/health-plans";
import { formatPrice } from "@/lib/pricing-calculator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PlanCardProps {
  product: CatalogProduct;
  cadence: Cadence;
  paymentMethod: PaymentMethod;
  onAdd: (productId: string) => void;
  onDetails: (productId: string) => void;
  onCompare?: (productId: string) => void;
  isInCart?: boolean;
}

export function PlanCard({
  product,
  cadence,
  paymentMethod,
  onAdd,
  onDetails,
  onCompare,
  isInCart = false,
}: PlanCardProps) {
  const price = getProductPrice(product, cadence, paymentMethod);
  const displayPrice = formatPrice(price);

  return (
    <div className="flex flex-col h-full border rounded-lg p-6 hover:shadow-lg transition-shadow bg-white">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
            <p className="text-sm text-gray-600">{product.category}</p>
          </div>
          {product.isFeatured && (
            <Badge variant="default" className="ml-2">
              Featured
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600">{product.description}</p>
      </div>

      {/* Pricing */}
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-blue-600">{displayPrice}</span>
          <span className="text-sm text-gray-600">/{cadence === "monthly" ? "mo" : "yr"}</span>
        </div>
        {paymentMethod === "ach" && (
          <p className="text-xs text-green-600 mt-1">ACH discount applied</p>
        )}
      </div>

      {/* Inclusions */}
      <div className="mb-4 flex-1">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">What's Included</h4>
        <ul className="space-y-2">
          {product.inclusions.slice(0, 3).map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Best For */}
      {product.metadata?.bestFor && (
        <div className="mb-4">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Best for:</span> {product.metadata.bestFor.join(", ")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={() => onAdd(product._id)}
          variant={isInCart ? "outline" : "default"}
          className="flex-1"
        >
          {isInCart ? "In Cart" : "Add"}
        </Button>
        <Button
          onClick={() => onDetails(product._id)}
          variant="ghost"
          className="flex-1"
        >
          Details
        </Button>
        {onCompare && (
          <Button
            onClick={() => onCompare(product._id)}
            variant="ghost"
            size="sm"
          >
            Compare
          </Button>
        )}
      </div>
    </div>
  );
}
