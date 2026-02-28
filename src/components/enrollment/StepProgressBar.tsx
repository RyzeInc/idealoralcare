"use client";

/**
 * STEP PROGRESS BAR
 * Horizontal step indicator rendered in the sticky enrollment shell header.
 * Accepts flowSteps from EnrollmentWizard so it reflects the current flow.
 */

import { useEnrollmentStep } from "@/components/enrollment/EnrollmentProvider";
import { Check } from "lucide-react";

interface FlowStep {
  key: string;
  label: string;
  sublabel?: string;
}

interface StepProgressBarProps {
  flowSteps?: FlowStep[];
}

const DEFAULT_STEPS: FlowStep[] = [
  { key: "eligibility", label: "Eligibility" },
  { key: "plans", label: "Plans" },
  { key: "personal-info", label: "Your Info" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
];

export function StepProgressBar({ flowSteps }: StepProgressBarProps) {
  const { currentStep, completedSteps, goToStep } = useEnrollmentStep();
  const steps = flowSteps ?? DEFAULT_STEPS;

  return (
    <nav className="enrollment-stepper" aria-label="Enrollment steps">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.key as any);
        const isCurrent = step.key === currentStep;
        const isClickable = isCompleted || isCurrent;

        let modifiers = "";
        if (isCompleted) modifiers += " enrollment-stepper__step--done";
        if (isCurrent) modifiers += " enrollment-stepper__step--active";
        if (isClickable) modifiers += " enrollment-stepper__step--clickable";

        return (
          <div
            key={step.key}
            className={`enrollment-stepper__step${modifiers}`}
            onClick={() => isClickable && goToStep(step.key as any)}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => e.key === "Enter" && isClickable && goToStep(step.key as any)}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="enrollment-stepper__node">
              {isCompleted ? <Check size={14} strokeWidth={3} /> : <span>{index + 1}</span>}
            </div>
            <div className="enrollment-stepper__labels">
              <span className="enrollment-stepper__label">{step.label}</span>
              {step.sublabel && (
                <span className="enrollment-stepper__sublabel">{step.sublabel}</span>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

