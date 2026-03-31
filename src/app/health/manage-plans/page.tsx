"use client";

/**
 * MANAGE PLANS PAGE
 *
 * Member-facing plan management hub:
 * - View current plan & membership status
 * - Upgrade / downgrade (Individual ↔ Family)
 * - Cancel membership (with confirmation)
 * - Compare Individual vs Family side-by-side
 * - Browse upcoming plan additions
 */

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import HealthHeader from "@/components/health/HealthHeader";
import {
  ArrowLeft,
  HeartPulse,
  Users,
  Check,
  X,
  AlertTriangle,
  ChevronRight,
  Crown,
  CreditCard,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  FileDown,
  FileText,
  CreditCard as CardIcon,
} from "lucide-react";
import "@/app/health/health.css";

// Static plan info
const INDIVIDUAL_PLAN = {
  slug: "oral-health-individual",
  name: "Individual Plan",
  tier: "individual",
  monthlyCents: 1499,
  annualCents: 16499,
  description: "Full membership benefits for one adult.",
  inclusions: [
    "AI Dental Scan",
    "24/7 Teledentistry",
    "Dental Discount Network",
    "Member ID Card",
    "Preventive Care Discounts",
    "Emergency Access",
  ],
};

const FAMILY_PLAN = {
  slug: "oral-health-family",
  name: "Family Plan",
  tier: "family",
  monthlyCents: 2499,
  annualCents: 27499,
  description: "Unlimited household members under one flat rate.",
  inclusions: [
    "All Individual Plan benefits",
    "Unlimited Household Members",
    "Dependent Invite by Email",
    "Shared Teledentistry Access",
    "Family Discount Network Coverage",
    "Individual Member ID Cards",
  ],
};

const COMPARISON_ROWS = [
  { label: "Monthly Price", individual: "$14.99/mo", family: "$24.99/mo" },
  { label: "Annual Price", individual: "$164.99/yr", family: "$274.99/yr" },
  { label: "AI Dental Scan", individual: true, family: true },
  { label: "Teledentistry (24/7)", individual: true, family: true },
  { label: "Dental Discount Network", individual: true, family: true },
  { label: "Member ID Card", individual: true, family: true },
  { label: "Unlimited Dependents", individual: false, family: true },
  { label: "Family Member Invites", individual: false, family: true },
  { label: "Shared Network Access", individual: false, family: true },
];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function CancelModal({ onConfirm, onClose, isLoading, error }: { onConfirm: () => void; onClose: () => void; isLoading?: boolean; error?: string | null }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{ maxWidth: "480px", width: "100%", padding: "2rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <AlertTriangle size={24} color="#d97706" />
          <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
            Cancel Membership
          </h3>
        </div>
        <p style={{ color: "#64748b", marginBottom: "1rem", lineHeight: 1.6 }}>
          Your benefits will remain active through the end of your current billing period. After that, all access ends.
        </p>
        <p style={{ color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.6, fontSize: "0.9rem" }}>
          You can re-enroll at any time. Cancelling is as easy as signing up — no hoops, no phone calls.
        </p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", marginBottom: "1.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.875rem", color: "#475569" }}>
            I understand my benefits will end at the close of my billing period.
          </span>
        </label>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onClose}
            className="button button--glass"
            style={{ flex: 1 }}
            disabled={isLoading}
          >
            Keep My Membership
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isLoading}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "10px",
              background: confirmed && !isLoading ? "#dc2626" : "#e2e8f0",
              color: confirmed && !isLoading ? "#fff" : "#94a3b8",
              border: "none", fontWeight: 600, fontSize: "0.9375rem",
              cursor: confirmed && !isLoading ? "pointer" : "not-allowed", transition: "all 0.2s",
            }}
          >
            {isLoading ? "Processing…" : "Confirm Cancellation"}
          </button>
        </div>
        {error && (
          <p style={{ color: "#dc2626", fontSize: "0.8125rem", marginTop: "0.75rem", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ManagePlansContent() {
  const { user } = useUser();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSubmitted, setCancelSubmitted] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [docDownloading, setDocDownloading] = useState<string | null>(null);

  const handleDocDownload = async (type: "packet" | "agreement" | "card") => {
    setDocDownloading(type);
    try {
      const res = await fetch(`/api/documents?type=${type}`);
      if (!res.ok) throw new Error("Failed to generate document");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const names: Record<string, string> = {
        packet: "Ideal_Oral_Health_Membership_Packet.pdf",
        agreement: "Ideal_Oral_Health_Membership_Agreement.pdf",
        card: "Ideal_Oral_Health_Member_Card.pdf",
      };
      a.href = url;
      a.download = names[type];
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Document download failed:", err);
    } finally {
      setDocDownloading(null);
    }
  };
  const [tierChangeLoading, setTierChangeLoading] = useState<string | null>(null);
  const [tierChangeResult, setTierChangeResult] = useState<{ direction: string; newTier: string; effective: string; effectiveDate?: string } | null>(null);
  const [tierChangeError, setTierChangeError] = useState<string | null>(null);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  // Fetch current bundle from Convex
  const bundle = useQuery(api.subscriptions.queries.getMyBundle);
  const entitlements = useQuery(api.subscriptions.queries.getMyEntitlements, {});
  const isLoading = bundle === undefined;

  const hasActive = !!bundle && bundle.status !== "cancelled";
  const isCancelPeriodEnd = bundle?.status === "cancel_at_period_end";
  const pendingDowngrade = (bundle as any)?.pendingDowngrade;

  // Determine current tier from entitlements
  const currentTier: "individual" | "family" | null = (() => {
    if (!entitlements || entitlements.length === 0) return null;
    const productSlug = (entitlements[0] as any)?.product?.slug;
    if (!productSlug) return null;
    return productSlug.includes("family") ? "family" : "individual";
  })();

  const handleCancelConfirm = async () => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to cancel subscription");
      }
      setCancelSubmitted(true);
      setShowCancelModal(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to open billing portal");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Billing portal error:", err);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleTierChange = async (targetTier: "individual" | "family") => {
    setTierChangeLoading(targetTier);
    setTierChangeError(null);
    setTierChangeResult(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change plan");
      }
      setTierChangeResult(data);
      setShowUpgradeConfirm(false);
    } catch (err) {
      setTierChangeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTierChangeLoading(null);
    }
  };

  return (
    <div className="health-landing">
      <HealthHeader />

      {/* Breadcrumb */}
      <div className="container" style={{ paddingTop: "1.5rem" }}>
        <Link
          href="/health/dashboard"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            color: "#64748b", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {/* Hero */}
      <section className="section bg--blue" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div className="container">
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
            Manage Your Plan
          </h1>
          <p style={{ color: "#475569", fontSize: "1rem" }}>
            Review, upgrade, or manage your Ideal Oral Health membership.
          </p>
        </div>
      </section>

      <section className="section bg--white" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ maxWidth: "900px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
              Loading your plan details…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* ── Current Plan Status ──────────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <HeartPulse size={22} color="#0066CC" /> Current Membership
                </h2>

                {cancelSubmitted ? (
                  <div style={{ padding: "1.5rem", background: "#fef3c7", borderRadius: "12px", border: "1px solid #fcd34d" }}>
                    <p style={{ color: "#92400e", fontWeight: 600, marginBottom: "0.375rem" }}>Cancellation Submitted</p>
                    <p style={{ color: "#92400e", fontSize: "0.9rem", margin: 0 }}>
                      Your membership remains active through your current billing period. You will receive a confirmation email shortly.
                    </p>
                  </div>
                ) : hasActive ? (
                  <div>
                    <div style={{
                      padding: "1.25rem", background: "#f0f9ff", borderRadius: "12px",
                      border: "1px solid #bae6fd", marginBottom: "1.25rem",
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem",
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                          <Crown size={16} color="#0066CC" />
                          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>
                            {user?.fullName ?? "Member"}
                          </span>
                          <span style={{
                            padding: "2px 10px", borderRadius: "9999px",
                            background: isCancelPeriodEnd ? "#fef3c7" : "#dcfce7",
                            color: isCancelPeriodEnd ? "#92400e" : "#15803d",
                            fontSize: "0.75rem", fontWeight: 700,
                          }}>
                            {isCancelPeriodEnd ? "Cancelling" : "Active"}
                          </span>
                        </div>
                        <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
                          Ideal Oral Health Membership
                          {(bundle as any)?.currentPeriodEnd && !isCancelPeriodEnd
                            ? ` · Renews ${new Date((bundle as any).currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : isCancelPeriodEnd && (bundle as any)?.currentPeriodEnd
                            ? ` · Access ends ${new Date((bundle as any).currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "2.5rem", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    <HeartPulse size={32} color="#0066CC" style={{ marginBottom: "1rem", opacity: 0.5 }} />
                    <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
                      You don&apos;t have an active plan yet. Explore your options below.
                    </p>
                    <Link href="/health/plans" className="button button--primary">
                      Browse Plans
                    </Link>
                  </div>
                )}
              </div>

              {/* ── My Documents ────────────────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <FileDown size={22} color="#0066CC" /> My Documents
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  Download your membership documents at any time.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {([
                    {
                      type: "packet" as const,
                      label: "Membership Packet",
                      description: "Welcome letter, program details, schedule of services & member ID card",
                      icon: <FileText size={18} color="#0066CC" />,
                    },
                    {
                      type: "agreement" as const,
                      label: "Membership Agreement",
                      description: "Your signed membership agreement and terms",
                      icon: <FileText size={18} color="#14b8a6" />,
                    },
                    {
                      type: "card" as const,
                      label: "Member ID Card",
                      description: "Printable front & back member ID card (PDF)",
                      icon: <CardIcon size={18} color="#7c3aed" />,
                    },
                  ] as const).map(({ type, label, description, icon }) => (
                    <div
                      key={type}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "1rem 1.25rem", background: "#f8fafc",
                        borderRadius: "12px", border: "1px solid #e2e8f0",
                        gap: "1rem", flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "160px" }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "10px",
                          background: "#fff", border: "1px solid #e2e8f0",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0f172a" }}>{label}</div>
                          <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "2px" }}>{description}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDocDownload(type)}
                        disabled={docDownloading === type || !hasActive}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.375rem",
                          padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0",
                          background: docDownloading === type ? "#f1f5f9" : "#fff",
                          color: docDownloading === type ? "#94a3b8" : "#0066CC",
                          fontWeight: 600, fontSize: "0.8125rem",
                          cursor: (docDownloading === type || !hasActive) ? "not-allowed" : "pointer",
                          opacity: !hasActive ? 0.5 : 1,
                          whiteSpace: "nowrap", transition: "all 0.15s",
                        }}
                      >
                        {docDownloading === type
                          ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                          : <><FileDown size={14} /> Download</>}
                      </button>
                    </div>
                  ))}
                </div>
                {!hasActive && (
                  <p style={{ color: "#94a3b8", fontSize: "0.8125rem", marginTop: "1rem", textAlign: "center" }}>
                    Documents are available once you have an active plan.
                  </p>
                )}
              </div>

              {/* ── Manage Payment Methods ───────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <CreditCard size={22} color="#0066CC" /> Billing &amp; Payment
                </h2>
                <div
                  style={{
                    padding: "1.5rem",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  <p style={{ color: "#64748b", marginBottom: "1rem" }}>
                    Manage your payment methods and view billing history.
                  </p>
                  <button
                    className="button button--glass"
                    onClick={handleBillingPortal}
                    disabled={!hasActive || billingLoading}
                    style={{
                      opacity: hasActive ? 1 : 0.5,
                      cursor: hasActive ? "pointer" : "not-allowed",
                    }}
                  >
                    {billingLoading ? "Opening…" : "Manage Payment Methods"}
                  </button>
                  {!hasActive && (
                    <p style={{ color: "#94a3b8", fontSize: "0.8125rem", marginTop: "0.75rem", margin: "0.75rem 0 0" }}>
                      Billing portal is available once you have an active plan.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Upgrade / Downgrade ──────────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <RefreshCw size={22} color="#0066CC" /> Change Your Tier
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                  {currentTier === "individual"
                    ? "Upgrade to Family for a one-time $10 fee — get immediate access."
                    : currentTier === "family"
                      ? "You can switch to Individual for free. The change takes effect at the end of your current billing period."
                      : "Switch between Individual and Family at any time."}
                </p>

                {/* Tier change result banner */}
                {tierChangeResult && (
                  <div style={{
                    padding: "1rem 1.25rem", borderRadius: "10px", marginBottom: "1.25rem",
                    background: tierChangeResult.direction === "upgrade" ? "#ecfdf5" : "#f0f9ff",
                    border: `1px solid ${tierChangeResult.direction === "upgrade" ? "#a7f3d0" : "#bfdbfe"}`,
                    display: "flex", alignItems: "center", gap: "0.75rem",
                  }}>
                    {tierChangeResult.direction === "upgrade"
                      ? <ArrowUpCircle size={20} color="#059669" />
                      : <ArrowDownCircle size={20} color="#2563eb" />}
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                        {tierChangeResult.direction === "upgrade"
                          ? `Upgraded to ${tierChangeResult.newTier}! You now have full access.`
                          : `Downgrade to ${tierChangeResult.newTier} scheduled.`}
                      </div>
                      {tierChangeResult.effectiveDate && (
                        <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                          Takes effect {tierChangeResult.effectiveDate}.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tier change error */}
                {tierChangeError && (
                  <div style={{
                    padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1.25rem",
                    background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
                    fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem",
                  }}>
                    <AlertTriangle size={16} /> {tierChangeError}
                  </div>
                )}

                {/* Pending downgrade banner */}
                {pendingDowngrade && !tierChangeResult && (
                  <div style={{
                    padding: "1rem 1.25rem", borderRadius: "10px", marginBottom: "1.25rem",
                    background: "#fffbeb", border: "1px solid #fde68a",
                    display: "flex", alignItems: "center", gap: "0.75rem",
                  }}>
                    <ArrowDownCircle size={20} color="#d97706" />
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.9rem" }}>
                        Downgrade to Individual scheduled
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                        Takes effect {new Date(pendingDowngrade.effectiveDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. You keep Family access until then.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                  {[INDIVIDUAL_PLAN, FAMILY_PLAN].map((plan) => {
                    const isCurrentPlan = currentTier === plan.tier;
                    const isUpgrade = currentTier === "individual" && plan.tier === "family";
                    const isDowngrade = currentTier === "family" && plan.tier === "individual";
                    return (
                      <div
                        key={plan.slug}
                        style={{
                          border: isCurrentPlan ? "2px solid #0066CC" : "1px solid #e2e8f0",
                          borderRadius: "14px",
                          padding: "1.5rem", background: isCurrentPlan ? "#f0f7ff" : "#f8fafc",
                          display: "flex", flexDirection: "column", gap: "1rem",
                          position: "relative",
                        }}
                      >
                        {isCurrentPlan && (
                          <div style={{
                            position: "absolute", top: "-12px", right: "16px",
                            background: "#0066CC", color: "#fff", fontSize: "0.75rem",
                            fontWeight: 700, padding: "3px 12px", borderRadius: "20px",
                          }}>
                            Current Plan
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          {plan.tier === "family" ? <Users size={20} color="#0066CC" /> : <HeartPulse size={20} color="#0066CC" />}
                          <h3 style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>{plan.name}</h3>
                        </div>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>{plan.description}</p>
                        <div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0066CC" }}>
                            {formatCents(plan.monthlyCents)}<span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748b" }}>/mo</span>
                          </div>
                          <div style={{ fontSize: "0.8125rem", color: "#14b8a6", fontWeight: 600 }}>
                            {formatCents(plan.annualCents)}/yr · 1 Month Free
                          </div>
                        </div>
                        <ul style={{ margin: 0, padding: "0 0 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                          {plan.inclusions.slice(0, 4).map((item) => (
                            <li key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
                              <Check size={14} color="#14b8a6" />
                              {item}
                            </li>
                          ))}
                        </ul>

                        {/* Smart action button */}
                        {isCurrentPlan ? (
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                            padding: "0.625rem 1rem", borderRadius: "8px",
                            background: "#e2e8f0", color: "#64748b",
                            fontWeight: 600, fontSize: "0.875rem",
                          }}>
                            <Crown size={15} /> Your Current Plan
                          </div>
                        ) : isUpgrade ? (
                          <button
                            onClick={() => setShowUpgradeConfirm(true)}
                            disabled={!!tierChangeLoading || isCancelPeriodEnd}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                              padding: "0.625rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer",
                              background: isCancelPeriodEnd ? "#e2e8f0" : "linear-gradient(135deg, #059669, #047857)",
                              color: isCancelPeriodEnd ? "#94a3b8" : "#fff",
                              fontWeight: 600, fontSize: "0.875rem",
                              opacity: tierChangeLoading ? 0.7 : 1,
                            }}
                          >
                            {tierChangeLoading === "family"
                              ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
                              : <><ArrowUpCircle size={15} /> Upgrade to Family — $10</>}
                          </button>
                        ) : isDowngrade ? (
                          <button
                            onClick={() => handleTierChange("individual")}
                            disabled={!!tierChangeLoading || isCancelPeriodEnd || !!pendingDowngrade}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                              padding: "0.625rem 1rem", borderRadius: "8px", border: "1px solid #e2e8f0",
                              cursor: (isCancelPeriodEnd || pendingDowngrade) ? "not-allowed" : "pointer",
                              background: "#fff", color: (isCancelPeriodEnd || pendingDowngrade) ? "#94a3b8" : "#475569",
                              fontWeight: 600, fontSize: "0.875rem",
                              opacity: tierChangeLoading ? 0.7 : 1,
                            }}
                          >
                            {tierChangeLoading === "individual"
                              ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
                              : pendingDowngrade
                                ? <><ArrowDownCircle size={15} /> Downgrade Scheduled</>
                                : <><ArrowDownCircle size={15} /> Switch to Individual (free)</>}
                          </button>
                        ) : (
                          <Link
                            href="/health/plans"
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                              padding: "0.625rem 1rem", borderRadius: "8px",
                              background: "linear-gradient(135deg, #0066CC, #0052a3)",
                              color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem",
                            }}
                          >
                            Select This Plan <ChevronRight size={15} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Upgrade Confirmation Modal ───────────────────── */}
              {showUpgradeConfirm && (
                <div
                  style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem",
                  }}
                  onClick={() => setShowUpgradeConfirm(false)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: "#fff", borderRadius: "16px", maxWidth: "420px",
                      width: "100%", padding: "2rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "12px",
                        background: "linear-gradient(135deg, #059669, #047857)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <ArrowUpCircle size={22} color="#fff" />
                      </div>
                      <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                        Upgrade to Family Plan
                      </h3>
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                      <p style={{ margin: "0 0 0.75rem" }}>
                        A one-time <strong>$10 upgrade fee</strong> will be added to your next invoice.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                        <li>Immediate access to Family plan features</li>
                        <li>Add up to 9 dependents</li>
                        <li>Your billing cycle stays the same</li>
                        <li>New rate: $24.99/mo or $274.99/yr</li>
                      </ul>
                    </div>
                    {tierChangeError && (
                      <div style={{
                        padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "1rem",
                        background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
                        fontSize: "0.8125rem",
                      }}>
                        {tierChangeError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        onClick={() => { setShowUpgradeConfirm(false); setTierChangeError(null); }}
                        style={{
                          flex: 1, padding: "0.625rem 1rem", borderRadius: "8px",
                          border: "1px solid #e2e8f0", background: "#fff",
                          color: "#475569", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleTierChange("family")}
                        disabled={!!tierChangeLoading}
                        style={{
                          flex: 1, padding: "0.625rem 1rem", borderRadius: "8px",
                          border: "none",
                          background: tierChangeLoading ? "#a7f3d0" : "linear-gradient(135deg, #059669, #047857)",
                          color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                        }}
                      >
                        {tierChangeLoading === "family"
                          ? "Processing..."
                          : "Confirm Upgrade — $10"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Compare Table ────────────────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
                  Individual vs. Family — Side by Side
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "400px" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b", fontSize: "0.8125rem", fontWeight: 600 }}>Feature</th>
                        <th style={{ padding: "12px 16px", textAlign: "center", borderBottom: "2px solid #e2e8f0", color: "#0066CC", fontSize: "0.9rem", fontWeight: 700 }}>Individual</th>
                        <th style={{ padding: "12px 16px", textAlign: "center", borderBottom: "2px solid #e2e8f0", color: "#0066CC", fontSize: "0.9rem", fontWeight: 700, background: "#f0f9ff", borderRadius: "8px 8px 0 0" }}>Family</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={row.label} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                          <td style={{ padding: "10px 16px", fontSize: "0.9rem", color: "#0f172a", fontWeight: 500, borderBottom: "1px solid #f1f5f9" }}>{row.label}</td>
                          <td style={{ padding: "10px 16px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                            {typeof row.individual === "boolean"
                              ? row.individual ? <Check size={18} color="#14b8a6" /> : <X size={18} color="#cbd5e1" />
                              : <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0066CC" }}>{row.individual}</span>
                            }
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "center", borderBottom: "1px solid #f1f5f9", background: "#f0f9ff" }}>
                            {typeof row.family === "boolean"
                              ? row.family ? <Check size={18} color="#14b8a6" /> : <X size={18} color="#cbd5e1" />
                              : <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0066CC" }}>{row.family}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Disclosure ───────────────────────────────────── */}
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8125rem", lineHeight: 1.6 }}>
                All plans are discount membership programs — not insurance.
                Cancel anytime; access continues through your current billing period end.
                Savings vary by provider and service.
              </p>

              {/* ── Cancel link — present but not prominent ────── */}
              {hasActive && !isCancelPeriodEnd && !cancelSubmitted && (
                <p style={{ textAlign: "center", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    style={{
                      background: "none", border: "none", padding: 0,
                      color: "#94a3b8", fontSize: "0.8125rem", cursor: "pointer",
                      textDecoration: "underline", textUnderlineOffset: "2px",
                    }}
                  >
                    Need to cancel? Click here.
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {showCancelModal && (
        <CancelModal
          onConfirm={handleCancelConfirm}
          onClose={() => { setShowCancelModal(false); setCancelError(null); }}
          isLoading={cancelLoading}
          error={cancelError}
        />
      )}
    </div>
  );
}

export default function ManagePlansPage() {
  return <ManagePlansContent />;
}
