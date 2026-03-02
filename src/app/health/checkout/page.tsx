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
  UserPlus
} from "lucide-react";
import HealthHeader from "@/components/health/HealthHeader";
import { CartProvider, useCart } from "@/lib/health-plans";
import { formatPrice, getPrice } from "@/lib/health-plans/types";
import { CadenceModal } from "@/components/health/catalog";
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

type AuthTab = "signin" | "signup";
type AuthStep = "form" | "verify";

function InlineAuth() {
  const { signIn, isLoaded: siLoaded, setActive: siSetActive } = useSignIn();
  const { signUp, isLoaded: suLoaded, setActive: suSetActive } = useSignUp();

  const [tab, setTab]                       = useState<AuthTab>("signup");
  const [step, setStep]                     = useState<AuthStep>("form");
  const [firstName, setFirstName]           = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPwd, setConfirmPwd]         = useState("");
  const [showPwd, setShowPwd]               = useState(false);
  const [verifyCode, setVerifyCode]         = useState("");
  const [error, setError]                   = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [oauthLoading, setOauthLoading]     = useState<string | null>(null);

  useEffect(() => { setError(""); setStep("form"); }, [tab]);

  const busy = isLoading || !!oauthLoading;
  const isLoaded = tab === "signin" ? siLoaded : suLoaded;

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: "10px",
    fontFamily: "inherit", fontSize: "0.9375rem", transition: "all 0.2s",
    backgroundColor: "#f8fafc", padding: "0.7rem 1rem 0.7rem 2.625rem",
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#0066CC";
    e.currentTarget.style.backgroundColor = "#fff";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#e2e8f0";
    e.currentTarget.style.backgroundColor = "#f8fafc";
  };

  const handleOAuth = async (strategy: "oauth_apple" | "oauth_google" | "oauth_facebook") => {
    if (!isLoaded) return;
    setOauthLoading(strategy);
    try {
      const fn = tab === "signin"
        ? signIn!.authenticateWithRedirect
        : signUp!.authenticateWithRedirect;
      await fn({
        strategy,
        redirectUrl: "/health/sso-callback",
        redirectUrlComplete: "/health/checkout",
      });
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPwd) { setError("Passwords do not match."); return; }
    if (password.length < 8)    { setError("Password must be at least 8 characters."); return; }
    if (!suLoaded) return;
    setIsLoading(true);
    try {
      const params: Record<string, string> = { emailAddress: email, password };
      if (firstName) params.firstName = firstName;
      const result = await signUp!.create(params);
      if (result.status === "complete") {
        await suSetActive!({ session: result.createdSessionId });
      } else if (result.unverifiedFields?.includes("email_address")) {
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      } else {
        setError("Account creation requires additional steps.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Sign-up failed.");
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
        await suSetActive!({ session: result.createdSessionId });
      } else {
        setError("Verification failed. Check your code.");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message || "Invalid code.");
    } finally {
      setIsLoading(false);
    }
  };

  const oauthButtons = [
    { strategy: "oauth_apple"    as const, icon: <AppleIcon />,    bg: "#000",    color: "#fff",    border: "none",                title: "Apple"    },
    { strategy: "oauth_facebook" as const, icon: <FacebookIcon />, bg: "#1877F2", color: "#fff",    border: "none",                title: "Facebook" },
    { strategy: "oauth_google"   as const, icon: <GoogleIcon />,   bg: "#fff",    color: "#374151", border: "1px solid #d1d5db", title: "Google"   },
  ] as const;

  return (
    <div>
      {/* tabs */}
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
        /* ── Email verification ── */
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ color: "#475569", fontSize: "0.9rem", margin: 0 }}>Enter the 6-digit code sent to <strong>{email}</strong>.</p>
          <input type="text" value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456" maxLength={6} disabled={isLoading} required
            style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.7rem", fontFamily: "monospace", fontSize: "1.375rem", letterSpacing: "0.4em", textAlign: "center", backgroundColor: "#f8fafc", width: "100%" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#0066CC"; e.currentTarget.style.backgroundColor = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }}
          />
          <button type="submit" disabled={isLoading || verifyCode.length < 6}
            style={{ padding: "0.75rem", background: isLoading || verifyCode.length < 6 ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, cursor: isLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            {isLoading ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> Verifying...</> : "Verify & Continue"}
          </button>
          <button type="button" onClick={() => { setStep("form"); setError(""); setVerifyCode(""); }}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.8125rem", cursor: "pointer", textDecoration: "underline" }}>
            ← Back
          </button>
        </form>
      ) : (
        <>
          {/* ── OAuth row ── */}
          <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1rem" }}>
            {oauthButtons.map(({ strategy, icon, bg, color, border, title }) => (
              <button key={strategy} type="button" title={`Continue with ${title}`}
                onClick={() => handleOAuth(strategy)} disabled={busy}
                style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", background: bg, color, border, cursor: busy ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: oauthLoading && oauthLoading !== strategy ? 0.4 : 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)", transition: "opacity 0.2s, transform 0.1s" }}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                {oauthLoading === strategy
                  ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
                  : icon}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>or continue with email</span>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          </div>

          {/* ── Form ── */}
          <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
            style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

            {tab === "signup" && (
              <div style={{ position: "relative" }}>
                <UserPlus size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name (optional)" disabled={busy} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
            )}

            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address" disabled={busy} required autoComplete="email"
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
              <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "Create password (min. 8 chars)" : "Password"}
                disabled={busy} required autoComplete={tab === "signup" ? "new-password" : "current-password"}
                style={{ ...inputStyle, paddingRight: "2.625rem" }} onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px", display: "flex" }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {tab === "signup" && (
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input type={showPwd ? "text" : "password"} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Confirm password" disabled={busy} required autoComplete="new-password"
                  style={{ ...inputStyle, borderColor: confirmPwd && password === confirmPwd ? "#22c55e" : "#e2e8f0" }}
                  onFocus={onFocus}
                  onBlur={(e) => { e.currentTarget.style.borderColor = confirmPwd && password === confirmPwd ? "#22c55e" : "#e2e8f0"; e.currentTarget.style.backgroundColor = "#f8fafc"; }} />
              </div>
            )}

            {tab === "signin" && (
              <div style={{ textAlign: "right", marginTop: "-0.375rem" }}>
                <Link href="/health/forgot-password" style={{ color: "#0066CC", fontSize: "0.8125rem", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
            )}

            <button type="submit" disabled={busy || !email || !password || (tab === "signup" && !confirmPwd)}
              style={{ padding: "0.75rem", background: busy || !email || !password ? "#cbd5e1" : "#0066CC", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.9375rem", cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "background 0.2s" }}
              onMouseEnter={(e) => { if (!busy && email && password) e.currentTarget.style.background = "#0052a3"; }}
              onMouseLeave={(e) => { if (!busy && email && password) e.currentTarget.style.background = "#0066CC"; }}>
              {isLoading
                ? <><Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> {tab === "signin" ? "Signing In..." : "Creating Account..."}</>
                : tab === "signin" ? "Sign In" : "Create Account & Continue"}
            </button>
          </form>
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
    removeItem 
  } = useCart();
  
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNotInsurance, setAgreedToNotInsurance] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
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
  
  // Calculate ACH savings
  const cardTotal = cart.items.reduce((sum, item) => {
    return sum + getPrice(item.product, cart.cadence, "card");
  }, 0);
  const achTotal = cart.items.reduce((sum, item) => {
    return sum + getPrice(item.product, cart.cadence, "ach");
  }, 0);
  const achSavings = cardTotal - achTotal;
  
  // Calculate actual total (subtotal is always card price, then apply ACH discount if applicable)
  const totalDueToday = cart.paymentMethod === "ach" ? achTotal : cardTotal;
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
      
      {/* Hero Section */}
      <section className="section bg--blue" style={{ paddingTop: "7rem", paddingBottom: "2rem" }}>
        <div className="container">
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
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
            Checkout
          </h1>
          <p style={{ color: "#475569", fontSize: "1.125rem" }}>
            Review your order and complete your purchase
          </p>
        </div>
      </section>
      
      {/* Main Checkout Grid */}
      <section className="section bg--white" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
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
                    const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
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
                            {item.product.category}
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
                          Save 17%
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
                      <span style={{ fontSize: "0.875rem", color: "#14b8a6", fontWeight: 600 }}>
                        ACH Discount: Save {formatPrice(achSavings)}{periodShort}
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
                  <label style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: agreedToTerms ? "#f0fdf4" : "transparent",
                    transition: "background 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      I understand that I will be billed <strong>{formatPrice(totalDueToday)}</strong> today 
                      and {formatPrice(totalDueToday)}{periodShort} on renewal. I can cancel 
                      anytime and keep access until the end of my billing period.
                    </span>
                  </label>
                  
                  <label style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    cursor: "pointer",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: agreedToNotInsurance ? "#fef3c7" : "transparent",
                    transition: "background 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={agreedToNotInsurance}
                      onChange={(e) => setAgreedToNotInsurance(e.target.checked)}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#0066CC",
                        marginTop: "2px"
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6 }}>
                      <strong style={{ color: "#d97706" }}>I understand this is NOT insurance.</strong> These plans provide 
                      discounts and access to services, not insurance coverage.
                    </span>
                  </label>
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
                    const itemPrice = getPrice(item.product, cart.cadence, cart.paymentMethod);
                    return (
                      <div key={item.productId} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ color: "#475569" }}>{item.product.name}</span>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>
                          {formatPrice(itemPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* ACH Savings Banner */}
                {cart.paymentMethod === "ach" && achSavings > 0 && (
                  <div style={{
                    margin: "1rem 0",
                    padding: "0.75rem 1rem",
                    background: "linear-gradient(135deg, #f0fdfa, #ecfdf5)",
                    borderRadius: "10px",
                    border: "1px solid #99f6e4",
                    textAlign: "center",
                    fontSize: "0.9375rem",
                    color: "#0d9488",
                    fontWeight: 600
                  }}>
                    ACH discount: You're saving {formatPrice(achSavings)}{periodShort}!
                  </div>
                )}
                
                {/* Totals */}
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Subtotal</span>
                    <span style={{ color: "#0f172a" }}>{formatPrice(subtotalCents)}</span>
                  </div>
                  {cart.paymentMethod === "ach" && achSavings > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#16a34a" }}>ACH Discount</span>
                      <span style={{ color: "#16a34a" }}>-{formatPrice(achSavings)}</span>
                    </div>
                  )}
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
