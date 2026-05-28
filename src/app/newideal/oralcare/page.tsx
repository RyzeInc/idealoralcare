import Link from "next/link";
import type { Metadata } from "next";
import {
  Smile,
  Eye,
  Ear,
  Sparkles,
  Check,
  ArrowRight,
  MapPin,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import {
  NewIdealHeader,
  NewIdealFooter,
} from "@/components/newideal/NewIdealChrome";

export const metadata: Metadata = {
  title: "Oral Care — New Ideal Health",
  description:
    "The Ideal Oral Care discount network gives members access to savings on dental cleanings, fillings, vision exams, eyewear, and hearing aids — at thousands of providers nationwide.",
};

export default function OralCarePage() {
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
              background: "rgba(14,165,233,0.1)",
              color: "#0ea5e9",
              borderRadius: 999,
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginTop: 20,
              marginBottom: 18,
            }}
          >
            <Smile size={14} /> ORAL CARE
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
            Save on dental, vision, and hearing — for the whole family
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            The Ideal Oral Care discount network connects you with thousands
            of dentists, optometrists, and hearing specialists nationwide —
            with negotiated savings on routine care, eyewear, and more.
            No claim forms, no waiting periods, no annual caps.
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
          </div>
        </div>
      </section>

      {/* What's covered */}
      <section className="section bg--white" style={{ paddingTop: "4rem", paddingBottom: "3rem" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 700, margin: "0 auto 36px" }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              What&apos;s included
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "1.0625rem" }}>
              Three benefit categories, one membership.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 22,
            }}
          >
            {[
              {
                icon: <Smile size={28} />,
                color: "#0ea5e9",
                title: "Dental Savings",
                desc: "Access negotiated rates at 100,000+ dental providers nationwide.",
                items: [
                  "Cleanings, exams, and X-rays",
                  "Fillings, crowns, and root canals",
                  "Orthodontics and cosmetic dentistry",
                  "Periodontal and oral surgery services",
                ],
              },
              {
                icon: <Eye size={28} />,
                color: "#14b8a6",
                title: "Vision Savings",
                desc: "Eye exams, prescription eyewear, and contacts at network providers.",
                items: [
                  "Annual eye exam discounts",
                  "Frames and prescription lenses",
                  "Contact lens savings",
                  "LASIK surgery discounts",
                ],
              },
              {
                icon: <Ear size={28} />,
                color: "#7c3aed",
                title: "Hearing Savings",
                desc: "Hearing exams, devices, and ongoing care discounts.",
                items: [
                  "Hearing exams and screenings",
                  "Discounted hearing aids",
                  "Fitting and follow-up appointments",
                  "Battery and accessory savings",
                ],
              },
            ].map((c) => (
              <div
                key={c.title}
                className="glass-card"
                style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {c.icon}
                </div>
                <h3 style={{ margin: 0, color: "#0f172a" }}>{c.title}</h3>
                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9375rem", lineHeight: 1.55 }}>
                  {c.desc}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
                  {c.items.map((it) => (
                    <li
                      key={it}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: "0.875rem",
                        color: "#334155",
                      }}
                    >
                      <Check size={14} style={{ color: c.color, marginTop: 3, flexShrink: 0 }} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why members love it */}
      <section className="section bg--blue" style={{ paddingTop: "3.5rem", paddingBottom: "3.5rem" }}>
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
            Why members choose Oral Care
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
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
                desc: "Save on every visit — there&apos;s no max benefit to hit.",
              },
              {
                icon: <Sparkles size={22} />,
                title: "No claim forms",
                desc: "Show your membership at the office and savings are applied at checkout.",
              },
              {
                icon: <MapPin size={22} />,
                title: "Massive network",
                desc: "100,000+ dental providers, plus thousands of vision and hearing partners.",
              },
            ].map((b) => (
              <div
                key={b.title}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 22,
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(14,165,233,0.12)",
                    color: "#0ea5e9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {b.icon}
                </div>
                <h3 style={{ fontSize: "1rem", margin: "0 0 6px", color: "#0f172a" }}>{b.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg--white" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 640 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
            Take care of every smile in the family
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: "1.0625rem" }}>
            Bundle Oral Care with the Essentials Plan, or enroll on its own.
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
