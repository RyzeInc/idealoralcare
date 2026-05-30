import Link from "next/link";
import type { Metadata } from "next";
import {
  Smile,
  Stethoscope,
  Sparkles,
  Check,
  ArrowRight,
  MapPin,
  CalendarClock,
  ShieldCheck,
  ScanLine,
  Phone,
} from "lucide-react";
import {
  NewIdealHeader,
  NewIdealFooter,
} from "@/components/newideal/NewIdealChrome";

export const metadata: Metadata = {
  title: "Oral Care — Ideal Health",
  description:
    "The Ideal Oral Savings Plan: AI Oral Scanning, 24/7 teledentistry, and a nationwide Dental Discount Network with savings of 20–60% at 100,000+ providers.",
};

export default function OralCarePage() {
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
            backgroundImage: "url('/newideal/site-files/lady-glasses.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.18,
          }}
        />
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "-10%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)",
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
            Oral Care
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
            AI Oral Scanning, 24/7 teledentistry, and savings of 20–60% at
            100,000+ dentists nationwide — with no waiting periods and no claim
            forms.
          </p>
        </div>
      </section>

      {/* ── WHAT'S COVERED ── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container">
          <div style={{ marginBottom: 60, textAlign: "center", maxWidth: 700, margin: "0 auto 60px" }}>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              What’s included
            </h2>
            <p style={{ color: "#475569", fontSize: "1.0625rem", margin: 0, lineHeight: 1.65 }}>
              A modern oral health plan built around prevention, access, and
              transparent pricing.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 28,
            }}
          >
            {[
              {
                icon: <ScanLine size={28} />,
                color: "#0284c7",
                gradient: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
                image: "/newideal/site-files/virtual-medicine.png",
                title: "AI Oral Scanning",
                desc: "Snap photos of your teeth and gums and get an AI-powered oral health report.",
                items: [
                  "Detects potential issues early",
                  "Personalized oral health score",
                  "Detailed report and recommendations",
                  "Track changes between visits",
                ],
              },
              {
                icon: <Stethoscope size={28} />,
                color: "#0d9488",
                gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                image: "/newideal/site-files/care-workers.png",
                title: "24/7 Teledentistry",
                desc: "Connect with experienced dentists by video call — anytime, anywhere.",
                items: [
                  "Professional advice and triage",
                  "Treatment recommendations",
                  "Prescription guidance when appropriate",
                  "No appointment, no commute",
                ],
              },
              {
                icon: <Smile size={28} />,
                color: "#0066CC",
                gradient: "linear-gradient(135deg, #0066CC 0%, #3b82f6 100%)",
                image: "/newideal/site-files/pinky-swear.png",
                title: "Dental Discount Network",
                desc: "Negotiated rates at 100,000+ participating dentists nationwide.",
                items: [
                  "20–60% off cleanings, exams, and X-rays",
                  "Savings on fillings, crowns, and root canals",
                  "Orthodontics and cosmetic dentistry",
                  "Periodontal and oral surgery services",
                ],
              },
              {
                icon: <Phone size={28} />,
                color: "#f97316",
                gradient: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
                image: "/newideal/site-files/nurse-clipboard.png",
                title: "Emergency Support",
                desc: "Pain or urgent concern? Talk to a specialist immediately for guidance and relief.",
                items: [
                  "24/7 access to dental specialists",
                  "Same-day video consults",
                  "Help finding in-person care",
                  "After-hours and weekend coverage",
                ],
              },
            ].map((c) => (
              <div
                key={c.title}
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
                    height: 180,
                    backgroundImage: `url('${c.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: c.gradient,
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
                        width: 48,
                        height: 48,
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
                      {c.icon}
                    </div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "1.3125rem",
                        fontWeight: 700,
                        margin: "0 0 6px",
                        letterSpacing: "-0.01em",
                        textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      }}
                    >
                      {c.title}
                    </h3>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.92)",
                        fontSize: "0.9rem",
                        margin: 0,
                        lineHeight: 1.4,
                        textShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      }}
                    >
                      {c.desc}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "24px 28px" }}>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {c.items.map((it) => (
                      <li
                        key={it}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          fontSize: "0.875rem",
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        <Check size={16} style={{ color: c.color, marginTop: 2, flexShrink: 0 }} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY MEMBERS LOVE IT ── */}
      <section style={{ background: "#f1f5f9", padding: "72px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              Why members choose Oral Care
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                icon: <CalendarClock size={22} />,
                title: "No waiting periods",
                desc: "Coverage starts the day after you enroll. Use it right away.",
              },
              {
                icon: <ShieldCheck size={22} />,
                title: "No annual caps",
                desc: "Save on every visit — there's no max benefit to hit.",
              },
              {
                icon: <Sparkles size={22} />,
                title: "No claim forms",
                desc: "Show your membership at the office and savings are applied at checkout.",
              },
              {
                icon: <MapPin size={22} />,
                title: "100,000+ providers",
                desc: "Find a participating dentist nearly anywhere in the country.",
              },
            ].map((b) => (
              <div
                key={b.title}
                style={{
                  background: "white",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(20,184,166,0.15)",
                    color: "#0d9488",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  {b.icon}
                </div>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    margin: "0 0 8px",
                    color: "#0f172a",
                  }}
                >
                  {b.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#475569",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIFESTYLE SPLIT BAND ── */}
      <section style={{ padding: "0", background: "white" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            minHeight: 360,
          }}
        >
          <div
            style={{
              backgroundImage: "url('/newideal/site-files/happy-family.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              minHeight: 320,
            }}
          />
          <div
            style={{
              padding: "60px 48px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)",
            }}
          >
            <div
              style={{
                color: "#0d9488",
                fontSize: "0.8125rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              Coverage that fits real life
            </div>
            <h2
              style={{
                fontSize: "clamp(1.625rem, 2.6vw, 2.125rem)",
                fontWeight: 800,
                color: "#0f172a",
                margin: "0 0 14px",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              From routine cleanings to root canals — everyone gets a healthier smile.
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              The Oral Savings Plan is built for households. Bring your spouse,
              your kids, your parents — savings apply at every visit, every time,
              with no caps and no claim forms.
            </p>
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
            Take care of every smile
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.8)",
              marginBottom: 32,
              fontSize: "1.0625rem",
              lineHeight: 1.7,
            }}
          >
            Bundle Oral Care with the Essentials Plan, or enroll on its own.
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
            See Plans & Pricing <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <NewIdealFooter />
    </div>
  );
}
