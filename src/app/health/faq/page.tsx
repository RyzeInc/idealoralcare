import type { Metadata } from "next";
import Link from "next/link";
import HealthHeader from "@/components/health/HealthHeader";
import { FAQJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Ideal Health Oral Health Plan",
  description:
    "Get answers to common questions about Ideal Health oral health plans, dental discount networks, teledentistry, AI oral scanning, pricing, and how to enroll.",
  alternates: { canonical: "/health/faq" },
  openGraph: {
    title: "FAQ — Ideal Health Oral Health Plans",
    description:
      "Everything you need to know about dental discount plans, teledentistry, AI oral scanning, and Ideal Health membership.",
    url: "https://getidealoh.com/health/faq",
    images: [
      { url: "/health-assets/og-default.png", width: 1200, height: 630 },
    ],
  },
};

const FAQ_SECTIONS = [
  {
    heading: "General Dental Questions",
    questions: [
      {
        question: "What is a dental discount plan?",
        answer:
          "A dental discount plan is a membership program that gives you access to a network of dentists who have agreed to offer reduced rates — typically 20–60% off standard fees. Unlike insurance, there are no claims to file, no waiting periods, no deductibles, and no annual maximums. You pay the discounted price directly to the dentist at the time of service.",
      },
      {
        question: "How much does dental care cost without insurance?",
        answer:
          "Without insurance or a discount plan, common dental procedures cost roughly: routine cleaning $75–$200, comprehensive exam $50–$150, bitewing X-rays $25–$100, simple filling $150–$300, crown $800–$1,700, root canal $700–$1,800, and a dental implant $3,000–$5,000. Costs vary significantly by location. A dental discount plan can reduce these prices by 20–60%.",
      },
      {
        question: "What are the alternatives to dental insurance?",
        answer:
          "The main alternatives are: dental discount plans (membership-based networks with negotiated rates), dental schools (supervised students provide care at 50–70% off), community health centers/FQHCs (sliding-scale fees based on income), in-office membership plans offered by individual dental practices, and health savings accounts (HSAs) for tax-free payment of dental expenses.",
      },
      {
        question: "What is teledentistry?",
        answer:
          "Teledentistry is remote dental care delivered via phone or video call with a licensed dentist. It's used for consultations, triaging dental emergencies, getting second opinions, receiving prescriptions (when appropriate), and general oral health guidance — without visiting a dental office. Many dental membership plans now include teledentistry as a standard benefit.",
      },
      {
        question: "What is AI oral health scanning?",
        answer:
          "AI oral health scanning uses artificial intelligence to analyze photos of your teeth and gums taken with a smartphone camera. The technology can identify visible concerns like tartar buildup, potential cavities, gum inflammation, and tooth damage. It's a screening tool for monitoring oral health between professional visits — not a replacement for dental exams or X-rays.",
      },
    ],
  },
  {
    heading: "About Ideal Health",
    questions: [
      {
        question: "What is Ideal Health?",
        answer:
          "Ideal Health is an oral health membership that combines three powerful tools: AI Oral Scanning from your smartphone, 24/7 teledentistry consultations with licensed dentists, and access to a nationwide Dental Discount Network of 140,000+ providers — saving members 20–58% on dental procedures.",
      },
      {
        question: "Is Ideal Health dental insurance?",
        answer:
          "No. Ideal Health is a dental discount program, not insurance. There are no claims to file, no waiting periods, no annual maximums, and no deductibles. You pay the discounted price directly to your dentist at the time of service.",
      },
      {
        question: "Who is Ideal Health for?",
        answer:
          "Ideal Health is for anyone who wants affordable dental care — whether you're uninsured, self-employed, retired, between jobs, or simply looking for a more affordable alternative to traditional dental insurance. Plans are available for individuals and families.",
      },
    ],
  },
  {
    heading: "Plans & Pricing",
    questions: [
      {
        question: "How much does Ideal Health cost?",
        answer:
          "Individual plans start at $14.99/month and family plans (unlimited dependents) start at $24.99/month. Annual billing options are also available at a discount. There are no hidden fees, deductibles, or additional costs beyond your membership and the discounted service price.",
      },
      {
        question: "What's included in every plan?",
        answer:
          "Every Ideal Health plan includes AI Oral Health Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network with 140,000+ participating providers. Family plans include unlimited dependents.",
      },
      {
        question: "What's the difference between individual and family plans?",
        answer:
          "The individual plan covers one adult member. The family plan covers one primary member plus unlimited dependents (spouse, children, etc.) for $24.99/month — making it significantly more cost-effective for households with two or more people.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. You can cancel your Ideal Health membership at any time from your member dashboard. There are no cancellation fees or long-term contracts.",
      },
    ],
  },
  {
    heading: "Dental Discount Network",
    questions: [
      {
        question: "How much can I save with the dental discount network?",
        answer:
          "Members save 20–58% on most dental procedures. For example: routine cleanings drop from $133 to $63 (53% savings), crowns from $1,556 to $699 (55% savings), and root canals from $1,638 to $685 (58% savings).",
      },
      {
        question: "How do I find a dentist in the network?",
        answer:
          "After enrolling, you can search for participating providers in your area through your member dashboard. The network includes over 140,000 general dentists and specialists nationwide.",
      },
      {
        question: "Are there waiting periods before I can use the dental discount?",
        answer:
          "No. Your Ideal Health membership activates within 24 hours of enrollment. You can start using your discounts immediately — there are no waiting periods for any procedure.",
      },
      {
        question: "Is there a limit to how much I can save each year?",
        answer:
          "No. Unlike dental insurance, which typically caps benefits at $1,000–$2,000 per year, the Dental Discount Network has no annual maximums. You can save on unlimited procedures throughout the year.",
      },
    ],
  },
  {
    heading: "Teledentistry",
    questions: [
      {
        question: "What is teledentistry?",
        answer:
          "Teledentistry is virtual dental care. With Ideal Health, you can connect with a licensed dentist 24/7 via phone or video call to get diagnoses, treatment recommendations, prescriptions (when clinically appropriate), and second opinions — all from home.",
      },
      {
        question: "When should I use teledentistry?",
        answer:
          "Use teledentistry for toothaches, broken or chipped teeth, gum swelling, mouth sores, orthodontic questions, second opinions, post-procedure concerns, and general dental guidance. It's especially useful for nights, weekends, and emergencies when your regular dentist is unavailable.",
      },
      {
        question: "Can teledentistry replace going to the dentist?",
        answer:
          "Teledentistry complements in-person care — it can't replace procedures like cleanings, fillings, or extractions. But it can help you determine whether an in-person visit is needed, saving you time and money on unnecessary appointments.",
      },
    ],
  },
  {
    heading: "AI Oral Health Scanning",
    questions: [
      {
        question: "How does AI oral health scanning work?",
        answer:
          "Using your smartphone camera, you take photos of your teeth and gums. Our AI technology analyzes the images to detect potential issues like tartar buildup, cavities, gum inflammation, and tooth damage — then provides a personalized oral health report.",
      },
      {
        question: "Is the AI scan a replacement for dental X-rays or exams?",
        answer:
          "No. The AI oral health scan is a screening tool that helps you monitor your dental health between professional visits. It can identify visible surface-level concerns but cannot detect issues below the gumline or inside teeth like X-rays can.",
      },
      {
        question: "How accurate is the AI scan?",
        answer:
          "The AI model has been trained on thousands of dental images and identifies visible dental concerns with high accuracy. Results should be discussed with a dental professional — which is why Ideal Health includes 24/7 teledentistry in every plan.",
      },
    ],
  },
  {
    heading: "Getting Started",
    questions: [
      {
        question: "How do I sign up?",
        answer:
          "Visit our plans page, choose individual or family, select monthly or annual billing, and complete checkout. Your membership activates within 24 hours. No paperwork, no approval process.",
      },
      {
        question: "Can I use Ideal Health alongside dental insurance?",
        answer:
          "Yes. Some members use Ideal Health as a supplement to their insurance — using the dental discount network for procedures not covered by their plan, or using teledentistry and AI scanning for convenience between covered visits.",
      },
      {
        question: "Is there a contract or commitment?",
        answer:
          "No long-term contracts. Monthly plans renew monthly and can be canceled anytime. Annual plans provide a discounted rate and renew annually.",
      },
    ],
  },
];

// Flatten all Q&As for the JSON-LD schema
const ALL_QUESTIONS = FAQ_SECTIONS.flatMap((s) =>
  s.questions.map((q) => ({
    question: q.question,
    answer: q.answer,
  }))
);

export default function FAQPage() {
  return (
    <div className="health-landing">
      <HealthHeader />

      <FAQJsonLd questions={ALL_QUESTIONS} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://getidealoh.com/health" },
          { name: "FAQ", url: "https://getidealoh.com/health/faq" },
        ]}
      />

      <section className="section" style={{ padding: "4rem 0" }}>
        <div
          className="container"
          style={{ maxWidth: "860px", margin: "0 auto" }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h1
              style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                marginBottom: "1rem",
              }}
            >
              Frequently Asked Questions
            </h1>
            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--text-secondary)",
                maxWidth: "600px",
                margin: "0 auto",
              }}
            >
              Everything you need to know about Ideal Health oral health plans.
              Can&apos;t find what you&apos;re looking for?{" "}
              <a
                href="mailto:info@getidealoh.com"
                style={{ color: "var(--primary-blue)" }}
              >
                Contact us
              </a>
              .
            </p>
          </div>

          {FAQ_SECTIONS.map((section) => (
            <div key={section.heading} style={{ marginBottom: "3rem" }}>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--primary-blue)",
                  marginBottom: "1.5rem",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid rgba(0,102,204,0.15)",
                }}
              >
                {section.heading}
              </h2>

              {section.questions.map((q) => (
                <details
                  key={q.question}
                  style={{
                    marginBottom: "1rem",
                    padding: "1.25rem 1.5rem",
                    borderRadius: "12px",
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <summary
                    style={{
                      fontWeight: 600,
                      fontSize: "1.05rem",
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                      listStyle: "none",
                    }}
                  >
                    {q.question}
                  </summary>
                  <p
                    style={{
                      marginTop: "1rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.7,
                      fontSize: "0.95rem",
                    }}
                  >
                    {q.answer}
                  </p>
                </details>
              ))}
            </div>
          ))}

          {/* CTA */}
          <div
            style={{
              marginTop: "2rem",
              padding: "2rem",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, rgba(0,102,204,0.08) 0%, rgba(20,184,166,0.06) 100%)",
              border: "1px solid rgba(0,102,204,0.15)",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "0.75rem",
              }}
            >
              Ready to get started?
            </h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Plans start at $14.99/month. No waiting periods. No annual
              maximums. Cancel anytime.
            </p>
            <Link href="/health/plans" className="button button--primary">
              View Plans & Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
