import HealthHeader from "@/components/health/HealthHeader";
import Link from "next/link";

export const metadata = {
  title: "Dental Discount Network | Ideal Health",
  description:
    "Save 20%–58% on dental procedures through our national dental discount network. No waiting periods, no annual maximums.",
};

const SAVINGS_DATA = [
  { procedure: "Routine Checkup",                        regular: 76,   plan: 33,  savings: 43,  pct: 57 },
  { procedure: "Extensive Oral Exam",                    regular: 134,  plan: 59,  savings: 75,  pct: 56 },
  { procedure: "Four Bitewing X-Rays",                   regular: 92,   plan: 41,  savings: 51,  pct: 55 },
  { procedure: "Adult Cleaning",                         regular: 133,  plan: 63,  savings: 70,  pct: 53 },
  { procedure: "Child Cleaning",                         regular: 92,   plan: 46,  savings: 46,  pct: 50 },
  { procedure: "Composite (White) Filling — Front Teeth",regular: 215,  plan: 100, savings: 115, pct: 53 },
  { procedure: "Crown (Porcelain fused to noble metal)", regular: 1556, plan: 699, savings: 857, pct: 55 },
  { procedure: "Molar Root Canal",                       regular: 1638, plan: 685, savings: 953, pct: 58 },
];

const FEATURES = [
  {
    title: "20%–50% Off Most Procedures",
    desc: "Routine exams, unlimited cleanings, dentures, root canals, and crowns — all at deep member discounts.",
  },
  {
    title: "Orthodontics Included",
    desc: "Save 20% on braces and retainers for children and adults.",
  },
  {
    title: "Specialist Savings",
    desc: "20% off specialists' normal fees — endodontics, oral surgery, pediatric dentistry, periodontics, and prosthodontics.",
  },
  {
    title: "Cosmetic Dentistry",
    desc: "Bonding, veneers, and other cosmetic procedures included in the discount program.",
  },
  {
    title: "Credentialed Providers",
    desc: "All network dentists meet highly selective standards for education, background, and license standing.",
  },
  {
    title: "Freedom to Choose",
    desc: "Visit any participating dentist and switch providers at any time — no lock-in, no referrals.",
  },
];

export default function DentalDiscountNetworkPage() {
  return (
    <div className="health-landing">
      <HealthHeader />

      {/* ── BOLD SPLIT HERO ─────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          height: "500px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          overflow: "hidden",
        }}
      >
        {/* Left — deep blue panel */}
        <div
          style={{
            background: "linear-gradient(145deg, #92400e 0%, #b45309 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "4rem 3.5rem 4rem 4rem",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Decorative arc */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-60px",
              right: "-80px",
              width: "260px",
              height: "260px",
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.08)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "-40px",
              left: "-50px",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              border: "2px solid rgba(243,156,18,0.15)",
              pointerEvents: "none",
            }}
          />

          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: "0.75rem",
              fontWeight: 700,
            color: "rgba(255,255,255,0.65)",
            marginBottom: "1rem",
          }}
        >
          Ideal Health Dental Discount Network
        </p>
          <h1
            style={{
              fontSize: "clamp(2rem, 3.5vw, 3rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              color: "#fff",
              marginBottom: "1.25rem",
            }}
          >
            Save Up to<br />
            <span style={{ color: "#fde68a" }}>58%</span> on Dental<br />
            Procedures
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "1rem",
              lineHeight: 1.6,
              maxWidth: "380px",
              marginBottom: "2rem",
            }}
          >
            One of the largest national provider networks — no waiting periods,
            no annual maximums, no claim forms. Just savings, starting day one.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link
              className="button button--accent"
              href="/health/plans"
              style={{ padding: "12px 28px", fontSize: "0.9375rem" }}
            >
              Explore Plans
            </Link>
            <a
              href="#savings"
              style={{
                padding: "12px 28px",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.35)",
                borderRadius: "8px",
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}
            >
              See Savings ↓
            </a>
          </div>
        </div>

        {/* Right — photo with overlay */}
        <div style={{ position: "relative", overflow: "hidden", height: "500px" }}>
          <img
            src="/health-assets/dentist-network-discount_1536x1024.png"
            alt="Parent helping child brush teeth"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
          {/* gradient bleed into left panel */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, #92400e 0%, transparent 30%)",
            }}
          />
          {/* Floating badge */}
          <div
            style={{
              position: "absolute",
              bottom: "2rem",
              right: "2rem",
              background: "rgba(255,255,255,0.95)",
              borderRadius: "14px",
              padding: "1rem 1.25rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              backdropFilter: "blur(8px)",
              textAlign: "center",
              minWidth: "130px",
            }}
          >
            <p style={{ margin: 0, fontSize: "2.25rem", fontWeight: 900, color: "#F39C12", lineHeight: 1 }}>
              58%
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Max Savings
            </p>
          </div>
        </div>
      </section>

      {/* ── QUICK STATS BAR ─────────────────────────────────────────────── */}
      <section
        style={{
          background: "#7c2d12",
          padding: "0",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          {[
            { num: "20–50%", label: "Off most procedures" },
            { num: "20%", label: "Off orthodontics" },
            { num: "20%", label: "Off specialist fees" },
            { num: "$0", label: "Waiting period" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              style={{
                padding: "1.5rem 1rem",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}
            >
              <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {stat.num}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SAVINGS TABLE ───────────────────────────────────────────────── */}
      <section id="savings" className="section">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--accent-orange, #F39C12)",
                marginBottom: "0.5rem",
              }}
            >
              Real Numbers
            </p>
            <h2 style={{ margin: "0 0 0.75rem" }}>Sample Dental Savings</h2>
            <p style={{ color: "var(--text-secondary, #475569)", maxWidth: "520px", margin: "0 auto" }}>
              See what members actually pay versus standard market rates.
            </p>
          </div>

          <div
            style={{
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 40px rgba(243,156,18,0.12)",
              border: "1px solid rgba(243,156,18,0.12)",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                background: "linear-gradient(90deg, #D68910, #F39C12)",
                padding: "0.875rem 1.25rem",
              }}
            >
              {["Procedure", "Regular Cost*", "Plan Cost†", "You Save", "% Saved"].map((h) => (
                <span
                  key={h}
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Table rows */}
            {SAVINGS_DATA.map((row, i) => (
              <div
                key={row.procedure}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  padding: "1rem 1.25rem",
                  alignItems: "center",
                  background: i % 2 === 0 ? "#fff" : "rgba(243,156,18,0.03)",
                  borderBottom: i < SAVINGS_DATA.length - 1 ? "1px solid rgba(243,156,18,0.08)" : "none",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#0f172a" }}>
                  {row.procedure}
                </span>
                <span style={{ fontSize: "0.9375rem", color: "#64748b", textDecoration: "line-through" }}>
                  ${row.regular.toLocaleString()}
                </span>
                <span style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#F39C12" }}>
                  ${row.plan.toLocaleString()}
                </span>
                <span style={{ fontWeight: 600, color: "#10b981", fontSize: "0.9375rem" }}>
                  ${row.savings.toLocaleString()}
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      background: "linear-gradient(135deg, #F39C12, #D68910)",
                      color: "#fff",
                      borderRadius: "20px",
                      padding: "3px 12px",
                      fontSize: "0.8125rem",
                      fontWeight: 800,
                    }}
                  >
                    {row.pct}%
                  </span>
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: "1rem", lineHeight: 1.6 }}>
            *Regular Cost based on average 80th percentile usual &amp; customary rates per
            the <strong>2024 Fair Health Report</strong> (U.S.).&nbsp;
            †Plan Cost represents average assigned plan fees (U.S.). Prices subject to change.
          </p>
        </div>
      </section>

      {/* ── FEATURE CARDS ───────────────────────────────────────────────── */}
      <section className="section bg--blue">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "rgba(243,156,18,1)",
                marginBottom: "0.5rem",
              }}
            >
              What's Included
            </p>
            <h2 style={{ margin: 0 }}>Dental Discount Plan Features</h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1.25rem",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "14px",
                  overflow: "hidden",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "#F39C12", fontWeight: 700 }}>{f.title}</h4>
                </div>
                <div style={{ padding: "1.25rem 1.5rem" }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.85, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NETWORK TRUST BAND ──────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4rem",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <img
                src="/health-assets/dentist-network-discount_1536x1024.png"
                alt="Neighborhood dentist visit"
                style={{
                  width: "100%",
                  borderRadius: "16px",
                  display: "block",
                  boxShadow: "0 16px 64px rgba(243,156,18,0.18)",
                }}
              />
              {/* Inline callout */}
              <div
                style={{
                  position: "absolute",
                  top: "1.5rem",
                  left: "-1.5rem",
                  background: "linear-gradient(135deg, #F39C12, #D68910)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "0.875rem 1.25rem",
                  boxShadow: "0 8px 24px rgba(243,156,18,0.3)",
                  maxWidth: "180px",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 }}>
                  Network Size
                </p>
                <p style={{ margin: "4px 0 0", fontWeight: 900, fontSize: "1.375rem", lineHeight: 1 }}>
                  National
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", opacity: 0.85 }}>
                  Neighborhood dentists
                </p>
              </div>
            </div>

            <div>
              <p
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--accent-orange, #F39C12)",
                  marginBottom: "0.75rem",
                }}
              >
                The Network
              </p>
              <h2 style={{ marginBottom: "1rem" }}>One of the Largest Dental Networks in the Nation</h2>
              <p style={{ color: "#475569", marginBottom: "1.5rem", lineHeight: 1.7 }}>
                Our dental discount network is built around your neighborhood dentist —
                one of the most recognized professional dental networks in the United States,
                with member-transparent pricing and robust fee schedules so you always know
                exactly what you'll pay before you sit in the chair.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {[
                  "Nationwide coverage — find a dentist near you",
                  "No waiting periods to start saving",
                  "No annual maximums or claim forms",
                  "Member-transparent pricing every visit",
                  "Change providers at any time, no referral needed",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start", fontSize: "0.9375rem", color: "#334155" }}>
                    <span style={{ color: "#F39C12", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                className="button button--primary"
                href="/health/plans"
                style={{ padding: "13px 32px", fontSize: "0.9375rem" }}
              >
                Find a Dentist Near You
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── DISCLOSURE ──────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: "0" }}>
        <div className="container">
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#94a3b8",
              textAlign: "center",
              maxWidth: "700px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance.
            Discount amounts vary by provider and procedure. Savings shown are sample
            estimates based on 2024 Fair Health Report data. Prices subject to change.
          </p>
        </div>
      </section>
    </div>
  );
}
