import HealthHeader from "@/components/health/HealthHeader";
import Link from "next/link";

export const metadata = {
  title: "Oral Health Scan | Ideal Health",
  description:
    "Get instant AI-powered insights into your dental health with our AI oral health scan. No waiting, no hassle — just quick results from your smartphone.",
};

export default function OralHealthScanPage() {
  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero - Bold Split Design */}
      <section className="section" style={{ padding: "4rem 0", background: "linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)" }}>
        <div className="container">
          <div className="row" style={{ alignItems: "center" }}>
            <div className="col-6">
              <div style={{ paddingRight: "2rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f0fdf4", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                  ORAL HEALTH AI SCAN
                </div>
                <h1 style={{ fontSize: "3rem", lineHeight: 1.1, fontWeight: 800, color: "#fff", marginBottom: "1.5rem" }}>
                  Growing Evidence Connects a Healthy Mouth With a Healthy Body
                </h1>
                <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.95)", marginBottom: "2rem", lineHeight: 1.6 }}>
                  Advanced AI-powered scanning reveals the mouth-body connection instantly. Detect early warning signs of systemic health conditions and take control of your wellness right from your phone.
                </p>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <Link className="button button--primary" href="/health/plans">
                    Get Started
                  </Link>
                  <Link className="button" href="#how-it-works" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
                    Learn How It Works
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-6">
              <img
                src="/health-assets/scan-photo-ex.png"
                alt="Example scan photo on phone"
                style={{ width: "100%", maxWidth: "400px", borderRadius: "12px" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Health Connections Grid - Inspired by the connection graphic */}
      <section className="section" style={{ padding: "4rem 0", background: "#f8f9fa" }}>
        <div className="container">
          <div className="heading-block" style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#27AE60", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              THE MOUTH-BODY CONNECTION
            </p>
            <h2 style={{ fontSize: "2.25rem" }}>Your Mouth Tells Your Health Story</h2>
            <p style={{ maxWidth: "680px", margin: "1rem auto 0", fontSize: "1.0625rem", color: "#64748b", lineHeight: 1.6 }}>
              Growing evidence connects a healthy mouth with a healthy body. Here&apos;s what researchers have discovered about oral health and systemic wellness:
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "2rem",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            <style>{`
              .health-condition-card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                transition: all 0.3s ease;
              }
              .health-condition-card:hover {
                box-shadow: 0 8px 24px rgba(46,204,113,0.15);
                transform: translateY(-4px);
              }
            `}</style>
            {[
              {
                condition: "High Blood Pressure",
                facts: [
                  "Putting off dental care during early adulthood is linked to an increased risk of high blood pressure.",
                  "Patients with gum disease are less likely to keep their blood pressure under control with medication that are those with good oral health."
                ]
              },
              {
                condition: "Dementia",
                facts: [
                  "Having 10 years of chronic gum disease (periodontitis) is associated with a higher risk of developing Alzheimer's disease.",
                  "Researchers report that uncontrolled periodontal disease 'could trigger or exacerbate' the neuroinflammatory phenomenon seen in Alzheimer's disease."
                ]
              },
              {
                condition: "Diabetes",
                facts: [
                  "Untreated gum disease makes it harder for people with diabetes to manage their blood glucose levels.",
                  "Diabetes raises the risk of developing gum disease by 86%."
                ]
              },
              {
                condition: "Respiratory Health",
                facts: [
                  "Research shows that improving oral hygiene among medically fragile seniors can reduce the death rate from aspiration pneumonia.",
                  "Patients with ventilator-associated pneumonia (VAP) who engage in regular toothbrushing spend significantly less time on mechanical ventilation than other VAP patients."
                ]
              },
              {
                condition: "Adverse Birth Outcomes",
                facts: [
                  "Gum disease among pregnant women is associated with preterm births, low birth weight babies and pre-eclampsia — a pregnancy complication that can cause organ damage and be fatal.",
                ]
              },
              {
                condition: "Obesity",
                facts: [
                  "Brushing teeth no more than once per day was linked with the development of obesity.",
                  "Frequent consumption of sugar-sweetened drinks raises the risk of both obesity and tooth decay among children and adults."
                ]
              },
            ].map((item) => (
              <div
                key={item.condition}
                className="health-condition-card"
              >
                <h3 style={{ fontSize: "1.25rem", color: "#27AE60", marginBottom: "1rem", fontWeight: 700 }}>
                  {item.condition}
                </h3>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: "0.95rem", lineHeight: 1.7 }}>
                  {item.facts.map((fact, idx) => (
                    <li key={idx} style={{ marginBottom: "0.75rem" }}>
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "3rem", fontSize: "0.8125rem", color: "#64748b" }}>
            <p><strong>Source:</strong> CareQuest Institute for Oral Health®</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" id="how-it-works" style={{ padding: "4rem 0" }}>
        <div className="container">
          <div className="heading-block" style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#27AE60", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              NEXT-GENERATION TECHNOLOGY
            </p>
            <h2 style={{ fontSize: "2.25rem" }}>How Your AI Oral Health Scan Works</h2>
            <p style={{ maxWidth: "680px", margin: "1rem auto 0", fontSize: "1.0625rem", color: "#64748b", lineHeight: 1.6 }}>
              Three simple steps to instant oral health insights — right from your phone.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem", marginTop: "2rem" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "50%", background: "linear-gradient(135deg, #2ECC71, #27AE60)", color: "#fff", fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>1</div>
              <h4 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "1rem" }}>Snap a Photo</h4>
              <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
                Use your smartphone camera to capture images of your teeth. No special equipment needed — the tool guides you through the process for the clearest results.
              </p>
              <img src="/health-assets/scan-result-demo.png" alt="Smartphone camera capturing a photo of teeth for oral health scan" style={{ width: "100%", maxWidth: "280px", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "50%", background: "linear-gradient(135deg, #2ECC71, #27AE60)", color: "#fff", fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>2</div>
              <h4 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "1rem" }}>AI Analysis</h4>
              <p style={{ color: "#64748b" }}>
                Our advanced AI engine instantly analyzes your images, identifying potential issues such as cavities, gum concerns, surface staining, and oral health patterns.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "50%", background: "linear-gradient(135deg, #2ECC71, #27AE60)", color: "#fff", fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>3</div>
              <h4 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "1rem" }}>Actionable Report</h4>
              <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
                Receive a detailed oral health report with clear, actionable insights with no appointment required. Share with your dentist anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="section" style={{ padding: "4rem 0", background: "linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)" }}>
        <div className="container">
          <div className="row" style={{ alignItems: "center" }}>
            <div className="col-6">
              <h2 style={{ fontSize: "2.25rem", color: "#fff", marginBottom: "1.5rem", fontWeight: 800 }}>
                Why Preventative Scanning Matters
              </h2>
              <p style={{ fontSize: "1.0625rem", color: "rgba(255,255,255,0.95)", marginBottom: "1.5rem", lineHeight: 1.7 }}>
                Early detection is powerful. By identifying oral health changes before they become serious problems, you can:
              </p>
              <ul style={{ color: "rgba(255,255,255,0.95)", fontSize: "1.0625rem", lineHeight: 1.8, paddingLeft: "1.5rem" }}>
                <li style={{ marginBottom: "1rem" }}>Reduce unnecessary dental treatment and costs</li>
                <li style={{ marginBottom: "1rem" }}>Support better management of systemic health conditions</li>
                <li style={{ marginBottom: "1rem" }}>Take proactive steps to protect your smile and health</li>
                <li style={{ marginBottom: "1rem" }}>Share insights with your dental and medical teams</li>
                <li>Stay informed about changes throughout the year</li>
              </ul>
              <div style={{ marginTop: "2rem" }}>
                <Link className="button button--primary" href="/health/teledentistry">
                  Follow Up With Teledentistry
                </Link>
              </div>
            </div>
            <div className="col-6">
              <img
                src="/health-assets/dental-office-exam.png"
                alt="Professional dental office exam"
                style={{ width: "100%", borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="section" style={{ padding: "4rem 0", textAlign: "center", background: "#f8f9fa" }}>
        <div className="container">
          <h2 style={{ fontSize: "2.25rem", marginBottom: "1.5rem", fontWeight: 800 }}>
            Ready to Connect Your Mouth to Your Health?
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "#64748b", maxWidth: "680px", margin: "0 auto 2rem", lineHeight: 1.6 }}>
            Get your AI oral health scan today. It takes less than 5 minutes and could reveal important insights about your wellness.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="button button--primary" href="/health/plans">
              Start Your Scan
            </Link>
            <Link className="button" href="/health/teledentistry" style={{ background: "#fff", color: "#27AE60", border: "2px solid #27AE60" }}>
              Schedule a Consultation
            </Link>
          </div>
        </div>
      </section>

      {/* Disclosure */}
      <section className="section">
        <div className="container">
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted, #94a3b8)",
              textAlign: "center",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance.
            This oral health scan is an informational tool and does not constitute a medical diagnosis.
            Please consult a licensed dental professional for clinical evaluation and treatment.
          </p>
        </div>
      </section>
    </div>
  );
}
