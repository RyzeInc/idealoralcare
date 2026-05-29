"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OralCareTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  planName?: string;
}

export const OralCareTermsModal: React.FC<OralCareTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  planName,
}) => {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (agreed) {
      onAccept();
      setAgreed(false);
    }
  };

  const handleClose = () => {
    setAgreed(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Oral Care Savings Membership Terms</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 text-sm">
          <div className="space-y-4">
            {planName && (
              <div className="bg-white border rounded p-3 text-xs">
                <span className="font-medium">Plan:</span> {planName}
              </div>
            )}

            <h3 className="font-semibold text-base">Oral Care Savings Membership — Terms &amp; Conditions</h3>

            <p>
              By enrolling in the Ideal Health Oral Care Savings Membership ("Oral Care Plan"), you acknowledge
              that you have read, understood, and agree to these terms.
            </p>

            <div>
              <h4 className="font-semibold mb-1">Plan Pricing</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Employee: $14.99/mo</li>
                <li>Employee + Family: $24.99/mo</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Nature of the Plan — NOT Insurance</h4>
              <p>
                <strong>This is a savings membership program, NOT insurance.</strong> The Oral Care Plan
                provides access to a network of participating dental, vision, and hearing providers who have
                agreed to offer reduced rates to members. It is not a substitute for dental, vision, or
                hearing insurance and does not satisfy any insurance coverage requirements.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Included Savings</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Dental Savings:</strong> 20–60% off dental procedures at 100,000+ participating
                  dentists nationwide through the Dental Savings Network. Savings vary by provider and
                  procedure. Not all procedures qualify for savings.
                </li>
                <li>
                  <strong>Vision Savings:</strong> Savings on eye exams, glasses frames, lenses, and
                  contacts at participating optical providers. Savings amounts vary by provider.
                </li>
                <li>
                  <strong>Hearing Care Savings:</strong> Savings on hearing exams and hearing aid
                  devices at participating hearing care providers.
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Provider Network</h4>
              <p>
                Savings are only available at participating providers within the network. Provider
                availability varies by location. Members are responsible for verifying provider
                participation and savings amounts prior to receiving services. Ideal Health does not
                guarantee the availability of any specific provider.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Payment and Billing</h4>
              <p>
                By enrolling, you authorize Ideal Health to charge your payment method the monthly
                membership fee for the Oral Care Plan. Charges will renew automatically each month
                until cancelled.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Cancellation</h4>
              <p>
                You may cancel this membership at any time by contacting Ideal Health at{" "}
                <strong>info@getidealhealth.com</strong>. To avoid charges for the following month,
                cancellation requests must be received at least <strong>30 days in advance</strong> of
                your next billing date. You will retain access to your savings through the end of
                your paid period.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Limitation of Liability</h4>
              <p>
                Ideal Health is not responsible for the quality of care or services provided by network
                providers, or for any savings amounts that may differ from those advertised. Ideal Health&apos;s
                liability is limited to fees paid in the three months prior to any claim.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Governing Law</h4>
              <p>
                These Terms are governed by the laws of the jurisdiction in which Ideal Health operates.
              </p>
            </div>
          </div>
        </div>

        {/* Agreement */}
        <div className="pt-3 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              I have read and understand that the Oral Care Plan is a savings membership,{" "}
              <strong>NOT insurance</strong>, and I agree to the terms above.
            </span>
          </label>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!agreed}
              className="flex-1"
            >
              Accept Oral Care Terms
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
