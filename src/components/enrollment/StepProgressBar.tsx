"use client";

/**
 * STEP PROGRESS BAR
 * Visual indicator for enrollment wizard progress
 * Crunch-style horizontal step indicator
 */

import { useEnrollmentStep } from "@/components/enrollment/EnrollmentProvider";
import { Check, AlertCircle } from "lucide-react";
import styles from "./step-progress-bar.module.css";

const STEPS = [
  { key: "eligibility", label: "Eligibility", order: 1 },
  { key: "plans", label: "Plans", order: 2 },
  { key: "personal-info", label: "Personal Info", order: 3 },
  { key: "payment", label: "Payment", order: 4 },
  { key: "review", label: "Review", order: 5 },
  { key: "confirmation", label: "Confirmation", order: 6 },
];

interface StepProgressBarProps {
  /** Optional: show only specific steps */
  visibleSteps?: string[];
}

export function StepProgressBar({ visibleSteps }: StepProgressBarProps) {
  const { currentStep, completedSteps, goToStep } = useEnrollmentStep();

  const displaySteps = visibleSteps
    ? STEPS.filter((s) => visibleSteps.includes(s.key))
    : STEPS;

  const handleStepClick = (stepKey: string) => {
    // Allow clicking back to completed steps
    if (completedSteps.includes(stepKey) || stepKey === currentStep) {
      goToStep(stepKey as any);
    }
  };

  return (
    <div className={styles.progressContainer}>
      <div className={styles.stepsWrapper}>
        {displaySteps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = step.key === currentStep;
          const isClickable = isCompleted || isCurrent;

          return (
            <div key={step.key} className={styles.stepWrapper}>
              {/* Connection line (except last step) */}
              {index < displaySteps.length - 1 && (
                <div
                  className={`${styles.line} ${
                    isCompleted ? styles.lineCompleted : ""
                  }`}
                />
              )}

              {/* Step dot and label */}
              <div className={styles.stepContainer}>
                <button
                  onClick={() => handleStepClick(step.key)}
                  disabled={!isClickable}
                  className={`${styles.step} ${
                    isCompleted ? styles.stepCompleted : ""
                  } ${isCurrent ? styles.stepCurrent : ""}`}
                  title={isClickable ? `Go to ${step.label}` : step.label}
                >
                  {isCompleted ? (
                    <Check size={16} className={styles.icon} />
                  ) : isCurrent ? (
                    <div className={styles.stepNumber}>{step.order}</div>
                  ) : (
                    <div className={styles.stepNumber}>{step.order}</div>
                  )}
                </button>

                {/* Label */}
                <div className={styles.label}>
                  <div
                    className={`${styles.labelText} ${
                      isCurrent ? styles.labelCurrent : ""
                    }`}
                  >
                    {step.label}
                  </div>
                  {isCurrent && <div className={styles.labelSubtext}>Current</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact variant for mobile (vertical)
 */
export function StepProgressBarCompact() {
  const { currentStep, completedSteps, goToStep } = useEnrollmentStep();

  return (
    <div className={styles.compactContainer}>
      <div className={styles.compactWrapper}>
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = step.key === currentStep;
          const isClickable = isCompleted || isCurrent;

          return (
            <button
              key={step.key}
              onClick={() => (isClickable ? goToStep(step.key as any) : null)}
              disabled={!isClickable}
              className={`${styles.compactStep} ${
                isCompleted ? styles.compactStepCompleted : ""
              } ${isCurrent ? styles.compactStepCurrent : ""}`}
              title={step.label}
            >
              {isCompleted ? (
                <Check size={14} />
              ) : (
                <span className={styles.compactNumber}>{step.order}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
