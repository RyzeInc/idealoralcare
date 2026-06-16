"use client";

/**
 * IDEAL HEALTH – GET STARTED / SIGN UP
 *
 * Architecture (Crunch-model): Account creation is embedded as Step 4 of the
 * enrollment wizard (AccountPaymentStep).  This page is the entry gate:
 *
 *  Primary path  → /health/enroll?flow=dtc  (new member, self-serve)
 *  Secondary path → standalone Clerk sign-up, for users already enrolled
 *                   through a broker/group who just need portal access.
 *
 * Keep this page intentionally thin — its job is to route people correctly,
 * not to duplicate the full account-creation form.
 */

import { useState, useEffect, Suspense } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Loader, CheckCircle2, User, ShieldCheck } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import "@/app/health/health.css";

/* ── Enrollment steps strip (mirrors Crunch's stepper concept) ─────────── */
const ENROLL_STEPS = [
  { num: 1, label: "Eligibility",     sub: "ZIP or group code" },
  { num: 2, label: "Choose Plan",     sub: "Coverage & pricing" },
  { num: 3, label: "Your Info",       sub: "Personal details" },
  { num: 4, label: "Account",         sub: "Create & pay" },
  { num: 5, label: "Complete",        sub: "Active coverage" },
];

/* ── SVG brand icons ────────────────────────────────────────────────────── */
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.75 3.16.8 1.2-.24 2.35-.93 3.63-.84 1.54.13 2.7.75 3.44 1.9-3.15 1.88-2.4 5.98.72 7.14-.57 1.46-1.3 2.91-2.95 3.88zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
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
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.989 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/* ── Shared input styles ─────────────────────────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: "100%", border: "1px solid #e2e8f0", borderRadius: "12px",
  fontFamily: "inherit", fontSize: "1rem", transition: "all 0.2s", backgroundColor: "#f8fafc",
};
const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#0066CC";
  e.currentTarget.style.backgroundColor = "#fff";
};
const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#e2e8f0";
  e.currentTarget.style.backgroundColor = "#f8fafc";
};

/* ── Ticket-based sign-up (for Clerk invitation links) ───────────────────── */
function ClerkTicketSignUpForm({ ticket }: { ticket: string }) {
  const { signUp, isLoaded, setActive } = useSignUp();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (error) window.scrollTo({ top: 0, behavior: "smooth" }); }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setIsLoading(true);
    if (!isLoaded || !signUp || !setActive) { setError("Loading. Please wait."); setIsLoading(false); return; }
    try {
      const result = await signUp.create({ strategy: "ticket", ticket, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // After account creation with ticket, try to find the pending admin invite
        // and redirect to claim it; otherwise go to dashboard
        const userEmail = result.emailAddress;
        if (userEmail) {
          try {
            const inviteRes = await fetch(`/api/admin/get-invite-by-email?email=${encodeURIComponent(userEmail)}`);
            if (inviteRes.ok) {
              const inviteData = await inviteRes.json();
              if (inviteData?.token) {
                router.push(`/health/claim-invite?token=${inviteData.token}&source=admin`);
                return;
              }
            }
          } catch {
            // If lookup fails, just go to dashboard
          }
        }
        router.push("/health/dashboard");
      } else {
        setError("Account setup incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Failed to create account. The invite link may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = password
    ? password.length >= 12 ? "strong" : password.length >= 8 ? "good" : "weak"
    : null;

  return (
    <div className="glass-card" style={{ padding: "2rem" }}>
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <AlertCircle size={20} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.95rem" }}>{error}</p>
        </div>
      )}
      <p style={{ color: "#475569", marginBottom: "1.5rem", fontSize: "0.9375rem", lineHeight: 1.6 }}>
        Your email address has been verified via your invite. Just set a password to complete your account.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label htmlFor="ticket-password" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            Password <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
            <input id="ticket-password" type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
              disabled={isLoading} autoComplete="new-password" required
              style={{ ...inputBase, padding: "0.75rem 2.75rem" }} onFocus={focusStyle} onBlur={blurStyle} />
            <button type="button" onClick={() => setShowPassword(s => !s)}
              style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex" }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ height: "4px", flex: 1, background: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: passwordStrength === "strong" ? "100%" : passwordStrength === "good" ? "66%" : "33%", background: passwordStrength === "strong" ? "#22c55e" : passwordStrength === "good" ? "#3b82f6" : "#ef4444", transition: "all 0.3s" }} />
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: passwordStrength === "strong" ? "#22c55e" : passwordStrength === "good" ? "#3b82f6" : "#ef4444" }}>
                {passwordStrength === "strong" ? "Strong" : passwordStrength === "good" ? "Good" : "Weak"}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="ticket-confirmPassword" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            Confirm password <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
            <input id="ticket-confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
              disabled={isLoading} autoComplete="new-password" required
              style={{ ...inputBase, padding: "0.75rem 2.75rem", borderColor: confirmPassword && password === confirmPassword ? "#22c55e" : "#e2e8f0" }}
              onFocus={focusStyle}
              onBlur={(e) => { e.currentTarget.style.borderColor = confirmPassword && password === confirmPassword ? "#22c55e" : "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }} />
            {confirmPassword && password === confirmPassword && (
              <CheckCircle2 size={18} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#22c55e", pointerEvents: "none" }} />
            )}
          </div>
        </div>

        <button type="submit" disabled={isLoading || !password || !confirmPassword}
          style={{ padding: "0.875rem 1.5rem", background: isLoading || !password || !confirmPassword ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: isLoading ? "wait" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          {isLoading ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Setting up account…</> : "Complete Account Setup"}
        </button>
      </form>
    </div>
  );
}

/* ── Standalone Clerk sign-up form (for already-enrolled portal access) ─── */
type Step = "form" | "verify";

function PortalSignUpForm({ redirectTo }: { redirectTo: string }) {
  const { signUp, isLoaded, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep]                     = useState<Step>("form");
  const [firstName, setFirstName]           = useState("");
  const [lastName, setLastName]             = useState("");
  const [email, setEmail]                   = useState("");
  const [phone, setPhone]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword]     = useState(false);
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [oauthLoading, setOauthLoading]     = useState<string | null>(null);

  useEffect(() => { if (error) window.scrollTo({ top: 0, behavior: "smooth" }); }, [error]);

  const handleOAuth = async (strategy: "oauth_apple" | "oauth_google" | "oauth_facebook") => {
    if (!isLoaded || !signUp) return;
    setOauthLoading(strategy);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/health/sso-callback",
        redirectUrlComplete: redirectTo,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "OAuth sign-up failed.");
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setIsLoading(true);
    if (!isLoaded || !signUp || !setActive) { setError("Loading. Please wait."); setIsLoading(false); return; }
    try {
      // NOTE: phone is intentionally NOT sent to Clerk here. The Clerk instance
      // has phone set to "Verify at sign-up", and this flow only collects an
      // email code — attaching a phone would leave the sign-up permanently
      // incomplete. Members can add/verify a phone later from their portal.
      const params: Record<string, string> = { emailAddress: email, password };
      if (firstName) params.firstName = firstName;
      if (lastName)  params.lastName  = lastName;
      const result = await signUp.create(params);
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(redirectTo);
      } else if (result.unverifiedFields?.includes("email_address")) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      } else {
        setError("Sign-up requires additional steps. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Sign-up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (!signUp || !setActive) { setError("Loading. Please wait."); setIsLoading(false); return; }
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(redirectTo);
      } else {
        setError("Verification failed. Please check your code.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = password
    ? password.length >= 12 ? "strong" : password.length >= 8 ? "good" : "weak"
    : null;

  const busy = isLoading || !!oauthLoading;

  return (
    <div className="glass-card" style={{ padding: "2rem" }}>
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <AlertCircle size={20} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.95rem" }}>{error}</p>
        </div>
      )}

      {step === "form" && (
        <>
          {/* SSO */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {([
              { label: "Apple",    strategy: "oauth_apple"    as const, icon: <AppleIcon />,    bg: "#000",    color: "#fff",    border: "none"              },
              { label: "Facebook", strategy: "oauth_facebook" as const, icon: <FacebookIcon />, bg: "#1877F2", color: "#fff",    border: "none"              },
              { label: "Google",   strategy: "oauth_google"   as const, icon: <GoogleIcon />,   bg: "#fff",   color: "#374151", border: "1px solid #d1d5db" },
            ] as const).map(({ label, strategy, icon, bg, color, border }) => (
              <button key={strategy} type="button" title={`Continue with ${label}`}
                onClick={() => handleOAuth(strategy)} disabled={busy}
                style={{ flex: 1, padding: "0.625rem", borderRadius: "10px", background: bg, color, border, cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: oauthLoading && oauthLoading !== strategy ? 0.4 : 1, transition: "opacity 0.2s, transform 0.1s", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                {oauthLoading === strategy ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : icon}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>or create with email</span>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* First + Last name */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {([
                { id: "firstName", label: "First name", val: firstName, set: setFirstName, ph: "Jane"  },
                { id: "lastName",  label: "Last name",  val: lastName,  set: setLastName,  ph: "Smith" },
              ] as const).map(({ id, label, val, set, ph }) => (
                <div key={id}>
                  <label htmlFor={`portal-${id}`} style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.9rem" }}>{label}</label>
                  <input id={`portal-${id}`} type="text" value={val} onChange={(e) => set(e.target.value)} placeholder={ph} disabled={busy} autoComplete={id}
                    style={{ ...inputBase, padding: "0.75rem 0.875rem" }} onFocus={focusStyle} onBlur={blurStyle} />
                </div>
              ))}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="portal-email" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Email address <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                <input id="portal-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  disabled={busy} autoComplete="email" required
                  style={{ ...inputBase, padding: "0.75rem 1rem 0.75rem 2.75rem" }} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="portal-phone" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
                Phone <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "0.9rem", pointerEvents: "none", userSelect: "none" }}>+1</span>
                <input id="portal-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000"
                  disabled={busy} autoComplete="tel"
                  style={{ ...inputBase, paddingTop: "0.75rem", paddingBottom: "0.75rem", paddingLeft: "3rem", paddingRight: "1rem" }}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="portal-password" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Password <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                <input id="portal-password" type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
                  disabled={busy} autoComplete="new-password" required
                  style={{ ...inputBase, padding: "0.75rem 2.75rem" }} onFocus={focusStyle} onBlur={blurStyle} />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex" }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ height: "4px", flex: 1, background: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: passwordStrength === "strong" ? "100%" : passwordStrength === "good" ? "66%" : "33%", background: passwordStrength === "strong" ? "#22c55e" : passwordStrength === "good" ? "#3b82f6" : "#ef4444", transition: "all 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: passwordStrength === "strong" ? "#22c55e" : passwordStrength === "good" ? "#3b82f6" : "#ef4444" }}>
                    {passwordStrength === "strong" ? "Strong" : passwordStrength === "good" ? "Good" : "Weak"}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="portal-confirmPassword" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Confirm password <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                <input id="portal-confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                  disabled={busy} autoComplete="new-password" required
                  style={{ ...inputBase, padding: "0.75rem 2.75rem", borderColor: confirmPassword && password === confirmPassword ? "#22c55e" : "#e2e8f0" }}
                  onFocus={focusStyle}
                  onBlur={(e) => { e.currentTarget.style.borderColor = confirmPassword && password === confirmPassword ? "#22c55e" : "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }} />
                {confirmPassword && password === confirmPassword && (
                  <CheckCircle2 size={18} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#22c55e", pointerEvents: "none" }} />
                )}
              </div>
            </div>

            <button type="submit" disabled={busy || !email || !password || !confirmPassword}
              style={{ padding: "0.875rem 1.5rem", background: busy || !email || !password || !confirmPassword ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: busy ? "wait" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.25rem" }}
              onMouseEnter={(e) => { if (!busy && email && password) e.currentTarget.style.background = "#0052a3"; }}
              onMouseLeave={(e) => { if (!busy && email && password) e.currentTarget.style.background = "#0066CC"; }}>
              {isLoading ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Creating Account...</> : "Create Portal Account"}
            </button>
          </form>
        </>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            <p style={{ color: "#166534", margin: 0, fontSize: "0.9rem" }}>Check your inbox and enter the 6-digit code below.</p>
          </div>
          <div>
            <label htmlFor="portal-code" style={{ display: "block", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Verification code</label>
            <input id="portal-code" type="text" value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456" maxLength={6} disabled={isLoading} required
              style={{ width: "100%", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "12px", fontFamily: "monospace", fontSize: "1.5rem", letterSpacing: "0.4em", textAlign: "center", transition: "all 0.2s", backgroundColor: "#f8fafc" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
            />
          </div>
          <button type="submit" disabled={isLoading || verificationCode.length < 6}
            style={{ padding: "0.875rem 1.5rem", background: isLoading || verificationCode.length < 6 ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: isLoading ? "wait" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            {isLoading ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Verifying...</> : "Verify & Continue"}
          </button>
          <button type="button" onClick={() => { setStep("form"); setError(""); setVerificationCode(""); }}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline" }}>
            ← Back to sign up
          </button>
        </form>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
function GetStartedPage() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect_url");
  const redirectTo = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/health/dashboard";
  const clerkTicket = searchParams.get("__clerk_ticket");
  const [showPortalForm, setShowPortalForm] = useState(false);

  const enrollHref = "/health/checkout";
  const signInHref = redirectTo !== "/health/dashboard"
    ? `/health/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/health/sign-in";

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* ── Clerk invitation ticket flow ── */}
      {clerkTicket ? (
        <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
          <div className="container" style={{ maxWidth: "480px" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
                Complete Your Account Setup
              </h2>
              <p style={{ color: "#475569", fontSize: "0.9375rem", margin: 0 }}>
                You've been invited to Ideal Health Admin. Set a password to activate your account.
              </p>
            </div>
            <ClerkTicketSignUpForm ticket={clerkTicket} />
          </div>
        </section>
      ) : (
        <>

      {/* ── Primary CTA ── */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "1.5rem" }}>
        <div className="container" style={{ maxWidth: "560px" }}>
          <div className="glass-card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #0066CC15, #14b8a615)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
              <ShieldCheck size={28} color="#0066CC" />
            </div>

            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>
              New to Ideal Health?
            </h2>
            <p style={{ color: "#475569", marginBottom: "1.75rem", lineHeight: 1.7, fontSize: "1rem" }}>
              Browse plans, add to cart, then create your account and pay — all in one checkout flow. Takes about 3 minutes.
            </p>

            <Link href={enrollHref}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", padding: "1rem 2.5rem", background: "#0066CC", color: "#fff", textDecoration: "none", borderRadius: "14px", fontWeight: 700, fontSize: "1.0625rem", boxShadow: "0 4px 16px rgba(0,102,204,0.25)", transition: "all 0.2s", width: "100%" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#0052a3"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#0066CC"; e.currentTarget.style.transform = "translateY(0)"; }}>
              Browse Plans & Enroll <ArrowRight size={20} />
            </Link>

            <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Already have an account?</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            <Link href={signInHref}
              style={{ display: "block", marginTop: "1rem", padding: "0.875rem 1.5rem", background: "#f0f4f8", color: "#0066CC", border: "1px solid #e2e8f0", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", textDecoration: "none", transition: "all 0.2s", textAlign: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e0ebff"; e.currentTarget.style.borderColor = "#0066CC"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f0f4f8"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
              Sign In to Member Portal
            </Link>
          </div>
        </div>
      </section>

      {/* ── Secondary: broker/group-enrolled users needing portal access ── */}
      <section className="section bg--white" style={{ paddingTop: "0.5rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "560px" }}>
          {!showPortalForm ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <p style={{ color: "#64748b", fontSize: "0.9375rem", marginBottom: "0.75rem" }}>
                Enrolled through your employer or a broker?
              </p>
              <button onClick={() => setShowPortalForm(true)}
                style={{ background: "none", border: "none", color: "#0066CC", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                Create portal access only →
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
                  Create Portal Access
                </h3>
                <p style={{ color: "#475569", fontSize: "0.9375rem", margin: 0 }}>
                  For members already enrolled through a group plan or broker. Your plan is on file — this creates your login for the member portal.
                </p>
              </div>
              <PortalSignUpForm redirectTo={redirectTo} />
              <button onClick={() => setShowPortalForm(false)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline", marginTop: "1rem", display: "block" }}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </section>

      </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function HealthSignUpPage() {
  return (
    <Suspense fallback={null}>
      <GetStartedPage />
    </Suspense>
  );
}

