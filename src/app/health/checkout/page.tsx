"use client";

/**
 * HEALTH CHECKOUT PAGE
 * 
 * Complete checkout flow using health.css design system:
 * 1. Review cart items
 * 2. Select payment method  
 * 3. Create account (if not logged in)
 * 4. Confirm and complete purchase
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser, useSignIn, useSignUp } from "@clerk/nextjs";
import { 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  Check, 
  Lock, 
  Calendar, 
  ShoppingCart,
  ChevronRight,
  Shield,
  X,
  Mail,
  Eye,
  EyeOff,
  Loader,
  AlertCircle,
  UserPlus,
  Phone,
  MapPin,
  User
} from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { AgentRepCodeSelector } from "@/components/health/AgentRepCodeSelector";
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { CadenceModal } from "@/components/health/catalog";
import { MembershipAgreementModal, TermsAndConditionsModal } from "@/components/legal";
import "@/app/health/health.css";

/* ─── Inline auth (sign-in / sign-up) used in checkout Step 3 ─────────────── */
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.75 3.16.8 1.2-.24 2.35-.93 3.63-.84 1.54.13 2.7.75 3.44 1.9-3.15 1.88-2.4 5.98.72 7.14-.57 1.46-1.3 2.91-2.95 3.88zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.989 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

type AuthTab = "signin" | "signup";
type AuthStep = "form" | "verify";

// ── Shared sub-components (must be module-level to avoid remount on each keystroke) ──

function Field({ label, error: err, optional, children }: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#374151", display: "flex", gap: "4px", alignItems: "center" }}>
        {label}
        {optional
          ? <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: "0.75rem" }}>(optional)</span>
          : <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
      {err && (
        <p style={{ color: "#dc2626", fontSize: "0.75rem", margin: 0, display: "flex", alignItems: "center", gap: "3px" }}>
          <AlertCircle size={11} style={{ flexShrink: 0 }} />{err}
        </p>
      )}
    </div>
  );
}

function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", display: "flex" }}>{icon}</span>
      {children}
    </div>
  );
}

const WIZARD_LABELS = ["Your Info", "Address", "Account"];
function StepIndicator({ wizardStep }: { wizardStep: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "1.5rem" }}>
      {WIZARD_LABELS.map((label, i) => {
        const isComplete = i < wizardStep;
        const isActive   = i === wizardStep;
        return [
          <div key={`step-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", flex: "none" }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: isComplete || isActive ? "#0066CC" : "#e2e8f0",
              color: isComplete || isActive ? "#fff" : "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8125rem", fontWeight: 700,
              boxShadow: isActive ? "0 0 0 4px rgba(0,102,204,0.15)" : "none",
              transition: "all 0.25s",
            }}>
              {isComplete ? <Check size={14} /> : i + 1}
            </div>
            <span style={{
              fontSize: "0.6875rem", fontWeight: isActive ? 700 : 400,
              color: isComplete || isActive ? "#0066CC" : "#94a3b8",
              whiteSpace: "nowrap", transition: "color 0.25s",
            }}>
              {label}
            </span>
          </div>,
          i < 2 && <div key={`line-${i}`} style={{
            flex: 1, height: 2, marginTop: 14,
            background: isComplete ? "#0066CC" : "#e2e8f0",
            transition: "background 0.25s",
          }} />,
        ];
      })}
    </div>
  );
}

function InlineAuth() {
  const { signIn, isLoaded: siLoaded, setActive: siSetActive } = useSignIn();
  const { signUp, isLoaded: suLoaded, setActive: suSetActive } = useSignUp();

  const [tab, setTab]                       = useState<AuthTab>("signup");
  const [step, setStep]                     = useState<AuthStep>("form");
  const [wizardStep, setWizardStep]         = useState(0); // 0=Your Info, 1=Address, 2=Account
  // Clerk fields
  const [firstName, setFirstName]           = useState("");
  const [lastName, setLastName]             = useState("");
  const [phoneNumber, setPhoneNumber]       = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPwd, setConfirmPwd]         = useState("");
  const [showPwd, setShowPwd]               = useState(false);
  const [verifyCode, setVerifyCode]         = useState("");
  // Careington fields
  const [dateOfBirth, setDateOfBirth]       = useState("");
  const [gender, setGender]                 = useState("");
  const [addressLine1, setAddressLine1]     = useState("");
  const [addressLine2, setAddressLine2]     = useState("");
  const [city, setCity]                     = useState("");
  const [state, setState]                   = useState("");
  const [postalCode, setPostalCode]         = useState("");
  // UX state
  const [touched, setTouched]               = useState<Record<string, boolean>>({});
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [oauthLoading, setOauthLoading]     = useState<string | null>(null);

  useEffect(() => { setError(""); setStep("form"); setTouched({}); setWizardStep(0); }, [tab]);

  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));
  const busy = isLoading || !!oauthLoading;

  // Per-field errors (only shown after the field has been touched)
  const fe = {
    lastName:   touched.lastName   && !lastName.trim()                                    ? "Last name is required" : "",
    phone:      touched.phone      && phoneNumber.length > 0 && phoneNumber.replace(/\D/g, "").length < 10 ? "Enter a valid 10-digit number" : "",
    dob:        touched.dob        && dateOfBirth.replace(/\D/g, "").length < 8           ? "Enter a complete date (MM/DD/YYYY)" : "",
    address1:   touched.address1   && !addressLine1.trim()                                ? "Street address is required" : "",
    city:       touched.city       && !city.trim()                                        ? "City is required" : "",
    state:      touched.state      && !state                                              ? "Select a state" : "",
    zip:        touched.zip        && !/^\d{5}$/.test(postalCode)                        ? "Enter a 5-digit ZIP" : "",
    email:      touched.email      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)          ? "Enter a valid email" : "",
    password:   touched.password   && password.length > 0 && password.length < 8         ? "Must be at least 8 characters" : "",
    confirmPwd: touched.confirmPwd && confirmPwd.length > 0 && password !== confirmPwd   ? "Passwords don't match" : "",
  };

  // Password strength (0=none, 1=too short, 2=weak, 3=fair, 4=strong)
  const pwdStrength = !password ? 0
    : password.length < 8 ? 1
    : password.length >= 12 && /[A-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4
    : password.length >= 8  && (/[A-Z]/.test(password) || /\d/.test(password)) ? 3
    : 2;
  const strengthMeta = [
    { label: "", color: "#e2e8f0" },
    { label: "Too short", color: "#ef4444" },
    { label: "Weak", color: "#f97316" },
    { label: "Fair", color: "#eab308" },
    { label: "Strong", color: "#22c55e" },
  ];

  // Dynamic border color for a field
  const border = (field: string, value: string, errorMsg: string) => {
    if (!touched[field]) return "#e2e8f0";
    if (errorMsg) return "#ef4444";
    return value ? "#22c55e" : "#e2e8f0";
  };

  const baseInput: React.CSSProperties = {
    width: "100%", borderRadius: "10px", fontFamily: "inherit",
    fontSize: "0.9375rem", transition: "border-color 0.2s, background-color 0.2s, box-shadow 0.2s",
    backgroundColor: "#f8fafc", outline: "none",
  };
  const inp = (field: string, value: string, errorMsg: string, hasIcon = false): React.CSSProperties => ({
    ...baseInput,
    border: `1px solid ${border(field, value, errorMsg)}`,
    padding: `0.7rem 1rem 0.7rem ${hasIcon ? "2.625rem" : "1rem"}`,
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "#0066CC";
    e.currentTarget.style.backgroundColor = "#fff";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.10)";
  };
  const handleBlur = (field: string, value: string, errorMsg: string) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      touch(field);
      const hasError = errorMsg || (field === "confirmPwd" && value !== password);
      e.currentTarget.style.borderColor = !value ? "#e2e8f0" : hasError ? "#ef4444" : "#22c55e";
      e.currentTarget.style.backgroundColor = "#f8fafc";
      e.currentTarget.style.boxShadow = "none";
    };

  // Format phone: (XXX) XXX-XXXX
  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  // Format DOB mask: MM/DD/YYYY
  const formatDob = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    if (d.length > 4) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
    if (d.length > 2) return d.slice(0, 2) + "/" + d.slice(2);
    return d;
  };

  const saveCareingtonProfile = () => {
    sessionStorage.setItem("careington_profile", JSON.stringify({
      dateOfBirth,
      gender,
      address: {
        line1: addressLine1,
        ...(addressLine2 && { line2: addressLine2 }),
        city, state, postalCode, country: "US",
      },
    }));
  };

  const handleOAuth = async (strategy: "oauth_apple" | "oauth_google" | "oauth_facebook") => {
    if (!(tab === "signin" ? siLoaded : suLoaded)) return;
    setOauthLoading(strategy);
    try {
      const fn = tab === "signin"
        ? signIn!.authenticateWithRedirect
        : signUp!.authenticateWithRedirect;
      await fn({ strategy, redirectUrl: "/health/sso-callback", redirectUrlComplete: "/health/checkout" });
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "OAuth failed.");
      setOauthLoading(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!siLoaded) return;
    setIsLoading(true);
    try {
      const result = await signIn!.create({ identifier: email, password });
      if (result.status === "complete") {
        await siSetActive!({ session: result.createdSessionId });
      } else {
        setError("Sign-in requires additional steps. Please try again.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Advance wizard step with per-step validation
  const handleNextStep = () => {
    setError("");
    if (wizardStep === 0) {
      setTouched(prev => ({ ...prev, lastName: true, phone: true, dob: true }));
      if (!lastName.trim())                                                                          { setError("Last name is required."); return; }
      if (phoneNumber.length > 0 && phoneNumber.replace(/\D/g, "").length < 10)                     { setError("Enter a complete 10-digit phone number or leave it blank."); return; }
      if (dateOfBirth.replace(/\D/g, "").length < 8)                                                { setError("A complete date of birth is required."); return; }
      setWizardStep(1);
    } else if (wizardStep === 1) {
      setTouched(prev => ({ ...prev, address1: true, city: true, state: true, zip: true }));
      if (!addressLine1.trim())                          { setError("Street address is required."); return; }
      if (!city.trim())                                  { setError("City is required."); return; }
      if (!state)                                        { setError("State is required."); return; }
      if (!/^\d{5}$/.test(postalCode))                  { setError("A valid 5-digit ZIP code is required."); return; }
      setWizardStep(2);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // Touch step-2 fields to reveal inline errors
    setTouched(prev => ({ ...prev, email: true, password: true, confirmPwd: true }));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))         { setError("Enter a valid email address."); return; }
    if (password.length < 8)                                { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPwd)                            { setError("Passwords do not match."); return; }
    if (!suLoaded) return;
    setIsLoading(true);
    try {
      const result = await signUp!.create({
        emailAddress: email,
        password,
        firstName: firstName || undefined,
        lastName,
        ...(phoneNumber.replace(/\D/g, "").length === 10 && { phoneNumber: `+1${phoneNumber.replace(/\D/g, "")}` }),
      } as any);
      if (result.status === "complete") {
        saveCareingtonProfile();
        await suSetActive!({ session: result.createdSessionId });
      } else if (result.unverifiedFields?.includes("email_address")) {
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      } else {
        setError("Account creation requires additional steps.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Sign-up failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code: verifyCode });
      if (result.status === "complete") {
        saveCareingtonProfile();
        await suSetActive!({ session: result.createdSessionId });
      } else {
        const missing = (result as any).missingFields ?? [];
        setStep("form");
        setVerifyCode("");
        setError(
          missing.length > 0
            ? `Account setup incomplete. Missing: ${missing.join(", ")}. Please try again.`
            : "Email verified, but account setup couldn't complete. Please try again."
        );
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Invalid verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  // (Field, IconField, StepIndicator are module-level components above InlineAuth)
  const oauthButtons = [
    { strategy: "oauth_apple"    as const, icon: <AppleIcon />,    bg: "#000",    color: "#fff",    border: "none",              title: "Apple"    },
    { strategy: "oauth_facebook" as const, icon: <FacebookIcon />, bg: "#1877F2", color: "#fff",    border: "none",              title: "Facebook" },
    { strategy: "oauth_google"   as const, icon: <GoogleIcon />,   bg: "#fff",    color: "#374151", border: "1px solid #d1d5db", title: "Google"   },
  ] as const;

  // Per-step submit-button validity
  const step0Valid = !!lastName.trim() && (phoneNumber.length === 0 || phoneNumber.replace(/\D/g, "").length === 10) && dateOfBirth.replace(/\D/g, "").length === 8;
  const step1Valid = !!addressLine1.trim() && !!city.trim() && !!state && /^\d{5}$/.test(postalCode);
  const step2Valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8 && password === confirmPwd;

  return (
    <div>
      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderRadius: "10px", background: "#f1f5f9", padding: "4px", marginBottom: "1.25rem" }}>
        {(["signup", "signin"] as AuthTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ flex: 1, padding: "0.5rem", borderRadius: "7px", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", transition: "all 0.2s",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#0066CC" : "#64748b",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
            {t === "signup" ? "Create Account" : "Sign In"}
          </button>
        ))}
      </div>

      {/* ── Global error ── */}
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
          <AlertCircle size={16} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.875rem" }}>{error}</p>
        </div>
      )}

      {step === "verify" ? (
        /* ── Email verification ── */
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <Mail size={18} color="#0284c7" style={{ marginTop: "1px", flexShrink: 0 }} />
            <p style={{ color: "#0369a1", margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
              We sent a 6-digit code to <strong>{email}</strong>. Check your inbox and enter it below.
            </p>
          </div>
          <input type="text" value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="_ _ _ _ _ _" maxLength={6} disabled={isLoading} required
            style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem", fontFamily: "monospace", fontSize: "1.75rem", letterSpacing: "0.5em", textAlign: "center", backgroundColor: "#f8fafc", width: "100%", outline: "none", transition: "border-color 0.2s" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.10)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <button type="submit" disabled={isLoading || verifyCode.length < 6}
            style={{ padding: "0.8125rem", background: isLoading || verifyCode.length < 6 ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "1rem", cursor: isLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            {isLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Verifying…</> : "Verify & Continue →"}
          </button>
          <button type="button" onClick={() => { setStep("form"); setError(""); setVerifyCode(""); }}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.8125rem", cursor: "pointer", textDecoration: "underline" }}>
            ← Use a different email
          </button>
        </form>
      ) : (
        <>
          {/* ── OAuth buttons (shared for both tabs) ── */}
          <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
            {oauthButtons.map(({ strategy, icon, bg, color, border: btnBorder, title }) => (
              <button key={strategy} type="button" title={`Continue with ${title}`}
                onClick={() => handleOAuth(strategy)} disabled={busy}
                style={{ flex: 1, padding: "0.5625rem", borderRadius: "8px", background: bg, color, border: btnBorder,
                  cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: oauthLoading && oauthLoading !== strategy ? 0.4 : 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.10)", transition: "opacity 0.2s, transform 0.15s" }}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                {oauthLoading === strategy ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : icon}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>or continue with email</span>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          </div>

          {/* ── Sign-up wizard / Sign-in form ── */}
          {tab === "signup" ? (
            <>
              <StepIndicator wizardStep={wizardStep} />
              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

                {/* Step 0 — Your Information */}
                {wizardStep === 0 && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                      <Field label="First Name" optional>
                        <IconField icon={<User size={15} />}>
                          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                            placeholder="e.g. Jamie" disabled={busy} autoComplete="given-name"
                            style={inp("firstName", firstName, "")} onFocus={handleFocus}
                            onBlur={handleBlur("firstName", firstName, "")} />
                        </IconField>
                      </Field>
                      <Field label="Last Name" error={fe.lastName}>
                        <IconField icon={<User size={15} />}>
                          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                            placeholder="e.g. Smith" disabled={busy} autoComplete="family-name"
                            style={inp("lastName", lastName, fe.lastName)} onFocus={handleFocus}
                            onBlur={handleBlur("lastName", lastName, fe.lastName)} />
                        </IconField>
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                      <Field label="Date of Birth" error={fe.dob}>
                        <input type="text" inputMode="numeric" value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(formatDob(e.target.value))}
                          placeholder="MM/DD/YYYY" disabled={busy} maxLength={10} autoComplete="bday"
                          style={inp("dob", dateOfBirth, fe.dob)} onFocus={handleFocus}
                          onBlur={handleBlur("dob", dateOfBirth, fe.dob)} />
                      </Field>
                      <Field label="Gender" optional>
                        <select value={gender} onChange={(e) => setGender(e.target.value)}
                          disabled={busy}
                          style={{ ...inp("gender", gender, ""), appearance: "none" as const, cursor: "pointer" }}
                          onFocus={handleFocus} onBlur={handleBlur("gender", gender, "")}>
                          <option value="">Prefer not to say</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </Field>
                    </div>

                    <Field label="Phone Number" error={fe.phone} optional>
                      <IconField icon={<Phone size={15} />}>
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                          placeholder="(555) 555-5555" disabled={busy} autoComplete="tel-national"
                          style={inp("phone", phoneNumber, fe.phone, true)} onFocus={handleFocus}
                          onBlur={handleBlur("phone", phoneNumber, fe.phone)} />
                      </IconField>
                    </Field>
                  </>
                )}

                {/* Step 1 — Home Address */}
                {wizardStep === 1 && (
                  <>
                    <Field label="Street Address" error={fe.address1}>
                      <IconField icon={<MapPin size={15} />}>
                        <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)}
                          placeholder="123 Main St" disabled={busy} autoComplete="address-line1"
                          style={inp("address1", addressLine1, fe.address1, true)} onFocus={handleFocus}
                          onBlur={handleBlur("address1", addressLine1, fe.address1)} />
                      </IconField>
                    </Field>

                    <Field label="Apt / Suite / Unit" optional>
                      <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="Apt 4B" disabled={busy} autoComplete="address-line2"
                        style={inp("address2", addressLine2, "")} onFocus={handleFocus}
                        onBlur={handleBlur("address2", addressLine2, "")} />
                    </Field>

                    <Field label="City" error={fe.city}>
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                        placeholder="Los Angeles" disabled={busy} autoComplete="address-level2"
                        style={inp("city", city, fe.city)} onFocus={handleFocus}
                        onBlur={handleBlur("city", city, fe.city)} />
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: "0.625rem" }}>
                      <Field label="State" error={fe.state}>
                        <select value={state} onChange={(e) => setState(e.target.value)}
                          disabled={busy}
                          style={{ ...inp("state", state, fe.state), appearance: "none" as const, cursor: "pointer" }}
                          onFocus={handleFocus} onBlur={handleBlur("state", state, fe.state)}>
                          <option value="">Select…</option>
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="ZIP Code" error={fe.zip}>
                        <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                          placeholder="90210" disabled={busy} maxLength={5} autoComplete="postal-code"
                          style={inp("zip", postalCode, fe.zip)} onFocus={handleFocus}
                          onBlur={handleBlur("zip", postalCode, fe.zip)} />
                      </Field>
                    </div>
                  </>
                )}

                {/* Step 2 — Account */}
                {wizardStep === 2 && (
                  <>
                    <Field label="Email Address" error={fe.email}>
                      <IconField icon={<Mail size={15} />}>
                        <input id="signup-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com" disabled={busy} required autoComplete="email"
                          style={inp("email", email, fe.email, true)} onFocus={handleFocus}
                          onBlur={handleBlur("email", email, fe.email)} />
                      </IconField>
                    </Field>

                    <Field label="Password" error={fe.password}>
                      <IconField icon={<Lock size={15} />}>
                        <input id="signup-password" name="password" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a password" disabled={busy} required autoComplete="new-password"
                          style={{ ...inp("password", password, fe.password, true), paddingRight: "2.625rem" }}
                          onFocus={handleFocus} onBlur={handleBlur("password", password, fe.password)} />
                        <button type="button" onClick={() => setShowPwd(s => !s)}
                          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px", display: "flex" }}>
                          {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </IconField>
                      {password.length > 0 && (
                        <div style={{ display: "flex", gap: "3px", alignItems: "center", marginTop: "0.25rem" }}>
                          {[1,2,3,4].map((level) => (
                            <div key={level} style={{ flex: 1, height: "3px", borderRadius: "2px", background: pwdStrength >= level ? strengthMeta[pwdStrength].color : "#e2e8f0", transition: "background 0.3s" }} />
                          ))}
                          <span style={{ fontSize: "0.6875rem", color: strengthMeta[pwdStrength].color, fontWeight: 600, marginLeft: "4px", minWidth: "50px" }}>
                            {strengthMeta[pwdStrength].label}
                          </span>
                        </div>
                      )}
                    </Field>

                    <Field label="Confirm Password" error={fe.confirmPwd}>
                      <IconField icon={<Lock size={15} />}>
                        <input id="signup-confirm-password" name="confirm-password" type={showPwd ? "text" : "password"} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                          placeholder="Re-enter your password" disabled={busy} required autoComplete="new-password"
                          style={inp("confirmPwd", confirmPwd, fe.confirmPwd, true)}
                          onFocus={handleFocus} onBlur={handleBlur("confirmPwd", confirmPwd, fe.confirmPwd)} />
                      </IconField>
                    </Field>

                    <div id="clerk-captcha" />
                  </>
                )}

                {/* Wizard navigation */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {wizardStep > 0 && (
                    <button type="button" onClick={() => { setWizardStep(s => s - 1); setError(""); }} disabled={busy}
                      style={{ flex: "none", padding: "0.8125rem 1.25rem", background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}>
                      ← Back
                    </button>
                  )}
                  {wizardStep < 2 ? (
                    <button type="button" onClick={handleNextStep} disabled={busy}
                      style={{ flex: 1, padding: "0.8125rem", background: "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "background 0.2s" }}
                      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#0052a3"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#0066CC"; }}>
                      Next →
                    </button>
                  ) : (
                    <button type="submit" disabled={busy || !step2Valid}
                      style={{ flex: 1, padding: "0.8125rem", background: (!step2Valid || busy) ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "background 0.2s" }}
                      onMouseEnter={(e) => { if (!busy && step2Valid) e.currentTarget.style.background = "#0052a3"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = (!step2Valid || busy) ? "#cbd5e1" : "#0066CC"; }}>
                      {isLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Creating Account…</> : "Create Account & Continue"}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            /* ── Sign-in form ── */
            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <Field label="Email Address" error={fe.email}>
                <IconField icon={<Mail size={15} />}>
                  <input id="signin-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" disabled={busy} required autoComplete="email"
                    style={inp("email", email, fe.email, true)} onFocus={handleFocus}
                    onBlur={handleBlur("email", email, fe.email)} />
                </IconField>
              </Field>

              <Field label="Password" error={fe.password}>
                <IconField icon={<Lock size={15} />}>
                  <input id="signin-password" name="password" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password" disabled={busy} required autoComplete="current-password"
                    style={{ ...inp("password", password, fe.password, true), paddingRight: "2.625rem" }}
                    onFocus={handleFocus} onBlur={handleBlur("password", password, fe.password)} />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px", display: "flex" }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </IconField>
              </Field>

              <div style={{ textAlign: "right", marginTop: "-0.375rem" }}>
                <Link href="/health/forgot-password" style={{ color: "#0066CC", fontSize: "0.8125rem", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={busy || !email || !password}
                style={{ marginTop: "0.25rem", padding: "0.8125rem", background: (!email || !password || busy) ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "background 0.2s" }}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#0052a3"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = (!email || !password || busy) ? "#cbd5e1" : "#0066CC"; }}>
                {isLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing In…</> : "Sign In"}
              </button>
            </form>
          )}
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CheckoutContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { 
    cart, 
    itemCount, 
    subtotalCents, 
    setPaymentMethod,
    setCadence,
    removeItem,
    setReferralCode 
  } = useCart();
  
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNotInsurance, setAgreedToNotInsurance] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Legal modal state
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  
  const periodLabel = cart.cadence === "monthly" ? "Monthly" : "Annual";
  const periodShort = cart.cadence === "monthly" ? "/mo" : "/yr";
  
  // Calculate renewal date
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + (cart.cadence === "monthly" ? 1 : 12));
  const formattedRenewal = renewalDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  
  // Calculate total (always use card pricing — no ACH discount)
  const cardTotal = cart.items.reduce((sum, item) => {
    return sum + getPrice(item.product, cart.cadence, "card");
  }, 0);
  const achSavings = 0;
  const totalDueToday = cardTotal;
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  const handleCheckout = async () => {
    if (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) return;
    if (itemCount === 0) return;

    const primaryItem = cart.items[0];
    if (!primaryItem) return;

    try {
      setCheckoutLoading(true);
      setCheckoutError(null);

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: primaryItem.product._id,
          cadence: cart.cadence,
          paymentMethod: cart.paymentMethod,
          referralCode: cart.referralCode || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start checkout");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };
  
  // Empty cart state
  if (itemCount === 0) {
    return (
      <div className="health-landing">
        <HealthHeader />
        
        <section className="section bg--white" style={{ paddingTop: "8rem", minHeight: "70vh" }}>
          <div className="container" style={{ textAlign: "center", maxWidth: "500px" }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0066CC20, #14b8a620)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem"
            }}>
              <ShoppingCart size={36} color="#0066CC" />
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#0f172a" }}>
              Your cart is empty
            </h2>
            <p style={{ color: "#64748b", marginBottom: "2rem", lineHeight: 1.7 }}>
              Browse our health plans and add what you need to get started.
            </p>
            <Link href="/health/plans" className="button button--primary">
              Browse Plans
            </Link>
          </div>
        </section>
      </div>
    );
  }
  
  return (
    <div className="health-landing">
      <HealthHeader />
      
      {/* Cadence Modal */}
      <CadenceModal />
      
      {/* Main Checkout Grid */}
      <section className="section bg--white" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "1200px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 400px",
            gap: "2.5rem",
            alignItems: "start"
          }}>
            
            {/* Left Column - Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Step 1: Review Order */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <Link 
                  href="/health/plans" 
                  style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "0.5rem",
                    color: "#0f172a",
                    textDecoration: "none",
                    marginBottom: "1rem",
                    fontSize: "0.9375rem"
                  }}
                >
                  <ArrowLeft size={18} />
                  Back to Plans
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>1</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Review Your Order
                  </h2>
                </div>
                
                {/* Order Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {cart.items.map((item) => {
                    const itemPrice = getPrice(item.product, cart.cadence, "card");
                    return (
                      <div key={item.productId} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        background: "#f8fafc",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <div>
                          <span style={{ 
                            display: "block",
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "#0066CC",
                            marginBottom: "0.25rem"
                          }}>
                            {item.product.slug?.includes("family") ? "Family Plan" : "Individual Plan"}
                          </span>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>
                            {item.product.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ fontWeight: 700, color: "#0066CC" }}>
                            {formatPrice(itemPrice)}{periodShort}
                          </span>
                          <button
                            onClick={() => removeItem(item.productId)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#94a3b8",
                              padding: "4px",
                              borderRadius: "6px",
                              transition: "all 0.2s"
                            }}
                            aria-label="Remove item"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Billing Info */}
                <div style={{ 
                  marginTop: "1.5rem", 
                  paddingTop: "1.5rem", 
                  borderTop: "1px solid #e2e8f0",
                }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "#64748b", display: "block", marginBottom: "0.5rem" }}>Billing Cycle</span>
                    <div style={{
                      display: "inline-flex",
                      background: "var(--glass-bg)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "4px"
                    }}>
                      <button
                        onClick={() => setCadence("monthly")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "calc(var(--radius-md) - 4px)",
                          border: "none",
                          background: cart.cadence === "monthly" 
                            ? "linear-gradient(135deg, var(--primary-blue), var(--primary-light))" 
                            : "transparent",
                          color: cart.cadence === "monthly" ? "white" : "var(--text-secondary)",
                          fontWeight: "600",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                          transition: "var(--transition)"
                        }}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setCadence("annual")}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "calc(var(--radius-md) - 4px)",
                          border: "none",
                          background: cart.cadence === "annual" 
                            ? "linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))" 
                            : "transparent",
                          color: cart.cadence === "annual" ? "white" : "var(--text-secondary)",
                          fontWeight: "600",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                          transition: "var(--transition)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        Annual
                        <span style={{
                          background: cart.cadence === "annual" ? "rgba(255,255,255,0.2)" : "rgba(20, 184, 166, 0.15)",
                          color: cart.cadence === "annual" ? "white" : "var(--accent-teal)",
                          padding: "2px 8px",
                          borderRadius: "100px",
                          fontSize: "0.6875rem",
                          fontWeight: "700"
                        }}>
                          1 Month Free
                        </span>
                      </button>
                    </div>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    marginTop: "1rem"
                  }}>
                    <div>
                      <span style={{ fontSize: "0.875rem", color: "#64748b", display: "block" }}>Renews On</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formattedRenewal}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Step 2: Payment Method */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>2</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Payment Method
                  </h2>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Card Option */}
                  {/* ACH Option */}
                  <button
                    onClick={() => setPaymentMethod("ach")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      border: cart.paymentMethod === "ach" 
                        ? "2px solid #14b8a6" 
                        : "1px solid #e2e8f0",
                      background: cart.paymentMethod === "ach" 
                        ? "linear-gradient(135deg, #14b8a608, #0066CC08)" 
                        : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left"
                    }}
                  >
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#f0fdfa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Building2 size={22} color="#14b8a6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        Bank Transfer (ACH)
                      </span>
                    </div>
                    {cart.paymentMethod === "ach" && (
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#14b8a6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Check size={14} color="#fff" />
                      </div>
                    )}
                  </button>

                  {/* Card Option */}
                  <button
                    onClick={() => setPaymentMethod("card")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      border: cart.paymentMethod === "card" 
                        ? "2px solid #0066CC" 
                        : "1px solid #e2e8f0",
                      background: cart.paymentMethod === "card" 
                        ? "linear-gradient(135deg, #0066CC08, #14b8a608)" 
                        : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left"
                    }}
                  >
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <CreditCard size={22} color="#64748b" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        Credit/Debit Card
                      </span>
                    </div>
                    {cart.paymentMethod === "card" && (
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#0066CC",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Check size={14} color="#fff" />
                      </div>
                    )}
                  </button>
                  
                </div>
              </div>
              
              {/* Step 3: Account */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>3</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Account
                  </h2>
                </div>
                
                {!isLoaded ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                    Loading...
                  </div>
                ) : isSignedIn ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "1rem",
                    background: "#f0fdf4",
                    borderRadius: "12px",
                    border: "1px solid #bbf7d0"
                  }}>
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #0066CC, #14b8a6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1.125rem"
                    }}>
                      {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                        {user?.fullName || "Account"}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {user?.emailAddresses[0]?.emailAddress}
                      </span>
                    </div>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Check size={16} color="#fff" />
                    </div>
                  </div>
                ) : (
                  <InlineAuth />
                )}
              </div>
              
              {/* Referral Code / Agent Selector */}
              <AgentRepCodeSelector
                referralCode={cart.referralCode}
                onReferralCodeChange={setReferralCode}
              />
              
              {/* Step 4: Confirm */}
              <div className="glass-card" style={{ padding: "1.5rem 2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                  <span style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0066CC, #0052a3)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.875rem"
                  }}>4</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "#0f172a" }}>
                    Confirm & Pay
                  </h2>
                </div>
                
                {/* Agreements */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Checkbox 1 → opens MembershipAgreementModal */}
                  <div
                    onClick={() => { if (!agreedToTerms) setMembershipModalOpen(true); }}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                      cursor: agreedToTerms ? "default" : "pointer",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: agreedToTerms ? "#f0fdf4" : "transparent",
                      border: agreedToTerms ? "1px solid #bbf7d0" : "1px solid transparent",
                      transition: "background 0.2s"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      readOnly
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px",
                        cursor: agreedToTerms ? "default" : "pointer",
                        pointerEvents: "none"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      I understand that I will be billed <strong>{formatPrice(totalDueToday)}</strong> today 
                      and {formatPrice(totalDueToday)}{periodShort} thereafter. I can cancel 
                      anytime and keep access until the end of my billing period.
                      {!agreedToTerms && (
                        <span style={{ display: "block", fontSize: "0.8125rem", color: "#0066CC", marginTop: "0.35rem", fontWeight: 500 }}>
                          Click to review &amp; sign membership agreement →
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {/* Checkbox 2 → opens TermsAndConditionsModal */}
                  <div
                    onClick={() => { if (!agreedToNotInsurance) setTermsModalOpen(true); }}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                      cursor: agreedToNotInsurance ? "default" : "pointer",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: agreedToNotInsurance ? "#fef3c7" : "transparent",
                      border: agreedToNotInsurance ? "1px solid #fde68a" : "1px solid transparent",
                      transition: "background 0.2s"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToNotInsurance}
                      readOnly
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px",
                        cursor: agreedToNotInsurance ? "default" : "pointer",
                        pointerEvents: "none"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      <strong style={{ color: "#d97706" }}>I understand this is NOT insurance.</strong> These plans provide 
                      discounts and access to services, not insurance coverage.
                      {!agreedToNotInsurance && (
                        <span style={{ display: "block", fontSize: "0.8125rem", color: "#0066CC", marginTop: "0.35rem", fontWeight: 500 }}>
                          Click to review &amp; accept terms and conditions →
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                

              </div>
            </div>
            
            {/* Right Column - Order Summary */}
            <div style={{ position: "sticky", top: "100px" }}>
              <div className="glass-card" style={{ 
                padding: "2rem",
                background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.9))"
              }}>
                <h3 style={{ 
                  fontSize: "1.25rem", 
                  fontWeight: 700, 
                  marginBottom: "1.5rem",
                  color: "#0f172a" 
                }}>
                  Order Summary
                </h3>
                
                {/* Items List */}
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.75rem",
                  paddingBottom: "1.25rem",
                  borderBottom: "1px solid #e2e8f0"
                }}>
                  {cart.items.map((item) => {
                    const itemPrice = getPrice(item.product, cart.cadence, "card");
                    return (
                      <div key={item.productId} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ color: "#475569" }}>
                          {item.product.name}
                        </span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>
                          {formatPrice(itemPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* ACH Savings Banner — removed */}
                
                {/* Totals */}
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Subtotal</span>
                    <span style={{ color: "#0f172a" }}>{formatPrice(subtotalCents)}</span>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    paddingTop: "0.75rem",
                    borderTop: "2px solid #0066CC",
                    marginTop: "0.5rem"
                  }}>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Due Today</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0066CC" }}>
                      {formatPrice(totalDueToday)}
                    </span>
                  </div>
                </div>
                
                {/* Renewal Info */}
                <div style={{
                  marginTop: "1.5rem",
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem"
                }}>
                  <Calendar size={20} color="#64748b" />
                  <div>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Renews on
                    </span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{formattedRenewal}</span>
                  </div>
                </div>
                
                {/* Error Display */}
                {checkoutError && (
                  <div style={{
                    marginBottom: "1rem",
                    padding: "0.75rem 1rem",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    borderRadius: "0.5rem",
                    color: "#991b1b",
                    fontSize: "0.875rem"
                  }}>
                    {checkoutError}
                  </div>
                )}

                {/* Checkout Button — redirects to Stripe Checkout */}
                <button
                  onClick={handleCheckout}
                  disabled={!isSignedIn || !agreedToTerms || !agreedToNotInsurance || checkoutLoading}
                  className="button button--primary"
                  style={{
                    width: "100%",
                    marginTop: "1.5rem",
                    padding: "1rem 1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    opacity: (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) ? 0.5 : 1,
                    cursor: (!isSignedIn || !agreedToTerms || !agreedToNotInsurance) ? "not-allowed" : "pointer"
                  }}
                >
                  {checkoutLoading ? (
                    "Redirecting to checkout…"
                  ) : (
                    <>
                      <Lock size={16} />
                      Proceed to Payment
                    </>
                  )}
                </button>
                
                {/* Pricing Clarification */}
                <p style={{
                  marginTop: "0.75rem",
                  textAlign: "center",
                  fontSize: "0.8125rem",
                  color: "#64748b"
                }}>
                  Prices shown reflect your selected payment method.
                </p>
                
                {/* Security Note */}
                <div style={{
                  marginTop: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  color: "#94a3b8",
                  fontSize: "0.8125rem"
                }}>
                  <Shield size={14} />
                  <span>256-bit SSL encrypted. Your information is secure.</span>
                </div>
                
                {/* Disclaimer */}
                <p style={{
                  marginTop: "1rem",
                  textAlign: "center",
                  fontSize: "0.8125rem",
                  color: "#64748b",
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: "#d97706" }}>This is not insurance.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Legal Modals */}
      <MembershipAgreementModal
        isOpen={membershipModalOpen}
        onClose={() => setMembershipModalOpen(false)}
        onAccept={(_signature: string) => {
          setAgreedToTerms(true);
          setMembershipModalOpen(false);
        }}
        memberData={{
          memberId: user?.id || "TBD",
          memberName: user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "Member",
          memberAddress: "Address on file",
          email: user?.emailAddresses?.[0]?.emailAddress || "",
          planName: cart.items?.[0]?.product?.name || "Ideal Oral Health Plan",
          groupCode: "IDEALDO",
          effectiveDate: new Date().toISOString().split("T")[0],
          billingInterval: cart.cadence,
        }}
      />
      <TermsAndConditionsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={() => {
          setAgreedToNotInsurance(true);
          setTermsModalOpen(false);
        }}
      />
      
      {/* Trust Section */}
      <section className="section bg--light" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        <div className="container" style={{ maxWidth: "800px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "3rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <Shield size={20} />
              <span>Secure Checkout</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <Lock size={20} />
              <span>SSL Encrypted</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
              <CreditCard size={20} />
              <span>Multiple Payment Options</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
}
