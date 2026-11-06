"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { SiteThemeProvider } from "@/components/providers/SiteThemeProvider";
import { CartProvider } from "@/lib/health-plans";
import { ReferralCapture } from "@/components/health/ReferralCapture";
import { PlatformNav } from "./PlatformNav";
import { CustomerError } from "./CustomerError";
import { AssureFooter } from "./AssureFooter";
import styles from "./experience.module.css";
import { CartTransferRestore } from "./CartTransferRestore";
export function AssureShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <SiteThemeProvider defaultSlug="assurevantage">
      <CartProvider storageNamespace="assurevantage">
        <div className={styles.site} data-assure-experience>
          <a className={styles.skip} href="#assure-content">
            Skip to content
          </a>
          <Suspense fallback={null}>
            <ReferralCapture />
            <PlatformNav />
          </Suspense>
          <div id="assure-content" tabIndex={-1}>
            <CustomerError key={pathname}>
              <Suspense fallback={<p role="status">Loading your cart…</p>}>
                <CartTransferRestore>{children}</CartTransferRestore>
              </Suspense>
            </CustomerError>
          </div>
          <Suspense fallback={null}>
            <AssureFooter />
          </Suspense>
        </div>
      </CartProvider>
    </SiteThemeProvider>
  );
}
