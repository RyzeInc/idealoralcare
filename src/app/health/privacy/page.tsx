import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | Ideal Health",
  description: "Privacy policy for Ideal Health discount program by Ideal.",
};

export default function IdealHealthPrivacyPage() {
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
            Privacy Policy
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
            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Introduction
              </h2>
              <p>
                This Privacy Policy explains how Ideal ("we," "us," "our," or "Company") 
                collects, uses, discloses, and otherwise processes personal information in 
                connection with the Ideal Health discount program.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Information We Collect
              </h2>
              <p>
                We may collect information you provide directly, such as:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Name, email address, and contact information</li>
                <li>Health-related information needed to facilitate discounts</li>
                <li>Payment and billing information</li>
                <li>Communication preferences</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                How We Use Your Information
              </h2>
              <p>
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Operate and maintain the Ideal Health program</li>
                <li>Process your enrollment and manage your membership</li>
                <li>Communicate with you about the program and updates</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Information Sharing
              </h2>
              <p>
                We may share information with participating healthcare providers to facilitate 
                discounted services. We do not sell your personal information to third parties.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Data Security
              </h2>
              <p>
                We implement appropriate technical and organizational measures to protect your 
                personal information. However, no method of transmission over the internet is 
                completely secure.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Your Rights and Choices
              </h2>
              <p>
                You may have rights regarding your personal information, including the right to 
                access, correct, or delete your information. Contact us for more information about 
                your rights.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#0F1320] mb-4">
                Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy or our privacy practices, please 
                contact us at:
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
