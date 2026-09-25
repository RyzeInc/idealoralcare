import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * POST /api/shop/click
 *
 * Outbound affiliate click beacon. Called via `navigator.sendBeacon` as the
 * shopper leaves for the merchant, so it must be cheap, unauthenticated, and
 * never block navigation.
 *
 * Deliberately not a redirect endpoint. Routing affiliate traffic through our
 * own hop before the merchant is link cloaking under several networks' terms
 * (Amazon's included) and risks the account. The anchor carries the real tagged
 * URL; this only records that it was clicked. See docs/internal/SHOP_DESIGN.md.
 *
 * Always answers 204. The caller can't read a response body from a beacon and
 * a lost click is a lost data point, not a lost sale — so failures stay quiet
 * rather than surfacing an error nobody is listening for.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      productId?: string;
      siteSlug?: string;
      referrerPath?: string;
    };

    if (!body?.productId || typeof body.productId !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // Forward the Clerk identity when there is one, so the mutation's own
    // `getAuthenticatedUserId` resolves a member. Passing a user id in the body
    // instead would let any caller attribute a click to anyone. Anonymous
    // visitors are the normal case and simply record no user.
    try {
      const { getToken } = await auth();
      const token = await getToken({ template: "convex" });
      if (token) convex.setAuth(token);
    } catch {
      // Signed out, or no Clerk session on the beacon — record it anonymously.
    }

    // The mutation reads `network` and `productSlug` off the product row rather
    // than trusting anything here, so an unauthenticated caller can inflate a
    // counter but cannot write arbitrary data.
    await convex.mutation(api.shop.clicks.record, {
      productId: body.productId as Id<"shopProducts">,
      siteSlug: typeof body.siteSlug === "string" ? body.siteSlug : undefined,
      referrerPath:
        typeof body.referrerPath === "string" ? body.referrerPath : undefined,
    });
  } catch {
    // Swallow: attribution is best-effort by design.
  }

  return new NextResponse(null, { status: 204 });
}
