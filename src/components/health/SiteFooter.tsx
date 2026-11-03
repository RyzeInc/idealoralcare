"use client";

import { usePathname } from "next/navigation";
import { IdealHealthFooter } from "./NexusHealthFooter";
import { NewIdealFooter } from "@/components/newideal/NewIdealChrome";

/** Membership program pages use program disclosures; oral pages keep their network disclosures. */
export function SiteFooter() {
  const pathname = usePathname();
  const programs = /^\/assurevantage\/(essentials|balance-for-life|oralcare|program-plans|program-checkout|program-success)(?:\/|$)/.test(pathname);
  return programs ? <NewIdealFooter inSiteShell /> : <IdealHealthFooter />;
}
