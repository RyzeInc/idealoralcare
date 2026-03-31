"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import UserMenu from "./UserMenu";

/**
 * MEMBER PORTAL BUTTON
 *
 * Smart nav button shown on every page that adapts to auth state:
 *   - Signed out:  "Member Portal" button → /health/sign-in
 *   - Signed in:   UserMenu avatar + dropdown → dashboard / logout
 *
 * Only renders on client after hydration to avoid SSR/client mismatch
 */
export default function MemberPortalButton() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render anything until client mounts to avoid hydration mismatch
  if (!isMounted || !isLoaded) {
    return null;
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
