import { Calendar, HelpCircle, DollarSign } from "lucide-react";

const problems = [
  {
    Icon: Calendar,
    title: "Getting an Appointment Shouldn't Take Weeks",
    body: "Between packed schedules and months-long wait lists, most people delay care until a minor issue becomes an expensive one.",
  },
  {
    Icon: HelpCircle,
    title: "No One Knows What They'll Pay Before They Go",
    body: "Dental offices rarely publish prices. Patients walk in blind, get treatment estimates mid-chair, and leave with bills they weren't prepared for.",
  },
  {
    Icon: DollarSign,
    title: "Insurance Covers Less Than People Think",
    body: "77 million Americans have zero dental coverage. Those who do still absorb 40–50% of major procedure costs out of pocket — every single time.",
  },
];

export default function ProblemBand() {
  return (
    <section
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
        padding: "80px 0",
      }}
    >
      <div className="container">
        {/* Heading */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "56px",
          }}
        >
          <p
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#14b8a6",
              marginBottom: "12px",
            }}
          >
            The Problem
          </p>
          <h2
            style={{
              fontSize: "clamp(1.625rem, 3.5vw, 2.25rem)",
              fontWeight: 800,
              color: "#f8fafc",
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            The Dental Care System Is Broken for Most People
          </h2>
          <p
            style={{
              fontSize: "1.0625rem",
              color: "rgba(248,250,252,0.65)",
              maxWidth: "560px",
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Access, affordability, and transparency have never kept up with what patients actually need.
          </p>
        </div>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
          }}
        >
          {problems.map(({ Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "16px",
                padding: "36px 32px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(20,184,166,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={24} color="#14b8a6" strokeWidth={1.75} />
              </div>
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#f8fafc",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "rgba(248,250,252,0.6)",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
