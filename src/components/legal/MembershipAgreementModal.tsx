import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface MembershipAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (signature: string) => void;
  memberData: {
    memberId: string;
    memberName: string;
    memberAddress: string;
    email: string;
    planName: string;
    groupCode: string;
    effectiveDate: string;
  };
}

export const MembershipAgreementModal: React.FC<MembershipAgreementModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  memberData,
}) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToConditions, setAgreedToConditions] = useState(false);
  const [signature, setSignature] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSignatureSave = () => {
    if (canvasRef.current) {
      const sig = canvasRef.current.toDataURL();
      setSignature(sig);
    }
  };

  const handleClearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setSignature("");
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom =
      Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    setScrolledToBottom(isAtBottom);
  };

  const isComplete =
    agreedToTerms && agreedToConditions && signature && scrolledToBottom;

  const handleAccept = () => {
    if (isComplete) {
      onAccept(signature);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ideal Oral Health Membership Agreement</DialogTitle>
        </DialogHeader>

        {/* Scrollable Agreement Content */}
        <div
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 text-sm"
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Member Information</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium">Member ID:</span> {memberData.memberId}
                </div>
                <div>
                  <span className="font-medium">Member Name:</span> {memberData.memberName}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Address:</span> {memberData.memberAddress}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Email:</span> {memberData.email}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Plan Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium">Plan Name:</span> {memberData.planName}
                </div>
                <div>
                  <span className="font-medium">Group Code:</span> {memberData.groupCode}
                </div>
                <div>
                  <span className="font-medium">Effective Date:</span>{" "}
                  {memberData.effectiveDate}
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold">Terms and Conditions Summary</h3>
              <p>
                By enrolling in this Ideal Oral Health plan, you confirm that you are at
                least 18 years old and authorize Ideal Oral Health to charge your payment
                method for the plan you have selected.
              </p>

              <h4 className="font-medium">Key Terms:</h4>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>This plan is not insurance</li>
                <li>
                  You must pay for all services at the time of service and receive
                  negotiated discounts
                </li>
                <li>Automatic renewal at end of term unless you cancel</li>
                <li>
                  30-day cancellation window for full refund (less processing fee)
                </li>
                <li>Careington may modify participating providers</li>
              </ul>

              <h4 className="font-medium mt-3">Cancellation:</h4>
              <p className="text-xs">
                Contact Ideal Oral Health at 801-820-0010 or info@getidealoh.com to
                cancel within 30 days.
              </p>

              <h4 className="font-medium mt-3">Careington &amp; DialCare Services:</h4>
              <p className="text-xs">
                This membership provides access to Careington&apos;s dental network (20-50%
                discounts) and DialCare&apos;s 24/7 teledentistry services.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                <strong>Important:</strong> Scroll to the bottom to complete the agreement.
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="border-t pt-4 space-y-3">
          <div>
            <label className="text-sm font-semibold mb-2 block">
              Member Signature
            </label>
            <canvas
              ref={canvasRef}
              width={500}
              height={120}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="border rounded bg-white cursor-crosshair w-full"
            />
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSignature}
              >
                Clear
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleSignatureSave}>
                Save Signature
              </Button>
            </div>
            {signature && (
              <p className="text-xs text-green-600 mt-1">✓ Signature captured</p>
            )}
          </div>

          {/* Agreement Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="membership-terms"
                checked={agreedToTerms}
                onCheckedChange={setAgreedToTerms}
              />
              <label htmlFor="membership-terms" className="text-sm">
                I agree to the Membership Terms and understand the coverage terms, billing
                arrangements, and cancellation policy.
              </label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms-conditions"
                checked={agreedToConditions}
                onCheckedChange={setAgreedToConditions}
              />
              <label htmlFor="terms-conditions" className="text-sm">
                I have read and agree to the Terms and Conditions, including automatic
                renewal and cancellation policies.
              </label>
            </div>

            {!scrolledToBottom && (
              <p className="text-xs text-orange-600">
                ⚠ Please scroll to the bottom of the agreement to proceed.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Later
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!isComplete}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Agree & Sign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
