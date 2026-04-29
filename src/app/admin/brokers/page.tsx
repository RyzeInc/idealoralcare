import { DistributionAdmin } from '@/components/admin/DistributionAdmin';
import { Breadcrumbs } from '@/components/admin/ui';

export default function DistributionPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Distribution' }]} />
      <DistributionAdmin />
    </div>
  );
}
