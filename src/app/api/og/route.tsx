import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { domainSite } from "@/lib/site-domains";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (domainSite(request.nextUrl.hostname)) return assureImage(request);
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Ideal Health";
  const description =
    searchParams.get("description") ||
    "Affordable oral health plans with AI scanning, 24/7 teledentistry, and dental discount network access.";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #166534 0%, #064e3b 60%, #022c22 100%)",
        padding: "60px 80px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#86efac",
            letterSpacing: "-0.02em",
          }}
        >
          IDEAL HEALTH
        </div>
      </div>
      <div
        style={{
          fontSize: "52px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          marginBottom: "20px",
          maxWidth: "900px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "24px",
          color: "#bbf7d0",
          lineHeight: 1.5,
          maxWidth: "800px",
        }}
      >
        {description}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "40px",
          gap: "24px",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            color: "#86efac",
            padding: "8px 20px",
            border: "2px solid #86efac",
            borderRadius: "99px",
          }}
        >
          AI Oral Scanning
        </div>
        <div
          style={{
            fontSize: "16px",
            color: "#86efac",
            padding: "8px 20px",
            border: "2px solid #86efac",
            borderRadius: "99px",
          }}
        >
          24/7 Teledentistry
        </div>
        <div
          style={{
            fontSize: "16px",
            color: "#86efac",
            padding: "8px 20px",
            border: "2px solid #86efac",
            borderRadius: "99px",
          }}
        >
          Dental Discount Network
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          right: "60px",
          fontSize: "18px",
          color: "#6ee7b7",
        }}
      >
        getidealoh.com
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}

function assureImage(request: NextRequest) {
  const title = (
    request.nextUrl.searchParams.get("title") ||
    "Everyday care. More peace of mind."
  ).slice(0, 100);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "70px 80px",
        background: "#f4f7f4",
        fontFamily: "sans-serif",
        color: "#153947",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 38,
          fontWeight: 700,
          color: "#006b68",
        }}
      >
        AssureVantage
      </div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 60 ? 58 : 72,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -2,
          maxWidth: 1000,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 25,
          color: "#465f68",
          borderTop: "2px solid #d6e2e1",
          paddingTop: 28,
        }}
      >
        <span>Medical care · Mental wellbeing · Oral health</span>
        <span>assurevantage.com</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
