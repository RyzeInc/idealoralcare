"use client";

import { useState, useEffect, Suspense } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Loader, KeyRound, Heart, Users, DollarSign, Zap } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { safeReturnPath } from "@/lib/safe-redirect";
import "@/app/health/health.css";


function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}


const inputBase: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  fontFamily: "inherit",
  fontSize: "1rem",
  transition: "all 0.2s",
  backgroundColor: "#f8fafc",
};

const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#0066CC";
  e.currentTarget.style.backgroundColor = "#fff";
};

const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#e2e8f0";
  e.currentTarget.style.backgroundColor = "#f8fafc";
};

function PlanShowcase() {
  const features = [
    { icon: Heart, label: "Comprehensive Coverage", description: "Oral health services for the whole family" },
    { icon: DollarSign, label: "Save Up to 40%", description: "On dental procedures at network providers" },
    { icon: Zap, label: "Instant Activation", description: "Benefits start immediately upon enrollment" },
    { icon: Users, label: "Wide Provider Network", description: "2,000+ dentists nationwide" },
  ];

  const trustPoints = [
    { number: "50K+", label: "Active Members" },
    { number: "99%", label: "Satisfaction Rate" },
    { number: "$2.5M+", label: "Savings Generated" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.75rem",
          fontWeight: "700",
          color: "#14b8a6",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "1rem",
          background: "rgba(20, 184, 166, 0.1)",
          padding: "6px 12px",
          borderRadius: "100px",
        }}>
          <Heart size={14} />
          Ideal Oral Savings Plan
        </div>
        <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: "800", color: "#0f172a", lineHeight: 1.2, marginBottom: "0.75rem" }}>
          Join thousands of members saving on dental care
        </h2>
        <p style={{ fontSize: "1.125rem", color: "#475569", lineHeight: 1.7, maxWidth: "400px" }}>
          Access affordable dental coverage with no deductibles, no waiting periods, and instant benefits
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                background: "rgba(20, 184, 166, 0.12)",
                border: "1px solid rgba(20, 184, 166, 0.2)",
                borderRadius: "10px",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: "42px",
                height: "42px",
              }}>
                <Icon size={20} style={{ color: "#14b8a6" }} />
              </div>
              <div>
                <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.95rem" }}>{feature.label}</div>
                <div style={{ fontSize: "0.875rem", color: "#64748b", lineHeight: 1.4 }}>{feature.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)",
        border: "1px solid rgba(20, 184, 166, 0.2)",
        borderRadius: "16px",
        padding: "1.25rem",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "1.5rem",
        textAlign: "center",
      }}>
        {trustPoints.map((point, i) => (
          <div key={i}>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#14b8a6", marginBottom: "0.5rem" }}>
              {point.number}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "500" }}>
              {point.label}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/health/plans"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#14b8a6", textDecoration: "none", fontWeight: "600", fontSize: "0.95rem" }}
      >
        View all plans →
      </Link>
    </div>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeReturnPath(searchParams.get("redirect_url"), "/health/dashboard");
  const { signIn, isLoaded, setActive } = useSignIn();

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [clerkTimeout, setClerkTimeout] = useState(false);
  // Verification flow state
  const [step, setStep] = useState<"credentials" | "verification">("credentials");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"email_code" | "phone_code" | "totp" | "backup_code">("email_code");
  const [factorStage, setFactorStage] = useState<"first" | "second">("first");
  const [secondFactorOptions, setSecondFactorOptions] = useState<string[]>([]);

  // Every second-factor strategy this UI knows how to render, in preferred order.
  // Add new strategies here (and to the verification-step UI below) rather than
  // introducing another one-off if/else — that's how this app ended up unable
  // to handle backup codes even though Clerk had them enabled.
  const SECOND_FACTOR_PRIORITY = ["totp", "email_code", "phone_code", "backup_code"] as const;
  type SecondFactorStrategy = (typeof SECOND_FACTOR_PRIORITY)[number];

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimeout(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  useEffect(() => {
    if (error) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [error]);

  const handleOAuth = async () => {
    if (!isLoaded || !signIn) return;
    setOauthLoading("oauth_google");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/health/sso-callback",
        redirectUrlComplete: redirectTo,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "OAuth sign-in failed. Please try again.");
      setOauthLoading(null);
    }
  };

  const activateSecondFactor = async (strategy: SecondFactorStrategy) => {
    if (!signIn) return;
    if (strategy === "phone_code" || strategy === "email_code") {
      await signIn.prepareSecondFactor({ strategy });
    }
    // totp and backup_code need no preparation — user already has the code in hand.
    setVerificationMethod(strategy);
    setFactorStage("second");
    setStep("verification");
    setVerificationCode("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (!isLoaded || !signIn || !setActive) { setError("Loading. Please wait."); setIsLoading(false); return; }
    const id = mode === "phone" && !identifier.startsWith("+")
      ? `+1${identifier.replace(/\D/g, "")}`
      : identifier;
    try {
      const result = await signIn.create({ identifier: id, password });
      console.log("[sign-in] result.status:", result.status, "supportedFirstFactors:", result.supportedFirstFactors, "supportedSecondFactors:", result.supportedSecondFactors);
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(redirectTo);
      } else if (result.status === "needs_second_factor") {
        // MFA required — pick the highest-priority strategy this UI supports
        const supported = result.supportedSecondFactors ?? [];
        setSecondFactorOptions(supported.map((f) => f.strategy));
        const chosen = SECOND_FACTOR_PRIORITY.find((strategy) =>
          supported.some((f) => f.strategy === strategy)
        );
        if (chosen) {
          await activateSecondFactor(chosen);
        } else {
          const found = supported.map((f) => f.strategy).join(", ") || "none";
          setError(`Multi-factor verification is required, but this app doesn't yet support your account's method (${found}). Please contact support.`);
        }
      } else if (result.status === "needs_first_factor") {
        // Email/phone code required as first factor — find and prepare it
        const supported = result.supportedFirstFactors ?? [];
        type FirstFactor = (typeof supported)[number];
        type EmailCodeFactor = Extract<FirstFactor, { strategy: "email_code" }>;
        type PhoneCodeFactor = Extract<FirstFactor, { strategy: "phone_code" }>;

        const emailCode = supported.find((f): f is EmailCodeFactor => f.strategy === "email_code");
        const phoneCode = supported.find((f): f is PhoneCodeFactor => f.strategy === "phone_code");
        if (emailCode) {
          await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailCode.emailAddressId });
          setVerificationMethod("email_code");
          setFactorStage("first");
          setStep("verification");
          setVerificationCode("");
          setError("");
        } else if (phoneCode) {
          await signIn.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: phoneCode.phoneNumberId });
          setVerificationMethod("phone_code");
          setFactorStage("first");
          setStep("verification");
          setVerificationCode("");
          setError("");
        } else {
          const found = supported.map((f) => f.strategy).join(", ") || "none";
          setError(`Verification is required, but this app doesn't yet support your account's method (${found}). Please contact support.`);
        }
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (!isLoaded || !signIn || !setActive || !verificationCode) { 
      setError("Please enter the verification code."); 
      setIsLoading(false); 
      return; 
    }
    try {
      // verificationMethod was set to whichever strategy we actually activated,
      // so it's always the correct strategy to attempt — no need to re-derive it.
      const result = factorStage === "second"
        ? await signIn.attemptSecondFactor({
            strategy: verificationMethod as SecondFactorStrategy,
            code: verificationCode,
          })
        : await signIn.attemptFirstFactor({
            strategy: verificationMethod as "email_code" | "phone_code",
            code: verificationCode,
          });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(redirectTo);
      } else if (result.status === "needs_second_factor") {
        // Additional verification needed
        setFactorStage("second");
        setStep("verification");
        setVerificationCode("");
        const factorVerification = result.secondFactorVerification;
        if (factorVerification?.strategy) {
          setVerificationMethod(factorVerification.strategy as typeof verificationMethod);
        }
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setVerificationCode("");
    setError("");
    setFactorStage("first");
    setSecondFactorOptions([]);
  };

  const busy = isLoading || !!oauthLoading;
  const isBackupCode = verificationMethod === "backup_code";
  // Other second-factor strategies the account has enrolled and this UI supports,
  // so a user isn't stuck contacting support just because their first choice
  // (e.g. a lost authenticator app) isn't available right now.
  const switchableSecondFactors = secondFactorOptions.filter(
    (s): s is SecondFactorStrategy =>
      (SECOND_FACTOR_PRIORITY as readonly string[]).includes(s) && s !== verificationMethod
  );
  const formValid = identifier.trim() !== "" && password.length >= 1 && isLoaded;
  const signUpHref = redirectTo !== "/health/dashboard"
    ? `/health/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/health/sign-up";

  return (
    <div className="health-landing">
      <HealthHeader />

      <section style={{
        background: "transparent",
        paddingTop: "1.5rem",
        paddingBottom: "1.5rem",
      }}>
        <div className="container" style={{
          maxWidth: "1280px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3rem",
          alignItems: "center",
        }}>
          {/* Left Column – Plan Showcase */}
          <div style={{ paddingRight: "2rem" }}>
            <PlanShowcase />
          </div>

          {/* Right Column – Sign In Form */}
          <div style={{ paddingLeft: "2rem" }}>
            {clerkTimeout && !isLoaded && (
              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <AlertCircle size={20} color="#92400e" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ color: "#92400e", margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600 }}>Auth not initializing</p>
                  <p style={{ color: "#78350f", margin: 0, fontSize: "0.875rem" }}>
                    Go to <strong>Clerk Dashboard → Domains</strong> and add{" "}
                    <code style={{ background: "#fde68a", padding: "1px 4px", borderRadius: "4px" }}>localhost:3000</code>{" "}
                    as an allowed origin, then refresh.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <AlertCircle size={20} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.95rem" }}>{error}</p>
              </div>
            )}

            <div className="glass-card" style={{ padding: "2rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.25rem" }}>
                Sign In
              </h2>
              <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1.25rem" }}>
                Access your Ideal Health member portal
              </p>

              {/* Google SSO */}
              {step === "credentials" && (
                <>
                  <button
                    type="button"
                    onClick={handleOAuth}
                    disabled={busy}
                    style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "10px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: 600, transition: "opacity 0.2s, transform 0.1s", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
                    onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {oauthLoading ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : <GoogleIcon />}
                    Continue with Google
                  </button>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                    <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>or</span>
                    <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                  </div>
                </>
              )}

              <form onSubmit={step === "credentials" ? handleSubmit : handleVerification} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {step === "credentials" ? (
                  <>
                    {/* Identifier */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <label htmlFor="identifier" style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.95rem" }}>
                          {mode === "phone" ? "Phone number" : "Email address or username"}
                        </label>
                        <button
                          type="button"
                          onClick={() => { setMode(m => m === "email" ? "phone" : "email"); setIdentifier(""); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#0066CC", fontSize: "0.8125rem", fontWeight: 500, padding: 0 }}
                        >
                          {mode === "phone" ? "Use email" : "Use phone"}
                        </button>
                      </div>
                  <div style={{ position: "relative" }}>
                    {mode === "phone"
                      ? <Phone size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                      : <Mail size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                    }
                    {mode === "phone" && (
                      <span style={{ position: "absolute", left: "38px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "0.9rem", pointerEvents: "none", userSelect: "none" }}>
                        +1
                      </span>
                    )}
                    <input
                      id="identifier"
                      type={mode === "phone" ? "tel" : "text"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={mode === "phone" ? "(555) 000-0000" : "email@example.com or username"}
                      disabled={busy}
                      autoComplete={mode === "phone" ? "tel" : "email username"}
                      style={{ ...inputBase, paddingTop: "0.75rem", paddingBottom: "0.75rem", paddingLeft: mode === "phone" ? "3.5rem" : "2.75rem", paddingRight: "1rem" }}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </div>
                </div>

                {/* Password */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <label htmlFor="password" style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.95rem" }}>Password</label>
                        <Link href="/health/forgot-password" style={{ color: "#0066CC", fontSize: "0.8125rem", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <KeyRound size={13} /> Forgot password?
                        </Link>
                      </div>
                      <div style={{ position: "relative" }}>
                        <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={busy}
                          autoComplete="current-password"
                          style={{ ...inputBase, padding: "0.75rem 2.75rem" }}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex" }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Verification Code Step */}
                    <div>
                      <label htmlFor="verificationCode" style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.95rem", display: "block", marginBottom: "0.5rem" }}>
                        Verification Code
                      </label>
                      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1rem" }}>
                        {verificationMethod === "email_code" && "Enter the code sent to your email"}
                        {verificationMethod === "phone_code" && "Enter the code sent to your phone"}
                        {verificationMethod === "totp" && "Enter your authenticator app code"}
                        {verificationMethod === "backup_code" && "Enter one of your saved backup codes"}
                      </p>
                      <input
                        id="verificationCode"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(
                          isBackupCode
                            ? e.target.value.replace(/\s/g, "").slice(0, 24)
                            : e.target.value.replace(/\D/g, "").slice(0, 6)
                        )}
                        placeholder={isBackupCode ? "xxxxx-xxxxx" : "000000"}
                        disabled={busy}
                        autoComplete="one-time-code"
                        inputMode={isBackupCode ? "text" : "numeric"}
                        maxLength={isBackupCode ? 24 : 6}
                        style={{ ...inputBase, padding: "0.75rem", textAlign: "center", fontSize: isBackupCode ? "1.125rem" : "1.5rem", letterSpacing: isBackupCode ? "0.05em" : "0.5rem", fontWeight: 600 }}
                        onFocus={focusStyle}
                        onBlur={blurStyle}
                      />
                      {factorStage === "second" && switchableSecondFactors.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.75rem", alignItems: "center" }}>
                          {switchableSecondFactors.map((strategy) => (
                            <button
                              key={strategy}
                              type="button"
                              onClick={() => activateSecondFactor(strategy)}
                              disabled={busy}
                              style={{ background: "none", border: "none", color: "#0066CC", fontSize: "0.8125rem", fontWeight: 500, cursor: busy ? "wait" : "pointer", padding: "0.125rem" }}
                            >
                              {strategy === "totp" && "Use authenticator app instead"}
                              {strategy === "email_code" && "Email me a code instead"}
                              {strategy === "phone_code" && "Text me a code instead"}
                              {strategy === "backup_code" && "Use a backup code instead"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={busy || (step === "credentials" && !formValid) || (step === "verification" && verificationCode.length < 6)}
                  style={{ padding: "0.875rem 1.5rem", background: (busy || (step === "credentials" && !formValid) || (step === "verification" && verificationCode.length < 6)) ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: busy ? "wait" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.25rem" }}
                  onMouseEnter={(e) => { if (!busy && ((step === "credentials" && formValid) || (step === "verification" && verificationCode.length === 6))) e.currentTarget.style.background = "#0055AA"; }}
                  onMouseLeave={(e) => { if (!busy && ((step === "credentials" && formValid) || (step === "verification" && verificationCode.length === 6))) e.currentTarget.style.background = "#0066CC"; }}
                >
                  {isLoading
                    ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> {step === "verification" ? "Verifying..." : "Signing in..."}</>
                    : !isLoaded
                      ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Initializing...</>
                      : step === "verification"
                        ? "Verify Code"
                        : "Sign In"
                  }
                </button>
                
                {step === "verification" && (
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    disabled={busy}
                    style={{ padding: "0.875rem 1.5rem", background: "#f0f4f8", color: "#0066CC", border: "1px solid #e2e8f0", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#e8f0fe"; }}
                    onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = "#f0f4f8"; }}
                  >
                    Back to Sign In
                  </button>
                )}
              </form>

              {/* Sign up link */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Don&apos;t have an account?</span>
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              </div>

              <Link
                href={signUpHref}
                style={{ display: "block", textAlign: "center", padding: "0.875rem 1.5rem", background: "#f0f4f8", color: "#0066CC", border: "1px solid #e2e8f0", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", textDecoration: "none", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#e8f0fe"; e.currentTarget.style.borderColor = "#0066CC"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f0f4f8"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                Create Account
              </Link>

              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Need help signing in?</p>
                <a href="mailto:support@getidealoh.com" style={{ color: "#0066CC", textDecoration: "none", fontWeight: 500 }}>
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .health-landing section > .container {
            display: flex !important;
            flex-direction: column !important;
            gap: 2rem !important;
          }
          .health-landing section > .container > div {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .health-landing section > .container > div:first-child {
            order: 2 !important;
          }
          .health-landing section > .container > div:last-child {
            order: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function HealthSignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
