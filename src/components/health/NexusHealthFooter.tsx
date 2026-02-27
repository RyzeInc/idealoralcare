import Link from "next/link";

export function NexusHealthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-gray-100 bg-white py-8 text-sm text-gray-600">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Compliance disclaimer - simple and minimal */}
        <div className="mb-8 space-y-3 text-xs leading-relaxed text-gray-600">
          <p className="font-semibold text-gray-700">
            DISCLAIMER: THIS DISCOUNT PROGRAM IS NOT INSURANCE
          </p>
          
          <p>
            Nexus Health programs are not intended to replace insurance. It does not meet the minimum creditable coverage requirements under the Affordable Care Act or Massachusetts M.G.L. c. 111M and 956 CMR 5.00, and it is not a Qualified Health Plan under the Affordable Care Act.
          </p>

          <p>
            Discounts are available only from participating providers and vary by provider. Members are responsible for paying discounted charges directly to providers. Provider availability may change without notice.
          </p>

          <p>
            You may cancel your membership within 30 days of the effective date for a refund, less applicable fees. For complete terms, disclosures, and cancellation details, see our program documentation.
          </p>

          <p className="text-gray-500">
            Ryze Nexus (Ryze LLC) — 1846 Fernando Ln, Tallahassee, FL 32303
          </p>
        </div>

        {/* Simple footer links */}
        <div className="flex flex-col gap-6 border-t border-gray-100 pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-gray-500">
            © {currentYear} Ryze Inc. All rights reserved.
          </p>

          <div className="flex gap-6">
            <Link href="/health/how-it-works" className="text-xs text-gray-600 hover:text-gray-900">
              How It Works
            </Link>
            <Link href="/health/plans" className="text-xs text-gray-600 hover:text-gray-900">
              Plans
            </Link>
            <Link href="/privacy" className="text-xs text-gray-600 hover:text-gray-900">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-gray-600 hover:text-gray-900">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
