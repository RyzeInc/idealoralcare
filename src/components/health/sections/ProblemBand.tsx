import { Calendar, HelpCircle, DollarSign } from "lucide-react";

const problems = [
  {
    Icon: Calendar,
    title: "Weeks to Get Seen",
    body: "Most people delay care because getting an appointment takes too long. By the time you go, a small problem has become a bigger one.",
  },
  {
    Icon: HelpCircle,
    title: "No One Tells You the Price",
    body: "You shouldn't find out what something costs while you're in the chair. Dental care should be transparent before you ever book.",
  },
  {
    Icon: DollarSign,
    title: "Coverage That Falls Short",
    body: "Even people with dental insurance still pay 40–50% out of pocket on major work. And tens of millions have no coverage at all.",
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
          <h2
            style={{
              fontSize: "clamp(1.625rem, 3.5vw, 2.25rem)",
              fontWeight: 800,
              color: "#f8fafc",
              marginBottom: "16px",
              lineHeight: 1.2,
            }}
          >
            Better Care Deserves a Better System.
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
            Most people put off dental care because of the wait, the cost, or not knowing where to start. It shouldn&apos;t be that hard.
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
