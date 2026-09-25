"use client";

import { usePathname } from "next/navigation";
import HeroSlideshow from "@/components/health/HeroSlideshow";
import HealthHeader from "@/components/health/HealthHeader";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";
import { TrustAnchors, ProblemBand } from "@/components/health/sections";
import SitePromoLinks from "@/components/health/SitePromoLinks";
import { Zap, Clock, Smile, Heart, Shield } from "lucide-react";

export default function SiteLandingPage() {
  const { site, isLoading } = useSiteTheme();
  const pathname = usePathname();
  const basePath = `/${pathname.split("/")[1]}`;

  const headline =
    site?.branding?.heroHeadline ||
    "Oral Health Savings Plan That Works Around Your Life";
  const subtext =
    site?.branding?.heroSubtext ||
    "AI Oral Scanning, 24/7 teledentistry, and a nationwide dental discount network — no waiting periods.";
  const brandName = site?.name || "Our Oral Health Plan";

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero + Slideshow */}
      <section className="hero-home section">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <HeroSlideshow />
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="hero-home__heading">
                <div className="hero-home__subtitle">{brandName}</div>
                <h1>{headline}</h1>
                <p className="hero-home__descr">{subtext}</p>
                <a className="button button--primary" href={`${basePath}/plans`}>
                  See Plans
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SitePromoLinks placement="landing" />

      <ProblemBand />

      {/* Three services */}
      <section className="related-posts section">
        <div className="container">
          <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
            Three Ways to Take Care of Your Smile
          </h2>
          <p style={{ textAlign: "center", color: "#475569", fontSize: "1.125rem", marginBottom: "3rem", maxWidth: "560px", margin: "0 auto 3rem" }}>
            AI imaging from home, a dentist whenever you need one, and real savings when you visit in person.
          </p>
          <div className="related-posts__grid">
            <a href={`${basePath}/oral-health-scan`} className="related-posts__card">
              <img src="/health-assets/toothlensscan_1086x1024.png" alt="AI Oral Scanning" />
              <h4>AI Oral Scanning</h4>
              <div className="link-arrow">AI-Powered Detection</div>
            </a>
            <a href={`${basePath}/teledentistry`} className="related-posts__card">
              <img src="/health-assets/teledentistr_1024x1024.png" alt="Teledentistry Consultations" />
              <h4>Teledentistry Consultations</h4>
              <div className="link-arrow">Expert Guidance 24/7</div>
            </a>
            <a href={`${basePath}/discount`} className="related-posts__card">
              <img src="/health-assets/dentist-network-discount_1536x1024.png" alt="Dental Discount Network" />
              <h4>Dental Discount Network</h4>
              <div className="link-arrow">Nationwide Access</div>
            </a>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="our-use-case section bg--blue" id="whats-included">
        <div className="container">
          <div className="heading-block">
            <h2>What&apos;s Included in Your Oral Health Savings Plan</h2>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/image-2-1.png" alt="Dentist providing teledentistry consultation" />
            </div>
            <div className="benefit-tiles" style={{ flex: 1 }}>
              {[
                { icon: Zap, color: "#2ECC71", title: "AI Oral Scanning", desc: "Analyze photos of your teeth using AI to detect potential issues early." },
                { icon: Clock, color: "#3498DB", title: "24/7 Teledentistry", desc: "Connect with licensed dentists anytime for consultations and guidance." },
                { icon: Smile, color: "#F39C12", title: "Dental Network Discounts", desc: "Access thousands of dentists nationwide with negotiated discount rates." },
                { icon: Heart, color: "#64748b", title: "Preventive Focus", desc: "Emphasis on preventive care and early detection to reduce costly treatments." },
                { icon: Shield, color: "#64748b", title: "Emergency Support", desc: "Immediate access to emergency dental support when urgent concerns arise." },
              ].map((item) => (
                <div key={item.title} className="benefit-tile">
                  <div className="benefit-tile__icon"><item.icon size={28} color={item.color} /></div>
                  <h4 className="benefit-tile__title">{item.title}</h4>
                  <p className="benefit-tile__description">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TrustAnchors />

      {/* CTA */}
      <section className="for-organization section bg--white">
        <div className="container">
          <div className="for-organization__row">
            <div className="for-organization__col">
              <h2>Oral Health Savings Plan for Your Team</h2>
              <p>
                Give your team real oral health value — AI scanning, 24/7 dentist access,
                and nationwide provider discounts that help employees stay on top of their health.
              </p>
              <div className="for-organization__btn_w">
                <a className="button button--primary" href={`${basePath}/enroll`}>
                  Get Started
                </a>
              </div>
            </div>
            <div className="for-organization__img">
              <img src="/health-assets/virtual-first_896x992-2.jpg" alt="Team members discussing benefits" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
