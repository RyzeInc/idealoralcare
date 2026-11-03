import '../health/health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { IdealHealthFooter } from '@/components/health/NexusHealthFooter';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';
import { Suspense } from 'react';
import { ReferralCapture } from '@/components/health/ReferralCapture';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { readPublicSite } from '@/lib/site-server';

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const site = await readPublicSite(siteSlug);
  if (!site || site._id === 'pending' || site.status !== 'active') return {};
  const origin = site.domain ? `https://${site.domain}` : 'https://www.getidealoh.com';
  const url = `${origin}/${encodeURIComponent(siteSlug)}`;
  const description = site.branding?.heroSubtext || `Explore ${site.name} membership plans and member services.`;
  const images = site.branding?.logoUrl ? [{ url: new URL(site.branding.logoUrl, origin).href, alt: site.name }] : [];
  return {
    title: site.name, description, metadataBase: new URL(origin), alternates: { canonical: url },
    openGraph: { title: site.name, siteName: site.name, description, url, images },
    twitter: { title: site.name, description, images: images.map(image => image.url) },
    ...(site.branding?.faviconUrl ? { icons: { icon: site.branding.faviconUrl } } : {}),
  };
}

export default async function SiteSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const site = await readPublicSite(siteSlug);
  // A newly prepared brand stays out of public sales until staff activate it.
  // The legacy resolver's synthetic default must not create a public tenant.
  if (!site || site._id === 'pending' || site.status !== 'active') notFound();

  return (
    <SiteThemeProvider defaultSlug={siteSlug}>
      <CartProvider key={siteSlug} storageNamespace={siteSlug}>
        <>
          <Suspense fallback={null}><ReferralCapture /></Suspense>
          <HealthFlowBackground />
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              {children}
            </div>
            <IdealHealthFooter />
          </div>
        </>
      </CartProvider>
    </SiteThemeProvider>
  );
}
