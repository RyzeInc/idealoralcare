"use client";

/**
 * HEALTH SIGN-IN PAGE
 * 
 * Custom sign-in page for Nexus Health members
 * Uses glassmorphism styling consistent with health pages
 */

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Shield, Heart, Sparkles } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import "@/app/health/health.css";

export default function HealthSignInPage() {
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
            Welcome Back
          </h1>
          <p style={{ 
            color: "rgba(255,255,255,0.85)", 
            fontSize: "1.125rem",
            maxWidth: "500px",
            margin: "0 auto"
          }}>
            Sign in to manage your health plans and access your member benefits
          </p>
        </div>
      </section>
      
      {/* Sign In Section */}
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
                Your Health, Simplified
              </h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="glass-card" style={{ 
                  padding: "1.25rem", 
                  display: "flex", 
                  alignItems: "flex-start", 
                  gap: "1rem" 
                }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #0066CC20, #0066CC10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Heart size={22} color="#0066CC" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>
                      Manage Your Plans
                    </h3>
                    <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.5 }}>
                      View and manage all your health subscriptions in one place
                    </p>
                  </div>
                </div>
                
                <div className="glass-card" style={{ 
                  padding: "1.25rem", 
                  display: "flex", 
                  alignItems: "flex-start", 
                  gap: "1rem" 
                }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #14b8a620, #14b8a610)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Shield size={22} color="#14b8a6" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>
                      Access Your Benefits
                    </h3>
                    <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.5 }}>
                      Download your member card and find participating providers
                    </p>
                  </div>
                </div>
                
                <div className="glass-card" style={{ 
                  padding: "1.25rem", 
                  display: "flex", 
                  alignItems: "flex-start", 
                  gap: "1rem" 
                }}>
                  <div style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #8b5cf620, #8b5cf610)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Sparkles size={22} color="#8b5cf6" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>
                      Exclusive Savings
                    </h3>
                    <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.5 }}>
                      Track your savings and discover new ways to save on care
                    </p>
                  </div>
                </div>
              </div>
              
              <p style={{ 
                marginTop: "2rem", 
                fontSize: "0.875rem", 
                color: "#94a3b8",
                lineHeight: 1.6
              }}>
                Don't have an account yet?{" "}
                <Link 
                  href="/health/plans" 
                  style={{ color: "#0066CC", fontWeight: 600, textDecoration: "none" }}
                >
                  Browse our plans
                </Link>
                {" "}and create an account at checkout.
              </p>
            </div>
            
            {/* Right Column - Sign In Form */}
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
                <SignIn 
                  path="/health/sign-in"
                  routing="path"
                  signUpUrl="/health/sign-up"
                  afterSignInUrl="/health/dashboard"
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
