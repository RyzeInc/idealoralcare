import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom =
      Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    setScrolledToBottom(isAtBottom);
  };

  const handleAccept = () => {
    if (agreed && scrolledToBottom) {
      onAccept();
      setAgreed(false);
      setScrolledToBottom(false);
    }
  };

  const isComplete = agreed && scrolledToBottom;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
        </DialogHeader>

        {/* Scrollable Terms Content */}
        <div
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 text-sm"
        >
          <div className="space-y-4 prose prose-sm max-w-none">
            <h3 className="font-semibold text-lg">Agreement Terms</h3>
            <p>
              The Terms and Conditions outlined in this document, along with those you
              will accept upon registering at www.dialcare.com, constitute the membership
              agreement (Agreement) between you and DialCare, LLC (&ldquo;DialCare&rdquo;). DialCare
              provides administrative services to DialCare clinicians and does not provide
              professional medical services.
            </p>

            <h3 className="font-semibold">Purchase and Renewal Conditions</h3>
            <p>
              By joining an Ideal Oral Health plan, you confirm that you are at least 18
              years old and you authorize Ideal Oral Health to charge your credit card or
              checking account for the plan you have selected. This charge will
              automatically renew at the end of your membership term until you notify Ideal
              Oral Health that you wish to cancel the plan.
            </p>

            <h3 className="font-semibold">Termination Conditions</h3>
            <p>
              Ideal Oral Health and DialCare reserve the right to terminate plan members
              for any reason, including non-payment. If terminated for a reason other than
              non-payment, you will receive a pro-rata refund of your membership fees.
            </p>

            <h3 className="font-semibold">Cancellation Conditions</h3>
            <p>
              You have the right to cancel within the first 30 days after effective date
              or receipt of membership materials (whichever is later) and receive a full
              refund, less the processing fee, if applicable.
            </p>
            <p>
              To cancel, submit a cancellation request with your name and member ID by
              mail, email (info@getidealoh.com), or phone (801-820-0010). Ideal Oral
              Health will stop collecting membership fees within 30 days after receiving a
              cancellation request.
            </p>

            <h3 className="font-semibold">Description of Services</h3>
            <p>
              This membership provides access to two primary services:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Careington POS Network:</strong> 20-50% discounts on dental
                procedures at participating providers
              </li>
              <li>
                <strong>DialCare Teledentistry:</strong> 24/7/365 virtual dental
                consultations with licensed dentists
              </li>
            </ul>

            <h3 className="font-semibold">Limitations, Exclusions and Exceptions</h3>
            <p>
              This is a discount plan offered by Careington International Corporation
              (Careington) through Ideal Oral Health. Careington is not a licensed
              insurer, health maintenance organization, or other underwriter of health
              care services.
            </p>
            <p>
              <strong>This plan is not insurance.</strong> You are obligated to pay for
              all dental health care services at the time of service. You will receive
              discounts for services at certain health care providers who have contracted
              with the plan.
            </p>
            <p>
              Key limitations include:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Savings vary by location and specific services</li>
              <li>Plan discounts cannot be combined with other discount programs</li>
              <li>
                Services by non-participating providers are not discounted
              </li>
              <li>Providers are subject to change</li>
              <li>It is your responsibility to verify provider participation</li>
              <li>Careington disclaims liability for professional advice and treatment</li>
            </ul>

            <h3 className="font-semibold">Complaint Procedure</h3>
            <p>
              If you wish to file a complaint, submit it in writing to:
            </p>
            <div className="bg-gray-100 p-2 rounded text-xs">
              <p>
                <strong>DialCare</strong>
                <br />
                P.O. Box 2568
                <br />
                Frisco, TX 75034
              </p>
            </div>
            <p>
              You have the right to request an appeal if dissatisfied with the complaint
              resolution. If you remain dissatisfied after completing the complaint
              resolution process, you may contact your state insurance department.
            </p>

            <h3 className="font-semibold">Contact Information</h3>
            <p>
              For questions related to Ideal Oral Health:
            </p>
            <div className="bg-gray-100 p-2 rounded text-xs">
              <p>
                <strong>Ideal Oral Health</strong>
                <br />
                Phone: 801-820-0010
                <br />
                Email: info@getidealoh.com
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
              <strong>Please scroll to the bottom of this document to accept the terms.</strong>
            </div>
          </div>
        </div>

        {/* Acceptance Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms-agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              disabled={!scrolledToBottom}
            />
            <label htmlFor="terms-agree" className="text-sm font-medium">
              I have read and understand the Terms & Conditions stated above. I agree to
              be bound by these terms, including automatic renewal and cancellation
              policies.
            </label>
          </div>

          {!scrolledToBottom && (
            <p className="text-xs text-orange-600 font-medium">
              ⚠ Please scroll to the bottom of the agreement to enable acceptance.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!isComplete}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept Terms
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
