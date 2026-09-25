import { BrokerDirectory } from '@/components/admin/brokers/BrokerDirectory';
import { Breadcrumbs } from '@/components/admin/ui';

export default function BrokersPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Brokers' }]} />
      <BrokerDirectory />
    </div>
  );
}
