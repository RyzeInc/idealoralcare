import { isAssureHost } from "@/components/assurevantage/PublicDomainFrame";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
export default async function EmployerSignIn() {
  if (await isAssureHost())
    redirect("/assurevantage/sign-in?redirect_url=%2Femployer%2Fupload");
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
