'use client';
import { use } from 'react';
import { BrokerWorkspace } from '@/components/admin/brokers/BrokerWorkspace';
import type { Id } from '@/convex/_generated/dataModel';

export default function BrokerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BrokerWorkspace key={id} partnerId={id as Id<'distributionPartners'>} />;
}
