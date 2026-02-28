/**
 * CART MUTATIONS
 *
 * Server-side cart operations:
 * - Create/update cart session
 * - Add/remove items
 * - Update cadence/payment method
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";

interface CreateSessionArgs {
  sessionId: string;
  customerId?: string;
  cadence: "monthly" | "annual";
}

interface AddItemArgs {
  sessionId: string;
  productId: string;
  quantity: number;
}

interface RemoveItemArgs {
  sessionId: string;
  productId: string;
}

interface UpdatePricingArgs {
  sessionId: string;
  cadence: "monthly" | "annual";
  paymentMethod: "card" | "ach";
  totalCents: number;
}

interface ClearSessionArgs {
  sessionId: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  addedAt: number;
}

/**
 * Create or get a cart session
 */
export const createSession = mutation({
  args: {
    sessionId: v.string(),
    customerId: v.optional(v.string()),
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
  },
  handler: async (ctx: MutationCtx, args: CreateSessionArgs) => {
    // Check if session already exists
    const existing = await ctx.db
      .query("cartSessions")
      .withIndex("by_session_id", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .first();

    if (existing) {
      return existing;
    }

    // Create new session
    const sessionId = await ctx.db.insert("cartSessions", {
      sessionId: args.sessionId,
      customerId: args.customerId,
      cadence: args.cadence,
      items: [],
      status: "active",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return ctx.db.get(sessionId);
  },
});

/**
 * Add item to cart
 */
export const addItem = mutation({
  args: {
    sessionId: v.string(),
    productId: v.id("catalogProducts"),
    quantity: v.number(),
  },
  handler: async (ctx: MutationCtx, args: AddItemArgs) => {
    const session = await ctx.db
      .query("cartSessions")
      .withIndex("by_session_id", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) {
      throw new Error("Cart session not found");
    }

    // Check if product already in cart
    const existingItem = (session.items as CartItem[]).find(
      (i) => i.productId === args.productId
    );

    let updatedItems: CartItem[];
    if (existingItem) {
      updatedItems = (session.items as CartItem[]).map((i) =>
        i.productId === args.productId
          ? { ...i, quantity: i.quantity + args.quantity }
          : i
      );
    } else {
      updatedItems = [
        ...(session.items as CartItem[]),
        {
          productId: args.productId,
          quantity: args.quantity,
          addedAt: Date.now(),
        },
      ];
    }

    await ctx.db.patch(session._id, {
      items: updatedItems as any,
      lastActivityAt: Date.now(),
    });

    return ctx.db.get(session._id);
  },
});

/**
 * Remove item from cart
 */
export const removeItem = mutation({
  args: {
    sessionId: v.string(),
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: MutationCtx, args: RemoveItemArgs) => {
    const session = await ctx.db
      .query("cartSessions")
      .withIndex("by_session_id", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) {
      throw new Error("Cart session not found");
    }

    const updatedItems = (session.items as CartItem[]).filter(
      (i) => i.productId !== args.productId
    );

    await ctx.db.patch(session._id, {
      items: updatedItems as any,
      lastActivityAt: Date.now(),
    });

    return ctx.db.get(session._id);
  },
});

/**
 * Update cart pricing (after cadence or payment method change)
 */
export const updatePricing = mutation({
  args: {
    sessionId: v.string(),
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    totalCents: v.number(),
  },
  handler: async (ctx: MutationCtx, args: UpdatePricingArgs) => {
    const session = await ctx.db
      .query("cartSessions")
      .withIndex("by_session_id", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) {
      throw new Error("Cart session not found");
    }

    // Fetch products for breakdown
    const breakdown = await Promise.all(
      (session.items as CartItem[]).map(async (item) => {
        const product = await ctx.db.get(item.productId as any);
        if (!product) return null;

        const productAny = product as any;
        const price =
          args.cadence === "monthly"
            ? args.paymentMethod === "card"
              ? productAny.pricing?.monthlyCardCents
              : productAny.pricing?.monthlyACHCents
            : args.paymentMethod === "card"
            ? productAny.pricing?.annualCardCents
            : productAny.pricing?.annualACHCents;

        return {
          productId: item.productId,
          priceCents: (price as number) * item.quantity,
        };
      })
    );

    await ctx.db.patch(session._id, {
      cadence: args.cadence,
      paymentMethod: args.paymentMethod,
      pricingPreview: {
        cadence: args.cadence,
        paymentMethod: args.paymentMethod,
        totalCents: args.totalCents,
        breakdown: breakdown.filter((b) => b !== null) as any,
        calculatedAt: Date.now(),
      },
      lastActivityAt: Date.now(),
    });

    return ctx.db.get(session._id);
  },
});

/**
 * Clear cart (on checkout success)
 */
export const clearSession = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx: MutationCtx, args: ClearSessionArgs) => {
    const session = await ctx.db
      .query("cartSessions")
      .withIndex("by_session_id", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .first();

    if (!session) {
      throw new Error("Cart session not found");
    }

    await ctx.db.patch(session._id, {
      items: [],
      status: "checked_out",
      completedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return ctx.db.get(session._id);
  },
});
