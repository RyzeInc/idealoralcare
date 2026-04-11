import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout | Ideal Health",
  description:
    "Complete your Ideal Health enrollment. Secure checkout powered by Stripe with instant activation.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
