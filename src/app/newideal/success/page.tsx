import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Welcome | New Ideal Health",
};

export default function NewIdealSuccessPage() {
  return (
    <div className="health-landing">
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          padding: "16px 0",
        }}
      >
        <div className="container" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/newideal/logo.png" alt="New Ideal Health" width={52} height={52} />
        </div>
      </header>

      <section className="section bg--blue" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: 640, textAlign: "center" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(20,184,166,0.18), rgba(16,185,129,0.18))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem",
            }}
          >
            <CheckCircle2 size={56} color="#0f766e" />
          </div>

          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 0.75rem 0",
            }}
          >
            Welcome to New Ideal Health
          </h1>
          <p
            style={{
              fontSize: "1.0625rem",
              color: "#475569",
              lineHeight: 1.6,
              margin: "0 0 2rem 0",
            }}
          >
            Your membership is active. You will receive a confirmation email shortly with your
            member ID, account details, and instructions for accessing each program (telehealth,
            pharmacy, labs, and more).
          </p>

          <div
            className="glass-card"
            style={{
              padding: 24,
              textAlign: "left",
              marginBottom: "2rem",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem" }}>What happens next</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                color: "var(--text-secondary)",
                fontSize: "0.9375rem",
                lineHeight: 1.7,
              }}
            >
              <li>You will receive a welcome email within a few minutes.</li>
              <li>Your member ID and program access instructions will be included.</li>
              <li>Your monthly billing will continue automatically — cancel anytime.</li>
              <li>
                Questions? Contact{" "}
                <a href="mailto:support@newidealhealth.com">support@newidealhealth.com</a>.
              </li>
            </ul>
          </div>

          <Link href="/newideal/plans" className="button button--primary">
            Back to plans
          </Link>
        </div>
      </section>
    </div>
  );
}
