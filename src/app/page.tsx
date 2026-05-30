import { LandingCards } from "./landing-cards";
import { Heart } from "lucide-react";

export const metadata = {
  title: "Ideal Health — Choose Your Plan",
  description:
    "Explore Ideal Health's Oral Savings Plans or our comprehensive Essentials health membership. Affordable coverage starting at $14.99/mo.",
};

export default function RootPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/newideal/site-files/multi-demographic.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.08,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          padding: "2rem 1.5rem 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heart size={20} color="white" />
          </div>
          <span
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: "1.4rem",
              letterSpacing: "-0.02em",
            }}
          >
            Ideal Health
          </span>
        </div>
      </header>

      {/* Hero text */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "rgba(186,230,253,0.9)",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          Welcome to Ideal Health
        </p>
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            maxWidth: 680,
            marginBottom: "1rem",
          }}
        >
          Affordable health coverage
          <br />
          <span style={{ color: "#7dd3fc" }}>built for real people</span>
        </h1>
        <p
          style={{
            color: "rgba(186,230,253,0.85)",
            fontSize: "1.1rem",
            maxWidth: 520,
            lineHeight: 1.65,
            marginBottom: "3rem",
          }}
        >
          Choose the plan family that fits your needs — dental &amp; vision savings, or a full
          wellness bundle starting at $14.99/mo.
        </p>

        {/* Interactive cards (client component) */}
        <LandingCards />

        {/* Trust line */}
        <p
          style={{
            color: "rgba(186,230,253,0.65)",
            fontSize: "0.8rem",
            marginTop: "2.5rem",
          }}
        >
          Ideal Health — administered by Ryze LLC · 1200 E Ridge Rd STE 1, McAllen, TX
        </p>
      </section>
    </main>
  );
}

