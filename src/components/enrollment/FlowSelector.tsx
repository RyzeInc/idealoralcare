"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, User, Users, Building2, Briefcase } from "lucide-react";

export type EnrollmentFlow =
  | "dtc"
  | "broker-individual"
  | "broker-group-member"
  | "broker-group-employer";

interface FlowOption {
  id: EnrollmentFlow;
  icon: React.ReactNode;
  badge?: string;
  title: string;
  who: string;
  description: string;
  details: string[];
  cta: string;
  accent: string;
  accentBg: string;
}

const FLOWS: FlowOption[] = [
  {
    id: "dtc",
    icon: <User size={28} />,
    title: "Individual Enrollment",
    who: "For individuals",
    description: "Sign up directly for the Ideal Oral Savings Plan.",
    details: [
      "Instant coverage activation",
      "Monthly or annual billing",
      "No broker code needed",
    ],
    cta: "Start Enrollment",
    accent: "#0066CC",
    accentBg: "#EFF5FC",
  },
  {
    id: "broker-individual",
    icon: <Briefcase size={28} />,
    badge: "Broker",
    title: "Broker — Individual Client",
    who: "For brokers & agents",
    description: "Enroll an individual client under your broker code.",
    details: [
      "Attribute enrollment to your account",
      "Commission tracked automatically",
      "Client pays directly",
    ],
    cta: "Enroll a Client",
    accent: "#7c3aed",
    accentBg: "#F5F3FF",
  },
  {
    id: "broker-group-member",
    icon: <Users size={28} />,
    badge: "Broker",
    title: "Broker — Group (Member Pays)",
    who: "For brokers with groups",
    description:
      "Set up group access — each member individually enrolls and pays their own membership.",
    details: [
      "Members use group code to join",
      "Each member billed separately",
      "Group dashboard for broker",
    ],
    cta: "Set Up Group",
    accent: "#0891b2",
    accentBg: "#EFF8FC",
  },
  {
    id: "broker-group-employer",
    icon: <Building2 size={28} />,
    badge: "Broker",
    title: "Broker — Group (Employer Pays)",
    who: "For brokers with groups",
    description:
      "Employer or organization covers membership cost for all enrolled members.",
    details: [
      "Single invoice to employer",
      "Members get immediate access",
      "Consolidated group billing",
    ],
    cta: "Set Up Group",
    accent: "#059669",
    accentBg: "#ECFDF5",
  },
];

export function FlowSelector() {
  const router = useRouter();

  const handleSelect = (flow: EnrollmentFlow) => {
    router.push(`/health/enroll?flow=${flow}`);
  };

  return (
    <div className="flow-selector">
      <div className="flow-selector__header">
        <p className="flow-selector__eyebrow">Get Started</p>
        <h1 className="flow-selector__title">How are you enrolling?</h1>
        <p className="flow-selector__subtitle">
          Choose the enrollment path that fits your situation. Each flow is
          tailored to your needs.
        </p>
      </div>

      <div className="flow-selector__grid">
        {FLOWS.map((flow) => (
          <button
            key={flow.id}
            onClick={() => handleSelect(flow.id)}
            className="flow-card"
            style={
              {
                "--flow-accent": flow.accent,
                "--flow-accent-bg": flow.accentBg,
              } as React.CSSProperties
            }
          >
            <div className="flow-card__top">
              <div className="flow-card__icon-wrap">
                {flow.icon}
              </div>
              {flow.badge && (
                <span className="flow-card__badge">{flow.badge}</span>
              )}
            </div>

            <div className="flow-card__body">
              <p className="flow-card__who">{flow.who}</p>
              <h2 className="flow-card__title">{flow.title}</h2>
              <p className="flow-card__description">{flow.description}</p>

              <ul className="flow-card__details">
                {flow.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="flow-card__footer">
              <span className="flow-card__cta">
                {flow.cta}
                <ArrowRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="flow-selector__help">
        Not sure which to choose?{" "}
        <a href="/health/how-it-works">Learn about our enrollment options →</a>
      </p>
    </div>
  );
}
