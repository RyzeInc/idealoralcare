"use client";

import { useSearchParams } from "next/navigation";
import { EnrollmentProvider } from "@/components/enrollment/EnrollmentProvider";
import { EnrollmentWizard } from "@/components/enrollment/EnrollmentWizard";
import HealthHeader from "@/components/health/HealthHeader";
import HealthFlowBackground from "@/components/background/HealthFlowBackground";

/**
 * ENROLLMENT PAGE
 *
 * Supports query parameters for different enrollment types:
 * - ?broker=CODE или ?agent=CODE - Broker-assisted enrollment with agent code
 * - ?group=CODE - Group enrollment with group code
 * - No params - DTC individual enrollment
 */

export default function EnrollmentPage() {
  const searchParams = useSearchParams();
  const brokerCode = searchParams.get("broker") || searchParams.get("agent");
  const groupCode = searchParams.get("group");

  return (
    <div>
      <HealthFlowBackground />
      <HealthHeader />
      <main className="enrollment-main">
        <EnrollmentProvider brokerCode={brokerCode || undefined} groupCode={groupCode || undefined}>
          <EnrollmentWizard />
        </EnrollmentProvider>
      </main>
    </div>
  );
}
