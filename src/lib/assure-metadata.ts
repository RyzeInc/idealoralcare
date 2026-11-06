import type { Metadata } from "next";
import { ASSURE_PAGES, ASSURE_URL, ASSURE_DESCRIPTION } from "./assure-content";
export function assureMetadata(
  path: string,
  override?: { title: string; description: string },
): Metadata {
  const key = path.replace(/^\//, "");
  const data = override ??
    ASSURE_PAGES[key] ?? {
      title: "AssureVantage",
      description: ASSURE_DESCRIPTION,
    };
  const url = new URL(`/assurevantage/${key}`, ASSURE_URL).href;
  const privatePage =
    /^(sign-in|sign-up|forgot-password|sso-callback|dashboard|manage-plans|claim-invite|program-checkout|checkout|program-success|enroll)(\/|$)/.test(
      key,
    );
  return {
    title: `${data.title} | AssureVantage`,
    description: data.description,
    metadataBase: new URL(ASSURE_URL),
    alternates: { canonical: url },
    icons: {
      icon: "/brands/assurevantage/logo.png",
      apple: "/brands/assurevantage/logo.png",
    },
    robots: privatePage ? { index: false, follow: false } : undefined,
    openGraph: {
      title: `${data.title} | AssureVantage`,
      siteName: "AssureVantage",
      description: data.description,
      url,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(data.title)}`,
          width: 1200,
          height: 630,
          alt: "AssureVantage",
        },
      ],
    },
    twitter: {
      title: `${data.title} | AssureVantage`,
      description: data.description,
      images: [`/api/og?title=${encodeURIComponent(data.title)}`],
    },
  };
}
