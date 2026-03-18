"use client";

import { Smile, Heart, Zap, Shield, Clock } from "lucide-react";

const BENEFITS = [
  {
    icon: Zap,
    iconColor: '#2ECC71',
    title: "AI Oral Scanning",
    description:
      "AI Oral Scanning analyzes photos of your teeth using AI to detect potential issues early.",
  },
  {
    icon: Clock,
    iconColor: '#3498DB',
    title: "24/7 Teledentistry",
    description:
      "Connect with licensed dentists anytime, anywhere via our Teledentistry Program for consultations and guidance.",
  },
  {
    icon: Smile,
    iconColor: '#F39C12',
    title: "Network Discounts",
    description:
      "Access thousands of dentists nationwide through the Dental Discount Network with negotiated discount rates.",
  },
  {
    icon: Heart,
    iconColor: '#64748b',
    title: "Preventive Focus",
    description:
      "Emphasis on preventive care and early detection to reduce costly treatments down the road.",
  },
  {
    icon: Shield,
    iconColor: '#64748b',
    title: "Emergency Support",
    description:
      "Immediate access to emergency dental support when pain or urgent concerns arise.",
  },
  {
    icon: Shield,
    iconColor: '#64748b',
    title: "Flexible Options",
    description:
      "Choose between teledentistry, in-network discounts, or a combination—whatever works best for you.",
  },
];

export default function BenefitGrid() {
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
            What's Included
          </p>
          <h2>Everything You Need for Oral Health</h2>
          <p style={{ fontSize: "1.125rem", color: "#475569", maxWidth: "600px", margin: "0 auto" }}>
            One affordable plan. Six comprehensive benefits.
          </p>
        </div>

        <div className="benefit-tiles">
          {BENEFITS.map((benefit, idx) => {
            const IconComponent = benefit.icon;
            return (
              <div key={idx} className="benefit-tile">
                <div className="benefit-tile__icon">
                  <IconComponent size={32} color={benefit.iconColor} />
                </div>
                <h4 className="benefit-tile__title">{benefit.title}</h4>
                <p className="benefit-tile__description">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
