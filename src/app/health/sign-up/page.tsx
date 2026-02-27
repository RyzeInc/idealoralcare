"use client";

/**
 * HEALTH SIGN-UP PAGE
 * 
 * Custom sign-up page for new Nexus Health members
 * Uses glassmorphism styling consistent with health pages
 */

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Shield, Heart, Sparkles, CheckCircle } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import "@/app/health/health.css";

export default function HealthSignUpPage() {
  return (
    <div className="health-landing">
      <HealthHeader />
      
      {/* Hero Section */}
      <section className="section bg--blue" style={{ paddingTop: "7rem", paddingBottom: "2rem" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <Link 
            href="/health/plans" 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "0.5rem",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              marginBottom: "1.5rem",
              fontSize: "0.9375rem"
            }}
          >
            <ArrowLeft size={18} />
            Back to Plans
          </Link>
          <h1 style={{ 
            fontSize: "clamp(2rem, 5vw, 2.75rem)", 
            fontWeight: 700, 
            color: "#fff", 
            marginBottom: "0.75rem" 
          }}>
            Join Nexus Health
          </h1>
          <p style={{ 
            color: "rgba(255,255,255,0.85)", 
            fontSize: "1.125rem",
            maxWidth: "500px",
            margin: "0 auto"
          }}>
            Create your account to start saving on healthcare today
          </p>
        </div>
      </section>
      
      {/* Sign Up Section */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "1000px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "3rem",
            alignItems: "center"
          }}>
            
            {/* Left Column - Benefits */}
            <div style={{ padding: "1rem" }}>
              <h2 style={{ 
                fontSize: "1.5rem", 
                fontWeight: 700, 
                color: "#0f172a",
                marginBottom: "1.5rem"
              }}>
                Why Join Nexus Health?
              </h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[
                  "Immediate access to savings — no waiting periods",
                  "AI-powered oral scanning with Toothlens",
                  "24/7 teledentistry and telehealth access",
                  "Nationwide provider network",
                  "Cancel anytime — no long-term commitments"
                ].map((benefit, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <CheckCircle size={20} color="#14b8a6" style={{ flexShrink: 0 }} />
                    <span style={{ color: "#475569", lineHeight: 1.5 }}>{benefit}</span>
                  </div>
                ))}
              </div>
              
              <div className="glass-card" style={{ 
                marginTop: "2rem",
                padding: "1.25rem",
                background: "linear-gradient(135deg, #fef3c7, #fef9c3)",
                border: "1px solid #fcd34d"
              }}>
                <p style={{ 
                  fontSize: "0.875rem", 
                  color: "#92400e",
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  <strong>Note:</strong> For more details about how these plans work, see our terms and footer disclosure.
                </p>
              </div>
              
              <p style={{ 
                marginTop: "1.5rem", 
                fontSize: "0.875rem", 
                color: "#94a3b8",
                lineHeight: 1.6
              }}>
                Already have an account?{" "}
                <Link 
                  href="/health/sign-in" 
                  style={{ color: "#0066CC", fontWeight: 600, textDecoration: "none" }}
                >
                  Sign in here
                </Link>
              </p>
            </div>
            
            {/* Right Column - Sign Up Form */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center",
              alignItems: "center"
            }}>
              <div className="glass-card" style={{ 
                padding: "2rem",
                width: "100%",
                maxWidth: "420px"
              }}>
                <SignUp 
                  path="/health/sign-up"
                  routing="path"
                  signInUrl="/health/sign-in"
                  afterSignUpUrl="/health/dashboard"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-none bg-transparent p-0",
                      headerTitle: "text-xl font-bold text-slate-900",
                      headerSubtitle: "text-slate-600",
                      formButtonPrimary: 
                        "bg-gradient-to-r from-[#0066CC] to-[#0052a3] hover:from-[#0052a3] hover:to-[#003d7a] text-white font-semibold py-3 rounded-xl transition-all duration-200",
                      formFieldInput: 
                        "rounded-xl border-slate-200 focus:border-[#0066CC] focus:ring-[#0066CC]/20",
                      footerActionLink: "text-[#0066CC] hover:text-[#0052a3] font-semibold",
                      identityPreviewEditButton: "text-[#0066CC]",
                      formFieldLabel: "text-slate-700 font-medium",
                      dividerLine: "bg-slate-200",
                      dividerText: "text-slate-400",
                      socialButtonsBlockButton: 
                        "border-slate-200 hover:bg-slate-50 rounded-xl transition-all",
                      socialButtonsBlockButtonText: "text-slate-700 font-medium",
                      alert: "rounded-xl",
                      alertText: "text-sm",
                    },
                    layout: {
                      socialButtonsPlacement: "bottom",
                      showOptionalFields: false,
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Trust Footer */}
      <section className="section bg--light" style={{ paddingTop: "1.5rem", paddingBottom: "2rem" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
            🔒 Your information is protected with 256-bit SSL encryption
          </p>
        </div>
      </section>
    </div>
  );
}
