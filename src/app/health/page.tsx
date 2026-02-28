import HealthHeader from "@/components/health/HealthHeader";
import {
  OralHero,
  PrincipleSection,
  BenefitGrid,
  PlanCard,
  HowItWorks,
  TrustAnchors,
  FAQSection,
  CTABand,
} from "@/components/health/sections";

export const metadata = {
  title: "Ideal Health Oral Plan | Comprehensive Oral Health Coverage",
  description:
    "Ideal Health Oral Health Plan - Toothlens AI oral scanning, Dial Care teledentistry, and Dental Discount Network Dental Discount Network dental network access. Affordable monthly membership.",
};

/**
 * IDEAL HEALTH - ORAL PLAN LANDING PAGE
 *
 * Crunch Fitness-inspired high-energy design adapted for healthcare:
 * - Full-bleed hero with clear promise
 * - Personalization band (ZIP lookup)
 * - Core principles (4 sections)
 * - Benefit grid
 * - Single comprehensive plan card
 * - How it works (5 steps)
 * - Trust anchors
 * - FAQ
 * - Final CTA band
 *
 * PUBLIC ACCESS - No authentication required
 */

export default function HealthLanding() {
  return (
    <div className="health-landing">
      {/* Shared Header */}
      <HealthHeader />

      {/* HERO SECTION - Full Bleed, High Energy */}
      <OralHero
        headline="Comprehensive Oral Health Care"
        subtitle="AI-powered Toothlens scanning, 24/7 Dial Care teledentistry, and Dental Discount Network Dental Discount Network network discounts—all in one affordable plan."
        bullets={[
          "Toothlens AI scanning for early detection",
          "24/7 teledentistry consultations with licensed dentists",
          "Nationwide dentist network discounts",
        ]}
        primaryCTA={{ text: "See Plan Details", href: "#plan" }}
      />

      {/* PRINCIPLES SECTION - 4 Core Values */}
      <PrincipleSection />

      {/* BENEFIT GRID - What's Included (6 items) */}
      <BenefitGrid />

      {/* PLAN CARD - Single Comprehensive Offering */}
      <PlanCard
        title="Ideal Health Oral Plan"
        description="Everything you need for comprehensive oral health coverage in one affordable plan."
      />

      {/* HOW IT WORKS - 5 Steps (Crunch energy) */}
      <HowItWorks />

      {/* TRUST ANCHORS - Why Choose Ideal Health */}
      <TrustAnchors />

      {/* FAQ SECTION - 8+ Common Questions */}
      <FAQSection />

      {/* FINAL CTA BAND - Conversion Push */}
      <CTABand
        headline="Ready to Start Your Oral Health Journey?"
        subtext="Join thousands of members who are saving money and getting better care with Ideal Health."
        ctaText="Enroll Now"
        ctaHref="/health/checkout"
      />
    </div>
  );
}
