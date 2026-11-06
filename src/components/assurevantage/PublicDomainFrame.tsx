import { headers } from "next/headers";
import { domainSite } from "@/lib/site-domains";
import { AssureShell } from "./AssureShell";
export async function PublicDomainFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return domainSite((await headers()).get("host")) ? (
    <AssureShell>{children}</AssureShell>
  ) : (
    <>{children}</>
  );
}
export async function isAssureHost() {
  return !!domainSite((await headers()).get("host"));
}
