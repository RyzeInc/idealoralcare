"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function AdminRedirectPage() {
  const router = useRouter();
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    const checkRedirect = async () => {
      try {
        const res = await fetch("/api/admin/post-signup-check");
        if (res.ok) {
          const { redirect } = await res.json();
          if (redirect) {
            router.push(redirect);
            return;
          }
        }
      } catch (err) {
        console.error("Redirect check error:", err);
      }

      // Fallback to dashboard
      router.push("/health/dashboard");
    };

    checkRedirect();
  }, [isLoaded, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Setting up your account...</p>
      </div>
    </div>
  );
}
