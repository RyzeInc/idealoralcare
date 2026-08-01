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

  const handleAccept = () => {
    if (agreed) {
      onAccept();
      setAgreed(false);
    }
  };

  const isComplete = agreed;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
        </DialogHeader>

        {/* Scrollable Terms Content */}
        <div className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 text-sm">
          <div className="space-y-6 prose prose-sm max-w-none">

            {/* ── Essentials Plan Section ─────────────────────────────── */}
            <div>
              <h2 className="font-bold text-base text-blue-900 border-b border-blue-200 pb-1 mb-3">
                Essentials Plan — Terms &amp; Conditions
              </h2>

              <h3 className="font-semibold">Description of the Essentials Plan</h3>
              <p>
                The Ideal Health Essentials Plan is a membership program —{" "}
                <strong>NOT insurance</strong> — that provides members access to telehealth
                consultations, prescription savings, lab services, mental wellness support, and
                discounted dental care through our network of participating
                providers. Benefits are available immediately upon your effective date.
              </p>

              <h3 className="font-semibold">Essentials Plan Pricing</h3>
              <ul>
                <li>Employee: $57.95/mo</li>
                <li>Employee + Spouse: $65.95/mo</li>
                <li>Employee + Child(ren): $77.95/mo</li>
                <li>Employee + Family: $82.95/mo</li>
              </ul>

              <h3 className="font-semibold">Eligibility</h3>
              <p>
                Membership is open to individuals ages 2–65. Dependent children must be listed at
                enrollment.
              </p>

              <h3 className="font-semibold">Purchase &amp; Renewal</h3>
              <p>
                By enrolling, you authorize Ryze LLC to charge your selected payment method for the
                plan you have chosen. Your membership will automatically renew each billing period and
                your payment method will be charged until you cancel. Your billing cycle begins on the
                16th of the month; membership becomes effective on the 1st of the following month.
              </p>

              <h3 className="font-semibold">Cancellation</h3>
              <p>
                You may cancel at any time by providing 30 days&apos; written notice to{" "}
                <strong>support@getidealoh.com</strong>. You retain access through the end of the
                paid billing period. To cancel within the first 30 days and receive a full refund,
                contact us with your name and member ID.
              </p>

              <h3 className="font-semibold">Termination</h3>
              <p>
                Ryze LLC reserves the right to terminate membership for any reason, including
                non-payment. If terminated for a reason other than non-payment, you will receive a
                pro-rata refund of prepaid fees.
              </p>

              <h3 className="font-semibold">Limitations &amp; Exclusions</h3>
              <p>
                The Essentials Plan is a discount membership — not a licensed insurer or HMO. No
                provider fees will be reimbursed. You are responsible for paying fees at the time of
                service. Actual savings vary by provider and location. Providers are subject to change
                without notice.
              </p>
            </div>

            {/* ── Oral Care Plan Section ──────────────────────────────── */}
            <div>
              <h2 className="font-bold text-base text-teal-800 border-b border-teal-200 pb-1 mb-3">
                Oral Care Plan — Terms &amp; Conditions
              </h2>

              <h3 className="font-semibold">Description of the Oral Care Plan</h3>
              <p>
                The Ideal Health Oral Care Plan is a savings membership —{" "}
                <strong>NOT insurance</strong> — that combines AI Oral Scanning, 24/7 teledentistry,
                emergency dental support, and the Dental Discount Network. Network savings range
                from 20–60% off at 100,000+ participating dentists nationwide.
              </p>

              <h3 className="font-semibold">Oral Care Plan Pricing</h3>
              <ul>
                <li>Employee: $14.99/mo</li>
                <li>Employee + Family: $24.99/mo</li>
              </ul>

              <h3 className="font-semibold">Included Benefits</h3>
              <ul>
                <li>
                  <strong>AI Oral Scanning</strong> — Photo-based oral health detection with personalized reports.
                </li>
                <li>
                  <strong>24/7 Teledentistry</strong> — Video consultations with experienced dentists.
                </li>
                <li>
                  <strong>Dental Discount Network</strong> — 20–60% off at 100,000+ participating dentists.
                </li>
                <li>
                  <strong>Emergency Support</strong> — Same-day specialist access for urgent dental concerns.
                </li>
              </ul>

              <h3 className="font-semibold">Important Limitations</h3>
              <p>
                This plan is <strong>not insurance</strong>. AI scans are informational and do not
                replace clinical diagnosis. No portion of any provider&apos;s fees will be reimbursed.
                Members pay reduced fees directly to providers at the time of service. Savings vary
                by provider and location and may not be combined with any other savings plan. Verify
                provider participation before receiving services.
              </p>

              <h3 className="font-semibold">Cancellation</h3>
              <p>
                Cancel at any time with 30 days&apos; notice to{" "}
                <strong>support@getidealoh.com</strong>. You retain access through the end of your
                paid billing period.
              </p>
            </div>

            {/* ── General Terms ───────────────────────────────────────── */}
            <div>
              <h2 className="font-bold text-base text-gray-700 border-b border-gray-200 pb-1 mb-3">
                General Terms
              </h2>

              <h3 className="font-semibold">Complaint Procedure</h3>
              <p>Submit complaints in writing to:</p>
              <div className="bg-gray-100 p-2 rounded text-xs">
                <p>
                  <strong>Ideal Health / Ryze LLC</strong><br />
                  1200 E Ridge Rd STE 1, McAllen, TX 78503<br />
                  Email: support@getidealoh.com
                </p>
              </div>
              <p>
                You have the right to appeal if dissatisfied with the complaint resolution. You may
                also contact your state insurance department.
              </p>

              <h3 className="font-semibold">Governing Law</h3>
              <p>
                This agreement is governed by the laws of the State of Texas, without regard to
                conflict of law provisions.
              </p>
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
            />
            <label htmlFor="terms-agree" className="text-sm font-medium">
              I have read and understand the Terms & Conditions stated above. I agree to
              be bound by these terms, including automatic renewal and cancellation
              policies.
            </label>
          </div>

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
