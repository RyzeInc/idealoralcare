"use client";
import { SignIn } from "@clerk/nextjs";
export default function EmployerSignIn() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6">
      <h1 className="text-2xl font-semibold">Employer eligibility uploads</h1>
      <SignIn
        routing="path"
        path="/employer/sign-in"
        signUpUrl="/employer/sign-up"
        forceRedirectUrl="/employer/upload"
      />
    </main>
  );
}
