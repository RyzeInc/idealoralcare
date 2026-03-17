// @vitest-environment jsdom
/**
 * DependentsStep — Component Tests
 *
 * Tests the enrollment wizard step that collects family member information.
 * The EnrollmentProvider context is mocked so the step can be rendered in isolation.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DependentsStep } from "../DependentsStep";

// ---------------------------------------------------------------------------
// Mock the CSS module (no-op in tests)
// ---------------------------------------------------------------------------
vi.mock("../steps.module.css", () => ({
  default: new Proxy(
    {},
    { get: (_t, key) => String(key) }
  ),
}));

// ---------------------------------------------------------------------------
// Mock the EnrollmentProvider context
// ---------------------------------------------------------------------------
const mockNextStep = vi.fn();
const mockDispatch = vi.fn();

let mockState: any = {
  personalInfo: { dependents: [] },
  selectedPlans: {},
  subtotal: 1499,
};

vi.mock("@/components/enrollment/EnrollmentProvider", () => ({
  useEnrollmentStep: () => ({ nextStep: mockNextStep }),
  useEnrollment: () => ({ state: mockState, dispatch: mockDispatch }),
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockState = {
    personalInfo: { dependents: [] },
    selectedPlans: {},
    subtotal: 1499,
  };
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStep() {
  return render(<DependentsStep />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DependentsStep", () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe("rendering", () => {
    test("renders the step heading", () => {
      renderStep();
      expect(screen.getByText(/Add Family Members/i)).toBeInTheDocument();
    });

    test("renders the 'Add Dependent' button when no dependents exist", () => {
      renderStep();
      // Should have some button to add a dependent
      const addBtn = screen.getByRole("button", { name: /add/i });
      expect(addBtn).toBeInTheDocument();
    });

    test("renders a 'Skip this step' button for users without dependents", () => {
      renderStep();
      const skipBtn = screen.getByRole("button", { name: /Continue without dependents/i });
      expect(skipBtn).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Adding a dependent
  // -------------------------------------------------------------------------

  describe("adding a dependent", () => {
    test("shows input fields after clicking the add button", async () => {
      renderStep();

      const addBtn = screen.getByRole("button", { name: /add/i });
      await userEvent.click(addBtn);

      expect(screen.getByPlaceholderText(/First name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Last name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/their@email.com/i)).toBeInTheDocument();
    });

    test("shows a relationship dropdown after clicking add", async () => {
      renderStep();

      const addBtn = screen.getByRole("button", { name: /add/i });
      await userEvent.click(addBtn);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("shows a remove button for each dependent card", async () => {
      renderStep();

      const addBtn = screen.getByRole("button", { name: /add/i });
      await userEvent.click(addBtn);

      const removeBtn = screen.getByRole("button", { name: /remove dependent/i });
      expect(removeBtn).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe("form validation", () => {
    test("disables Continue button when required fields are empty", async () => {
      renderStep();
      await userEvent.click(screen.getByRole("button", { name: /add/i }));
      // After adding a blank dependent, Continue should be disabled
      const primaryBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim().startsWith("Continue") &&
                 !btn.textContent?.includes("without")
      );
      expect(primaryBtn).toBeDefined();
      expect(primaryBtn).toBeDisabled();
    });

    test("does not call nextStep when email validation fails", async () => {
      // Fill in name fields (enables the button) but use an invalid email
      // so validate() fails and nextStep is never called
      renderStep();
      await userEvent.click(screen.getByRole("button", { name: /add/i }));
      await userEvent.type(screen.getByPlaceholderText(/First name/i), "Kid");
      await userEvent.type(screen.getByPlaceholderText(/Last name/i), "Doe");
      await userEvent.type(screen.getByPlaceholderText(/their@email.com/i), "not-an-email");
      const primaryBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim().startsWith("Continue") &&
                 !btn.textContent?.includes("without")
      );
      await userEvent.click(primaryBtn!);
      expect(mockNextStep).not.toHaveBeenCalled();
    });

    test("shows 'Invalid email' for a malformed email address", async () => {
      renderStep();
      await userEvent.click(screen.getByRole("button", { name: /add/i }));

      // Fill in name but bad email
      await userEvent.type(screen.getByPlaceholderText(/First name/i), "Kid");
      await userEvent.type(screen.getByPlaceholderText(/Last name/i), "Doe");
      await userEvent.type(screen.getByPlaceholderText(/their@email.com/i), "not-an-email");

      const primaryBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim().startsWith("Continue") &&
                 !btn.textContent?.includes("without")
      );
      await userEvent.click(primaryBtn!);

      expect(screen.getByText(/Invalid email/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Skip
  // -------------------------------------------------------------------------

  describe("skip flow", () => {
    test("clicking 'Continue without dependents' dispatches SET_DEPENDENTS with empty array", async () => {
      renderStep();

      await userEvent.click(screen.getByRole("button", { name: /Continue without dependents/i }));

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_DEPENDENTS",
        payload: [],
      });
    });

    test("clicking 'Continue without dependents' calls nextStep", async () => {
      renderStep();

      await userEvent.click(screen.getByRole("button", { name: /Continue without dependents/i }));

      expect(mockNextStep).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Successful submit
  // -------------------------------------------------------------------------

  describe("successful submission", () => {
    test("dispatches SET_DEPENDENTS with the filled-in dependent data", async () => {
      renderStep();

      await userEvent.click(screen.getByRole("button", { name: /add/i }));

      await userEvent.type(screen.getByPlaceholderText(/First name/i), "Spouse");
      await userEvent.type(screen.getByPlaceholderText(/Last name/i), "Doe");
      await userEvent.type(screen.getByPlaceholderText(/their@email.com/i), "spouse@test.com");

      const primaryBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim().startsWith("Continue") &&
                 !btn.textContent?.includes("without")
      );
      await userEvent.click(primaryBtn!);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_DEPENDENTS",
          payload: expect.arrayContaining([
            expect.objectContaining({
              firstName: "Spouse",
              lastName: "Doe",
              email: "spouse@test.com",
            }),
          ]),
        })
      );
    });

    test("calls nextStep after successful submission", async () => {
      renderStep();

      await userEvent.click(screen.getByRole("button", { name: /add/i }));

      await userEvent.type(screen.getByPlaceholderText(/First name/i), "Spouse");
      await userEvent.type(screen.getByPlaceholderText(/Last name/i), "Doe");
      await userEvent.type(screen.getByPlaceholderText(/their@email.com/i), "spouse@test.com");

      const primaryBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim().startsWith("Continue") &&
                 !btn.textContent?.includes("without")
      );
      await userEvent.click(primaryBtn!);

      expect(mockNextStep).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Pricing preview
  // -------------------------------------------------------------------------

  describe("pricing preview", () => {
    test("shows a dependent pricing row after adding a family member", async () => {
      renderStep();
      // The pricing section only appears after at least one dependent is added
      await userEvent.click(screen.getByRole("button", { name: /add/i }));
      // With monthly_card default, per-dep price is $9.99 (999 cents)
      // There will be multiple $9.99 elements (dep row + total), so use getAllByText
      const priceEls = screen.getAllByText((text) => text.includes("9.99"));
      expect(priceEls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
