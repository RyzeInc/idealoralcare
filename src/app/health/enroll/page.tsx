import { Metadata } from 'next';
import { EnrollmentProvider } from '@/components/enrollment/EnrollmentProvider';
import { EnrollmentWizard } from '@/components/enrollment/EnrollmentWizard';
import { HealthHeader } from '@/components/health/HealthHeader';
import { HealthFlowBackground } from '@/components/health/HealthFlowBackground';

export const metadata: Metadata = {
  title: 'Enroll | Ryze Health',
  description: 'Start your health plan enrollment with Ryze Health',
};

export default function EnrollmentPage() {
  return (
    <div>
      <HealthFlowBackground />
      <HealthHeader />
      <main className="enrollment-main">
        <EnrollmentProvider>
          <EnrollmentWizard />
        </EnrollmentProvider>
      </main>
    </div>
  );
}
