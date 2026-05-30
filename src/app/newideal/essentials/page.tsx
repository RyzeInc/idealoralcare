import Link from "next/link";
import type { Metadata } from "next";
import {
  Heart,
  Stethoscope,
  Pill,
  FlaskConical,
  Brain,
  Check,
  ArrowRight,
  Smartphone,
  Clock,
} from "lucide-react";
import {
  NewIdealHeader,
  NewIdealFooter,
} from "@/components/newideal/NewIdealChrome";

export const metadata: Metadata = {
  title: "Essentials Plan — Ideal Health",
  description:
    "The Essentials Plan bundles Lyric Telehealth, QuestSelect labs, RxValet pharmacy savings, and Balance for Life mental wellness into one affordable monthly membership.",
};

const PROGRAMS = [
  {
    name: "Lyric Telehealth",
    icon: <Stethoscope size={24} />,
    image: "/newideal/site-files/virtual-medicine.png",
    color: "#0f766e",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    desc:
      "Three ways to see a doctor online — Virtual Urgent Care, Virtual Primary Care, and Virtual Dermatology. 24/7/365 access from your phone, tablet, or computer.",
    bullets: [
      "Virtual Urgent Care — talk to a doctor in minutes (cold/flu, sinus, allergies, UTI, rashes, pink eye, and more)",
      "Virtual Primary Care — establish an ongoing relationship with a PCP for chronic-condition management, refills, and screenings",
      "Virtual Dermatology — board-certified review of 3+ photos, treatment plan within 72 hours",
      "Prescriptions sent electronically to your local pharmacy",
    ],
  },
  {
    name: "QuestSelect Labs",
    icon: <FlaskConical size={24} />,
    image: "/newideal/site-files/lab-services.png",
    color: "#0066CC",
    gradient: "linear-gradient(135deg, #0066CC 0%, #3b82f6 100%)",
    desc:
      "Transparent, pre-negotiated lab pricing through Quest Diagnostics — the country's largest network of patient service centers.",
    bullets: [
      "Significant discounts on common blood work, panels, and screenings",
      "Access to thousands of Quest patient service centers nationwide",
      "No surprise billing — you know the price before you go",
      "Use alongside a Lyric telehealth visit for full workups",
    ],
  },
  {
    name: "RxValet Pharmacy",
    icon: <Pill size={24} />,
    image: "/newideal/site-files/pharmacy-pic.png",
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    desc:
      "A discount prescription program that often beats your insurance copay. Show your RxValet info at the pharmacy counter — no claims to file.",
    bullets: [
      "Big savings on generic and brand-name prescriptions",
      "Accepted at major pharmacies nationwide",
      "Use for the whole family — no per-script limits",
      "Mail-order option available for maintenance medications",
    ],
  },
  {
    name: "Balance for Life",
    icon: <Brain size={24} />,
    image: "/newideal/site-files/mental-health-pic.png",
    color: "#db2777",
    gradient: "linear-gradient(135deg, #db2777 0%, #f43f5e 100%)",
    desc:
      "A comprehensive behavioral health and mental wellness ecosystem — short-term counseling, 24/7 live support, an AI wellness companion, and inpatient/outpatient referrals.",
    bullets: [
      "Up to 10 no-cost short-term counseling sessions (phone, video, or in-person)",
      "24/7 live answer with a counselor for crisis & support",
      "Chat with Zenn — AI mental health companion via text 24/7/365",
      "Specialized tracks: Anxiety, Depression, Chronic Pain, Substance Use, Trauma, PTSD, and more",
      "Long-term virtual & in-person care network with PHQ-2, PHQ-9, GAD-7 monitoring",
    ],
  },
];

export default function EssentialsPage() {
  return (
    <div className="health-landing" style={{ background: "#f1f5f9" }}>
      <NewIdealHeader />

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
          padding: "80px 0 60px",
          overflow: "hidden",
        }}
      >
        {/* Background image overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/newideal/site-files/happy-family.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.18,
          }}
        />
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-5%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="container" style={{ position: "relative", maxWidth: 820 }}>
          <Link
            href="/newideal"
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "0.875rem",
              textDecoration: "none",
              display: "inline-block",
              marginBottom: 24,
            }}
          >
            ← Back to Overview
          </Link>

          <h1
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: "-0.02em",
            }}
          >
            Essentials Plan
          </h1>

          <p
            style={{
              fontSize: "1.1875rem",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.65,
              marginBottom: 0,
              maxWidth: 600,
            }}
          >
            Four powerful programs in one membership: telehealth, labs, pharmacy
            savings, and mental wellness support — all at your fingertips.
          </p>
        </div>
      </section>

      {/* ── PROGRAMS GRID ── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container">
          <div style={{ marginBottom: 60 }}>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              What's included
            </h2>
            <p style={{ color: "#475569", fontSize: "1.0625rem", margin: 0, lineHeight: 1.65 }}>
              Each program is designed to cover a critical pillar of your healthcare.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 28,
            }}
          >
            {PROGRAMS.map((prog) => (
              <div
                key={prog.name}
                style={{
                  background: "white",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Photo header with gradient overlay */}
                <div
                  style={{
                    position: "relative",
                    height: 160,
                    backgroundImage: `url('${prog.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: prog.gradient,
                      opacity: 0.78,
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      padding: "24px 28px",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(6px)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        marginBottom: 12,
                      }}
                    >
                      {prog.icon}
                    </div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "1.3125rem",
                        fontWeight: 700,
                        margin: 0,
                        letterSpacing: "-0.01em",
                        textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      }}
                    >
                      {prog.name}
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "24px 28px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <p
                    style={{
                      color: "#475569",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    {prog.desc}
                  </p>

                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {prog.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          fontSize: "0.875rem",
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        <Check size={16} style={{ color: prog.color, marginTop: 2, flexShrink: 0 }} />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIFESTYLE BAND ── */}
      <section
        style={{
          position: "relative",
          padding: "0",
          background: "#0c4a6e",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 320,
            backgroundImage: "url('/newideal/site-files/multi-demographic.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(12,74,110,0.92) 0%, rgba(13,148,136,0.78) 100%)",
            }}
          />
          <div
            className="container"
            style={{
              position: "relative",
              padding: "72px 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 28,
              maxWidth: 1100,
            }}
          >
            {[
              { stat: "24/7", label: "Telehealth access for the whole family" },
              { stat: "100K+", label: "Pharmacies accepting RxValet savings" },
              { stat: "$0", label: "Claim forms — show your card and save" },
              { stat: "10", label: "Free counseling sessions per year" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "clamp(2rem, 4vw, 2.875rem)",
                    fontWeight: 800,
                    color: "white",
                    lineHeight: 1,
                    marginBottom: 10,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.stat}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.88)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.5,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "linear-gradient(135deg, #0c4a6e 0%, #134e4a 100%)", padding: "72px 0" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
          <h2
            style={{
              fontSize: "clamp(1.875rem, 3.5vw, 2.625rem)",
              fontWeight: 800,
              color: "white",
              marginBottom: 14,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to get started?
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "1.0625rem",
              marginBottom: 32,
              lineHeight: 1.7,
            }}
          >
            The Essentials Plan is your all-in-one healthcare foundation.
          </p>
          <Link
            href="/newideal/plans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#f97316",
              color: "white",
              padding: "16px 34px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: "1.0625rem",
              textDecoration: "none",
              boxShadow: "0 4px 18px rgba(249,115,22,0.42)",
            }}
          >
            Choose Your Tier <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <NewIdealFooter />
    </div>
  );
}
