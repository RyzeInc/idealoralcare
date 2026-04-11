import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/health/dashboard/",
          "/health/checkout/",
          "/health/manage-plans/",
          "/health/sign-in/",
          "/health/sign-up/",
          "/health/sso-callback/",
          "/health/forgot-password/",
          "/health/claim-invite/",
          "/admin/",
          "/api/",
          "/debug/",
          "/bootstrap/",
        ],
      },
    ],
    sitemap: "https://getidealoh.com/sitemap.xml",
  };
}
