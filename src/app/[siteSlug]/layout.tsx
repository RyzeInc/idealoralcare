import '../health/health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { IdealHealthFooter } from '@/components/health/NexusHealthFooter';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';

export default async function SiteSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;

  return (
    <SiteThemeProvider defaultSlug={siteSlug}>
      <CartProvider>
        <>
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
