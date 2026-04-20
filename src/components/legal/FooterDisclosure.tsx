import React from "react";
import Link from "next/link";

export const FooterDisclosure: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 text-xs py-6 mt-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Main Disclosure */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <p className="leading-relaxed">
            THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance. This plan does not meet the minimum creditable coverage requirements under M.G.L. c.111M and 956 CMR 5.00. This plan is not a Qualified Health Plan under the Affordable Care Act. The range of discounts will vary depending on the type of provider and service. The plan does not pay providers directly. Plan members must pay for all services but will receive a discount from participating providers. The list of participating providers is at https://www.getidealoh.com/health/dashboard. A written list of participating providers is available upon request. You may cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) and receive a full refund. Discount Plan Organization and administrator: Careington International Corporation, 7400 Gaylord Parkway, Frisco, TX 75034; phone 800-441-0380. This plan is not available in Vermont or Washington.
          </p>
        </div>

        {/* Company & Provider Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* Ideal Oral Health */}
          <div>
            <h4 className="font-semibold text-white mb-2">Ideal Oral Health</h4>
            <div className="space-y-1 text-xs">
              <p>
                <strong>Phone:</strong>{" "}
                <a href="mailto:support@getidealoh.com" className="text-blue-400 hover:text-blue-300">
                  support@getidealoh.com
                </a>
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:support@getidealoh.com" className="text-blue-400 hover:text-blue-300">
                  support@getidealoh.com
                </a>
              </p>
              <div className="mt-2">
                <p className="font-medium text-white mb-1">Locations:</p>
                <div className="space-y-1">
                  <p>Northeast: 116 S. Main St, Wallingford CT 06492</p>
                  <p>Southern: 800 S Gay St STE 700, Knoxville TN 37929</p>
                  <p>Texas: 1200 E Ridge Rd STE 1, McAllen TX 78503</p>
                </div>
              </div>
            </div>
          </div>

          {/* Careington & DialCare */}
          <div>
            <h4 className="font-semibold text-white mb-2">Service Providers</h4>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-white">Careington International Corporation</p>
                <p className="text-xs text-gray-400">7400 Gaylord Parkway, Frisco, TX 75034</p>
                <p className="text-xs text-gray-400">
                  <a href="tel:800-441-0380" className="text-blue-400 hover:text-blue-300">
                    800-441-0380
                  </a>
                </p>
              </div>
              <div>
                <p className="font-medium text-white">DialCare Support</p>
                <p className="text-xs text-gray-400">
                  <a href="tel:855-335-2255" className="text-blue-400 hover:text-blue-300">
                    855-335-2255
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Links */}
        <div className="pt-4 border-t border-gray-700 flex flex-wrap gap-4">
          <Link href="/legal/disclosure" className="text-blue-400 hover:text-blue-300">
            Full Disclosure
          </Link>
          <Link href="/legal/terms-conditions" className="text-blue-400 hover:text-blue-300">
            Terms & Conditions
          </Link>
          <Link href="/legal/marketing-language" className="text-blue-400 hover:text-blue-300">
            Plan Details
          </Link>
          <p className="text-gray-500">
            Last Updated: March 2026
          </p>
        </div>
      </div>
    </footer>
  );
};
