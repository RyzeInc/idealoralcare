"use client";
import { useState } from "react";
import {
  normalizeCheckoutProfile,
  type CheckoutProfile,
} from "@/lib/checkout-profile";

interface Props {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  onComplete: (profile: CheckoutProfile) => void;
  onReset?: () => void;
}

export function CheckoutIntake({
  userId,
  email,
  firstName,
  lastName,
  onComplete,
  onReset,
}: Props) {
  const [draft, setDraft] = useState(() => {
    let saved: Partial<CheckoutProfile> = {};
    try {
      const scoped = sessionStorage.getItem(`checkout-intake:${userId}`);
      const signup = JSON.parse(
        sessionStorage.getItem("careington_profile") || "null",
      );
      saved = scoped
        ? JSON.parse(scoped)
        : signup?.email === email
          ? signup
          : {};
    } catch {
      /* The form remains available if storage is unavailable. */
    }
    return {
      firstName: saved.firstName || firstName || "",
      lastName: saved.lastName || lastName || "",
      dateOfBirth: saved.dateOfBirth || "",
      gender: saved.gender || "",
      phone: saved.phone || "",
      line1: saved.address?.line1 || "",
      line2: saved.address?.line2 || "",
      city: saved.address?.city || "",
      state: saved.address?.state || "",
      postalCode: saved.address?.postalCode || "",
    };
  });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const profile = normalizeCheckoutProfile({
          ...draft,
          address: {
            line1: draft.line1,
            line2: draft.line2,
            city: draft.city,
            state: draft.state,
            postalCode: draft.postalCode,
          },
        });
        if (!profile) {
          setError(
            "Check your name, date of birth, address, state and ZIP code. A phone number, if provided, must be complete.",
          );
          return;
        }
        try {
          sessionStorage.setItem(
            `checkout-intake:${userId}`,
            JSON.stringify(profile),
          );
        } catch {
          /* The current checkout still has the confirmed form. */
        }
        onComplete(profile);
        setConfirmed(true);
        setError("");
      }}
      style={{ marginTop: 24 }}
    >
      <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
        Member details & eligibility intake
      </h3>
      <p style={{ color: "#64748b", margin: "8px 0 16px" }}>
        Confirm the details needed to enroll you and prepare your membership
        documents.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {(
          [
            ["firstName", "First name", "given-name"],
            ["lastName", "Last name", "family-name"],
            ["dateOfBirth", "Date of birth (MM/DD/YYYY or YYYY-MM-DD)", "bday"],
            ["phone", "Phone (optional)", "tel"],
            ["line1", "Street address", "address-line1"],
            ["line2", "Apartment / suite (optional)", "address-line2"],
            ["city", "City", "address-level2"],
            ["state", "State (two letters)", "address-level1"],
            ["postalCode", "ZIP code", "postal-code"],
          ] as const
        ).map(([key, label, autocomplete]) => (
          <label
            key={key}
            style={{ display: "grid", gap: 4, fontSize: ".875rem" }}
          >
            {label}
            <input
              autoComplete={autocomplete}
              required={key !== "phone" && key !== "line2"}
              readOnly={confirmed}
              value={draft[key]}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [key]: event.target.value }))
              }
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 10,
              }}
            />
          </label>
        ))}
        <label style={{ display: "grid", gap: 4, fontSize: ".875rem" }}>
          Gender (optional)
          <select
            disabled={confirmed}
            value={draft.gender}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, gender: event.target.value }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: 10,
            }}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: 12 }}>
          {error}
        </p>
      )}
      {confirmed ? (
        <p role="status" style={{ color: "#15803d", marginTop: 12 }}>
          Member details confirmed. You can review and sign your agreements.
          <button
            type="button"
            onClick={() => {
              setConfirmed(false);
              onReset?.();
            }}
            style={{ marginLeft: 12, textDecoration: "underline" }}
          >
            Edit details
          </button>
        </p>
      ) : (
        <button
          type="submit"
          className="button button--primary"
          style={{ marginTop: 16 }}
        >
          Confirm member details
        </button>
      )}
    </form>
  );
}
