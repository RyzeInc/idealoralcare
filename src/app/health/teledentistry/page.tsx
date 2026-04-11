import HealthHeader from "@/components/health/HealthHeader";
import Link from "next/link";

export const metadata = {
  title: "Teledentistry | 24/7 Virtual Dental Consultations | Ideal Health",
  description:
    "24/7/365 virtual consultations with licensed dentists via phone or video chat. Ideal Health Teledentistry — care on your schedule, wherever you are.",
  alternates: { canonical: "/health/teledentistry" },
  openGraph: {
    title: "24/7 Teledentistry — Talk to a Dentist Anytime",
    description:
      "Virtual dental consultations available 24/7/365 via phone or video. Get prescriptions, second opinions, and expert oral health guidance from home.",
    url: "https://getidealoh.com/health/teledentistry",
    images: [{ url: "/health-assets/teledentistr_1024x1024.png", width: 1024, height: 1024 }],
  },
};

const HELP_WITH = [
  { title: "Oral Pain", desc: "Immediate guidance for toothaches, jaw pain, and other acute oral discomfort." },
  { title: "Broken, Chipped or Sensitive Teeth", desc: "Expert advice on damaged or temperature-sensitive teeth and next steps." },
  { title: "Gum Swelling & Bleeding", desc: "Assess and advise on periodontal concerns including inflammation and bleeding gums." },
  { title: "Sores, Lesions & Infections", desc: "Evaluation of mouth sores, soft tissue lesions, swelling, and suspected infections." },
  { title: "Orthodontia Needs", desc: "Virtual screening and guidance on braces, aligners, and orthodontic concerns." },
  { title: "Second Opinions", desc: "Get an expert second opinion to ensure confidence in oral health diagnoses and treatment plans." },
  { title: "Prescriptions", desc: "Clinically appropriate, non-DEA controlled prescriptions when indicated, in accordance with state regulations." },
  { title: "And Much More", desc: "Misaligned teeth, post-procedure questions, general dental guidance — covered." },
];

const WHEN_TO_USE = [
  "For non-emergency dental issues, questions and concerns",
  "When you live a significant distance from a dentist",
  "For second opinions on dental care",
  "When your primary dentist is unavailable",
  "When traveling within the U.S. and in need of dental care or guidance",
  "During or after normal business hours, nights, weekends and holidays",
  "To avoid unnecessary trips to the Emergency Room",
];

export default function TeledentistryPage() {
  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero - Bold Split Design */}
      <section className="section" style={{ padding: "4rem 0", background: "linear-gradient(135deg, #1e3a5f 0%, #1b4a7a 100%)" }}>
        <div className="container">
          <div className="row" style={{ alignItems: "center" }}>
            <div className="col-6">
              <div style={{ paddingRight: "2rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                  IDEAL HEALTH TELEDENTISTRY
                </div>
                <h1 style={{ fontSize: "3rem", lineHeight: 1.1, fontWeight: 800, color: "#fff", marginBottom: "1.5rem" }}>
                  Expert Dental Care — 24/7/365
                </h1>
                <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.95)", marginBottom: "2rem", lineHeight: 1.6 }}>
                  Virtual consultations with licensed dentists via phone or video chat. Get answers to your dental questions and guidance on oral health concerns — anytime, anywhere.
                </p>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <Link className="button button--accent" href="/health/plans" style={{ padding: "12px 28px", fontSize: "0.9375rem" }}>
                    Explore Plans
                  </Link>
                  <a href="#services" style={{ padding: "12px 28px", fontSize: "0.9375rem", fontWeight: 600, color: "#fff", border: "2px solid rgba(255,255,255,0.35)", borderRadius: "8px", textDecoration: "none", transition: "border-color 0.2s" }}>
                    Learn More ↓
                  </a>
                </div>
              </div>
            </div>
            <div className="col-6" style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img
                src="/health-assets/teledentistry-video-call.png"
                alt="Teledentistry virtual consultation"
                style={{ width: "75%", maxWidth: "400px", borderRadius: "12px", position: "relative", zIndex: 1, objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── DIAGONAL WAVE DIVIDER ───────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          height: "60px",
          background: "#fff",
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
        }}
      >
        <svg width="100%" height="60" viewBox="0 0 100 60" preserveAspectRatio="none" style={{ display: "block" }}>
          <path d="M 0,30 Q 25,10 50,30 T 100,30 L 100,60 L 0,60 Z" fill="#1e3a5f" />
        </svg>
      </div>

      {/* ── WHAT WE CAN HELP WITH ──────────────────────────────────────── */}
      <section id="services" style={{ background: "#eff6ff", padding: "4rem 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#2980B9",
                marginBottom: "0.5rem",
              }}
            >
              Our Services
            </p>
            <h2 style={{ margin: "0 0 0.75rem" }}>What We Can Help With</h2>
            <p style={{ color: "#475569", maxWidth: "540px", margin: "0 auto" }}>
              Licensed dentists available 24 hours a day to address a wide range of oral health concerns.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {HELP_WITH.map((item, idx) => (
              <div
                key={item.title}
                style={{
                  background: "#fff",
                  border: "1px solid rgba(10,139,138,0.1)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "1.5rem",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #3498DB, #2980B9)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                  }}
                >
                  {idx + 1}
                </div>
                <h4 style={{ margin: "0.75rem 0 0.5rem", color: "#2980B9", fontSize: "1rem" }}>{item.title}</h4>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHEN TO USE SECTION ────────────────────────────────────────── */}
      <section style={{ background: "#fff", padding: "4rem 0" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "start" }}>
            <div>
              <p
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#2980B9",
                  marginBottom: "0.75rem",
                }}
              >
                Use Cases
              </p>
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>When to Use Teledentistry</h2>
              <p style={{ color: "#475569", marginBottom: "2rem", lineHeight: 1.7 }}>
                Teledentistry is perfect for non-emergency dental issues, convenient access when you can't get to an office, and expert guidance whenever you need it.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {WHEN_TO_USE.map((use) => (
                <div
                  key={use}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    alignItems: "flex-start",
                    padding: "1rem",
                    background: "rgba(52,152,219,0.05)",
                    borderRadius: "10px",
                    border: "1px solid rgba(52,152,219,0.1)",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "#3498DB",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.625rem",
                      fontWeight: 900,
                      marginTop: "2px",
                    }}
                  >
                    ✓
                  </span>
                  <p style={{ margin: 0, fontSize: "0.9375rem", color: "#334155", lineHeight: 1.5 }}>{use}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DIAGONAL WAVE DIVIDER 2 ────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          height: "60px",
          background: "#fff",
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          overflow: "hidden",
        }}
      >
        <svg width="100%" height="60" viewBox="0 0 100 60" preserveAspectRatio="none" style={{ display: "block" }}>
          <path d="M 0,30 Q 25,50 50,30 T 100,30 L 100,0 L 0,0 Z" fill="#1e3a5f" />
        </svg>
      </div>

      {/* ── LIVE VIDEO CONSULTATIONS ───────────────────────────────────── */}
      <section style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1b4a7a 100%)", padding: "4rem 0" }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
            <div>
              <p
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.75)",
                  marginBottom: "0.75rem",
                }}
              >
                How It Works
              </p>
              <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "1.5rem" }}>Live Video Consultations</h2>
              <p style={{ color: "rgba(255,255,255,0.85)", marginBottom: "1.5rem", lineHeight: 1.7 }}>
                Connect face-to-face with a licensed dentist from home, work, or anywhere. Our platform supports both phone and video consultations — your choice, your schedule.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {[
                  "Emergencies & urgent dental concerns",
                  "General dental questions & guidance",
                  "After-hours and weekend access",
                  "Orthodontic screening",
                  "Triage and dental screening",
                  "Prescriptions when clinically appropriate",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start", fontSize: "0.9375rem", color: "rgba(255,255,255,0.85)" }}>
                    <span style={{ fontWeight: 700, color: "#5dade2", flexShrink: 0, marginTop: "1px" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                className="button button--accent"
                href="/health/plans"
                style={{ padding: "13px 32px", fontSize: "0.9375rem" }}
              >
                Start Consultation
              </Link>
            </div>

            <div style={{ position: "relative" }}>
              <img
                src="/health-assets/teledentistry-provider.png"
                alt="Healthcare provider video consultation"
                style={{
                  width: "100%",
                  borderRadius: "16px",
                  display: "block",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 24/7 CTA ───────────────────────────────────────────────────── */}
      <section style={{ background: "#fff", padding: "4rem 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
            <h2>Care on Your Schedule</h2>
            <p style={{ color: "#475569", fontSize: "1.0625rem", lineHeight: 1.7, marginBottom: "2rem" }}>
              Access expert dental guidance 24 hours a day, 7 days a week, 365 days a year. No waiting rooms, no scheduling headaches — just the answers you need, when you need them.
            </p>
            <Link className="button button--primary" href="/health/plans">
              Explore Plans
            </Link>
          </div>
        </div>
      </section>

      {/* ── DISCLOSURE ──────────────────────────────────────────────────── */}
      <section style={{ background: "#eff6ff", padding: "2.5rem 0", borderTop: "1px solid rgba(52,152,219,0.15)" }}>
        <div className="container">
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#64748b",
              textAlign: "center",
              maxWidth: "700px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            <strong>Disclosure:</strong> THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance. State availability may vary. Please contact us for up-to-date information on availability in your state.
          </p>
        </div>
      </section>
    </div>
  );
}
