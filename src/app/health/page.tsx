import Link from "next/link";
import HeroSlideshow from "@/components/health/HeroSlideshow";
import HealthHeader from "@/components/health/HealthHeader";
import { TrustAnchors, ProblemBand } from "@/components/health/sections";
import { Zap, Clock, Smile, Heart, Shield } from "lucide-react";

export const metadata = {
  title: "Ideal Oral Health Plan | Comprehensive Oral Health Coverage",
  description:
    "Ideal Oral Health Plan - AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network dental access. Affordable monthly membership.",
};

export default function HealthLanding() {
  return (
    <div className="health-landing">
      {/* ── Header ─────────────────────────────────────────────── */}
      <HealthHeader />

      {/* ── Hero + Slideshow ────────────────────────────────────── */}
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
                <div className="hero-home__subtitle">IDEAL ORAL HEALTH PLAN</div>
                <h1>Oral Health Care That Works Around Your Life — Not the Other Way Around.</h1>
                <p className="hero-home__descr">
                  AI Oral Scanning from home, licensed dentists available 24/7, and a
                  nationwide provider network that saves members 25–50% on dental
                  procedures — without the waiting rooms, surprise bills, or guesswork.
                </p>
                <a className="button button--primary" href="#whats-included">
                  See What&rsquo;s Included
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem Band ─────────────────────────────────────────── */}
      <ProblemBand />

      {/* ── Feature Preview Cards ───────────────────────────────── */}
      <section className="related-posts section">
        <div className="container">
          <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Start Smiling More</h2>
          <p style={{ textAlign: "center", color: "#475569", fontSize: "1.125rem", marginBottom: "3rem", maxWidth: "560px", margin: "0 auto 3rem" }}>A smarter dental experience: AI oral imaging, comfortable consults from home, and direct savings on care.</p>
          <div className="related-posts__grid">
            <Link href="/health/oral-health-scan" className="related-posts__card">
              <img src="/health-assets/toothlensscan_1086x1024.png" alt="AI Oral Scanning" />
              <h4>AI Oral Scanning</h4>
              <div className="link-arrow">AI-Powered Detection</div>
            </Link>
            <Link href="/health/teledentistry" className="related-posts__card">
              <img src="/health-assets/teledentistr_1024x1024.png" alt="Teledentistry Consultations" />
              <h4>Teledentistry Consultations</h4>
              <div className="link-arrow">Expert Guidance 24/7</div>
            </Link>
            <Link href="/health/discount" className="related-posts__card">
              <img src="/health-assets/dentist-network-discount_1536x1024.png" alt="Dental Discount Network" />
              <h4>Dental Discount Network</h4>
              <div className="link-arrow">Nationwide Access</div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── What's Included — image left + benefit tiles right ──── */}
      <section className="our-use-case section bg--blue" id="whats-included">
        <div className="container">
          <div className="heading-block">
            <h2>What&apos;s Included in Your Oral Health Plan</h2>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/image-2-1.png" alt="Dentist providing teledentistry consultation" />
            </div>
            <div className="benefit-tiles" style={{ flex: 1 }}>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Zap size={28} color="#0066CC" /></div>
                <h4 className="benefit-tile__title">AI Oral Scanning</h4>
                <p className="benefit-tile__description">AI Oral Scanning analyzes photos of your teeth using AI to detect potential issues early.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Clock size={28} color="#0066CC" /></div>
                <h4 className="benefit-tile__title">24/7 Teledentistry</h4>
                <p className="benefit-tile__description">Connect with licensed dentists anytime via our Teledentistry Program for consultations and guidance.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Smile size={28} color="#0066CC" /></div>
                <h4 className="benefit-tile__title">Network Discounts</h4>
                <p className="benefit-tile__description">Access thousands of dentists nationwide through the Dental Discount Network with negotiated discount rates.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Heart size={28} color="#0066CC" /></div>
                <h4 className="benefit-tile__title">Preventive Focus</h4>
                <p className="benefit-tile__description">Emphasis on preventive care and early detection to reduce costly treatments down the road.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Shield size={28} color="#0066CC" /></div>
                <h4 className="benefit-tile__title">Emergency Support</h4>
                <p className="benefit-tile__description">Immediate access to emergency dental support when pain or urgent concerns arise.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Shield size={28} color="#14B8A6" /></div>
                <h4 className="benefit-tile__title">Flexible Options</h4>
                <p className="benefit-tile__description">Choose between teledentistry, in-network discounts, or a combination—whatever works best for you.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why It Works Better ─────────────────────────────────── */}
      <section className="benefits section bg--white">
        <div className="container">
          <h2>Why Ideal Oral Health Works Better</h2>
          <ul className="benefits__list">
            <li><strong>Advanced AI Technology</strong>: AI Oral Scanning detects issues early and provides detailed analysis without the cost of frequent in-person visits.</li>
            <li><strong>Expert Network</strong>: Access to a carefully selected network of trusted dentists nationwide, all vetted for quality care.</li>
            <li><strong>Transparent Pricing</strong>: Know upfront what procedures cost with our nationwide provider network discounts. No surprise bills.</li>
            <li><strong>Preventative Focus</strong>: AI scanning and coaching help catch problems early, reducing costly treatments down the road.</li>
            <li><strong>Always Available</strong>: 24/7 access to dentists and oral health coaches means you can address concerns at any time, including outside standard office hours.</li>
            <li><strong>Comprehensive Support</strong>: From emergency care to routine coaching, we&apos;re here for every aspect of your oral health journey.</li>
          </ul>
        </div>
      </section>

      {/* ── How to Get Started ──────────────────────────────────── */}
      <section style={{ padding: "100px 0", backgroundColor: "#f8fafc" }}>
        <div className="container">
          <div className="how-it-works-section__layout" style={{ display: "flex", gap: "56px", alignItems: "center" }}>
            {/* Image — left */}
            <div className="how-it-works-section__image" style={{ flex: "0 0 38%" }}>
              <img
                src="/health-assets/d1-team_896x1352-opt2.jpg"
                alt="Getting started with Ideal Oral Health"
                style={{ maxWidth: "100%", height: "auto", borderRadius: "var(--radius-lg)", boxShadow: "var(--glass-shadow-lg)" }}
              />
            </div>
            {/* Steps — right */}
            <div className="how-it-works-section__content" style={{ flex: 1 }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0066CC", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
                Simple Process
              </p>
              <h2 style={{ marginBottom: "1rem" }}>Getting Started Takes 4 Easy Steps</h2>
              <p style={{ fontSize: "1.125rem", color: "#475569", marginBottom: "2.5rem" }}>
                From enrollment to access—everything you need to start your oral health journey.
              </p>
              <div className="how-it-works" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", margin: 0 }}>
                {[
                  { step: 1, title: "Review the Plan", description: "Learn about what's included in our Oral Health Plan and how it supports your dental care needs." },
                  { step: 2, title: "Enroll Online", description: "Enrollment is completed in a few minutes. Select your payment method (card or ACH) and billing frequency." },
                  { step: 3, title: "Get Your Member ID", description: "Receive your digital member ID card within 24 hours of enrollment with access to all plan services." },
                  { step: 4, title: "Start Your Dental Journey", description: "Use AI scanning for home monitoring, get teledentistry consultations when needed, and access discounted in-network care." },
                ].map((item) => (
                  <div key={item.step} className="how-it-works__step">
                    <div className="how-it-works__number">{item.step}</div>
                    <h3 className="how-it-works__title">{item.title}</h3>
                    <p className="how-it-works__description">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Anchors ───────────────────────────────────────── */}
      <TrustAnchors />

      {/* ── For Your Team ───────────────────────────────────────── */}
      <section className="for-organization section bg--white">
        <div className="container">
          <div className="for-organization__row">
            <div className="for-organization__col">
              <h2>Oral Health Plan for Your Team</h2>
              <p>
                Offer your employees a modern oral health plan that actually works. AI-powered
                scanning, 24/7 teledentistry, and nationwide provider discounts reduce costs,
                improve preventative care, and boost employee satisfaction.
              </p>
              <div className="for-organization__btn_w">
                <a className="button button--accent" href="/contact">Schedule a Demo</a>
              </div>
            </div>
            <div className="for-organization__img">
              <img src="/health-assets/virtual-first_896x992-2.jpg" alt="Team members discussing benefits" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="faq section">
        <div className="container">
          <h2>Oral Health Plan Questions?</h2>
          <div className="faq__list">
            <div className="accordion">
              <h4>What is the Ideal Oral Health Plan?</h4>
              <div>The Ideal Oral Health Plan is a comprehensive oral care solution featuring advanced AI Oral Scanning technology for oral health scanning, 24/7 teledentistry access with experienced specialists, and a nationwide network of providers with discounted rates. It is designed to make oral care accessible, affordable, and preventative.</div>
            </div>
            <div className="accordion">
              <h4>How does AI Oral Scanning work?</h4>
              <div>AI Oral Scanning analyzes photos of your teeth and gums. Simply take clear photos and our AI provides a detailed oral health report identifying potential issues, calculating your oral health score, and recommending next steps. It is a convenient way to track your health between in-person visits.</div>
            </div>
            <div className="accordion">
              <h4>Can I use the Oral Health Plan for emergency care?</h4>
              <div>Yes! The Oral Health Plan includes 24/7 emergency support. If you&apos;re experiencing pain or have urgent concerns, you can connect with a specialist immediately via teledentistry to get guidance and relief recommendations.</div>
            </div>
            <div className="accordion">
              <h4>How do the nationwide dentist discounts work?</h4>
              <div>Ideal Health has partnerships with a nationwide network of licensed dentists. Plan members receive negotiated discount rates on procedures like cleanings, fillings, root canals, and more. You can search our network to find nearby dentists and see their discount rates before scheduling.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
