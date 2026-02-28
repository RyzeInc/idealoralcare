"use client";

import Image from "next/image";
import Link from "next/link";

export function NexusHealthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#ffffff", color: "#1e293b", borderTop: "1px solid #e2e8f0" }} className="w-full text-sm">

      {/* Main columns — logo lives here as first column */}
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "2.5rem", alignItems: "start" }}>

          {/* Logo column */}
          <div>
            <Image
              src="/ideal-health-logo.png"
              alt="Ideal Health"
              width={140}
              height={48}
              style={{ objectFit: "contain", marginBottom: "0" }}
            />
          </div>

          {/* Get in Touch */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Get in Touch
            </p>
            <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: "1.6" }}>
              <p style={{ margin: "0 0 0.125rem 0" }}>Customer Service line:</p>
              <a href="tel:8018200010" style={{ color: "#0f172a", fontWeight: 600, textDecoration: "none", display: "block", marginBottom: "0.625rem" }}>
                801-820-0010
              </a>
              <p style={{ margin: "0 0 0.125rem 0" }}>Email:</p>
              <a href="mailto:info@getidealhealth.com" style={{ color: "#0066CC", textDecoration: "none", fontWeight: 500 }}>
                info@getidealhealth.com
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

          {/* Locations */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Locations
            </p>
            <div style={{ fontSize: "0.8125rem", color: "#475569", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ lineHeight: "1.5" }}>
                <p style={{ fontWeight: 600, color: "#0f172a", margin: "0 0 0.125rem 0" }}>Northeast Office</p>
                <p style={{ margin: 0 }}>116 S. Main St</p>
                <p style={{ margin: 0 }}>Wallingford CT 06492</p>
              </div>
              <div style={{ lineHeight: "1.5" }}>
                <p style={{ fontWeight: 600, color: "#0f172a", margin: "0 0 0.125rem 0" }}>Southern Office</p>
                <p style={{ margin: 0 }}>800 S Gay St STE 700</p>
                <p style={{ margin: 0 }}>Knoxville TN 37929</p>
              </div>
              <div style={{ lineHeight: "1.5" }}>
                <p style={{ fontWeight: 600, color: "#0f172a", margin: "0 0 0.125rem 0" }}>Texas Office</p>
                <p style={{ margin: 0 }}>1200 E Ridge Rd STE 1</p>
                <p style={{ margin: 0 }}>McAllen TX 78503</p>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0066CC", marginBottom: "0.75rem", marginTop: 0 }}>
              Terms and Conditions
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Terms and Conditions", href: "/health/terms" },
                { label: "Privacy Policy", href: "/health/privacy" },
                { label: "Program Disclosures", href: "/health/terms" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} style={{ color: "#475569", textDecoration: "none", fontSize: "0.8125rem" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#0066CC")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #e2e8f0" }} />

      {/* Disclaimer + copyright */}
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" style={{ paddingTop: "1.5rem", paddingBottom: "2rem" }}>
        <p style={{ fontSize: "0.6875rem", color: "#94a3b8", lineHeight: "1.7", maxWidth: "860px", marginBottom: "1.25rem" }}>
          <strong style={{ color: "#64748b" }}>DISCLAIMER:</strong> Ideal Health programs are not intended to replace insurance and do not meet minimum creditable coverage requirements under the ACA or Massachusetts M.G.L. c. 111M and 956 CMR 5.00. Discounts are available only from participating providers and vary by provider. Members are responsible for paying discounted charges directly to providers. These are discount plans, not insurance.
        </p>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          © {currentYear} Ideal. All rights reserved.
        </p>
      </div>

    </footer>
  );
}

// Legacy alias
export { NexusHealthFooter as IdealHealthFooter };
