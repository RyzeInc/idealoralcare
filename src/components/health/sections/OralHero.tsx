"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface OralHeroProps {
  headline?: string;
  subtitle?: string;
  bullets?: string[];
  primaryCTA?: { text: string; href: string };
}

export default function OralHero({
  headline = "Comprehensive Oral Health Care",
  subtitle =
    "AI-powered Toothlens scanning, 24/7 Teledentistry Program, and Dental Discount Network discounts—all in one affordable plan.",
  bullets = [
    "Toothlens AI scanning for home monitoring",
    "24/7 teledentistry consultations",
    "Nationwide dentist network discounts",
  ],
  primaryCTA = { text: "Explore the Plan", href: "#plan" },
}: OralHeroProps) {
  return (
    <div className="oral-hero">
      <div className="oral-hero__overlay" aria-hidden="true" />
      <div className="container">
        <div className="oral-hero__content">
          <h1 className="oral-hero__headline">{headline}</h1>
          <p className="oral-hero__subtitle">{subtitle}</p>

          <ul className="oral-hero__bullets">
            {bullets.map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>

          <div className="oral-hero__cta-group">
            <Link
              href={primaryCTA.href}
              className="oral-hero__cta-primary"
            >
              {primaryCTA.text}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
