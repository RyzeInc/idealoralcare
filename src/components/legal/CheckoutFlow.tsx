import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MembershipAgreementModal } from "./MembershipAgreementModal";
import { TermsAndConditionsModal } from "./TermsAndConditionsModal";

interface CheckoutFlowProps {
  memberData: {
    memberId: string;
    memberName: string;
    memberAddress: string;
    email: string;
    planName: string;
    groupCode: string;
    effectiveDate: string;
  };
  onCheckoutComplete: (agreementData: {
    membershipTermsSigned: boolean;
    termsAndConditionsAgreed: boolean;
    memberSignature: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

type CheckoutStep = "idle" | "membership-agreement" | "terms-conditions" | "complete";

export const CheckoutFlow: React.FC<CheckoutFlowProps> = ({
  memberData,
  onCheckoutComplete,
  isLoading = false,
}) => {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("idle");
  const [membershipTermsSigned, setMembershipTermsSigned] = useState(false);
  const [termsAndConditionsAgreed, setTermsAndConditionsAgreed] = useState(false);
  const [memberSignature, setMemberSignature] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartCheckout = () => {
    setCurrentStep("membership-agreement");
  };

  const handleMembershipAgreementAccept = (signature: string) => {
    setMembershipTermsSigned(true);
    setMemberSignature(signature);
    setCurrentStep("terms-conditions");
  };

  const handleTermsAndConditionsAccept = () => {
    setTermsAndConditionsAgreed(true);
    setCurrentStep("complete");
  };

  const handleMembershipAgreementClose = () => {
    if (!membershipTermsSigned) {
      setCurrentStep("idle");
    }
  };

  const handleTermsAndConditionsClose = () => {
    if (!termsAndConditionsAgreed) {
      setCurrentStep("membership-agreement");
    }
  };

  const handleFinalCheckout = async () => {
    if (!membershipTermsSigned || !termsAndConditionsAgreed) {
      alert("Please complete both the membership agreement and terms & conditions.");
      return;
    }

    setIsProcessing(true);
    try {
      await onCheckoutComplete({
        membershipTermsSigned,
        termsAndConditionsAgreed,
        memberSignature,
      });
    } catch (error) {
      console.error("Checkout error:", error);
      alert("An error occurred during checkout. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isCheckoutDisabled =
    !membershipTermsSigned || !termsAndConditionsAgreed || isProcessing || isLoading;

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          {membershipTermsSigned ? (
            <span className="text-green-600 font-semibold">✓</span>
          ) : (
            <span className="text-gray-400">○</span>
          )}
          <span className={membershipTermsSigned ? "text-green-700 font-medium" : "text-gray-600"}>
            Membership Agreement Signed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {termsAndConditionsAgreed ? (
            <span className="text-green-600 font-semibold">✓</span>
          ) : (
            <span className="text-gray-400">○</span>
          )}
          <span
            className={
              termsAndConditionsAgreed ? "text-green-700 font-medium" : "text-gray-600"
            }
          >
            Terms & Conditions Accepted
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {currentStep === "idle" ? (
          <Button
            onClick={handleStartCheckout}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Review & Sign Membership Agreement
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleStartCheckout}
              disabled={membershipTermsSigned || isProcessing}
            >
              {membershipTermsSigned ? "✓ Membership Signed" : "Review Agreement"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentStep("terms-conditions")}
              disabled={!membershipTermsSigned || isProcessing}
              className={
                termsAndConditionsAgreed
                  ? "border-green-500 text-green-700"
                  : "border-gray-300"
              }
            >
              {termsAndConditionsAgreed ? "✓ Terms Accepted" : "Review Terms & Conditions"}
            </Button>
          </>
        )}
      </div>

      {/* Checkout Button */}
      <Button
        onClick={handleFinalCheckout}
        disabled={isCheckoutDisabled}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3"
      >
        {isProcessing || isLoading ? (
          <>
            <span className="mr-2 inline-block animate-spin">⌛</span>
            Processing...
          </>
        ) : membershipTermsSigned && termsAndConditionsAgreed ? (
          "Complete Enrollment"
        ) : (
          "Complete Both Steps to Checkout"
        )}
      </Button>

      {!membershipTermsSigned && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
          ⚠ Complete the Membership Agreement to proceed.
        </p>
      )}

      {membershipTermsSigned && !termsAndConditionsAgreed && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
          ⚠ Please review and accept the Terms & Conditions to complete checkout.
        </p>
      )}

      {/* Modals */}
      <MembershipAgreementModal
        isOpen={currentStep === "membership-agreement"}
        onClose={handleMembershipAgreementClose}
        onAccept={handleMembershipAgreementAccept}
        memberData={memberData}
      />

      <TermsAndConditionsModal
        isOpen={currentStep === "terms-conditions"}
        onClose={handleTermsAndConditionsClose}
        onAccept={handleTermsAndConditionsAccept}
      />
    </div>
  );
};
