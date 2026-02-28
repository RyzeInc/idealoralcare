"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";

interface CTABandProps {
  headline?: string;
  subtext?: string;
  ctaText?: string;
  ctaHref?: string;
}

export default function CTABand({
  headline = "Ready to Take Control of Your Oral Health?",
  subtext = "Toothlens AI scanning, 24/7 teledentistry, and a nationwide dentist network—all in one simple plan.",
  ctaText = "Enroll Now",
  ctaHref = "/health/checkout",
}: CTABandProps) {
  return (
    <div className="cta-band">
      <div className="container">
        <h2 className="cta-band__headline">{headline}</h2>
        <p className="cta-band__subtext">{subtext}</p>

        <div className="cta-band__form">
          <Link
            href={ctaHref}
            className="button button--white"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "white",
              color: "#0066CC",
              padding: "14px 32px",
              borderRadius: "8px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.3s ease",
            }}
          >
            <CheckCircle size={18} />
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
