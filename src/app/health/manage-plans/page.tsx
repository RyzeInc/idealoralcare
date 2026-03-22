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

function CancelModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
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
          >
            Keep My Membership
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "10px",
              background: confirmed ? "#dc2626" : "#e2e8f0",
              color: confirmed ? "#fff" : "#94a3b8",
              border: "none", fontWeight: 600, fontSize: "0.9375rem",
              cursor: confirmed ? "pointer" : "not-allowed", transition: "all 0.2s",
            }}
          >
            Cancel Membership
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagePlansContent() {
  const { user } = useUser();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSubmitted, setCancelSubmitted] = useState(false);

  // Fetch current bundle from Convex
  const bundle = useQuery(api.subscriptions.queries.getMyBundle);
  const isLoading = bundle === undefined;

  const hasActive = !!bundle && bundle.status !== "cancelled";
  const isCancelPeriodEnd = bundle?.status === "cancel_at_period_end";

  const handleCancelConfirm = () => {
    // TODO: wire to Stripe cancel subscription endpoint
    setCancelSubmitted(true);
    setShowCancelModal(false);
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
                      {!isCancelPeriodEnd && (
                        <button
                          onClick={() => setShowCancelModal(true)}
                          style={{
                            padding: "0.5rem 1rem", borderRadius: "8px",
                            border: "1px solid #fca5a5", background: "#fff5f5",
                            color: "#dc2626", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                          }}
                        >
                          Cancel Membership
                        </button>
                      )}
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
                    disabled
                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                  >
                    Manage Payment Methods
                  </button>
                  <p style={{ color: "#94a3b8", fontSize: "0.8125rem", marginTop: "0.75rem", margin: "0.75rem 0 0" }}>
                    Coming soon — Stripe billing portal integration.
                  </p>
                </div>
              </div>

              {/* ── Upgrade / Downgrade ──────────────────────────── */}
              <div className="glass-card" style={{ padding: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <RefreshCw size={22} color="#0066CC" /> Change Your Tier
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                  Switch between Individual and Family at any time. Changes take effect on your next billing cycle.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                  {[INDIVIDUAL_PLAN, FAMILY_PLAN].map((plan) => (
                    <div
                      key={plan.slug}
                      style={{
                        border: "1px solid #e2e8f0", borderRadius: "14px",
                        padding: "1.5rem", background: "#f8fafc",
                        display: "flex", flexDirection: "column", gap: "1rem",
                      }}
                    >
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
                    </div>
                  ))}
                </div>
              </div>

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
            </div>
          )}
        </div>
      </section>

      {showCancelModal && (
        <CancelModal onConfirm={handleCancelConfirm} onClose={() => setShowCancelModal(false)} />
      )}
    </div>
  );
}

export default function ManagePlansPage() {
  return <ManagePlansContent />;
}
