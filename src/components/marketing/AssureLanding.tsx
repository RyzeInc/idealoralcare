import { AssureHome } from "@/components/assurevantage/MarketingPages";
import { ASSURE_DESCRIPTION, ASSURE_URL } from "@/lib/assure-content";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
export const metadata = {
  title: "AssureVantage | Everyday care & wellbeing",
  description: ASSURE_DESCRIPTION,
  metadataBase: new URL(ASSURE_URL),
  alternates: { canonical: ASSURE_URL },
  icons: {
    icon: "/brands/assurevantage/logo.png",
    apple: "/brands/assurevantage/logo.png",
  },
  openGraph: {
    title: "AssureVantage | Everyday care & wellbeing",
    siteName: "AssureVantage",
    description: ASSURE_DESCRIPTION,
    url: ASSURE_URL,
    images: [
      { url: "/api/og", width: 1200, height: 630, alt: "AssureVantage" },
    ],
  },
  twitter: {
    title: "AssureVantage | Everyday care & wellbeing",
    description: ASSURE_DESCRIPTION,
    images: ["/api/og"],
  },
};
export default function AssureLanding() {
  return (
    <>
      <WebSiteJsonLd name="AssureVantage" url={ASSURE_URL} />
      <AssureHome />
    </>
  );
}
