import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Heart,
  Shield,
  Smile,
  Stethoscope,
  Pill,
  FlaskConical,
  Brain,
  ArrowRight,
  Check,
  Phone,
  Globe,
  Star,
} from "lucide-react";
import {
  NewIdealHeader,
  NewIdealFooter,
} from "@/components/newideal/NewIdealChrome";

export const metadata: Metadata = {
  title: "Ideal Health — Affordable Healthcare Membership",
  description:
    "Ideal Health offers the Essentials Plan and Oral Care membership programs. Telehealth, pharmacy savings, lab services, mental wellness, and dental and hearing savings.",
};

const PROGRAM_CARDS = [
  {
    href: "/newideal/essentials",
    icon: <Heart size={26} />,
    color: "#0066CC",
    overlay: "linear-gradient(150deg, rgba(0,102,204,0.82) 0%, rgba(59,130,246,0.72) 100%)",
    image: "/newideal/site-files/nurse-clipboard.png",
    name: "Essentials Plan",
    tagline: "Everyday care for everyday life",
    blurb:
      "24/7 telehealth, deeply discounted prescriptions, lab testing, and a complete behavioral health suite — bundled into one affordable membership.",
    includes: [
      "Lyric Virtual Urgent Care, Primary Care & Dermatology",
      "QuestSelect lab pricing",
      "RxValet pharmacy discounts",
      "Balance for Life mental wellness & substance support",
    ],
  },
  {
    href: "/newideal/oralcare",
    icon: <Smile size={26} />,
    color: "#0284c7",
    overlay: "linear-gradient(150deg, rgba(13,148,136,0.82) 0%, rgba(6,182,212,0.72) 100%)",
    image: "/newideal/site-files/lady-glasses.png",
    name: "Oral Care",
    tagline: "AI-powered oral health, savings on dental",
    blurb:
      "AI Oral Scanning, 24/7 teledentistry, emergency support, and the Dental Discount Network — 20–60% off at 100,000+ dentists nationwide.",
    includes: [
      "AI Oral Scanning — instant photo-based health reports",
      "24/7 teledentistry consultations",
      "Dental Discount Network — 100,000+ providers",
      "Emergency support, day or night",
    ],
  },
];

const COVERAGE_ITEMS = [
  { icon: <Stethoscope size={22} />, label: "24/7 Telehealth", sub: "Urgent care, primary care, dermatology" },
  { icon: <Pill size={22} />, label: "Pharmacy Savings", sub: "RxValet card — save on prescriptions" },
  { icon: <FlaskConical size={22} />, label: "Lab Discounts", sub: "QuestSelect transparent pricing" },
  { icon: <Brain size={22} />, label: "Mental Wellness", sub: "Counseling, coaching, 24/7 chat" },
  { icon: <Smile size={22} />, label: "Dental Savings", sub: "100,000+ providers nationwide" },
  { icon: <Shield size={22} />, label: "AI Oral Scanning", sub: "Instant photo-based health reports" },
];

export default function NewIdealLandingPage() {
  return (
    <div className="health-landing" style={{ background: "#f1f5f9" }}>
      <NewIdealHeader />

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
          padding: "90px 0 80px",
          overflow: "hidden",
        }}
      >
        {/* Subtle background image overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/newideal/site-files/multi-demographic.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            opacity: 0.15,
          }}
        />
        {/* Decorative radial glow */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(20,184,166,0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="container"
          style={{ position: "relative", textAlign: "center", maxWidth: 820 }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "6px 16px",
              background: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.25)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Healthcare That Fits Your Life
          </span>

          <h1
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              marginBottom: 22,
              letterSpacing: "-0.02em",
            }}
          >
            One membership.{" "}
            <span style={{ color: "#fb923c" }}>Two powerful programs.</span>
          </h1>

          <p
            style={{
              fontSize: "1.1875rem",
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.65,
              marginBottom: 0,
              maxWidth: 660,
              margin: "0 auto 38px",
            }}
          >
            Telehealth, pharmacy discounts, lab testing, mental wellness, and
            dental and hearing savings — all in one affordable
            membership.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/newideal/plans"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f97316",
                color: "white",
                padding: "15px 30px",
                borderRadius: 12,
                fontWeight: 700,
                textDecoration: "none",
                fontSize: "1rem",
                boxShadow: "0 4px 18px rgba(249,115,22,0.45)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
            >
              See Plans &amp; Pricing <ArrowRight size={18} />
            </Link>
            <Link
              href="/newideal/essentials"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.14)",
                color: "white",
                border: "1.5px solid rgba(255,255,255,0.35)",
                padding: "14px 26px",
                borderRadius: 12,
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "1rem",
                backdropFilter: "blur(8px)",
              }}
            >
              Explore Programs
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ background: "#0c4a6e", padding: "22px 0" }}>
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 48,
            flexWrap: "wrap",
            textAlign: "center",
          }}
        >
          {[
            { val: "24/7", label: "Telehealth Access" },
            { val: "1,000+", label: "Discounted Medications" },
            { val: "100,000+", label: "Dental Providers" },
            { val: "$57.95", label: "Starting / Month" },
          ].map((s) => (
            <div key={s.label}>
              <div
                style={{ fontSize: "1.625rem", fontWeight: 800, color: "#fb923c", lineHeight: 1 }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section style={{ padding: "80px 0 72px" }}>
        <div className="container">
          <div
            style={{
              textAlign: "center",
              marginBottom: 52,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              Choose your coverage
            </h2>
            <p style={{ color: "#475569", fontSize: "1.0625rem", margin: 0, lineHeight: 1.65 }}>
              Build your membership from any combination of our three programs.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {PROGRAM_CARDS.map((prog) => (
              <div
                key={prog.href}
                style={{
                  background: "white",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Photo header */}
                <div style={{ height: 185, position: "relative", overflow: "hidden" }}>
                  <Image
                    src={prog.image}
                    alt={prog.name}
                    fill
                    style={{ objectFit: "cover", objectPosition: "center" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: prog.overlay,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 18,
                      left: 22,
                      right: 22,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(8px)",
                        color: "white",
                        marginBottom: 10,
                      }}
                    >
                      {prog.icon}
                    </div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: "1.3125rem",
                        fontWeight: 700,
                        margin: "0 0 4px",
                        letterSpacing: "-0.01em",
                        textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      }}
                    >
                      {prog.name}
                    </h3>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.88)",
                        fontSize: "0.875rem",
                        margin: 0,
                        lineHeight: 1.4,
                        textShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      {prog.tagline}
                    </p>
                  </div>
                </div>

                {/* Card body */}
                <div
                  style={{
                    padding: "24px 28px 28px",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  <p
                    style={{
                      color: "#475569",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    {prog.blurb}
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
                    {prog.includes.map((item) => (
                      <li
                        key={item}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          fontSize: "0.875rem",
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        <Check
                          size={15}
                          style={{ color: prog.color, marginTop: 2, flexShrink: 0 }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={prog.href}
                    style={{
                      marginTop: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: prog.color,
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "0.9375rem",
                    }}
                  >
                    Learn more <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COVERAGE STRIP ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0c4a6e 0%, #134e4a 100%)",
          padding: "72px 0",
        }}
      >
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2
              style={{
                color: "white",
                fontWeight: 800,
                fontSize: "clamp(1.75rem, 3vw, 2.375rem)",
                marginBottom: 12,
                letterSpacing: "-0.02em",
              }}
            >
              Everything in one place
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.72)",
                maxWidth: 500,
                margin: "0 auto",
                fontSize: "1.0625rem",
                lineHeight: 1.6,
              }}
            >
              Your membership card opens the door to a full healthcare ecosystem.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {COVERAGE_ITEMS.map((b) => (
              <div
                key={b.label}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 16,
                  padding: "22px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    background: "rgba(251,146,60,0.18)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fb923c",
                    flexShrink: 0,
                  }}
                >
                  {b.icon}
                </div>
                <div>
                  <div
                    style={{ color: "white", fontWeight: 600, fontSize: "0.9375rem", lineHeight: 1.3 }}
                  >
                    {b.label}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: "0.8125rem",
                      marginTop: 3,
                      lineHeight: 1.4,
                    }}
                  >
                    {b.sub}
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
          overflow: "hidden",
          padding: "80px 0",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/newideal/site-files/doctor-with-patients.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(12,74,110,0.93) 0%, rgba(13,148,136,0.82) 100%)",
          }}
        />
        <div
          className="container"
          style={{ position: "relative", textAlign: "center", maxWidth: 720 }}
        >
          <p
            style={{
              color: "rgba(186,230,253,0.9)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Real people. Real savings.
          </p>
          <h2
            style={{
              color: "#fff",
              fontSize: "clamp(1.75rem, 3.5vw, 2.625rem)",
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 18,
              letterSpacing: "-0.02em",
            }}
          >
            Healthcare you can actually afford to use
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.78)",
              fontSize: "1.0625rem",
              lineHeight: 1.7,
              marginBottom: 40,
              maxWidth: 560,
              margin: "0 auto 40px",
            }}
          >
            From telehealth visits to dental cleanings to mental health support —
            your Ideal Health membership gives your whole household access to the
            care they need, at rates that make sense.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            {[
              { val: "24/7", label: "Doctor Access" },
              { val: "$0", label: "Consultation Fees" },
              { val: "100K+", label: "Dental Providers" },
              { val: "1,000+", label: "Rx Discounts" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 14,
                  padding: "18px 12px",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 800,
                    color: "#fb923c",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {stat.val}
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "rgba(255,255,255,0.75)",
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "white", padding: "88px 0 100px" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
          <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={20} fill="#f97316" color="#f97316" />
            ))}
          </div>

          <h2
            style={{
              fontSize: "clamp(1.875rem, 3.5vw, 2.625rem)",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: 14,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to take control of your healthcare?
          </h2>
          <p
            style={{
              color: "#475569",
              fontSize: "1.0625rem",
              marginBottom: 36,
              lineHeight: 1.7,
            }}
          >
            Memberships start at{" "}
            <strong style={{ color: "#0f172a" }}>$57.95/mo</strong> for
            individuals. Spouse, child, and family tiers available.
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
            View Plans &amp; Enroll <ArrowRight size={18} />
          </Link>

          <div
            style={{
              display: "flex",
              gap: 24,
              justifyContent: "center",
              marginTop: 30,
              fontSize: "0.875rem",
              color: "#64748b",
              flexWrap: "wrap",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Phone size={14} /> Customer Service: 844-433-2502
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Globe size={14} /> getidealhealth.com
            </span>
          </div>
        </div>
      </section>

      <NewIdealFooter />
    </div>
  );
}
