import { RepCodesAdmin } from '@/components/admin/RepCodesAdmin';
import { Breadcrumbs } from '@/components/admin/ui';

export default function RepCodesPage() {
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Rep Codes' }]} />
      <RepCodesAdmin />
    </div>
  );
}
