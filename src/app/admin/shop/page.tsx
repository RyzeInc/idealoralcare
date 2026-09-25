import { ShopAdmin } from '@/components/admin/ShopAdmin';
import { Breadcrumbs } from '@/components/admin/ui';

export default function ShopPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Shop' }]} />
      <ShopAdmin />
    </div>
  );
}
