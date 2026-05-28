import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import NewIdealCheckoutClient from "./page.client";

export const metadata = {
  title: "Checkout | New Ideal Health",
};

export default function NewIdealCheckoutPage() {
  return (
    <ClerkProvider>
      <Suspense fallback={null}>
        <NewIdealCheckoutClient />
      </Suspense>
    </ClerkProvider>
  );
}
