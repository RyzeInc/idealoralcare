"use client";

/**
 * IDEAL HEALTH – SIGN IN
 * SSO (Apple + Facebook + Google), email/username or phone, password, redirect support
 */

import { useState, useEffect, Suspense } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, Loader, KeyRound } from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import "@/app/health/health.css";

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
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.989 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

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

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect_url") || "/health/dashboard";
  const { signIn, isLoaded, setActive } = useSignIn();

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [clerkTimeout, setClerkTimeout] = useState(false);

  // If Clerk hasn't loaded in 8s, it's likely blocked or the domain isn't allowlisted
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setClerkTimeout(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  useEffect(() => { if (error) window.scrollTo({ top: 0, behavior: "smooth" }); }, [error]);

  const handleOAuth = async (strategy: "oauth_apple" | "oauth_google" | "oauth_facebook") => {
    if (!isLoaded) return;
    setOauthLoading(strategy);
    try {
      await signIn!.authenticateWithRedirect({
        strategy,
        redirectUrl: "/health/sso-callback",
        redirectUrlComplete: redirectTo,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "OAuth sign-in failed. Please try again.");
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (!isLoaded) { setError("Loading. Please wait."); setIsLoading(false); return; }
    const id = mode === "phone" && !identifier.startsWith("+")
      ? `+1${identifier.replace(/\D/g, "")}`
      : identifier;
    try {
      const result = await signIn!.create({ identifier: id, password });
      if (result.status === "complete") {
        await setActive!({ session: result.createdSessionId });
        router.push(redirectTo);
      } else {
        setError("Sign-in requires additional verification. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const busy = isLoading || !!oauthLoading;
  const formValid = identifier.trim() !== "" && password.length >= 1 && isLoaded;
  const signUpHref = redirectTo !== "/health/dashboard"
    ? `/health/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/health/sign-up";

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Hero */}
      <section className="section bg--blue" style={{ paddingTop: "7rem", paddingBottom: "2rem" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <Link href="/health/plans"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "#0f172a", textDecoration: "none", marginBottom: "1.5rem", fontSize: "0.9375rem", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0066CC")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#0f172a")}>
            <ArrowLeft size={18} /> Back to Plans
          </Link>
          <h1 style={{ fontSize: "clamp(2rem,5vw,2.75rem)", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>
            Welcome Back
          </h1>
          <p style={{ color: "#475569", fontSize: "1.125rem", maxWidth: "500px", margin: "0 auto" }}>
            Sign in to access your Ideal Health member portal
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "480px" }}>

          {clerkTimeout && !isLoaded && (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <AlertCircle size={20} color="#92400e" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <p style={{ color: "#92400e", margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600 }}>Auth not initializing</p>
                <p style={{ color: "#78350f", margin: 0, fontSize: "0.875rem" }}>
                  Go to <strong>Clerk Dashboard → Domains</strong> and add <code style={{ background: "#fde68a", padding: "1px 4px", borderRadius: "4px" }}>localhost:3000</code> as an allowed origin, then refresh.
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

            {/* SSO Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Apple",    strategy: "oauth_apple" as const,    icon: <AppleIcon />,    bg: "#000",    color: "#fff",     border: "none"              },
                { label: "Facebook", strategy: "oauth_facebook" as const, icon: <FacebookIcon />, bg: "#1877F2", color: "#fff",     border: "none"              },
                { label: "Google",   strategy: "oauth_google" as const,   icon: <GoogleIcon />,   bg: "#fff",   color: "#374151",  border: "1px solid #d1d5db" },
              ].map(({ label, strategy, icon, bg, color, border }) => (
                <button key={strategy} type="button" title={`Continue with ${label}`}
                  onClick={() => handleOAuth(strategy)} disabled={busy}
                  style={{ flex: 1, padding: "0.625rem", borderRadius: "10px", background: bg, color, border, cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: oauthLoading && oauthLoading !== strategy ? 0.4 : 1, transition: "opacity 0.2s, transform 0.1s", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
                  onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                  {oauthLoading === strategy ? <Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> : icon}
                </button>
              ))}
            </div>

            {/* Or divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Identifier */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label htmlFor="identifier" style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.95rem" }}>
                    {mode === "phone" ? "Phone number" : "Email address or username"}
                  </label>
                  <button type="button"
                    onClick={() => { setMode(m => m === "email" ? "phone" : "email"); setIdentifier(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#0066CC", fontSize: "0.8125rem", fontWeight: 500, padding: 0 }}>
                    {mode === "phone" ? "Use email" : "Use phone"}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  {mode === "phone"
                    ? <Phone size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                    : <Mail size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />}
                  {mode === "phone" && (
                    <span style={{ position: "absolute", left: "38px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "0.9rem", pointerEvents: "none", userSelect: "none" }}>
                      +1
                    </span>
                  )}
                  <input id="identifier"
                    type={mode === "phone" ? "tel" : "text"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={mode === "phone" ? "(555) 000-0000" : "email@example.com or username"}
                    disabled={busy}
                    autoComplete={mode === "phone" ? "tel" : "email username"}
                    style={{ ...inputBase, paddingTop: "0.75rem", paddingBottom: "0.75rem", paddingLeft: mode === "phone" ? "3.5rem" : "2.75rem", paddingRight: "1rem" }}
                    onFocus={focusStyle} onBlur={blurStyle}
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
                  <input id="password" type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    disabled={busy} autoComplete="current-password"
                    style={{ ...inputBase, padding: "0.75rem 2.75rem" }}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex" }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={busy || !formValid}
                style={{ padding: "0.875rem 1.5rem", background: busy || !formValid ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", cursor: busy ? "wait" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.25rem" }}
                onMouseEnter={(e) => { if (!busy && formValid) e.currentTarget.style.background = "#0052a3"; }}
                onMouseLeave={(e) => { if (!busy && formValid) e.currentTarget.style.background = "#0066CC"; }}>
                {isLoading ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Signing in...</> : !isLoaded ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Initializing...</> : "Sign In"}
              </button>
            </form>

            {/* Sign up link */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>Don't have an account?</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>
            <Link href={signUpHref}
              style={{ display: "block", textAlign: "center", padding: "0.875rem 1.5rem", background: "#f0f4f8", color: "#0066CC", border: "1px solid #e2e8f0", borderRadius: "12px", fontWeight: 600, fontSize: "1rem", textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e0ebff"; e.currentTarget.style.borderColor = "#0066CC"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f0f4f8"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
              Create Account
            </Link>
          </div>

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Need help signing in?</p>
            <a href="mailto:support@idealhealth.com" style={{ color: "#0066CC", textDecoration: "none", fontWeight: 500 }}>Contact support</a>
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
