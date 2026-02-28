'use client';

import { useEnrollment } from './EnrollmentProvider';
import { OrderSummaryRail } from './OrderSummaryRail';
import { StepProgressBar } from './StepProgressBar';
import { EligibilityStep } from './steps/EligibilityStep';
import { PlanSelectionStep } from './steps/PlanSelectionStep';
import { PersonalInfoStep } from './steps/PersonalInfoStep';
import { AccountPaymentStep } from './steps/AccountPaymentStep';
import { ReviewStep } from './steps/ReviewStep';
import { ConfirmationPage } from './ConfirmationPage';

interface FlowStep {
  key: string;
  label: string;
  sublabel?: string;
  component: React.ComponentType;
}

const FLOW_STEPS: Record<string, FlowStep[]> = {
  'dtc': [
    { key: 'eligibility', label: 'Eligibility', sublabel: 'ZIP code', component: EligibilityStep },
    { key: 'plans', label: 'Choose Plan', sublabel: 'Coverage', component: PlanSelectionStep },
    { key: 'personal-info', label: 'Your Info', sublabel: 'Details', component: PersonalInfoStep },
    { key: 'payment', label: 'Payment', sublabel: 'Billing', component: AccountPaymentStep },
    { key: 'review', label: 'Review', sublabel: 'Confirm', component: ReviewStep },
  ],
  'broker-individual': [
    { key: 'eligibility', label: 'Verify', sublabel: 'Agent code', component: EligibilityStep },
    { key: 'plans', label: 'Choose Plan', sublabel: 'Coverage', component: PlanSelectionStep },
    { key: 'personal-info', label: 'Your Info', sublabel: 'Details', component: PersonalInfoStep },
    { key: 'payment', label: 'Payment', sublabel: 'Billing', component: AccountPaymentStep },
    { key: 'review', label: 'Review', sublabel: 'Confirm', component: ReviewStep },
  ],
  'broker-group-member': [
    { key: 'eligibility', label: 'Group Code', sublabel: 'Verify', component: EligibilityStep },
    { key: 'plans', label: 'Choose Plan', sublabel: 'Coverage', component: PlanSelectionStep },
    { key: 'personal-info', label: 'Your Info', sublabel: 'Details', component: PersonalInfoStep },
    { key: 'payment', label: 'Payment', sublabel: 'Your share', component: AccountPaymentStep },
    { key: 'review', label: 'Review', sublabel: 'Confirm', component: ReviewStep },
  ],
  'broker-group-employer': [
    { key: 'eligibility', label: 'Group Code', sublabel: 'Verify', component: EligibilityStep },
    { key: 'plans', label: 'Choose Plan', sublabel: 'Coverage', component: PlanSelectionStep },
    { key: 'personal-info', label: 'Your Info', sublabel: 'Details', component: PersonalInfoStep },
    { key: 'payment', label: 'Billing', sublabel: 'Employer pays', component: AccountPaymentStep },
    { key: 'review', label: 'Review', sublabel: 'Confirm', component: ReviewStep },
  ],
};

export function EnrollmentWizard() {
  const { state } = useEnrollment();
  const currentStep = state.currentStep;
  const flowType = (state.flowType as string | undefined) || 'dtc';

  if (currentStep === 'confirmation') {
    return <ConfirmationPage />;
  }

  const flowSteps = FLOW_STEPS[flowType] ?? FLOW_STEPS['dtc'];
  const stepIndex = flowSteps.findIndex((s) => s.key === currentStep);
  const step = flowSteps[stepIndex] ?? flowSteps[0];
  const StepComponent = step.component;

  return (
    <div className="enrollment-shell">
      {/* Sticky horizontal stepper bar */}
      <div className="enrollment-shell__stepper-bar">
        <StepProgressBar flowSteps={flowSteps} />
      </div>

      {/* Two-column body */}
      <div className="enrollment-shell__body">
        <div className="enrollment-step-card">
          <StepComponent />
        </div>
        <aside>
          <div className="enroll-rail">
            <OrderSummaryRail />
          </div>
        </aside>
      </div>
    </div>
  );
}
