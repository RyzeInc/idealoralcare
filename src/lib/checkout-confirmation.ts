import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
export type CheckoutConfirmation = "received" | "processing" | "unverified";
/** Read-only receipt check. A confirmation page never provisions membership. */
export async function checkoutConfirmation(
  sessionId: string | undefined,
): Promise<CheckoutConfirmation> {
  if (
    !sessionId ||
    !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId) ||
    !process.env.STRIPE_SECRET_KEY
  )
    return "unverified";
  const { userId } = await auth();
  if (!userId) return "unverified";
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.clerkUserId !== userId) return "unverified";
    if (session.status !== "complete") return "unverified";
    return session.payment_status === "paid" ||
      session.payment_status === "no_payment_required"
      ? "received"
      : "processing";
  } catch {
    return "unverified";
  }
}
