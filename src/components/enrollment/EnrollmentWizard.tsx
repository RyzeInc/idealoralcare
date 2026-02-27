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
import styles from './enrollment-wizard.module.css';

const STEPS = [
  { key: 'eligibility', component: EligibilityStep, label: 'Eligibility' },
  { key: 'plans', component: PlanSelectionStep, label: 'Plans' },
  { key: 'personal-info', component: PersonalInfoStep, label: 'Personal' },
  { key: 'payment', component: AccountPaymentStep, label: 'Payment' },
  { key: 'review', component: ReviewStep, label: 'Review' },
];

export function EnrollmentWizard() {
  const { state } = useEnrollment();
  const currentStep = state.currentStep;

  // Show confirmation page after enrollment is complete
  if (currentStep === 'confirmation') {
    return <ConfirmationPage />;
  }

  const stepIndex = STEPS.findIndex((step) => step.key === currentStep);
  const step = STEPS[stepIndex];
  const StepComponent = step?.component || EligibilityStep;

  return (
    <div className={styles.wizardContainer}>
      {/* Desktop Layout */}
      <div className={styles.desktopLayout}>
        {/* Left Column: Progress Bar + Step */}
        <div className={styles.stepColumn}>
          <StepProgressBar />
          <div className={styles.stepContent}>
            <StepComponent />
          </div>
        </div>

        {/* Right Column: Order Summary (Desktop Only) */}
        <aside className={styles.railColumn}>
          <OrderSummaryRail />
        </aside>
      </div>

      {/* Mobile Layout */}
      <div className={styles.mobileLayout}>
        <div className={styles.mobileProgressBar}>
          <StepProgressBar />
        </div>
        <div className={styles.mobileContent}>
          <StepComponent />
        </div>
        <div className={styles.mobileRail}>
          <OrderSummaryRail />
        </div>
      </div>
    </div>
  );
}
