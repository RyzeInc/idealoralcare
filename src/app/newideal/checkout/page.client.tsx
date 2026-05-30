"use client";

/**
 * NEW IDEAL HEALTH — CHECKOUT
 *
 * Mirrors the /health/checkout flow:
 *   1. Review Your Order
 *   2. Payment Method (card / ACH — same price)
 *   3. Account (Clerk modal sign-in / sign-up)
 *   4. Agent / Rep Code
 *   5. Confirm & Pay (Membership Agreement modal w/ signature + Terms modal)
 *
 * Differences from /health/checkout:
 *   - Monthly cadence is fixed (no annual toggle)
 *   - Card and ACH are the same price (no ACH discount banner)
 *   - No family-member add-ons (tier is selected on /newideal/plans)
 *   - Posts siteSlug="newideal" so the webhook attributes to NIH hierarchy
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  useUser,
  useSignIn,
  useSignUp,
  SignOutButton,
} from "@clerk/nextjs";
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Check,
  Lock,
  Calendar,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Shield,
  X,
  Loader,
  AlertCircle,
  Mail,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  User,
  ScanLine,
  Stethoscope,
  Smile,
  Heart,
  Activity,
  Zap,
} from "lucide-react";
import { useCart } from "@/lib/health-plans/cart-context";
import { formatPrice } from "@/lib/health-plans/types";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AgentRepCodeSelector } from "@/components/health/AgentRepCodeSelector";
import {
  TermsAndConditionsModal,
  EssentialsMembershipModal,
  OralCareTermsModal,
} from "@/components/legal";
/* ─── Inline auth helpers (identical to /health/checkout) ───────────────────── */
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
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
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
  const [wizardStep, setWizardStep]         = useState(0);
  const [firstName, setFirstName]           = useState("");
  const [lastName, setLastName]             = useState("");
  const [phoneNumber, setPhoneNumber]       = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPwd, setConfirmPwd]         = useState("");
  const [showPwd, setShowPwd]               = useState(false);
  const [verifyCode, setVerifyCode]         = useState("");
  const [dateOfBirth, setDateOfBirth]       = useState("");
  const [gender, setGender]                 = useState("");
  const [addressLine1, setAddressLine1]     = useState("");
  const [addressLine2, setAddressLine2]     = useState("");
  const [city, setCity]                     = useState("");
  const [state, setState]                   = useState("");
  const [postalCode, setPostalCode]         = useState("");
  const [touched, setTouched]               = useState<Record<string, boolean>>({});
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [oauthLoading, setOauthLoading]     = useState<string | null>(null);

  useEffect(() => { setError(""); setStep("form"); setTouched({}); setWizardStep(0); }, [tab]);

  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));
  const busy = isLoading || !!oauthLoading;

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

  const borderColor = (field: string, value: string, errorMsg: string) => {
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
    border: `1px solid ${borderColor(field, value, errorMsg)}`,
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

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const formatDob = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    if (d.length > 4) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
    if (d.length > 2) return d.slice(0, 2) + "/" + d.slice(2);
    return d;
  };
  const saveCareingtonProfile = () => {
    sessionStorage.setItem("careington_profile", JSON.stringify({
      dateOfBirth, gender,
      address: { line1: addressLine1, ...(addressLine2 && { line2: addressLine2 }), city, state, postalCode, country: "US" },
    }));
  };

  const handleOAuth = async (strategy: "oauth_apple" | "oauth_google" | "oauth_facebook") => {
    if (!(tab === "signin" ? siLoaded : suLoaded)) return;
    setOauthLoading(strategy);
    try {
      const fn = tab === "signin" ? signIn!.authenticateWithRedirect : signUp!.authenticateWithRedirect;
      await fn({ strategy, redirectUrl: "/health/sso-callback", redirectUrlComplete: "/newideal/checkout" });
    } catch (err: unknown) {
      const e = err as { errors?: { message: string }[] };
      setError(e?.errors?.[0]?.message || "OAuth failed.");
      setOauthLoading(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!siLoaded) return;
    setIsLoading(true);
    try {
      const result = await signIn!.create({ identifier: email, password });
      if (result.status === "complete") {
        await siSetActive!({ session: result.createdSessionId });
      } else {
        setError("Sign-in requires additional steps. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { message: string }[] };
      setError(e?.errors?.[0]?.message || "Sign-in failed.");
    } finally { setIsLoading(false); }
  };

  const handleNextStep = () => {
    setError("");
    if (wizardStep === 0) {
      setTouched(prev => ({ ...prev, lastName: true, phone: true, dob: true }));
      if (!lastName.trim()) { setError("Last name is required."); return; }
      if (phoneNumber.length > 0 && phoneNumber.replace(/\D/g, "").length < 10) { setError("Enter a complete 10-digit phone number or leave it blank."); return; }
      if (dateOfBirth.replace(/\D/g, "").length < 8) { setError("A complete date of birth is required."); return; }
      setWizardStep(1);
    } else if (wizardStep === 1) {
      setTouched(prev => ({ ...prev, address1: true, city: true, state: true, zip: true }));
      if (!addressLine1.trim()) { setError("Street address is required."); return; }
      if (!city.trim()) { setError("City is required."); return; }
      if (!state) { setError("State is required."); return; }
      if (!/^\d{5}$/.test(postalCode)) { setError("A valid 5-digit ZIP code is required."); return; }
      setWizardStep(2);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    setTouched(prev => ({ ...prev, email: true, password: true, confirmPwd: true }));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPwd) { setError("Passwords do not match."); return; }
    if (!suLoaded) return;
    setIsLoading(true);
    try {
      const result = await signUp!.create({
        emailAddress: email, password,
        firstName: firstName || undefined, lastName,
        ...(phoneNumber.replace(/\D/g, "").length === 10 && { phoneNumber: `+1${phoneNumber.replace(/\D/g, "")}` }),
      } as Parameters<typeof signUp.create>[0]);
      if (result.status === "complete") {
        saveCareingtonProfile();
        await suSetActive!({ session: result.createdSessionId });
      } else if (result.unverifiedFields?.includes("email_address")) {
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      } else {
        setError("Account creation requires additional steps.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Sign-up failed.");
    } finally { setIsLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    setIsLoading(true);
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code: verifyCode });
      if (result.status === "complete") {
        saveCareingtonProfile();
        await suSetActive!({ session: result.createdSessionId });
      } else {
        const missing = (result as { missingFields?: string[] }).missingFields ?? [];
        setStep("form"); setVerifyCode("");
        setError(missing.length > 0
          ? `Account setup incomplete. Missing: ${missing.join(", ")}. Please try again.`
          : "Email verified, but account setup couldn't complete. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Invalid verification code.");
    } finally { setIsLoading(false); }
  };

  const oauthButtons = [
    { strategy: "oauth_apple"    as const, icon: <AppleIcon />,    bg: "#000",    color: "#fff",    border: "none",              title: "Apple"    },
    { strategy: "oauth_facebook" as const, icon: <FacebookIcon />, bg: "#1877F2", color: "#fff",    border: "none",              title: "Facebook" },
    { strategy: "oauth_google"   as const, icon: <GoogleIcon />,   bg: "#fff",    color: "#374151", border: "1px solid #d1d5db", title: "Google"   },
  ] as const;

  const step2Valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8 && password === confirmPwd;

  return (
    <div>
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

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
          <AlertCircle size={16} color="#991b1b" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ color: "#7f1d1d", margin: 0, fontSize: "0.875rem" }}>{error}</p>
        </div>
      )}

      {step === "verify" ? (
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

          {tab === "signup" ? (
            <>
              <StepIndicator wizardStep={wizardStep} />
              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
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
                        <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={busy}
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
                        <select value={state} onChange={(e) => setState(e.target.value)} disabled={busy}
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
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {wizardStep > 0 && (
                    <button type="button" onClick={() => { setWizardStep(s => s - 1); setError(""); }} disabled={busy}
                      style={{ flex: "none", padding: "0.8125rem 1.25rem", background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}>
                      ← Back
                    </button>
                  )}
                  {wizardStep < 2 ? (
                    <button type="button" onClick={handleNextStep} disabled={busy}
                      style={{ flex: 1, padding: "0.8125rem", background: "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                      onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#0052a3"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#0066CC"; }}>
                      Next →
                    </button>
                  ) : (
                    <button type="submit" disabled={busy || !step2Valid}
                      style={{ flex: 1, padding: "0.8125rem", background: (!step2Valid || busy) ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                      onMouseEnter={(e) => { if (!busy && step2Valid) e.currentTarget.style.background = "#0052a3"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = (!step2Valid || busy) ? "#cbd5e1" : "#0066CC"; }}>
                      {isLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Creating Account…</> : "Create Account & Continue"}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
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
                style={{ marginTop: "0.25rem", padding: "0.8125rem", background: (!email || !password || busy) ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
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

function CheckoutHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "14px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          href="/newideal"
          style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
        >
          <Image
            src="/newideal/logo.png"
            alt="Ideal Health"
            width={52}
            height={52}
          />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/newideal" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Overview
          </Link>
          <Link href="/newideal/essentials" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Essentials
          </Link>
          <Link href="/newideal/oralcare" style={{ fontSize: "0.875rem", color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Oral Care
          </Link>
        </nav>
        <Link
          href="/newideal/plans"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Back to plans
        </Link>
      </div>
    </header>
  );
}

function StepHeader({
  num,
  title,
  done,
}: {
  num: number;
  title: string;
  done?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: done
            ? "linear-gradient(135deg, var(--accent-teal), var(--accent-emerald))"
            : "var(--primary-blue)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
        }}
      >
        {done ? <Check size={18} /> : num}
      </div>
      <h3 style={{ margin: 0, fontSize: "1.125rem" }}>{title}</h3>
    </div>
  );
}

export default function NewIdealCheckoutClient() {
  const { user, isLoaded, isSignedIn } = useUser();
  const {
    cart,
    itemCount,
    subtotalCents,
    setPaymentMethod,
    setReferralCode,
    removeItem,
  } = useCart();

  const [agreedToNotInsurance, setAgreedToNotInsurance] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  // Plan detail accordion state
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const [oralCareOpen, setOralCareOpen] = useState(false);
  // Per-plan agreement state
  const [essentialsAgreed, setEssentialsAgreed] = useState(false);
  const [essentialsModalOpen, setEssentialsModalOpen] = useState(false);
  const [oralCareAgreed, setOralCareAgreed] = useState(false);
  const [oralCareModalOpen, setOralCareModalOpen] = useState(false);

  // Convex mutation — persists the signed oral care agreement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveOralCareAgreement = useMutation((api as any)["legal/membershipAgreements"].createOralCareAgreement);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);
  const formattedRenewal = renewalDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hasEssentials = cart.items.some((i) =>
    i.product.slug?.startsWith("essentials-")
  );
  const hasOralCare = cart.items.some((i) =>
    i.product.slug?.startsWith("oralcare-")
  );

  const canSubmit =
    isSignedIn &&
    agreedToNotInsurance &&
    (!hasEssentials || essentialsAgreed) &&
    (!hasOralCare || oralCareAgreed) &&
    itemCount > 0 &&
    !loading;

  const handleCheckout = async () => {
    if (!canSubmit) return;
    const primary = cart.items[0];
    if (!primary) return;

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: primary.product._id,
          cadence: "monthly",
          paymentMethod: cart.paymentMethod,
          siteSlug: "newideal",
          additionalPlanIds: cart.items.slice(1).map((i) => i.productId),
          successUrl: `${origin}/newideal/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/newideal/checkout`,
          referralCode: cart.referralCode || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start checkout");
      }

      const data = await response.json();
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (itemCount === 0) {
    return (
      <div className="health-landing" style={{ background: "#f1f5f9" }}>
        <CheckoutHeader />
        <section
          style={{
            position: "relative",
            background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
            padding: "80px 0 60px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/health-assets/members-discussing_1024x1024.png')",
              backgroundSize: "cover",
              backgroundPosition: "center 40%",
              opacity: 0.1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "-10%",
              right: "-5%",
              width: 500,
              height: 500,
              background: "radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div className="container" style={{ position: "relative", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3rem)",
                fontWeight: 800,
                color: "#ffffff",
                margin: "0 0 1rem 0",
                lineHeight: 1.1,
              }}
            >
              Your Cart is Empty
            </h1>
            <p
              style={{
                fontSize: "1.0625rem",
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                lineHeight: 1.65,
              }}
            >
              Add an Ideal Health membership to get started
            </p>
          </div>
        </section>
        <section
          style={{ paddingTop: "3rem", paddingBottom: "4rem" }}
        >
          <div
            className="container"
            style={{ textAlign: "center", maxWidth: 500 }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(0,102,204,0.12), rgba(20,184,166,0.12))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 2rem",
              }}
            >
              <ShoppingCart size={36} color="#0066CC" />
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "2rem",
              }}
            >
              Browse our membership plans and select a tier that works best for you.
            </p>
            <Link href="/newideal/plans" className="button button--primary">
              Browse plans
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="health-landing" style={{ background: "#f1f5f9" }}>
      <CheckoutHeader />

      <section
        style={{
          position: "relative",
          background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
          padding: "80px 0 60px",
          overflow: "hidden",
        }}
      >
        {/* Background image overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/newideal/site-files/nurse-clipboard.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 25%",
            opacity: 0.16,
          }}
        />
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-5%",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="container" style={{ position: "relative" }}>
          <div>
            <h1
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                fontWeight: 800,
                color: "#ffffff",
                margin: "0 0 1rem 0",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Complete Your Enrollment
            </h1>
            <p
              style={{
                fontSize: "1.0625rem",
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                lineHeight: 1.65,
                maxWidth: 680,
              }}
            >
              Secure payment and instant access to your Ideal Health membership
            </p>
          </div>
        </div>
      </section>

      <section
        style={{ paddingTop: "3rem", paddingBottom: "4rem" }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 380px",
              gap: "2.5rem",
              alignItems: "start",
            }}
          >
            {/* LEFT: Steps */}
            <div style={{ display: "grid", gap: "1.5rem" }}>
              {/* Step 1: Review Your Order */}
              <div className="glass-card" style={{ padding: 28 }}>
                <StepHeader num={1} title="Review Your Order" />

                <div style={{ display: "grid", gap: 8 }}>
                  {cart.items.map((item) => (
                    <div
                      key={item.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 0",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--primary-blue)",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {(item.product.category || "").replace(/-/g, " ")}
                        </div>
                        <div style={{ fontWeight: 500 }}>
                          {item.product.name}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {formatPrice(item.product.pricing.monthlyCardCents)}
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontWeight: 400,
                              fontSize: "0.875rem",
                            }}
                          >
                            /mo
                          </span>
                        </span>
                        <button
                          onClick={() => removeItem(item.productId)}
                          aria-label="Remove"
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 4,
                            display: "flex",
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 16,
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>Billing Cycle</span>
                  <span style={{ fontWeight: 500, color: "#0f172a" }}>
                    Monthly
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 6,
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>Renews On</span>
                  <span style={{ fontWeight: 500, color: "#0f172a" }}>
                    {formattedRenewal}
                  </span>
                </div>
              </div>

              {/* Step 2: Payment Method */}
              <div className="glass-card" style={{ padding: 28 }}>
                <StepHeader num={2} title="Payment Method" />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {[
                    {
                      id: "card" as const,
                      label: "Credit/Debit Card",
                      icon: <CreditCard size={18} />,
                    },
                    {
                      id: "ach" as const,
                      label: "Bank Transfer (ACH)",
                      icon: <Building2 size={18} />,
                    },
                  ].map((opt) => {
                    const active = cart.paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPaymentMethod(opt.id)}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "var(--radius-sm)",
                          border: active
                            ? "1.5px solid var(--primary-blue)"
                            : "1.5px solid rgba(0,0,0,0.08)",
                          background: active ? "rgba(0,102,204,0.04)" : "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontWeight: 600,
                          color: active ? "var(--primary-blue)" : "#0f172a",
                          textAlign: "left",
                        }}
                      >
                        {opt.icon}
                        <span style={{ flex: 1 }}>{opt.label}</span>
                        {active && (
                          <Check
                            size={16}
                            style={{ color: "var(--primary-blue)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: 10,
                    marginBottom: 0,
                  }}
                >
                  Prices shown reflect your selected payment method.
                </p>
              </div>

              {/* Step 3: Account */}
              <div className="glass-card" style={{ padding: 28 }}>
                <StepHeader num={3} title="Account" done={!!isSignedIn} />

                {!isLoaded ? (
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>
                    <Loader size={14} style={{ display: "inline", animation: "spin 1s linear infinite", marginRight: 6 }} />
                    Loading account…
                  </p>
                ) : isSignedIn ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary-blue), var(--accent-teal))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                        {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{user?.fullName || user?.firstName || "Signed in"}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{user?.primaryEmailAddress?.emailAddress}</div>
                      </div>
                    </div>
                    <SignOutButton>
                      <button style={{ background: "none", border: "1px solid rgba(0,0,0,0.1)", padding: "6px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        Sign out
                      </button>
                    </SignOutButton>
                  </div>
                ) : (
                  <InlineAuth />
                )}
              </div>

              {/* Step 4: Agent / Rep Code */}
              <AgentRepCodeSelector
                referralCode={cart.referralCode}
                onReferralCodeChange={setReferralCode}
                lockedFromUrl={cart.referralCodeSource === "url"}
              />

              {/* Step 5: Confirm & Pay */}
              <div className="glass-card" style={{ padding: 28 }}>
                <StepHeader num={5} title="Confirm & Pay" />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {/* Essentials Plan agreement — only shown if Essentials is in cart */}
                  {hasEssentials && (
                    <div
                      onClick={() => {
                        if (!essentialsAgreed) setEssentialsModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        cursor: essentialsAgreed ? "default" : "pointer",
                        padding: 14,
                        borderRadius: 10,
                        background: essentialsAgreed
                          ? "rgba(16,185,129,0.06)"
                          : "transparent",
                        border: essentialsAgreed
                          ? "1px solid rgba(16,185,129,0.25)"
                          : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={essentialsAgreed}
                        readOnly
                        style={{
                          width: 20,
                          height: 20,
                          accentColor: "var(--primary-blue)",
                          marginTop: 2,
                          pointerEvents: "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.9375rem",
                          color: "#475569",
                          lineHeight: 1.6,
                        }}
                      >
                        <strong>Essentials Plan Membership Agreement</strong> —{" "}
                        {cart.items.find((i) => i.product.slug?.startsWith("essentials-"))?.product.name}
                        {!essentialsAgreed && (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              color: "var(--accent-teal)",
                              marginTop: 6,
                              fontWeight: 500,
                            }}
                          >
                            Click to review and sign the Essentials membership agreement
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Oral Care agreement — only shown if Oral Care is in cart */}
                  {hasOralCare && (
                    <div
                      onClick={() => {
                        if (!oralCareAgreed) setOralCareModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        cursor: oralCareAgreed ? "default" : "pointer",
                        padding: 14,
                        borderRadius: 10,
                        background: oralCareAgreed
                          ? "rgba(13,148,136,0.06)"
                          : "transparent",
                        border: oralCareAgreed
                          ? "1px solid rgba(13,148,136,0.25)"
                          : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={oralCareAgreed}
                        readOnly
                        style={{
                          width: 20,
                          height: 20,
                          accentColor: "#0d9488",
                          marginTop: 2,
                          pointerEvents: "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.9375rem",
                          color: "#475569",
                          lineHeight: 1.6,
                        }}
                      >
                        <strong>Oral Care Discount Membership Terms</strong> —{" "}
                        {cart.items.find((i) => i.product.slug?.startsWith("oralcare-"))?.product.name}
                        {!oralCareAgreed && (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              color: "var(--accent-teal)",
                              marginTop: 6,
                              fontWeight: 500,
                            }}
                          >
                            Click to review and accept the Oral Care discount terms
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* NOT insurance — always shown */}
                  <div
                    onClick={() => {
                      if (!agreedToNotInsurance) setTermsModalOpen(true);
                    }}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      cursor: agreedToNotInsurance ? "default" : "pointer",
                      padding: 16,
                      borderRadius: 12,
                      background: agreedToNotInsurance
                        ? "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(251,146,60,0.06) 100%)"
                        : "rgba(249,115,22,0.04)",
                      border: agreedToNotInsurance
                        ? "1.5px solid #f97316"
                        : "1.5px solid rgba(249,115,22,0.2)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreedToNotInsurance}
                      readOnly
                      style={{
                        width: 20,
                        height: 20,
                        accentColor: "#f97316",
                        marginTop: 2,
                        pointerEvents: "none",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.9375rem",
                        color: "#475569",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>I understand this is NOT insurance.</strong>{" "}
                      Ideal Health is a membership program providing access to
                      telehealth, pharmacy savings, lab services, mental
                      wellness support, and discounted dental, vision, and
                      hearing care.
                      {!agreedToNotInsurance && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.8125rem",
                            color: "var(--accent-teal)",
                            marginTop: 6,
                            fontWeight: 500,
                          }}
                        >
                          Click to review and accept the terms &amp; conditions
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div
                  className="glass-card"
                  style={{
                    padding: 16,
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    color: "#b91c1c",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* RIGHT: Order Summary */}
            <div style={{ position: "sticky", top: 100 }}>
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ margin: "0 0 16px 0" }}>Order Summary</h3>

                {cart.items.map((item) => {
                  const isEss = item.product.slug?.startsWith("essentials-");
                  const isOral = item.product.slug?.startsWith("oralcare-");
                  const isOpen = isEss ? essentialsOpen : isOral ? oralCareOpen : false;
                  const toggle = isEss
                    ? () => setEssentialsOpen((v) => !v)
                    : isOral
                    ? () => setOralCareOpen((v) => !v)
                    : undefined;

                  const essentialsDetails = [
                    { icon: <Heart size={13} />, label: "Telehealth", desc: "24/7 virtual doctor visits" },
                    { icon: <Activity size={13} />, label: "Mental Health", desc: "Licensed counselors on-demand" },
                    { icon: <Zap size={13} />, label: "Preventive Care", desc: "Screenings & wellness checks" },
                    { icon: <Shield size={13} />, label: "Rx Discounts", desc: "Savings at 60,000+ pharmacies" },
                  ];
                  const oralCareDetails = [
                    { icon: <ScanLine size={13} />, label: "AI Oral Scanning", desc: "Photo-based health detection" },
                    { icon: <Stethoscope size={13} />, label: "24/7 Teledentistry", desc: "Video consults with dentists" },
                    { icon: <Smile size={13} />, label: "Dental Discount Network", desc: "20–60% off at 100,000+ providers" },
                    { icon: <Phone size={13} />, label: "Emergency Support", desc: "Same-day specialist access" },
                  ];
                  const details = isEss ? essentialsDetails : isOral ? oralCareDetails : [];

                  return (
                    <div key={item.productId} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 0",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>
                            {item.product.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Monthly membership
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>
                            {formatPrice(item.product.pricing.monthlyCardCents)}
                          </span>
                          {toggle && (
                            <button
                              onClick={toggle}
                              style={{
                                background: "rgba(0,102,204,0.07)",
                                border: "none",
                                borderRadius: 6,
                                padding: "3px 6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: "0.7rem",
                                color: "var(--primary-blue)",
                                fontWeight: 500,
                              }}
                            >
                              Details
                              <ChevronDown
                                size={12}
                                style={{
                                  transition: "transform 0.2s",
                                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                }}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {toggle && isOpen && (
                        <div
                          style={{
                            background: "rgba(0,102,204,0.04)",
                            borderRadius: 8,
                            padding: "10px 12px",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--text-muted)",
                              marginBottom: 8,
                            }}
                          >
                            What&apos;s included
                          </div>
                          {details.map((d, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                padding: "5px 0",
                                borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.05)",
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--primary-blue)",
                                  marginTop: 1,
                                  flexShrink: 0,
                                }}
                              >
                                {d.icon}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                                  {d.label}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                  {d.desc}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 14,
                    marginTop: 8,
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotalCents)}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 14,
                    marginTop: 8,
                    borderTop: "2px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Due Today</span>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "var(--primary-blue)",
                    }}
                  >
                    {formatPrice(subtotalCents)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    padding: "10px 12px",
                    background: "rgba(0,102,204,0.04)",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Calendar size={14} />
                  <span>
                    Renews on{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {formattedRenewal}
                    </strong>
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={!canSubmit}
                  style={{
                    width: "100%",
                    marginTop: 20,
                    padding: "14px 20px",
                    background: canSubmit
                      ? "linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
                      : "rgba(0,0,0,0.08)",
                    color: canSubmit ? "white" : "var(--text-muted)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader
                        size={18}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <Lock size={16} /> Complete Purchase
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    justifyContent: "center",
                    marginTop: 14,
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <Shield size={12} /> Secured by Stripe · 256-bit SSL
                </div>

                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: 12,
                    marginBottom: 0,
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  Cancel anytime. You&apos;ll keep access until the end of
                  your billing period.{" "}
                  <strong>This is not insurance.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Legal modals */}
      <EssentialsMembershipModal
        isOpen={essentialsModalOpen}
        onClose={() => setEssentialsModalOpen(false)}
        onAccept={() => {
          setEssentialsAgreed(true);
          setEssentialsModalOpen(false);
        }}
        memberData={{
          memberName:
            user?.fullName ||
            user?.primaryEmailAddress?.emailAddress ||
            "Member",
          email:
            user?.primaryEmailAddress?.emailAddress || "email@example.com",
          planName:
            cart.items.find((i) => i.product.slug?.startsWith("essentials-"))?.product.name ||
            "Essentials Plan",
          periodicChargeCents:
            cart.items.find((i) => i.product.slug?.startsWith("essentials-"))?.product.pricing
              .monthlyCardCents ?? 0,
        }}
      />

      <OralCareTermsModal
        isOpen={oralCareModalOpen}
        onClose={() => setOralCareModalOpen(false)}
        onAccept={async (signature: string) => {
          try {
            await saveOralCareAgreement({
              userId: user!.id,
              memberName: user!.fullName ?? user!.id,
              email: user!.emailAddresses[0]?.emailAddress ?? "",
              planName:
                cart.items.find((i) => i.product.slug?.startsWith("oralcare-"))?.product.name ??
                "Oral Care Savings",
              periodicCharge: (() => {
                const item = cart.items.find((i) => i.product.slug?.startsWith("oralcare-"));
                return item ? formatPrice(item.product.pricing.monthlyCardCents) + "/mo" : undefined;
              })(),
              memberSignature: signature,
              signatureTimestamp: Date.now(),
            });
          } catch (err) {
            console.error("Failed to save oral care agreement:", err);
            // Non-blocking — agreement UI gate still set below
          }
          setOralCareAgreed(true);
          setOralCareModalOpen(false);
        }}
        planName={
          cart.items.find((i) => i.product.slug?.startsWith("oralcare-"))?.product.name
        }
        memberData={user ? { memberName: user.fullName ?? undefined, email: user.emailAddresses[0]?.emailAddress } : undefined}
      />

      <TermsAndConditionsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={() => {
          setAgreedToNotInsurance(true);
          setTermsModalOpen(false);
        }}
      />
    </div>
  );
}
