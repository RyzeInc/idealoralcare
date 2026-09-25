"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteThemeOptional } from "@/components/providers/SiteThemeProvider";

export function NexusHealthFooter() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const basePath = `/${pathname.split("/")[1]}`;
  const themeCtx = useSiteThemeOptional();
  const site = themeCtx?.site;

  const logoSrc = site?.branding?.logoUrl || "/ideal-oral-health-logo.png";
  const logoWidth = site?.branding?.logoWidth || 110;
  const logoAlt = site?.name || "Oral Health Plan";
  const brandName = site?.name || "Ideal Oral Health";
  const supportEmail = site?.enrollmentDefaults?.supportEmail || "support@getidealoh.com";
  const supportPhone = site?.enrollmentDefaults?.supportPhone || "(844) 679-9367";
  const footerText = site?.branding?.footerText;

  const resourceLinks = [
    { label: "Blog", href: `${basePath}/blog` },
    { label: "FAQ", href: `${basePath}/faq` },
    { label: "How It Works", href: `${basePath}/how-it-works` },
    { label: "Terms and Conditions", href: `${basePath}/terms` },
    { label: "Privacy Policy", href: `${basePath}/privacy` },
    { label: "Program Disclosures", href: `${basePath}/terms` },
  ];

  return (
    <footer style={{ backgroundColor: "#ffffff", color: "#1e293b", borderTop: "1px solid #e2e8f0" }} className="w-full text-sm">

      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto repeat(4, 1fr)", gap: "2rem", alignItems: "start" }}>

          {/* Logo column */}
          <div style={{ minWidth: 0 }}>
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={logoWidth}
              height={53}
              style={{ objectFit: "contain", height: "auto", maxHeight: "52px", width: logoWidth }}
            />
          </div>

          {/* Get in Touch */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Get in Touch
            </p>
            <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: "1.6" }}>
              {supportPhone && (
                <>
                  <p style={{ margin: "0 0 0.125rem 0" }}>Customer Service line:</p>
                  <a
                    href={`tel:${supportPhone.replace(/\D/g, "")}`}
                    style={{ color: "#0f172a", fontWeight: 600, textDecoration: "none", display: "block", marginBottom: "0.625rem" }}
                  >
                    {supportPhone}
                  </a>
                </>
              )}
              <p style={{ margin: "0 0 0.125rem 0" }}>Email:</p>
              <a href={`mailto:${supportEmail}`} style={{ color: "#0066CC", textDecoration: "none", fontWeight: 500 }}>
                {supportEmail}
              </a>
            </div>
          </div>

          {/* Hours of Operation */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Hours of Operation
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0 }}>Mon - Fri: 9am - 6pm</p>
          </div>

          {/* Locations / custom footer text */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Locations
            </p>
            {footerText ? (
              <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0, lineHeight: "1.5" }}>{footerText}</p>
            ) : (
              <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: "1.5" }}>
                <p style={{ margin: 0 }}>5500 N Military Trail</p>
                <p style={{ margin: 0 }}>Jupiter, FL 33458</p>
              </div>
            )}
          </div>

          {/* Resources */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Resources
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {resourceLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    style={{ color: "#475569", textDecoration: "none", fontSize: "0.8125rem" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#0066CC")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0" }} />

      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" style={{ paddingTop: "1.25rem", paddingBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: "1.7", maxWidth: "860px", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 700 }}>THIS PLAN IS NOT INSURANCE and is not intended to replace health insurance.</span>{" "}
          This plan does not meet the minimum creditable coverage requirements under M.G.L. c.111M and 956 CMR 5.00. This plan is not a Qualified Health Plan under the Affordable Care Act. The range of discounts will vary depending on the type of provider and service. The plan does not pay providers directly. Plan members must pay for all services but will receive a discount from participating providers. A written list of participating providers is available upon request. You may cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) and receive a full refund. Discount Plan Organization and administrator: Careington International Corporation, 7400 Gaylord Parkway, Frisco, TX 75034; phone 800-441-0380. This plan is not available in Vermont or Washington.
        </p>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          © {currentYear} {brandName}. All rights reserved.
        </p>
      </div>

    </footer>
  );
}

// Legacy alias
export { NexusHealthFooter as IdealHealthFooter };
