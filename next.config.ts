import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "getidealoh.com",
        "www.getidealoh.com",
        // Remove *.app.github.dev in production deploys
        ...(process.env.NODE_ENV === "development" ? ["*.app.github.dev"] : []),
      ],
    },
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=*, microphone=*, geolocation=(), browsing-topics=(), downloads=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Clerk (dev + prod custom domain) + Stripe + Cloudflare
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.getidealoh.com https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com",
              // Inline styles + Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: Clerk CDN + QR code generator + general
              "img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com https://*.clerk.accounts.dev https://api.qrserver.com",
              // Fonts: local + Google Fonts CDN
              "font-src 'self' data: https://fonts.gstatic.com",
              // API connections: Convex + Clerk (dev + prod) + Stripe
              "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://clerk.getidealoh.com https://api.stripe.com https://r.stripe.com https://www.google-analytics.com https://analytics.google.com",
              // Iframes: Clerk + Stripe + Cloudflare + Toothlens SmileScan
              "frame-src https://*.clerk.accounts.dev https://clerk.getidealoh.com https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://selfcheck.toothlens.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withAnalyzer(nextConfig);
