"use client";

const STEPS = [
  {
    step: 1,
    title: "Review the Plan",
    description:
      "Learn about what's included in our Oral Health Plan and how it supports your dental care needs.",
  },
  {
    step: 2,
    title: "Enroll Online",
    description:
      "Enrollment is completed in a few minutes. Select your payment method (card or ACH) and billing frequency.",
  },
  {
    step: 3,
    title: "Get Your Member ID",
    description:
      "Receive your digital member ID card within 24 hours of enrollment with access to all plan services.",
  },
  {
    step: 4,
    title: "Start Your Dental Journey",
    description:
      "Use AI scanning for home monitoring, get teledentistry consultations when needed, and access discounted in-network care.",
  },
];

export default function HowItWorks() {
  return (
    <section style={{ padding: "100px 0", backgroundColor: "#f8fafc" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem",
            }}
          >
            Simple Process
          </p>
          <h2>Getting Started Takes 4 Easy Steps</h2>
          <p style={{ fontSize: "1.125rem", color: "#475569", maxWidth: "600px", margin: "0 auto" }}>
            From enrollment to access—everything you need to start your oral health journey.
          </p>
        </div>

        <div className="how-it-works">
          {STEPS.map((item) => (
            <div key={item.step} className="how-it-works__step">
              <div className="how-it-works__number">{item.step}</div>
              <h3 className="how-it-works__title">{item.title}</h3>
              <p className="how-it-works__description">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
