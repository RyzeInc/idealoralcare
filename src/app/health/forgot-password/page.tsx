"use client";

/**
 * IDEAL HEALTH FORGOT PASSWORD PAGE
 *
 * Two-step password reset using Clerk's reset_password_email_code strategy:
 *   Step 1 – User enters email → Clerk sends a 6-digit code
 *   Step 2 – User enters code + new password → session created, redirect to dashboard
 */

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader,
  KeyRound,
} from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import "@/app/health/health.css";

type Step = "email" | "verify";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /* ── Step 1: Request reset code ── */
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !email) return;

    setError("");
    setIsLoading(true);
    try {
      await signIn!.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("verify");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Could not send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Step 2: Verify code + set new password ── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const result = await signIn!.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });

      if (result.status === "complete") {
        await setActive!({ session: result.createdSessionId });
        router.push("/health/dashboard");
      } else {
        setError("Verification failed. Please check your code and try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero Section */}
      <section
        className="section bg--blue"
        style={{ paddingTop: "7rem", paddingBottom: "2rem" }}
      >
        <div className="container" style={{ textAlign: "center" }}>
          <Link
            href="/health/sign-in"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
              marginBottom: "1.5rem",
              fontSize: "0.9375rem",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          >
            <ArrowLeft size={18} />
            Back to Sign In
          </Link>
          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 2.75rem)",
              fontWeight: 700,
              color: "#fff",
              marginBottom: "0.75rem",
            }}
          >
            {step === "email" ? "Reset Your Password" : "Check Your Email"}
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "1.125rem",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            {step === "email"
              ? "Enter your email address and we'll send you a reset code"
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section
        className="section bg--white"
        style={{ paddingTop: "3rem", paddingBottom: "4rem" }}
      >
        <div className="container" style={{ maxWidth: "500px" }}>
          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "1rem",
                marginBottom: "2rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <AlertCircle size={20} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
              <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.95rem" }}>{error}</p>
            </div>
          )}

          <div className="glass-card" style={{ padding: "2rem" }}>
            {/* ── STEP 1: EMAIL ── */}
            {step === "email" && (
              <form onSubmit={handleRequestCode} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <label
                    htmlFor="email"
                    style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail
                      size={18}
                      style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={isLoading}
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem 0.75rem 2.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        fontFamily: "inherit",
                        fontSize: "1rem",
                        transition: "all 0.2s",
                        backgroundColor: "#f8fafc",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  style={{
                    padding: "0.875rem 1.5rem",
                    background: isLoading || !email ? "#cbd5e1" : "#0066CC",
                    color: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: isLoading ? "wait" : "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  {isLoading ? (
                    <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Sending Code...</>
                  ) : (
                    <><KeyRound size={18} /> Send Reset Code</>
                  )}
                </button>
              </form>
            )}

            {/* ── STEP 2: CODE + NEW PASSWORD ── */}
            {step === "verify" && (
              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Success hint */}
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    padding: "0.875rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                  <p style={{ color: "#166534", margin: 0, fontSize: "0.9rem" }}>
                    Code sent! Check your inbox and enter it below.
                  </p>
                </div>

                {/* Code field */}
                <div>
                  <label
                    htmlFor="code"
                    style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}
                  >
                    Reset Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    disabled={isLoading}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      fontFamily: "monospace",
                      fontSize: "1.5rem",
                      letterSpacing: "0.4em",
                      textAlign: "center",
                      transition: "all 0.2s",
                      backgroundColor: "#f8fafc",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                  />
                </div>

                {/* New password */}
                <div>
                  <label
                    htmlFor="newPassword"
                    style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}
                  >
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock
                      size={18}
                      style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
                    />
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      disabled={isLoading}
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem 2.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        fontFamily: "inherit",
                        fontSize: "1rem",
                        transition: "all 0.2s",
                        backgroundColor: "#f8fafc",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex" }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}
                  >
                    Confirm Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock
                      size={18}
                      style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
                    />
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      disabled={isLoading}
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem 2.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        fontFamily: "inherit",
                        fontSize: "1rem",
                        transition: "all 0.2s",
                        backgroundColor: "#f8fafc",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !code || !newPassword || !confirmPassword}
                  style={{
                    padding: "0.875rem 1.5rem",
                    background: isLoading || !code || !newPassword || !confirmPassword ? "#cbd5e1" : "#0066CC",
                    color: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: isLoading ? "wait" : "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  {isLoading ? (
                    <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Resetting Password...</>
                  ) : (
                    "Reset Password & Sign In"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); setCode(""); }}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline" }}
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>

          {/* Back to sign in */}
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link
              href="/health/sign-in"
              style={{ color: "#0066CC", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
