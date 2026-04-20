"use client";

/**
 * SSO CALLBACK
 *
 * Handles the OAuth redirect after Apple / Facebook / Google sign-in or sign-up.
 * Clerk's AuthenticateWithRedirectCallback completes the flow and then redirects
 * to the `redirectUrlComplete` that was set when initiating the OAuth request.
 */

import { useState, useEffect } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SSOCallbackPage() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        gap: "1rem",
        padding: "2rem",
      }}
    >
      {!timedOut ? (
        <>
          <Loader
            size={32}
            style={{ animation: "spin 1s linear infinite", color: "#0066CC" }}
          />
          <p style={{ color: "#64748b", fontSize: "1rem", margin: 0 }}>
            Completing sign-in…
          </p>
        </>
      ) : (
        <div
          style={{
            maxWidth: "420px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <AlertCircle size={40} color="#dc2626" />
          <h2 style={{ color: "#0f172a", fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Sign-in is taking longer than expected
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0, lineHeight: 1.6 }}>
            The authentication service may be having trouble completing your request.
            Please try signing in again.
          </p>
          <Link
            href="/health/sign-in"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
              background: "#0066CC",
              color: "#fff",
              borderRadius: "12px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              marginTop: "0.5rem",
            }}
          >
            Back to Sign In
          </Link>
        </div>
      )}

      {/* Clerk completes the OAuth handshake and redirects */}
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/health/dashboard"
        signUpFallbackRedirectUrl="/health/dashboard"
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
