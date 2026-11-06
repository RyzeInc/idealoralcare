import { isAssureHost } from "@/components/assurevantage/PublicDomainFrame";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
export default async function EmployerSignUp() {
  if (await isAssureHost())
    redirect("/assurevantage/sign-up?redirect_url=%2Femployer%2Fupload");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6">
      <h1 className="text-2xl font-semibold">
        Create your employer upload account
      </h1>
      <p className="text-center text-sm text-slate-600">
        Use the email address approved by your Ideal contact.
      </p>
      <SignUp
        routing="path"
        path="/employer/sign-up"
        signInUrl="/employer/sign-in"
        forceRedirectUrl="/employer/upload"
      />
    </main>
  );
}
