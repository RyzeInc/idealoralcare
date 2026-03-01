"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { EnrollmentProvider } from "@/components/enrollment/EnrollmentProvider";
import { EnrollmentWizard } from "@/components/enrollment/EnrollmentWizard";
import { FlowSelector, EnrollmentFlow } from "@/components/enrollment/FlowSelector";
import { BrokerSelector } from "@/components/enrollment/BrokerSelector";
import HealthHeader from "@/components/health/HealthHeader";
import HealthFlowBackground from "@/components/background/HealthFlowBackground";
import type { Doc } from "@/convex/_generated/dataModel";

const VALID_FLOWS: EnrollmentFlow[] = ["dtc", "broker-individual", "broker-group-member", "broker-group-employer"];
const BROKER_FLOWS: EnrollmentFlow[] = ["broker-individual", "broker-group-member", "broker-group-employer"];

function EnrollmentContent() {
  const searchParams = useSearchParams();
  const flowParam = searchParams.get("flow");
  const brokerCode = searchParams.get("broker") || searchParams.get("agent") || undefined;
  const groupCode = searchParams.get("group") || undefined;

  const flowType = VALID_FLOWS.includes(flowParam as EnrollmentFlow)
    ? (flowParam as EnrollmentFlow)
    : null;

  const [selectedBroker, setSelectedBroker] = useState<Doc<'adminUsers'> | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const handleBrokerSelect = (broker: Doc<'adminUsers'>) => {
    setSelectedBroker(broker);
    setShowWizard(true);
  };

  const handleSkipBroker = () => {
    setShowWizard(true);
  };

  return (
    <>
      {!flowType ? (
        <FlowSelector />
      ) : !showWizard && BROKER_FLOWS.includes(flowType) ? (
        <BrokerSelector
          flowType={flowType}
          onSelectBroker={handleBrokerSelect}
          onSkip={handleSkipBroker}
        />
      ) : (
        <EnrollmentProvider
          flowType={flowType}
          brokerCode={brokerCode}
          groupCode={groupCode}
        >
          {selectedBroker && (
            <div style={{ display: 'none' }}>
              {/* Store selected broker - will be dispatched in EnrollmentWizard */}
              <input
                type="hidden"
                data-broker-id={selectedBroker._id}
                data-broker-clerkUserId={selectedBroker.clerkUserId}
              />
            </div>
          )}
          <EnrollmentWizard selectedBroker={selectedBroker} />
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
