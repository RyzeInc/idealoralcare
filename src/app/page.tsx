import { AssureShell } from "@/components/assurevantage/AssureShell";
import { headers } from "next/headers";
import IdealLanding, {
  metadata as idealMetadata,
} from "@/components/marketing/legacy-ideal/page";
import AssureLanding, {
  metadata as assureMetadata,
} from "@/components/marketing/AssureLanding";
import { domainSite } from "@/lib/site-domains";

async function isAssureDomain() {
  return Boolean(domainSite((await headers()).get("host")));
}

export async function generateMetadata() {
  return (await isAssureDomain()) ? assureMetadata : idealMetadata;
}

export default async function RootPage() {
  return (await isAssureDomain()) ? (
    <AssureShell>
      <AssureLanding />
    </AssureShell>
  ) : (
    <IdealLanding />
  );
}
