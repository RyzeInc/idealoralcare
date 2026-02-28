"use client";

import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

interface AuthGateProps {
  children: ReactNode;
  requireAuth?: boolean; // If true, show only when signed in. If false/undefined, show only when signed out
}

/**
 * Custom auth gate that replaces Clerk's SignedIn and SignedOut components
 * Usage:
 *   - <AuthGate requireAuth={true}>Content for signed in users</AuthGate>
 *   - <AuthGate>Content for signed out users</AuthGate>
 */
export default function AuthGate({ children, requireAuth = false }: AuthGateProps) {
  const { isSignedIn, isLoaded } = useAuth();

  // Don't render anything until Clerk is loaded
  if (!isLoaded) {
    return null;
  }

  // If requireAuth is true, show content only when signed in
  if (requireAuth) {
    return isSignedIn ? <>{children}</> : null;
  }

  // Otherwise, show content only when signed out
  return !isSignedIn ? <>{children}</> : null;
}
