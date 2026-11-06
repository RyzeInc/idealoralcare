"use client";
import { SiteMarketing } from "@/components/health/SiteMarketing";
import {
  SERVICE_MARKETING_FEATURES,
  type SiteMarketingFeature,
} from "@/convex/lib/siteMarketing";
import Image from "next/image";
import { AssureLink as Link } from "./AssureLink";
import styles from "./experience.module.css";
export function AssureFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div>
            <Link href="/" className={styles.footerLogo}>
              <Image
                src="/brands/assurevantage/logo.png"
                alt="AssureVantage home"
                width={185}
                height={62}
              />
            </Link>
            <p>
              Better access. Greater value.
              <br />
              More peace of mind.
            </p>
            <p>
              Everyday care, mental wellbeing and oral health, with membership
              options that fit your life.
            </p>
          </div>
          <div>
            <h2>Explore benefits</h2>
            <ul>
              {[
                ["virtual-care", "Virtual care"],
                ["labs", "Lab services"],
                ["pharmacy", "Prescription savings"],
                ["balance-for-life", "Mental wellbeing"],
                ["oralcare", "Oral Care"],
              ].map(([path, label]) => (
                <FooterPromotion
                  key={path}
                  feature={
                    path === "balance-for-life"
                      ? undefined
                      : SERVICE_MARKETING_FEATURES[
                          path as keyof typeof SERVICE_MARKETING_FEATURES
                        ]
                  }
                >
                  <li>
                    <Link href={`/assurevantage/${path}`}>{label}</Link>
                  </li>
                </FooterPromotion>
              ))}
            </ul>
          </div>
          <div>
            <h2>Membership</h2>
            <ul>
              {[
                ["program-plans", "Memberships & pricing"],
                ["how-it-works", "How it works"],
                ["faq", "Questions & answers"],
                ["dashboard", "Member portal"],
                ["help", "Get help"],
              ].map(([path, label]) => (
                <FooterPromotion
                  key={path}
                  feature={
                    path === "faq"
                      ? "faq"
                      : path === "how-it-works"
                        ? "howItWorks"
                        : undefined
                  }
                >
                  <li>
                    <Link href={`/assurevantage/${path}`}>{label}</Link>
                  </li>
                </FooterPromotion>
              ))}
            </ul>
          </div>
          <div>
            <h2>Connect with us</h2>
            <ul>
              <li>
                <Link href="/assurevantage/about">About AssureVantage</Link>
              </li>
              <li>
                <Link href="/assurevantage/for-employers">
                  Employers & brokers
                </Link>
              </li>
              <SiteMarketing feature="blog">
                <li>
                  <Link href="/assurevantage/blog">Guides & resources</Link>
                </li>
              </SiteMarketing>
              <li>
                <a href="mailto:info@assurevantage.com">
                  info@assurevantage.com
                </a>
              </li>
            </ul>
            <p>
              Membership support has a dedicated contact for each program.{" "}
              <Link href="/assurevantage/help">Find your support team →</Link>
            </p>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>
            These membership programs are not insurance and do not replace
            medical or dental insurance. Included services, discounts,
            eligibility and effective dates follow your selected membership’s
            terms. Oral Care is a separate purchase from Essentials; Balance for
            Life is included with Essentials.
          </p>
          <div className={styles.footerLegal}>
            <Link href="/assurevantage/terms">Terms & disclosures</Link>
            <Link href="/assurevantage/privacy">Privacy</Link>
          </div>
          <p>
            © {new Date().getFullYear()} AssureVantage. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterPromotion({
  feature,
  children,
}: {
  feature?: SiteMarketingFeature;
  children: React.ReactNode;
}) {
  return feature ? (
    <SiteMarketing feature={feature}>{children}</SiteMarketing>
  ) : (
    <>{children}</>
  );
}
