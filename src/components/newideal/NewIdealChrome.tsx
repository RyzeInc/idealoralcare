import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";

const NAV = [
  { href: "/newideal", label: "Overview" },
  { href: "/newideal/essentials", label: "Essentials" },
  { href: "/newideal/oralcare", label: "Oral Care" },
  { href: "/newideal/plans", label: "Plans & Pricing" },
];

export function NewIdealHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "14px 0",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          href="/newideal"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <Image
            src="/newideal/logo.png"
            alt="Ideal Health"
            width={56}
            height={56}
            priority
          />
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
          }}
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontSize: "0.9375rem",
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/newideal/plans"
            className="button button--primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
            }}
          >
            <ShoppingCart size={16} /> Enroll
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function NewIdealFooter() {
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
              src="/newideal/logo.png"
              alt="Ideal Health"
              width={36}
              height={36}
            />
            <span
              style={{ color: "white", fontWeight: 700, fontSize: "1.05rem" }}
            >
              Ideal Health
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
            Affordable healthcare access — telehealth, pharmacy savings,
            labs, mental wellness, and dental/vision/hearing discounts.
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
        <span>© {new Date().getFullYear()} Ideal Health. All rights reserved.</span>
        <span>Powered by Ideal Health</span>
      </div>
    </footer>
  );
}
