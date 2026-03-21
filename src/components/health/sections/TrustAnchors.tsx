"use client";

import { Shield, Users, Award, Zap } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "Private & Secure",
    text: "Your health data is encrypted and never shared with third parties.",
  },
  {
    icon: Users,
    title: "Real Licensed Dentists",
    text: "Every teledentistry provider on our platform is board-licensed and independently verified.",
  },
  {
    icon: Award,
    title: "Month-to-Month Flexibility",
    text: "No long-term commitment. Cancel any time, no questions asked.",
  },
  {
    icon: Zap,
    title: "Access Within 24 Hours",
    text: "Your benefits are active the day after you enroll. No waiting period.",
  },
];

export default function TrustAnchors() {
  return (
    <section style={{ padding: "100px 0" }}>
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
            Why Members Trust Ideal Health
          </p>
          <h2>Peace of Mind, Every Step</h2>
        </div>

        <div className="trust-anchors">
          {TRUST_ITEMS.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div key={idx} className="trust-anchor">
                <div className="trust-anchor__icon">
                  <IconComponent size={40} color="#475569" />
                </div>
                <h4 className="trust-anchor__title">{item.title}</h4>
                <p className="trust-anchor__text">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
