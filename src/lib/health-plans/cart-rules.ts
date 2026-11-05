import { isBflSlug, isEssentialsSlug, isMembershipProgramSlug } from "@/convex/lib/productSlugs";
import type { CartState } from "./types";

/** Repair saved carts too: Essentials includes BFL; membership programs bill monthly. */
export function normalizeProgramCart(cart: CartState): CartState {
  const essentials = cart.items.find((item) => isEssentialsSlug(item.product.slug));
  const items = essentials ? cart.items.filter((item) =>
    !isBflSlug(item.product.slug) && (!isEssentialsSlug(item.product.slug) || item === essentials)
  ) : cart.items;
  return { ...cart, items, cadence: items.some((item) => isMembershipProgramSlug(item.product.slug)) ? "monthly" : cart.cadence };
}
