"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OralCareTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (signature: string) => void;
  planName?: string;
  memberData?: {
    memberName?: string;
    email?: string;
  };
}

export const OralCareTermsModal: React.FC<OralCareTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  planName,
  memberData,
}) => {
  const [agreed, setAgreed] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const startTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setIsDrawing(true);
    setHasStroke(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(
        (touch.clientX - rect.left) * (canvasRef.current.width / rect.width),
        (touch.clientY - rect.top) * (canvasRef.current.height / rect.height)
      );
    }
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.lineTo(
        (touch.clientX - rect.left) * (canvasRef.current.width / rect.width),
        (touch.clientY - rect.top) * (canvasRef.current.height / rect.height)
      );
      ctx.stroke();
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasStroke(false);
  };

  const handleAccept = () => {
    if (agreed && hasStroke && canvasRef.current) {
      onAccept(canvasRef.current.toDataURL());
      clearSignature();
      setAgreed(false);
    }
  };

  const handleClose = () => {
    clearSignature();
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
            {(planName || memberData) && (
              <div className="bg-white border rounded p-3 space-y-1 text-xs">
                {memberData?.memberName && (
                  <div><span className="font-medium">Member:</span> {memberData.memberName}</div>
                )}
                {memberData?.email && (
                  <div><span className="font-medium">Email:</span> {memberData.email}</div>
                )}
                {planName && (
                  <div><span className="font-medium">Plan:</span> {planName}</div>
                )}
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
                provides AI-powered oral health tools, 24/7 teledentistry, and access to a network of
                participating dentists who have agreed to offer reduced rates to members. It is not a
                substitute for dental insurance and does not satisfy any insurance coverage requirements.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Included Benefits</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>AI Oral Scanning:</strong> Photo-based oral health detection and personalized
                  health reports. AI scans are informational and do not replace clinical diagnosis by a
                  licensed dentist.
                </li>
                <li>
                  <strong>24/7 Teledentistry:</strong> Video consultations with experienced dentists.
                  Availability and response times may vary.
                </li>
                <li>
                  <strong>Dental Discount Network:</strong> 20–60% off dental procedures at 100,000+
                  participating dentists nationwide. Savings vary by provider and procedure. Not all
                  procedures qualify for savings.
                </li>
                <li>
                  <strong>Emergency Support:</strong> Same-day access to specialists for urgent dental
                  concerns through the teledentistry platform.
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Provider Network</h4>
              <p>
                Dental network savings are only available at participating providers. Provider
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

        {/* Checkbox + Signature */}
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

          {/* Signature */}
          <div>
            <p className="text-sm font-medium mb-1">
              Sign below to confirm your acceptance:
            </p>
            <div className="border rounded bg-white" style={{ cursor: "crosshair" }}>
              <canvas
                ref={canvasRef}
                width={580}
                height={120}
                className="w-full"
                style={{ touchAction: "none" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startTouch}
                onTouchMove={drawTouch}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
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

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!agreed || !hasStroke}
              className="flex-1"
            >
              Sign &amp; Accept Oral Care Terms
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
