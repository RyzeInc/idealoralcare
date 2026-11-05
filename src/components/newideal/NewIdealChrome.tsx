"use client";

import { ProgramLink as Link, useProgramBrand } from "@/components/newideal/ProgramLink";
import Image from "next/image";


import { NewIdealHeader as LegacyHeader, NewIdealFooter as LegacyFooter } from "@/components/marketing/legacy-ideal/NewIdealChrome";

export function NewIdealHeader() {
  const brand = useProgramBrand();
  if (!brand.mainBrand) return <LegacyHeader />;
  return null;
}

export function NewIdealFooter({ inSiteShell = false }: { inSiteShell?: boolean } = {}) {
  const brand = useProgramBrand();
  if (!brand.mainBrand) return <LegacyFooter />;
  if (!inSiteShell) return null;
  return (
    <footer
      style={{
        background: "#0f172a",
        color: "rgba(255,255,255,0.7)",
        padding: "40px 0 24px",
        marginTop: 40,
      }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr",
          gap: 32,
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Image
              src={brand.logo}
              alt={brand.name}
              width={140}
              height={47}
              style={{ background: "white", padding: 4, borderRadius: 4 }}
            />
            <span
              style={{ color: "white", fontWeight: 700, fontSize: "1.05rem" }}
            >
              {brand.name}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
            Affordable healthcare access — telehealth, pharmacy savings,
            labs, mental wellness, and dental discounts.
          </p>
        </div>

        <div>
          <h4
            style={{
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginTop: 0,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Programs
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem", lineHeight: 1.9 }}>
            <li><Link href="/newideal/essentials" style={{ color: "inherit", textDecoration: "none" }}>Essentials Plan</Link></li>
            <li><Link href="/newideal/oralcare" style={{ color: "inherit", textDecoration: "none" }}>Oral Care</Link></li>
            <li><Link href="/newideal/balance-for-life" style={{ color: "inherit", textDecoration: "none" }}>Balance for Life</Link></li>
            <li><Link href="/newideal/plans" style={{ color: "inherit", textDecoration: "none" }}>Pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4
            style={{
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginTop: 0,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Important
          </h4>
          <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "white" }}>This is not insurance.</strong>{" "}
            Programs provide access to discounted healthcare services and
            a network of providers.
          </p>
        </div>
      </div>

      <div
        className="container"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 18,
          fontSize: "0.8125rem",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>© {new Date().getFullYear()} {brand.name}. All rights reserved.</span>
        <span>Powered by {brand.name}</span>
      </div>
    </footer>
  );
}
