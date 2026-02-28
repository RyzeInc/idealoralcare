"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface AuthButtonProps {
  type: "signin" | "signup";
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom auth button that redirects to sign-in or sign-up pages
 * Replaces Clerk's SignInButton and SignUpButton
 */
export default function AuthButton({
  type,
  children,
  className,
  style,
}: AuthButtonProps) {
  const href = type === "signin" ? "/health/sign-in" : "/health/sign-up";
  const defaultLabel = type === "signin" ? "Sign In" : "Sign Up";

  return (
    <Link
      href={href}
      className={className}
      style={style}
    >
      {children || defaultLabel}
    </Link>
  );
}
