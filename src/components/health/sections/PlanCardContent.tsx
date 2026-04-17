"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

interface PlanCardContentProps {
  title?: string;
  description?: string;
}

export default function PlanCardContent({
  title = "Ideal Oral Health Plan",
  description = "Wide Ranging oral healthcare discount plan with AI scanning, teledentistry, and nationwide provider discounts.",
}: PlanCardContentProps) {
  // Query for oral plan data from Convex
  const planData = useQuery(api.healthplans.oral.getOralPlan);

  if (!planData) {
    return (
      <section style={{ padding: "100px 0" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p>Loading plan details...</p>
        </div>
      </section>
    );
  }

  // Extract features for display
  const featureTitles = planData.features
    .filter((f) => f.included)
    .map((f) => f.name);

  return (
    <section style={{ padding: "100px 0" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#0066CC",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem",
            }}
          >
            Our Single Plan
          </p>
          <h2>One Plan. Comprehensive Coverage.</h2>
          <p
            style={{
              fontSize: "1.125rem",
              color: "#475569",
              maxWidth: "600px",
              margin: "0 auto",
            }}
          >
            {description}
          </p>
        </div>

        <div className="plan-card">
          <div className="plan-card__badge">Everything Included</div>

          <h3 className="plan-card__name">{planData.name}</h3>


          <ul className="plan-card__features">
            {featureTitles.map((feature, idx) => (
              <li key={idx}>{feature}</li>
            ))}
          </ul>

          <div
            style={{
              backgroundColor: "#f0f9ff",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "2rem",
              marginTop: "2rem",
            }}
          >
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#0c4a6e",
                margin: "0",
              }}
            >
              <strong>Powered by:</strong>
            </p>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#0c4a6e",
                margin: "0.5rem 0 0 0",
              }}
            >
              <strong>AI Oral Scanning:</strong> AI-powered oral health
              scanning available on iOS and Android
            </p>
          </div>

          <Link
            href="/health/checkout"
            className="button button--primary"
            style={{
              display: "inline-block",
              width: "100%",
              padding: "14px 24px",
              backgroundColor: "#0066CC",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              marginBottom: "1rem",
            }}
          >
            Enroll Now
          </Link>

          <Link
            href="/health/how-it-works"
            style={{
              display: "block",
              padding: "12px 24px",
              border: "2px solid #e2e8f0",
              borderRadius: "8px",
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
              color: "#0066CC",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            Learn How It Works
          </Link>
        </div>
      </div>
    </section>
  );
}
