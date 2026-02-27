import './health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { NexusHealthFooter } from '@/components/health/NexusHealthFooter';

export const metadata = {
  title: 'Nexus Health | Modern Health Plans Made Simple',
  description: 'Nexus Health by Ryze - Two powerful health plans: Wellness GLP Plan for weight management with GLP-1 medications, and Oral Health Plan with Toothlens AI scanning and teledentistry.',
  icons: {
    icon: '/nexus-health-logo.png',
    shortcut: '/nexus-health-logo.png',
    apple: '/nexus-health-logo.png',
  },
};

/**
 * HEALTH CATALOG LAYOUT
 *
 * PUBLIC ACCESS - No authentication required for browsing
 * Users can browse all pages and add items to cart
 * Authentication only required at /health/checkout
 *
 * Flow:
 * 1. Browse /health/* pages (public)
 * 2. Add items to cart (persisted locally)
 * 3. Click checkout
 * 4. Create account + pay (Clerk signup + Stripe)
 * 5. Redirect to /health/dashboard (authenticated)
 */
export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HealthFlowBackground />
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          {children}
        </div>
        <NexusHealthFooter />
      </div>
    </>
  );
}
