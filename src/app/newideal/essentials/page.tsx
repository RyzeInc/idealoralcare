import Link from "next/link";
import type { Metadata } from "next";
import {
  Heart,
  Stethoscope,
  Pill,
  FlaskConical,
  Brain,
  Phone,
  Globe,
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
  title: "Essentials Plan — New Ideal Health",
  description:
    "The Essentials Plan bundles Lyric Telehealth, QuestSelect labs, RxValet pharmacy savings, and Balance for Life mental wellness into one affordable monthly membership.",
};

const PROGRAMS = [
  {
    name: "Lyric Telehealth",
    icon: <Stethoscope size={24} />,
    color: "#0f766e",
    desc:
      "Three ways to see a doctor online — Virtual Urgent Care, Virtual Primary Care, and Virtual Dermatology. 24/7/365 access from your phone, tablet, or computer.",
    bullets: [
      "Virtual Urgent Care — talk to a doctor in minutes (cold/flu, sinus, allergies, UTI, rashes, pink eye, and more)",
      "Virtual Primary Care — establish an ongoing relationship with a PCP for chronic-condition management, refills, and screenings",
      "Virtual Dermatology — board-certified review of 3+ photos, treatment plan within 72 hours",
      "Prescriptions sent electronically to your local pharmacy",
    ],
    contact: { phone: "1-866-223-8831", website: "getlyric.com" },
  },
  {
    name: "QuestSelect Labs",
    icon: <FlaskConical size={24} />,
    color: "#0066CC",
    desc:
      "Transparent, pre-negotiated lab pricing through Quest Diagnostics — the country's largest network of patient service centers.",
    bullets: [
      "Significant discounts on common blood work, panels, and screenings",
      "Access to thousands of Quest patient service centers nationwide",
      "No surprise billing — you know the price before you go",
      "Use alongside a Lyric telehealth visit for full workups",
    ],
    contact: { phone: "800-646-7788" },
  },
  {
    name: "RxValet Pharmacy",
    icon: <Pill size={24} />,
    color: "#7c3aed",
    desc:
      "A discount prescription program that often beats your insurance copay. Show your RxValet info at the pharmacy counter — no claims to file.",
    bullets: [
      "Big savings on generic and brand-name prescriptions",
      "Accepted at major pharmacies nationwide",
      "Use for the whole family — no per-script limits",
      "Mail-order option available for maintenance medications",
    ],
    contact: {
      phone: "855-798-2538",
      detail: "BIN 006053 · PCN MSC · Group GIH1000",
    },
  },
  {
    name: "Balance for Life",
    icon: <Brain size={24} />,
    color: "#14b8a6",
    desc:
      "A comprehensive behavioral health and mental wellness ecosystem — short-term counseling, 24/7 live support, an AI wellness companion, and inpatient/outpatient referrals.",
    bullets: [
      "Up to 10 no-cost short-term counseling sessions (phone, video, or in-person)",
      "24/7 live answer with a counselor for crisis & support",
      "Chat with Zenn — AI mental health companion via text 24/7/365",
      "Specialized tracks: Anxiety, Depression, Chronic Pain, Substance Use, Trauma, PTSD, and more",
      "Long-term virtual & in-person care network with PHQ-2, PHQ-9, GAD-7 monitoring",
    ],
    contact: {
      phone: "833-354-2691",
      website: "balanceforlifebh.com",
      detail: "Member Code: Ideal",
    },
  },
];

export default function EssentialsPage() {
  return (
    <div className="health-landing">
      <NewIdealHeader />

      {/* Hero */}
      <section
        className="section bg--blue"
        style={{ paddingTop: "4rem", paddingBottom: "3rem" }}
      >
        <div className="container" style={{ maxWidth: 820 }}>
          <Link
            href="/newideal"
            style={{
              color: "var(--primary-blue)",
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            ← Back to Overview
          </Link>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "rgba(0,102,204,0.1)",
              color: "var(--primary-blue)",
              borderRadius: 999,
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginTop: 20,
              marginBottom: 18,
            }}
          >
            <Heart size={14} /> ESSENTIALS PLAN
          </div>
          <h1
            style={{
              fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            Everyday care for everyday life
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            One membership bundles four essential healthcare programs: 24/7
            telehealth, deeply discounted prescriptions, transparent lab
            pricing, and a complete mental wellness suite. Built for
            individuals and families who want real access without insurance
            complexity.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/newideal/plans"
              className="button button--primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
              }}
            >
              See Pricing & Enroll <ArrowRight size={16} />
            </Link>
            <Link
              href="/newideal/oralcare"
              style={{
                background: "white",
                color: "var(--primary-blue)",
                border: "1.5px solid var(--primary-blue)",
                padding: "12px 22px",
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Explore Oral Care
            </Link>
          </div>

          {/* Quick stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 16,
              marginTop: 36,
            }}
          >
            {[
              { stat: "24/7", label: "Telehealth access" },
              { stat: "70%", label: "Of illnesses treated virtually" },
              { stat: "72hr", label: "Dermatology response" },
              { stat: "10", label: "No-cost counseling visits" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 16,
                  textAlign: "center",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: "var(--primary-blue)",
                  }}
                >
                  {s.stat}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs detail */}
      <section
        className="section bg--white"
        style={{ paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              What&apos;s in the Essentials Plan
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              Four integrated programs, one monthly membership.
            </p>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            {PROGRAMS.map((p) => (
              <div
                key={p.name}
                className="glass-card"
                style={{ padding: 28 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 20,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 14,
                      background: `${p.color}15`,
                      color: p.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#0f172a" }}>{p.name}</h3>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        margin: "0 0 16px 0",
                        lineHeight: 1.6,
                      }}
                    >
                      {p.desc}
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {p.bullets.map((b) => (
                        <li
                          key={b}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            fontSize: "0.9375rem",
                            color: "#334155",
                          }}
                        >
                          <Check size={16} style={{ color: p.color, marginTop: 3, flexShrink: 0 }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div
                      style={{
                        marginTop: 18,
                        padding: 14,
                        background: "rgba(0,0,0,0.02)",
                        borderRadius: 8,
                        display: "flex",
                        gap: 18,
                        flexWrap: "wrap",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {p.contact.phone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Phone size={14} /> {p.contact.phone}
                        </span>
                      )}
                      {p.contact.website && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Globe size={14} /> {p.contact.website}
                        </span>
                      )}
                      {p.contact.detail && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Smartphone size={14} /> {p.contact.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        className="section bg--blue"
        style={{ paddingTop: "3.5rem", paddingBottom: "3.5rem" }}
      >
        <div className="container" style={{ maxWidth: 880 }}>
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#0f172a",
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            How it works
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
            }}
          >
            {[
              { n: 1, t: "Enroll online", d: "Pick your tier (Employee, +Spouse, +Child, or Family) and check out in under 5 minutes." },
              { n: 2, t: "Receive your member info", d: "We assign your Member ID and email your card so you can use all four programs immediately." },
              { n: 3, t: "Use anytime, anywhere", d: "Call, tap, or click — Lyric, QuestSelect, RxValet, and Balance for Life are available 24/7." },
            ].map((s) => (
              <div
                key={s.n}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 22,
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary-blue), var(--accent-teal))",
                    color: "white",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: "1rem", margin: "0 0 6px", color: "#0f172a" }}>{s.t}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg--white" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
          <Clock size={36} style={{ color: "var(--accent-teal)", marginBottom: 12 }} />
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
            Coverage starts the day after you enroll
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: "1.0625rem" }}>
            From <strong>$57.95/mo</strong> for an individual. Spouse, child,
            and family tiers available.
          </p>
          <Link
            href="/newideal/plans"
            className="button button--primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              fontSize: "1rem",
            }}
          >
            See Plans & Enroll <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <NewIdealFooter />
    </div>
  );
}
