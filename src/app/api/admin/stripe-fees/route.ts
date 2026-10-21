import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!convexUrl || !stripeKey) {
    return NextResponse.json({ error: "Stripe or Convex is not configured" }, { status: 503 });
  }

  try {
    const token = await getToken({ template: "convex" });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);
    const profile = await convex.query(api.admin.adminUsers.getMyAdminProfile, {});
    if (!profile?.permissions.includes("billing.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stripe = new Stripe(stripeKey);
    const entries = await stripe.balanceTransactions.list({ limit: 100 });
    return NextResponse.json({
      livemode: stripeKey.startsWith("sk_live_"),
      hasMore: entries.has_more,
      entries: entries.data
        .filter((entry) => entry.currency === "usd" && ["charge", "payment", "stripe_fee", "payout", "transfer"].includes(entry.type))
        .map((entry) => ({
          id: entry.id,
          created: entry.created,
          type: entry.type,
          amountCents: entry.amount,
          feeCents: entry.fee,
          netCents: entry.net,
          description: entry.description ?? "",
          feeDetails: entry.fee_details?.map((detail) => ({
            amountCents: detail.amount,
            description: detail.description ?? "",
          })) ?? [],
        })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[stripe-fees] Failed to load balance transactions", error);
    return NextResponse.json({ error: "Could not load Stripe balance transactions" }, { status: 502 });
  }
}
