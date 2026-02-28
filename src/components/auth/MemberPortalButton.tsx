"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { User } from "lucide-react";
import UserMenu from "./UserMenu";

/**
 * MEMBER PORTAL BUTTON
 *
 * Smart nav button shown on every page that adapts to auth state:
 *   - Not loaded:  renders a ghost placeholder (avoids layout shift)
 *   - Signed out:  "Member Portal" button → /health/sign-in
 *   - Signed in:   UserMenu avatar + dropdown → dashboard / logout
 */
export default function MemberPortalButton() {
  const { isSignedIn, isLoaded } = useAuth();

  // Render a fixed-width placeholder while Clerk hydrates to prevent layout shift
  if (!isLoaded) {
    return (
      <div
        style={{
          width: "128px",
          height: "36px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.08)",
        }}
      />
    );
  }

  if (isSignedIn) {
    return <UserMenu />;
  }

  return (
    <Link
      href="/health/sign-in"
      className="button button--glass"
      style={{
        padding: "8px 16px",
        fontSize: "0.875rem",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        textDecoration: "none",
      }}
    >
      <User size={16} />
      Member Portal
    </Link>
  );
}
