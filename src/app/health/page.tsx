import Link from "next/link";
import HeroSlideshow from "@/components/health/HeroSlideshow";
import HealthHeader from "@/components/health/HealthHeader";
import { TrustAnchors, ProblemBand } from "@/components/health/sections";
import { Zap, Clock, Smile, Heart, Shield } from "lucide-react";

export const metadata = {
  title: "Ideal Oral Health Plan | Comprehensive Oral Health Coverage",
  description:
    "Ideal Oral Health Plan - AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network dental access. Affordable monthly membership.",
  alternates: { canonical: "/health" },
  openGraph: {
    title: "Ideal Oral Health Plan | Affordable Dental Care Alternative",
    description:
      "Save 20–58% on dental care with AI scanning, 24/7 teledentistry, and 140,000+ providers. No waiting periods, no annual maximums. Plans from $14.99/mo.",
    url: "https://getidealoh.com/health",
    images: [{ url: "/health-assets/og-default.png", width: 1200, height: 630 }],
  },
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
                <div className="hero-home__subtitle">Ideal Oral Health Plan</div>
                <h1>Oral Healthcare Discount Plan That Works Around Your Life — Not the Other Way Around.</h1>
                <p className="hero-home__descr">
                  AI Oral Scanning from home, licensed dentists available 24/7, and a
                  nationwide provider network that saves members 20–50% on dental
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
          <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Three Ways to Take Care of Your Smile</h2>
          <p style={{ textAlign: "center", color: "#475569", fontSize: "1.125rem", marginBottom: "3rem", maxWidth: "560px", margin: "0 auto 3rem" }}>AI imaging from home, a dentist whenever you need one, and real savings when you visit in person.</p>
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
            <h2>What&apos;s Included in Your Oral Healthcare Discount Plan</h2>
          </div>
          <div className="our-use-case__content">
            <div className="our-use-case__image">
              <img src="/health-assets/image-2-1.png" alt="Dentist providing teledentistry consultation" />
            </div>
            <div className="benefit-tiles" style={{ flex: 1 }}>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Zap size={28} color="#2ECC71" /></div>
                <h4 className="benefit-tile__title">AI Oral Scanning</h4>
                <p className="benefit-tile__description">AI Oral Scanning analyzes photos of your teeth using AI to detect potential issues early.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Clock size={28} color="#3498DB" /></div>
                <h4 className="benefit-tile__title">24/7 Teledentistry</h4>
                <p className="benefit-tile__description">Connect with licensed dentists anytime via our Teledentistry Program for consultations and guidance.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Smile size={28} color="#F39C12" /></div>
                <h4 className="benefit-tile__title">Dental Network Discounts</h4>
                <p className="benefit-tile__description">Access thousands of dentists nationwide through the Careington POS Dental Discount Network with negotiated discount rates.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Heart size={28} color="#64748b" /></div>
                <h4 className="benefit-tile__title">Preventive Focus</h4>
                <p className="benefit-tile__description">Emphasis on preventive care and early detection to reduce costly treatments down the road.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Shield size={28} color="#64748b" /></div>
                <h4 className="benefit-tile__title">Emergency Support</h4>
                <p className="benefit-tile__description">Immediate access to emergency dental support when pain or urgent concerns arise.</p>
              </div>
              <div className="benefit-tile">
                <div className="benefit-tile__icon"><Shield size={28} color="#64748b" /></div>
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
          <h2>Built Around How You Actually Live</h2>
          <ul className="benefits__list">
            <li>Catch problems before they get costly — AI scans your mouth at home, so small issues don&apos;t turn into big ones.</li>
            <li>Providers nationwide, already vetted — so you spend time getting care, not searching for it.</li>
            <li>See exactly what you&apos;ll pay before you go. No mid-chair surprises, no mystery bills.</li>
            <li>Prevention is always cheaper than treatment — and we&apos;ve made it easy to actually do it.</li>
            <li>Toothache at 2am? A licensed dentist is available any time you need one.</li>
            <li>Whether it&apos;s a routine check-in or an urgent concern, you&apos;ll always have someone in your corner.</li>
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
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
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
              <h2>Oral Healthcare Discount Plan for Your Team</h2>
              <p>
                Give your team a real edge in oral health. AI scanning, 24/7 dentist access,
                and nationwide provider dental discounts help employees stay on top of their health
                without the hassle — and that makes a difference in how they show up every day.
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
          <h2>Questions You Might Have</h2>
          <div className="faq__list">
            <div className="accordion">
              <h4>Is this real dental insurance?</h4>
              <div>No — The Ideal Oral Healthcare Discount Plan is a membership, not an insurance plan. Because this is not insurance, there are no deductibles, no waiting periods, no claim forms, and no annual coverage caps. You get AI scanning, 24/7 dentist access, and a nationwide dental discount network — starting the day after you enroll.</div>
            </div>
            <div className="accordion">
              <h4>How does the AI scanning work — do I need any equipment?</h4>
              <div>No special equipment needed — just your smartphone. You&apos;ll take a few guided photos of your teeth and gums, and our AI analyzes them to give you an oral health score, identify areas of concern, and suggest next steps. Most scans take under five minutes.</div>
            </div>
            <div className="accordion">
              <h4>What if I have a dental emergency?</h4>
              <div>Call or message through the app any time — 24/7. You&apos;ll be connected with a licensed dentist who can assess your situation, provide pain management guidance, write a prescription if needed, and refer you to an in-person provider. You don&apos;t have to wait until Monday morning.</div>
            </div>
            <div className="accordion">
              <h4>How much can I actually save on dental procedures?</h4>
              <div>Members typically save 20%-50% on common procedures like cleanings, fillings, and root canals. You can search our provider network before your appointment to see exact member pricing — no surprises at checkout.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
