'use client';

import { ToastProvider } from '@/components/admin/ui/Toast';
import { AdminErrorBoundary } from '@/components/admin/ui/AdminErrorBoundary';

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminErrorBoundary>{children}</AdminErrorBoundary>
    </ToastProvider>
  );
}
