"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EnrollmentProvider } from "@/components/enrollment/EnrollmentProvider";
import { EnrollmentWizard } from "@/components/enrollment/EnrollmentWizard";
import { FlowSelector, EnrollmentFlow } from "@/components/enrollment/FlowSelector";
import HealthHeader from "@/components/health/HealthHeader";
import HealthFlowBackground from "@/components/background/HealthFlowBackground";

const VALID_FLOWS: EnrollmentFlow[] = ["dtc", "broker-individual", "broker-group-member", "broker-group-employer"];

function EnrollmentContent() {
  const searchParams = useSearchParams();
  const flowParam = searchParams.get("flow");
  const brokerCode = searchParams.get("broker") || searchParams.get("agent") || undefined;
  const groupCode = searchParams.get("group") || undefined;

  const flowType = VALID_FLOWS.includes(flowParam as EnrollmentFlow)
    ? (flowParam as EnrollmentFlow)
    : null;

  return (
    <>
      {!flowType ? (
        <FlowSelector />
      ) : (
        <EnrollmentProvider
          flowType={flowType}
          brokerCode={brokerCode}
          groupCode={groupCode}
        >
          <EnrollmentWizard />
        </EnrollmentProvider>
      )}
    </>
  );
}

export default function EnrollmentPage() {
  return (
    <div className="enrollment-page">
      <HealthFlowBackground />
      <HealthHeader />
      <main>
        <Suspense fallback={<div>Loading enrollment...</div>}>
          <EnrollmentContent />
        </Suspense>
      </main>
    </div>
  );
}
