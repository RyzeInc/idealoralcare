"use client";

import Image from "next/image";

/**
 * "How To Use Your Program" infographic component.
 * Faithfully recreates the branded 3-column benefit card layout.
 *
 * Required assets under /public/health-assets/:
 *   - toothlensscan_1086x1024.png  (AI scan phone image)
 *   - teledentistry-video-call.png (teledentistry phone image)
 *   - network-map.svg (provider network map)
 *
 * Logo: /public/ideal-oral-health-logo.png
 */

interface BenefitCard {
  ctaLabel: string;
  ctaGradient: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  howItWorks: string[];
  bestFor?: string[];
  bullets: string[];
  bulletColor: string;
}

const BENEFITS: BenefitCard[] = [
  {
    ctaLabel: "Start Scan →",
    ctaGradient: "linear-gradient(135deg, #34d399, #10b981)",
    title: "AI Dental Scan",
    imageSrc: "/health-assets/toothlensscan_1086x1024.png",
    imageAlt: "AI Dental Scan - phone showing oral scan interface",
    howItWorks: [
      "Take 5 Easy Photos",
      "AI Reviews Your Scan",
      "Get Your Results & Next Steps",
    ],
    bestFor: [
      "Spotting possible problem areas",
      "Monitoring visible changes",
      "Knowing when to seek follow-up care",
    ],
    bullets: [],
    bulletColor: "#10b981",
  },
  {
    ctaLabel: "Talk to a Dentist →",
    ctaGradient: "linear-gradient(135deg, #60a5fa, #2563eb)",
    title: "Teledentistry",
    imageSrc: "/health-assets/teledentistry-video-call.png",
    imageAlt: "Teledentistry - video call with a licensed dentist",
    howItWorks: [
      "Request a Consultation",
      "Speak with a Licensed Dentist",
      "Get Guidance & Recommendations",
    ],
    bestFor: [
      "Questions & Concerns",
      "Reviewing Scan Results",
      "Next Steps & Treatment Advice",
    ],
    bullets: [],
    bulletColor: "#2563eb",
  },
  {
    ctaLabel: "Find a Provider",
    ctaGradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    title: "Dental Discount Network",
    imageSrc: "/discountmap.png",
    imageAlt: "Dental Discount Network - map with provider locations",
    howItWorks: [
      "Search Participating Dentists",
      "Show Your Member ID",
      "Save on Eligible Services",
    ],
    bestFor: [
      "Cleanings & Exams",
      "Fillings, Crowns, & More",
      "Big Savings on Care",
    ],
    bullets: [],
    bulletColor: "#f59e0b",
  },
];

export default function HowToUseProgram() {
  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)",
        padding: "60px 24px 48px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* -------- Logo (top-left) -------- */}
      <div style={{ position: "absolute", top: "20px", left: "24px" }}>
        <Image
          src="/ideal-oral-health-logo.png"
          alt="Ideal Oral Health"
          width={180}
          height={60}
          style={{ objectFit: "contain" }}
          priority
        />
      </div>

      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        {/* -------- Heading -------- */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            How To Use <span style={{ color: "#2563eb" }}>Your Program</span>
          </h2>
        </div>

        {/* -------- Subheading -------- */}
        <p
          style={{
            textAlign: "center",
            fontSize: "clamp(0.95rem, 1.6vw, 1.125rem)",
            color: "#475569",
            margin: "0 auto 40px",
            maxWidth: "600px",
            lineHeight: 1.5,
          }}
        >
          3 Powerful Benefits to Help You Take Control of Your Oral Health
        </p>

        {/* -------- 3-Column Card Grid -------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "24px",
          }}
        >
          {BENEFITS.map((benefit, idx) => (
            <div
              key={idx}
              style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* CTA Bar */}
              <div style={{ padding: "16px 16px 0" }}>
                <div
                  style={{
                    background: benefit.ctaGradient,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    padding: "14px 20px",
                    letterSpacing: "0.01em",
                    textAlign: "center",
                    borderRadius: "12px",
                    boxShadow: `0 4px 20px ${benefit.bulletColor}66`,
                  }}
                >
                  {benefit.ctaLabel}
                </div>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "14px 20px 8px",
                  textAlign: "center",
                }}
              >
                {benefit.title}
              </h3>

              {/* Image + How It Works side-by-side */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  padding: "4px 16px 0",
                  flex: 1,
                }}
              >
                {/* Image */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "160px",
                  }}
                >
                  <Image
                    src={benefit.imageSrc}
                    alt={benefit.imageAlt}
                    fill
                    style={{ objectFit: "contain", objectPosition: "center" }}
                    sizes="(max-width: 768px) 45vw, 18vw"
                  />
                </div>

                {/* How It Works + Best For */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 0" }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      color: "#0f172a",
                      margin: "0 0 6px",
                    }}
                  >
                    How It Works
                  </p>
                  <ol
                    style={{
                      margin: "0 0 10px",
                      paddingLeft: "18px",
                      listStyleType: "decimal",
                    }}
                  >
                    {benefit.howItWorks.map((step, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: "0.8125rem",
                          color: "#334155",
                          lineHeight: 1.65,
                          paddingLeft: "2px",
                        }}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>

                  {/* Best For */}
                  {benefit.bestFor && benefit.bestFor.length > 0 && (
                    <>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          color: "#0f172a",
                          margin: "0 0 4px",
                        }}
                      >
                        Best For:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "0", listStyle: "none" }}>
                        {benefit.bestFor.map((item, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: "0.8125rem",
                              color: "#334155",
                              lineHeight: 1.65,
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: benefit.bulletColor,
                                flexShrink: 0,
                              }}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Bullets (AI Scan card) */}
              {benefit.bullets.length > 0 && (
                <div style={{ padding: "8px 20px 16px" }}>
                  <ul style={{ margin: 0, paddingLeft: "0", listStyle: "none" }}>
                    {benefit.bullets.map((item, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: "0.8125rem",
                          color: "#334155",
                          lineHeight: 1.7,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: benefit.bulletColor,
                            flexShrink: 0,
                          }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Spacer for cards without bottom bullets */}
              {benefit.bullets.length === 0 && <div style={{ height: "16px" }} />}
            </div>
          ))}
        </div>

        {/* -------- Bottom Disclaimer -------- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginTop: "40px",
            paddingTop: "20px",
          }}
        >
          <Image
            src="/ideal-oral-health-logo.png"
            alt="Ideal Oral Health"
            width={28}
            height={28}
            style={{ objectFit: "contain" }}
          />
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#64748b",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Ideal Oral Health is a membership program. Included services are not insurance. Savings
            vary by provider.
          </p>
        </div>
      </div>

      {/* -------- Responsive override for mobile -------- */}
      <style>{`
        @media (max-width: 900px) {
          section > div > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
            max-width: 420px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
      `}</style>
    </section>
  );
}
