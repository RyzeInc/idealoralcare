import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Packages that must NOT be bundled by webpack on the server.
  // ssh2 ships a native .node binary (sshcrypto.node) that webpack cannot parse;
  // listing it here makes Next require() it at runtime instead.
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],

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
            // ⚠️  CRITICAL — DO NOT REMOVE OR TIGHTEN THE downloads DIRECTIVE  ⚠️
            //
            // Downloading scan reports is a CORE product feature.  The SmileScan
            // iframe lives at https://selfcheck.toothlens.com (a third-party
            // origin).  Chromium enforces Permissions-Policy on cross-origin
            // iframes, so if you restrict `downloads` to only `(self)` the
            // iframe silently loses the ability to initiate downloads and members
            // will see download-fail errors with no obvious cause.
            //
            // Rule: `downloads` MUST always list both `self` AND
            //        "https://selfcheck.toothlens.com"
            //
            // History: v0.9.9 (2026-04-22) accidentally set downloads=(self)
            // which broke report downloads for all members.  Fixed in v0.9.13.
            value: 'camera=*, microphone=*, geolocation=(), browsing-topics=(), downloads=(self "https://selfcheck.toothlens.com")',
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
              // API connections: Convex + Clerk (dev + prod) + Stripe + Clerk telemetry
              "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://clerk.getidealoh.com https://api.stripe.com https://r.stripe.com https://www.google-analytics.com https://analytics.google.com https://clerk-telemetry.com",
              // Iframes: Clerk + Stripe + Cloudflare + Toothlens SmileScan + Ryze telemedicine
              // ⚠️  CRITICAL: selfcheck.toothlens.com MUST remain in frame-src.
              // Removing it breaks the SmileScan iframe (core product feature).
              "frame-src https://*.clerk.accounts.dev https://clerk.getidealoh.com https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://selfcheck.toothlens.com https://ryze.telemedsimplified.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withAnalyzer(nextConfig);
