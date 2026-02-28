"use client";

import { Shield, Users, Award, Zap } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "256-Bit SSL Encryption",
    text: "Your information is protected with enterprise-grade security.",
  },
  {
    icon: Users,
    title: "Real Licensed Dentists",
    text: "All Dial Care providers are licensed dental professionals with real expertise.",
  },
  {
    icon: Award,
    title: "Month-to-Month Flexibility",
    text: "No surprises. Transparent month-to-month membership with full control.",
  },
  {
    icon: Zap,
    title: "Immediate Access",
    text: "Start using your benefits the same day you enroll.",
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
              color: "#0066CC",
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
                  <IconComponent size={40} color="#0066CC" />
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
