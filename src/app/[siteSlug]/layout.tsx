import '../health/health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { IdealHealthFooter } from '@/components/health/NexusHealthFooter';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';
import { Suspense } from 'react';
import { ReferralCapture } from '@/components/health/ReferralCapture';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { notFound } from 'next/navigation';

export default async function SiteSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? '');
  const site = await convex.query(api.hierarchy.resolveSiteBySlug, { slug: siteSlug });
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
