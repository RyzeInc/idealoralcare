import '@/app/health/health.css';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';

export const metadata = {
  title: 'New Ideal Health | Membership Programs',
  description:
    'New Ideal Health membership programs — telehealth, pharmacy savings, lab services, and mental wellness support.',
};

export default function NewIdealLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteThemeProvider defaultSlug="newideal">
      <CartProvider>
        <div className="flex flex-col min-h-screen">
          <div className="flex-grow">{children}</div>
        </div>
      </CartProvider>
    </SiteThemeProvider>
  );
}
