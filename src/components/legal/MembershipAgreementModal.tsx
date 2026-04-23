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
  const [hasStroke, setHasStroke] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    setHasStroke(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setSignature("");
    setHasStroke(false);
  };

  const isComplete =
    agreedToTerms && agreedToConditions && hasStroke;

  const handleAccept = () => {
    if (isComplete && canvasRef.current) {
      const sig = canvasRef.current.toDataURL();
      onAccept(sig);
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
              <p>
                The Terms and Conditions you have accepted or will accept upon registering at www.dialcare.com, 
                are part of this membership agreement (Agreement) between you and DialCare, LLC ("DialCare"). 
                DialCare provides administrative services to DialCare clinicians and does not provide professional medical services.  
                The Terms and Conditions define the obligations of DialCare, its authorized agents and yourself, 
                and they establish the basic rules of safe and fair use of DialCare's public website, member website, and services (Services). 
                DialCare and its authorized agents reserve the right to immediately and without advance notice terminate the Services 
                and deny access to individuals who do not abide by the Terms and Conditions. 
              </p>

              <p>
                To add a family member to your plan or change mode of payment, contact Ideal Oral Health at support@getidealoh.com. For assistance using your plan, please call Member Services at 1-855-335-2255.
              </p>

              <h3 className="font-semibold">Purchase and Renewal Conditions</h3>
              <p>
                By joining a plan, for yourself or on behalf of a minor child for whom you are a parent or legal guardian, 
                you confirm that you are at least 18 years old and you authorize Ryze LLC to charge your credit card or checking account for the plan you have selected. 
                By joining, you indicate you have read and agree to the terms and conditions of the plan. 
              </p>
              <p>
                <em>This charge will automatically renew at the end of your membership term, and your credit card or checking account will be automatically charged for the appropriate amount, until you notify Ideal Health that you wish to cancel the plan.</em>
              </p>

              <h3 className="font-semibold">Termination Conditions</h3>
              <p>
                Ryze LLC and DialCare reserve the right to terminate plan members from its plan for any reason, including non-payment. 
                If Ryze LLC terminates the plan or your membership for a reason other than non-payment, you will receive a pro-rata refund of your membership fees.
              </p>

              <h3 className="font-semibold">Cancellation Conditions</h3>
              <p>
                You have the right to cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) 
                and receive a full refund. 
                If for any reason you wish to cancel, submit a cancellation request with your name and member ID by mail to Ryze LLC, 
                1200 E Ridge Rd STE 1, McAllen TX 78503, or email support@getidealoh.com. 
                Ryze LLC will stop collecting membership fees in a reasonable amount of time, but no later than 30 days after receiving a cancellation request. 
                
              </p>
              <p>
                When you cancel, you will continue to have access to the plan for the remainder of the period for which you have paid; 
                your membership will terminate at the end of that period. 
                The preceding sentence does not apply to quarterly, semi-annual or annual memberships in FL and OK, 
                where you will receive a pro-rata refund whenever you cancel.
              </p>

              <h3 className="font-semibold">Description of Services</h3>
              <p>
                Please see the enclosed materials for a specific description of the programs included in your plan. 
              </p>

              <h3 className="font-semibold">Limitations, Exclusions and Exceptions</h3>
              <p>
                This is a discount plan offered by Careington. 
                Careington is not a licensed insurer, health maintenance organization or other underwriter of health care services. 
                This plan is not insurance. No portion of any provider's fees will be reimbursed or otherwise paid by Careington. 
                Careington is not licensed to provide and does not provide health care services or items to individuals. 
                You will receive discounts for services at certain health care providers who have contracted with the plan. 
                You are obligated to pay for all health care services at the time of service. Savings are based upon the provider's normal fees. 
                Actual savings will vary depending upon location and specific services or products purchased. 
                Please verify such services with each individual provider. 
                The plan's discounts may not be used in conjunction with any other discount plan or program. 
                All listed or quoted prices are current prices by participating providers and subject to change without notice. 
              </p>
              <p>
                Any procedures performed by a non-participating provider are not discounted. 
                From time to time, certain providers may offer products or services to the general public at prices lower than the discounted prices available through this plan. 
                In such event, members will be charged the lowest price. Discounts on professional services are not available when prohibited by law. 
                This plan does not discount all procedures. Providers are subject to change without notice and services may vary in some states. 
                It is your responsibility to verify that the provider participates in the plan. 
                At any time Careington may substitute a provider network at its sole discretion. 
                Careington cannot guarantee the continued participation of any provider. 
                If the provider leaves the plan, you will need to select another provider. 
                Providers contracted by Careington are solely responsible for the professional advice and treatment rendered to members and 
                Careington disclaims any liability with respect to such matters
              </p>

              <h3 className="font-semibold">Complaint Procedure</h3>
              <p>
                If you would like to file a complaint, you must submit your complaint in writing to:  
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
                You have the right to request an appeal if you are dissatisfied with the complaint resolution. 
                After completing the complaint resolution process, if you remain dissatisfied you may contact your state insurance department. 
                Contact information for your state insurance department is available upon request.
              </p>


            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="border-t pt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">
                Member Signature
              </label>
              {hasStroke && (
                <span className="text-sm text-green-600">✓ Signature captured</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSignature}
              >
                Clear
              </Button>
            </div>
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
