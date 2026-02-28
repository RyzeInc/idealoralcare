"use client";

/**
 * SSO CALLBACK
 *
 * Handles the OAuth redirect after Apple / Facebook / Google sign-in or sign-up.
 * Clerk's AuthenticateWithRedirectCallback completes the flow and then redirects
 * to the `redirectUrlComplete` that was set when initiating the OAuth request.
 */

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader } from "lucide-react";

export default function SSOCallbackPage() {
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
      }}
    >
      <Loader
        size={32}
        style={{ animation: "spin 1s linear infinite", color: "#0066CC" }}
      />
      <p style={{ color: "#64748b", fontSize: "1rem", margin: 0 }}>
        Completing sign-in…
      </p>

      {/* Clerk completes the OAuth handshake and redirects */}
      <AuthenticateWithRedirectCallback />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
