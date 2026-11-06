"use client";
import { PROVIDER_GROUP_CODE } from "@/lib/constants";
import { useRef, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isMembershipProgramSlug } from "@/convex/lib/productSlugs";
import type { CartState } from "@/lib/health-plans/types";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { checkoutAddress, type CheckoutProfile } from "@/lib/checkout-profile";

export function useCheckoutEnrollment(
  cart: CartState,
  userId?: string,
  email?: string,
) {
  const { isAuthenticated } = useConvexAuth();
  const saveAgreement = useMutation(
    api.legal.membershipAgreements.createMembershipAgreement,
  );
  const [intake, setIntake] = useState<{
    userId: string;
    profile: CheckoutProfile;
  } | null>(null);
  const profile = intake && intake.userId === userId ? intake.profile : null;
  const fingerprint = JSON.stringify([
    userId,
    profile,
    cart.cadence,
    cart.paymentMethod,
    cart.items.map((item) => [
      item.productId,
      getPrice(item.product, cart.cadence, cart.paymentMethod),
    ]),
  ]);
  const [signatures, setSignatures] = useState<
    Record<string, { fingerprint: string; signature: string; signedAt: number }>
  >({});
  const saved = useRef(new Map<string, string>());
  const canSign = Boolean(userId && isAuthenticated && profile);
  const hasSignature = (family: "membership" | "oral") =>
    signatures[family]?.fingerprint === fingerprint;
  const recordSignature = (
    family: "membership" | "oral",
    signature: string,
  ) => {
    if (!canSign || !signature) return;
    setSignatures((prev) => ({
      ...prev,
      [family]: { fingerprint, signature, signedAt: Date.now() },
    }));
  };
  return {
    profile,
    canSign,
    hasSignature,
    recordSignature,
    fingerprint,
    resetProfile: () => setIntake(null),
    confirmProfile: (profile: CheckoutProfile) => {
      if (userId) setIntake({ userId, profile });
    },
    prepareCheckout: async () => {
      if (!canSign || !profile || !userId || !email)
        throw new Error(
          "Complete your account and member details before continuing.",
        );
      return await Promise.all(
        cart.items.map(async (item) => {
          const family = isMembershipProgramSlug(item.product.slug)
            ? "membership"
            : "oral";
          const signed = signatures[family];
          if (!signed || signed.fingerprint !== fingerprint)
            throw new Error(
              "Review and sign the agreements for your current selections.",
            );
          const key = `${fingerprint}:${item.productId}:${signed.signedAt}`;
          const existing = saved.current.get(key);
          if (existing) return existing;
          const result = await saveAgreement({
            productId:
              item.productId as import("@/convex/_generated/dataModel").Id<"catalogProducts">,
            userId,
            memberId: userId,
            memberName: `${profile.firstName} ${profile.lastName}`,
            memberAddress: checkoutAddress(profile),
            email,
            planName: item.product.name,
            groupCode:
              family === "membership" ? "ESSENTIALS" : PROVIDER_GROUP_CODE,
            term: cart.cadence === "monthly" ? "Monthly" : "Annual",
            classification: item.product.name.toLowerCase().includes("family")
              ? "Member and Family"
              : "Member Only",
            paymentMode:
              cart.paymentMethod === "ach" ? "Bank Draft" : "Credit Card",
            periodicCharge: formatPrice(
              getPrice(item.product, cart.cadence, cart.paymentMethod),
            ),
            processingFee: "$0.00",
            membershipTermsAgreed: true,
            termsAndConditionsAgreed: true,
            memberSignature: signed.signature,
            signatureTimestamp: signed.signedAt,
          });
          saved.current.set(key, result.agreementId);
          return result.agreementId;
        }),
      );
    },
  };
}
