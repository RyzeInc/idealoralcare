"use client";

import styles from "./principles.module.css";

const PRINCIPLES = [
  {
    number: 1,
    headline: "Predictable Monthly Cost",
    text: "One simple, affordable monthly membership. No surprises, no hidden fees, no unexpected bills.",
  },
  {
    number: 2,
    headline: "Accessible at Participating Dentists",
    text: "Access thousands of participating dentists nationwide via the Dental Discount Network Dental Discount Network network. Use your benefits immediately.",
  },
  {
    number: 3,
    headline: "Clear Benefit Tiers",
    text: "Preventive care covered at 100%. Basic and major services at predictable discount rates. Ortho and cosmetic options available.",
  },
  {
    number: 4,
    headline: "Human Support When You Need It",
    text: "24/7 Dial Care teledentistry + dedicated member support. Real dentists, real care, real answers.",
  },
];

export default function PrincipleSection() {
  return (
    <section className={styles.principles}>
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
            Why Ideal Health Works
          </p>
          <h2>Built On Four Core Principles</h2>
          <p style={{ fontSize: "1.125rem", color: "#475569", maxWidth: "600px", margin: "0 auto" }}>
            Designed for simplicity, affordability, and real support every step of the way.
          </p>
        </div>

        <div className={styles.grid}>
          {PRINCIPLES.map((principle) => (
            <div key={principle.number} className={styles.card}>
              <div className={styles.label}>PRINCIPLE #{principle.number}</div>
              <h3 className={styles.headline}>{principle.headline}</h3>
              <p className={styles.text}>{principle.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
