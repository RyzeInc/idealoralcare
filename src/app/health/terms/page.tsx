import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Use | Ideal Health",
  description: "Terms of use for Ideal Health discount program by Ideal.",
};

export default function IdealHealthTermsPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <Button asChild variant="ghost" size="sm" className="mb-6 bg-white/50 hover:bg-white/70">
            <Link href="/health">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Ideal Health
            </Link>
          </Button>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-medium tracking-tight text-[#0F1320] md:text-5xl">
            Terms of Use
          </h1>
          <p className="mt-4 text-[#64748B]">
            Ideal Health Discount Program
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="prose prose-sm max-w-none space-y-6 text-[#354158]">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Important Disclaimer
              </h2>
              <p className="font-semibold text-amber-900">
                THIS DISCOUNT PROGRAM IS NOT INSURANCE
              </p>
              <p className="mt-4">
                The Ideal Health discount program is not intended to replace health insurance. 
                It does not meet the minimum creditable coverage requirements under the Affordable 
                Care Act or Massachusetts M.G.L. c. 111M and 956 CMR 5.00, and it is not a 
                Qualified Health Plan under the Affordable Care Act.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Program Overview
              </h2>
              <p>
                Ideal Health is a discount program offered by Ideal LLC that provides access to 
                discounted health services through a network of participating providers.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Membership Terms
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Discounts Available:</strong> Discounts are available only from participating providers and vary by provider and service.
                </li>
                <li>
                  <strong>Direct Payment Responsibility:</strong> The program does not make payments to providers. Members are responsible for paying the discounted charges directly to participating providers at the time of service unless otherwise stated.
                </li>
                <li>
                  <strong>Provider Changes:</strong> Provider availability and participation may change without notice.
                </li>
                <li>
                  <strong>Cancellation Rights:</strong> You may cancel your membership within 30 days of the effective date or receipt of membership materials (whichever is later) for a refund, less any applicable processing or administrative fees, where permitted.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Your Responsibilities
              </h2>
              <p>
                As a member, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Provide accurate and complete information when enrolling</li>
                <li>Pay participating providers directly for discounted services</li>
                <li>Comply with provider policies and procedures</li>
                <li>Use the program only for authorized purposes</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Limitation of Liability
              </h2>
              <p>
                Ideal LLC and the Ideal Health program are not responsible for the quality, 
                timeliness, or appropriateness of services provided by participating healthcare 
                providers. Members should verify provider credentials and quality independently.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Fees and Payment
              </h2>
              <p>
                Membership fees, where applicable, are non-refundable except as provided by this 
                agreement or applicable law. Discounted services are paid directly to providers at 
                the point of service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Changes to Terms
              </h2>
              <p>
                Ideal LLC reserves the right to modify these terms at any time. Continued membership 
                in the program constitutes acceptance of any modifications.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Contact Information
              </h2>
              <p>
                For questions about these terms or the Ideal Health program, please contact:
              </p>
              <p className="mt-4">
                <strong>Ideal (Ideal LLC)</strong><br />
                1846 Fernando Ln<br />
                Tallahassee, FL 32303<br />
                Email: hello@idealhealth.com
              </p>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-xs text-[#64748B]">
                Last updated: February 19, 2026
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
