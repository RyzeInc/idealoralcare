"use client";

/**
 * PROFILE COMPLETION PROMPT
 *
 * Dashboard overlay that asks members to "verify" their information when
 * required census fields are missing from their Convex member profile.
 *
 * Mirrors the look & flow of the /health/checkout signup wizard (step
 * indicator, masked DOB input, US state select) so it reads as a natural
 * verification step rather than re-collection of lost data.
 *
 * Data + persistence:
 *  - reads the signed-in member's profile via api.enrollment.members.getMyProfile
 *  - saves via api.enrollment.members.completeMyProfile (Clerk-secured, self-only)
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
];

const DISMISS_KEY = "profile_completion_dismissed";

// MM/DD/YYYY mask
function formatDob(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length > 2) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

// MM/DD/YYYY -> ISO YYYY-MM-DD (returns "" if incomplete)
function dobToIso(masked: string): string {
  const d = masked.replace(/\D/g, "");
  if (d.length !== 8) return "";
  const mm = d.slice(0, 2);
  const dd = d.slice(2, 4);
  const yyyy = d.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

// (XXX) XXX-XXXX mask
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const baseInput: React.CSSProperties = {
  width: "100%",
  borderRadius: "10px",
  fontFamily: "inherit",
  fontSize: "0.9375rem",
  transition: "border-color 0.2s, background-color 0.2s, box-shadow 0.2s",
  backgroundColor: "#f8fafc",
  outline: "none",
  border: "1px solid #e2e8f0",
  padding: "0.7rem 1rem",
};

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "0.375rem" }}>
        {label}
        {optional && <span style={{ color: "#94a3b8", fontWeight: 400 }}> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

export default function ProfileCompletionPrompt() {
  const profile = useQuery(api.enrollment.members.getMyProfile, {});
  const completeProfile = useMutation(api.enrollment.members.completeMyProfile);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state — initialized from existing profile values where present.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Determine which sections are missing.
  const missing = useMemo(() => {
    if (!profile) return { personal: false, address: false, any: false };
    const p = profile as any;
    const personal = !p.firstName?.trim() || !p.lastName?.trim() || !p.dateOfBirth;
    const addr = p.address || {};
    const address = !addr.line1?.trim() || !addr.city?.trim() || !addr.state?.trim() || !addr.postalCode?.trim();
    return { personal, address, any: personal || address };
  }, [profile]);

  // One-time hydration from the profile once it loads.
  if (profile && !hydrated) {
    const p = profile as any;
    setFirstName(p.firstName ?? "");
    setLastName(p.lastName ?? "");
    setDateOfBirth("");
    setGender(p.gender ?? "");
    setPhone(p.phone ?? "");
    setAddressLine1(p.address?.line1 ?? "");
    setAddressLine2(p.address?.line2 ?? "");
    setCity(p.address?.city ?? "");
    setStateCode(p.address?.state ?? "");
    setPostalCode(p.address?.postalCode ?? "");
    setHydrated(true);
  }

  // Build the ordered list of steps that actually need completing.
  const steps = useMemo(() => {
    const s: Array<"personal" | "address"> = [];
    if (missing.personal) s.push("personal");
    if (missing.address) s.push("address");
    return s;
  }, [missing.personal, missing.address]);

  // Nothing to show: loading, no profile, complete, or dismissed for this session.
  if (profile === undefined || profile === null || !missing.any || dismissed || steps.length === 0) {
    return null;
  }

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  const validatePersonal = (): string => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (dobToIso(dateOfBirth) === "") return "Enter a complete date of birth (MM/DD/YYYY).";
    return "";
  };
  const validateAddress = (): string => {
    if (!addressLine1.trim()) return "Street address is required.";
    if (!city.trim()) return "City is required.";
    if (!stateCode) return "Select a state.";
    if (!/^\d{5}$/.test(postalCode)) return "Enter a valid 5-digit ZIP.";
    return "";
  };

  const handleNext = () => {
    setError("");
    const err = currentStep === "personal" ? validatePersonal() : validateAddress();
    if (err) {
      setError(err);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleSubmit = async () => {
    setError("");
    const err = currentStep === "personal" ? validatePersonal() : validateAddress();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (steps.includes("personal")) {
        payload.firstName = firstName.trim();
        payload.lastName = lastName.trim();
        const iso = dobToIso(dateOfBirth);
        if (iso) payload.dateOfBirth = iso;
        if (gender) payload.gender = gender;
      }
      const digits = phone.replace(/\D/g, "");
      if (digits.length === 10) payload.phone = `+1${digits}`;
      if (steps.includes("address")) {
        payload.address = {
          line1: addressLine1.trim(),
          ...(addressLine2.trim() ? { line2: addressLine2.trim() } : {}),
          city: city.trim(),
          state: stateCode,
          postalCode,
          country: "US",
        };
      }
      await completeProfile(payload as any);
      // Reactive query will re-evaluate `missing` and unmount this prompt.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your information. Please try again.");
      setSaving(false);
    }
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Verify your information"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            Verify your information
          </h2>
          <p style={{ margin: "0.375rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
            Please confirm a few details so your membership and ID card are accurate.
          </p>

          {/* Step indicator */}
          {steps.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              {steps.map((s, i) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: "4px",
                    borderRadius: "2px",
                    background: i <= stepIndex ? "#0066CC" : "#e2e8f0",
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", display: "grid", gap: "0.875rem" }}>
          {currentStep === "personal" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                <Field label="First name">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    disabled={saving}
                    style={baseInput}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    disabled={saving}
                    style={baseInput}
                  />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
                <Field label="Date of Birth">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(formatDob(e.target.value))}
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                    autoComplete="bday"
                    disabled={saving}
                    style={baseInput}
                  />
                </Field>
                <Field label="Gender" optional>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={saving}
                    style={{ ...baseInput, appearance: "none", cursor: "pointer" }}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
              </div>
              <Field label="Phone Number" optional>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  autoComplete="tel"
                  disabled={saving}
                  style={baseInput}
                />
              </Field>
            </>
          )}

          {currentStep === "address" && (
            <>
              <Field label="Street Address">
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St"
                  autoComplete="address-line1"
                  disabled={saving}
                  style={baseInput}
                />
              </Field>
              <Field label="Apt, Suite, etc." optional>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apt 4B"
                  autoComplete="address-line2"
                  disabled={saving}
                  style={baseInput}
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.625rem" }}>
                <Field label="City">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Orlando"
                    autoComplete="address-level2"
                    disabled={saving}
                    style={baseInput}
                  />
                </Field>
                <Field label="State">
                  <select
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    disabled={saving}
                    style={{ ...baseInput, appearance: "none", cursor: "pointer", padding: "0.7rem 0.5rem" }}
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="ZIP">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="32801"
                    maxLength={5}
                    autoComplete="postal-code"
                    disabled={saving}
                    style={baseInput}
                  />
                </Field>
              </div>
            </>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#ef4444", fontWeight: 500 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStepIndex((i) => Math.max(0, i - 1));
                }}
                disabled={saving}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.7rem 1.25rem",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
              disabled={saving}
              style={{
                background: "#0066CC",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "0.7rem 1.5rem",
                fontWeight: 600,
                fontSize: "0.9375rem",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : isLastStep ? "Save & Verify" : "Continue"}
            </button>
        </div>
      </div>
    </div>
  );
}
