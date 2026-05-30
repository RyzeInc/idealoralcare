"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Smile, Heart } from "lucide-react";

function PlanCard({
  href,
  imageSrc,
  imageAlt,
  headerGradient,
  icon,
  title,
  description,
  bullets,
  bulletColor,
  startingPrice,
  priceColor,
  priceBg,
  priceBorder,
  btnBg,
}: {
  href: string;
  imageSrc: string;
  imageAlt: string;
  headerGradient: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
  bulletColor: string;
  startingPrice: string;
  priceColor: string;
  priceBg: string;
  priceBorder: string;
  btnBg: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "rgba(255,255,255,0.97)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: hovered
            ? "0 28px 70px rgba(0,0,0,0.3)"
            : "0 20px 60px rgba(0,0,0,0.25)",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "pointer",
          height: "100%",
        }}
      >
        {/* Photo header */}
        <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            style={{ objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: headerGradient,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icon}
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.1rem",
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {title}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem" }}>
          <p
            style={{
              color: "#374151",
              fontSize: "0.95rem",
              lineHeight: 1.65,
              marginBottom: "1.25rem",
            }}
          >
            {description}
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {bullets.map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#374151",
                  fontSize: "0.875rem",
                }}
              >
                <span
                  style={{
                    color: bulletColor,
                    fontWeight: 700,
                    fontSize: "1rem",
                  }}
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: priceBg,
              borderRadius: 12,
              padding: "0.875rem 1.125rem",
              border: `1px solid ${priceBorder}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: priceColor,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Starting at
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {startingPrice}
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#64748b",
                  }}
                >
                  /mo
                </span>
              </div>
            </div>
            <div
              style={{
                background: btnBg,
                color: "#fff",
                borderRadius: 8,
                padding: "0.5rem 1rem",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Explore →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function LandingCards() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1.5rem",
        width: "100%",
        maxWidth: 780,
      }}
    >
      <PlanCard
        href="/health"
        imageSrc="/newideal/site-files/pinky-swear.png"
        imageAlt="Oral Care Savings"
        headerGradient="linear-gradient(150deg, rgba(13,148,136,0.82) 0%, rgba(6,182,212,0.7) 100%)"
        icon={<Smile size={22} color="white" />}
        title="Oral Savings Plans"
        description="20–60% off dental, vision, and hearing services at 100,000+ providers nationwide. No waiting periods. No insurance hassles."
        bullets={[
          "Dental savings — cleanings, fillings, crowns",
          "Vision — exams, glasses, contacts",
          "Hearing — exams & hearing aids",
        ]}
        bulletColor="#0d9488"
        startingPrice="$14.99"
        priceColor="#0d9488"
        priceBg="linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)"
        priceBorder="#99f6e4"
        btnBg="#0d9488"
      />
      <PlanCard
        href="/newideal"
        imageSrc="/newideal/site-files/happy-family.png"
        imageAlt="Essentials Plan"
        headerGradient="linear-gradient(150deg, rgba(12,74,110,0.82) 0%, rgba(3,105,161,0.7) 100%)"
        icon={<Heart size={22} color="white" />}
        title="Essentials Bundle"
        description="Telehealth, pharmacy savings, lab work, mental wellness, and oral care — all in one simple monthly membership."
        bullets={[
          "Lyric Telehealth — 24/7 doctor access",
          "RxValet — prescription savings",
          "Balance for Life — mental wellness",
        ]}
        bulletColor="#0369a1"
        startingPrice="$57.95"
        priceColor="#0369a1"
        priceBg="linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)"
        priceBorder="#bae6fd"
        btnBg="#0369a1"
      />
    </div>
  );
}
