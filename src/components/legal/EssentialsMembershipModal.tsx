"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/health-plans/types";

interface EssentialsMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (signature: string) => void;
  memberData: {
    memberName: string;
    email: string;
    planName: string;
    periodicChargeCents: number;
  };
}

export const EssentialsMembershipModal: React.FC<EssentialsMembershipModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  memberData,
}) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formattedPrice = formatPrice(memberData.periodicChargeCents);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    setHasStroke(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(
        (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
        (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
      );
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.lineTo(
        (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
        (e.clientY - rect.top) * (canvasRef.current.height / rect.height)
      );
      ctx.stroke();
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasStroke(false);
  };

  const handleAccept = () => {
    if (agreedToTerms && hasStroke && canvasRef.current) {
      onAccept(canvasRef.current.toDataURL());
    }
  };

  const handleClose = () => {
    clearSignature();
    setAgreedToTerms(false);
    onClose();
  };

  const isComplete = agreedToTerms && hasStroke;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Essentials Membership Agreement</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded p-3 bg-gray-50 text-sm min-h-0">
          <div className="space-y-3">
            {/* Member + Plan Summary */}
            <div className="bg-white border rounded p-2 space-y-0.5 text-xs">
              <div><span className="font-medium">Member:</span> {memberData.memberName}</div>
              <div><span className="font-medium">Email:</span> {memberData.email}</div>
              <div><span className="font-medium">Plan:</span> {memberData.planName}</div>
              <div><span className="font-medium">Monthly charge:</span> {formattedPrice}/mo</div>
              <div><span className="font-medium">Effective date:</span> First day of the month following enrollment</div>
            </div>

            <h3 className="font-semibold text-base">Essentials Terms and Conditions</h3>
            <p>
              These terms and conditions ("Terms") outline the agreement between you ("Member") and Ideal Health
              Essentials ("Provider") regarding the Ideal Health Essentials Monthly Membership Plan ("Membership
              Plan"). By enrolling in the Membership Plan, you acknowledge that you have read, understood, and
              agree to these Terms.
            </p>

            <div>
              <h4 className="font-semibold mb-1">Plan Details</h4>
              <p className="mb-1">
                The Ideal Health Essentials Plan Membership offers several options:
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Individual Plan: $57.95 per month</li>
                <li>Member and Spouse: $65.95 per month</li>
                <li>Member and Child: $77.95 per month</li>
                <li>Family Plan: $82.95 per month</li>
              </ul>
              <p className="mt-1">
                <strong>This Membership Plan is NOT insurance</strong> and does not satisfy ACA minimum essential
                coverage. The Membership Plan does not cover any additional medical services or treatments beyond
                what is explicitly stated in the plan documents.
              </p>
              <p className="mt-1">
                Individuals ages 2 to 65 are eligible for Ideal Health membership. Dependents under the age of
                two are not eligible. Dependent children are eligible until the last day of their 25th year.
                Individuals are eligible until the last day of their 64th year.
              </p>
              <p className="mt-1">
                Telehealth and discount programs are provided through third-party organizations and are not
                connected to our Essentials provider.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Payment and Billing</h4>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>By enrolling, you authorize Provider to charge your credit card automatically each month.</li>
                <li>All charges will be processed in the currency specified at the time of enrollment.</li>
                <li>It is your responsibility to ensure your credit card information remains up to date.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Billing Cycle</h4>
              <p>
                The billing cycle commences on the <strong>16th day of each calendar month</strong> and continues
                for a period of one calendar month, concluding on the 15th day of the following month.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Effective Date</h4>
              <p>
                The effective date shall be on the <strong>first day of the month following</strong> the billing
                cycle during which the member enrolled and paid for the plan.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Cancellation Policy</h4>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>
                  To cancel, notify Provider via email at{" "}
                  <strong>info@getidealhealth.com</strong>.
                </li>
                <li>
                  Cancellation requests must be received at least <strong>30 days in advance</strong> to avoid
                  charges for the following month.
                </li>
                <li>
                  Requests received within less than 30 days will result in a charge for the subsequent month.
                </li>
                <li>Provider will send a confirmation email upon receipt of your cancellation request.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Termination or Modification by Provider</h4>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Provider reserves the right to terminate or modify the Membership Plan with 30 days prior notice.</li>
                <li>Non-payment shall result in cancellation of the plan on the last day of the month.</li>
                <li>
                  A Member is considered in default if their payment method fails and they do not provide an
                  alternative method by the close of business at the end of the billing cycle.
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Limitation of Liability</h4>
              <p>
                Provider shall not be liable for any indirect, incidental, special, consequential, or punitive
                damages arising out of the Membership Plan or its termination. Provider&apos;s liability shall be
                limited to the total amount paid by the Member during the three-month period immediately preceding
                the claim.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Governing Law</h4>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in
                which Provider operates.
              </p>
            </div>
          </div>
        </div>

        {/* Agreement checkbox */}
        <div className="pt-2 space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              I have read, understood, and agree to the Ideal Health Essentials Terms and Conditions above.
            </span>
          </label>

          {/* Signature */}
          <div>
            <p className="text-sm font-medium mb-1">
              Sign below to complete your membership agreement:
            </p>
            <div className="border rounded bg-white" style={{ cursor: "crosshair" }}>
              <canvas
                ref={canvasRef}
                width={580}
                height={80}
                className="w-full"
                style={{ touchAction: "none" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center mt-0.5">
              <p className="text-xs text-gray-500">Draw your signature above</p>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs text-blue-600 underline"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-0.5">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!isComplete}
              className="flex-1"
            >
              Sign & Accept Agreement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
