'use client';
import { Suspense } from 'react';
import { BrokerOnboardForm } from '@/components/admin/brokers/BrokerOnboardForm';

export default function OnboardBrokerPage() {
  return (
    <Suspense>
      <BrokerOnboardForm />
    </Suspense>
  );
}
