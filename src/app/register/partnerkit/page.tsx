import type { Metadata } from "next";
import { PartnerRegistrationForm } from "./PartnerRegistrationForm";

export const metadata: Metadata = {
  title: "Partner Registration | Ideal Oral Health",
  description:
    "Register your agency or business to partner with Ideal Oral Health. Get access to our partner kit and learn about our oral savings plans.",
  alternates: { canonical: "/register/partnerkit" },
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[#F6F4F1] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#5F64E8]/10 text-[#5F64E8] text-sm font-medium px-3 py-1 rounded-full mb-4">
            Agency &amp; Partner Network
          </div>
          <h1 className="text-3xl font-bold text-[#0F1320] mb-3">
            Let&apos;s Work Together
          </h1>
          <p className="text-[#64748B] text-base">
            Tell us about your business and we&apos;ll follow up with everything
            you need to get started.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-[#E8E3DF] shadow-sm p-8">
          <PartnerRegistrationForm />
        </div>

        {/* Already licensed and ready to formally apply */}
        <p className="mt-6 text-center text-sm text-[#64748B]">
          Already a licensed broker, agency, or rep ready to onboard?{" "}
          <a href="/register/rep" className="font-medium text-[#5F64E8] hover:underline">
            Complete the full partner application →
          </a>
        </p>
      </div>
    </main>
  );
}
