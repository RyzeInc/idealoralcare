import { PRIMARY_AUTH_ORIGIN, ASSURE_ORIGIN } from "./site-domains";
import type { CartState, CatalogProduct } from "./health-plans/types";
import {
  hasConflictingPrograms,
  isMembershipProgramSlug,
} from "@/convex/lib/productSlugs";

/** Only public catalog IDs and shopping preferences cross domains, never account or payment details. */
export type CheckoutTransfer = {
  ids: string[];
  cadence: "monthly" | "annual";
  paymentMethod: "card" | "ach";
  referralCode: string;
  referralSource: "url" | "manual";
};
export function secureCheckoutUrl(cart: CartState) {
  const url = new URL("/assurevantage/program-checkout", PRIMARY_AUTH_ORIGIN);
  url.searchParams.set(
    "cart",
    JSON.stringify({
      ids: cart.items.map((i) => i.productId),
      cadence: cart.cadence,
      paymentMethod: cart.paymentMethod,
      referralCode: cart.referralCode || "",
      referralSource: cart.referralCodeSource === "url" ? "url" : "manual",
    }),
  );
  return url.href;
}
export function readCheckoutTransfer(
  raw: string | null,
): CheckoutTransfer | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !Array.isArray(data.ids) ||
      data.ids.length > 3 ||
      data.ids.some(
        (id: unknown) =>
          typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id),
      ) ||
      new Set(data.ids).size !== data.ids.length
    )
      return null;
    if (
      !["monthly", "annual"].includes(data.cadence) ||
      !["card", "ach"].includes(data.paymentMethod) ||
      typeof data.referralCode !== "string" ||
      data.referralCode.length > 100
    )
      return null;
    return {
      ids: data.ids,
      cadence: data.cadence,
      paymentMethod: data.paymentMethod,
      referralCode: data.referralCode,
      referralSource: data.referralSource === "url" ? "url" : "manual",
    };
  } catch {
    return null;
  }
}
export function transferProducts(
  transfer: CheckoutTransfer,
  catalog: CatalogProduct[],
  allowedIds?: string[],
) {
  const products = transfer.ids.map((id) =>
    catalog.find(
      (p) =>
        p._id === id &&
        p.isVisible !== false &&
        (!allowedIds?.length || allowedIds.includes(id)),
    ),
  );
  if (products.some((p) => !p)) return null;
  const selected = products as CatalogProduct[];
  if (
    hasConflictingPrograms(selected.map((p) => p.slug)) ||
    selected.filter((p) => p.category === "dental").length > 1
  )
    return null;
  return {
    products: selected,
    cadence: selected.some((p) => isMembershipProgramSlug(p.slug))
      ? ("monthly" as const)
      : transfer.cadence,
  };
}

export function shoppingUrl(cart: CartState) {
  const secure = new URL(secureCheckoutUrl(cart));
  const shopping = new URL("/assurevantage/program-plans", ASSURE_ORIGIN);
  shopping.search = secure.search;
  return shopping.href;
}
