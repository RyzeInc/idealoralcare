// @vitest-environment jsdom
/**
 * FamilySection — Component Tests
 *
 * Tests the dashboard component that lets primary members manage their
 * dependent family members.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---------------------------------------------------------------------------
// Mock Convex hooks
// ---------------------------------------------------------------------------
const mockAddDependent = vi.fn();
const mockRemoveDependent = vi.fn();
const mockResendInvite = vi.fn();
let mockDependents: any[] | undefined = [];

vi.mock("@clerk/nextjs", () => ({
  useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: true })),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockDependents),
  useMutation: vi.fn((fn: string) => {
    if (String(fn).includes("addDependent") || fn === "addDependent") return mockAddDependent;
    if (String(fn).includes("removeDependent") || fn === "removeDependent") return mockRemoveDependent;
    if (String(fn).includes("resendDependentInvite") || fn === "resendDependentInvite") return mockResendInvite;
    return vi.fn();
  }),
  skipToken: Symbol("skipToken"),
}));

// Mock the generated Convex API
vi.mock("@/convex/_generated/api", () => ({
  api: {
    enrollment: {
      dependents: {
        getMyDependents: "enrollment.dependents.getMyDependents",
        addDependent: "enrollment.dependents.addDependent",
        removeDependent: "enrollment.dependents.removeDependent",
        resendDependentInvite: "enrollment.dependents.resendDependentInvite",
      },
    },
  },
}));

// Mock lucide-react icons to avoid the SVG rendering complexity
vi.mock("lucide-react", () => ({
  Users: () => React.createElement("span", { "data-testid": "icon-users" }),
  UserPlus: () => React.createElement("span", { "data-testid": "icon-user-plus" }),
  Mail: () => React.createElement("span", { "data-testid": "icon-mail" }),
  Trash2: () => React.createElement("span", { "data-testid": "icon-trash" }),
  RefreshCw: () => React.createElement("span", { "data-testid": "icon-refresh" }),
  CheckCircle: () => React.createElement("span", { "data-testid": "icon-check" }),
  Clock: () => React.createElement("span", { "data-testid": "icon-clock" }),
}));

import FamilySection from "../FamilySection";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDependents = [];
  mockAddDependent.mockResolvedValue({});
  mockRemoveDependent.mockResolvedValue({});
  mockResendInvite.mockResolvedValue({});

  // Reset the mock implementation to ensure correct function routing
  vi.mocked(useMutation).mockImplementation((fn: any) => {
    const fnStr = String(fn);
    if (fnStr.includes("removeDependent")) return mockRemoveDependent;
    if (fnStr.includes("resendDependentInvite")) return mockResendInvite;
    return mockAddDependent; // addDependent
  });

  vi.mocked(useQuery).mockImplementation(() => mockDependents);

  // Default Clerk state: loaded and signed in
  vi.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: true } as any);
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSection() {
  return render(<FamilySection />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FamilySection", () => {
  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  test("shows a loading indicator while dependents are undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined as any);

    renderSection();

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("empty state", () => {
    test("shows empty state message when there are no dependents", () => {
      mockDependents = [];
      renderSection();

      expect(screen.getByText(/No family members added yet/i)).toBeInTheDocument();
    });

    test("shows 'Add Family Member' button in empty state", () => {
      mockDependents = [];
      renderSection();

      expect(
        screen.getByRole("button", { name: /Add Family Member/i })
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Dependent list
  // -------------------------------------------------------------------------

  describe("dependent list", () => {
    const MOCK_DEPENDENTS = [
      {
        _id: "prof_dep1",
        firstName: "Kid",
        lastName: "Doe",
        relationship: "child",
        invitedEmail: "kid@test.com",
        inviteStatus: "pending",
      },
      {
        _id: "prof_dep2",
        firstName: "Spouse",
        lastName: "Doe",
        relationship: "spouse",
        invitedEmail: "spouse@test.com",
        inviteStatus: "claimed",
      },
    ];

    beforeEach(() => {
      mockDependents = MOCK_DEPENDENTS;
    });

    test("renders each dependent's name", () => {
      renderSection();

      expect(screen.getByText("Kid Doe")).toBeInTheDocument();
      expect(screen.getByText("Spouse Doe")).toBeInTheDocument();
    });

    test("renders 'Invite Pending' badge for unclaimed dependents", () => {
      renderSection();

      expect(screen.getByText("Invite Pending")).toBeInTheDocument();
    });

    test("renders 'Active' badge for claimed dependents", () => {
      renderSection();

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    test("renders the dependent's email", () => {
      renderSection();

      expect(screen.getByText("kid@test.com")).toBeInTheDocument();
    });

    test("shows 'Resend' button only for unclaimed dependents", () => {
      renderSection();

      // Kid is pending → should have Resend; Spouse is claimed → no Resend
      const resendBtns = screen.getAllByRole("button", { name: /Resend/i });
      expect(resendBtns).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Add form
  // -------------------------------------------------------------------------

  describe("add form", () => {
    test("clicking top 'Add Member' button reveals the add form", async () => {
      mockDependents = [{ _id: "d1", firstName: "Existing", lastName: "Dep", relationship: "child", inviteStatus: "pending" }];
      renderSection();

      await userEvent.click(screen.getByRole("button", { name: /Add Member/i }));

      // After clicking, the form opens — verify first-name field appears
      expect(screen.getByPlaceholderText("Jane")).toBeInTheDocument();
    });

    test("validates required fields on submit", async () => {
      renderSection();

      // Open form from empty state
      await userEvent.click(screen.getByRole("button", { name: /Add Family Member/i }));

      // Click 'Add Member' submit button without filling in data
      await userEvent.click(screen.getByRole("button", { name: /^Add Member$/i }));

      // Multiple "Required" spans appear (firstName, lastName) — use getAllByText
      const errorSpans = screen.getAllByText(/Required/i);
      expect(errorSpans.length).toBeGreaterThan(0);
      expect(mockAddDependent).not.toHaveBeenCalled();
    });

    test("validates email format", async () => {
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: /Add Family Member/i }));

      await userEvent.type(screen.getByPlaceholderText("Jane"), "Kid");
      await userEvent.type(screen.getByPlaceholderText("Doe"), "Doe");
      await userEvent.type(screen.getByPlaceholderText("jane@example.com"), "not-valid");

      await userEvent.click(screen.getByRole("button", { name: /^Add Member$/i }));

      expect(screen.getByText(/Valid email required/i)).toBeInTheDocument();
    });

    test("calls addDependent mutation with trimmed values on valid submit", async () => {
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: /Add Family Member/i }));

      await userEvent.type(screen.getByPlaceholderText("Jane"), "  Kid  ");
      await userEvent.type(screen.getByPlaceholderText("Doe"), "  Doe  ");
      await userEvent.type(screen.getByPlaceholderText("jane@example.com"), "kid@test.com");

      await userEvent.click(screen.getByRole("button", { name: /^Add Member$/i }));

      await waitFor(() => {
        expect(mockAddDependent).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "Kid",
            lastName: "Doe",
            email: "kid@test.com",
          })
        );
      });
    });

    test("hides the form after successful add", async () => {
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: /Add Family Member/i }));

      await userEvent.type(screen.getByPlaceholderText("Jane"), "Kid");
      await userEvent.type(screen.getByPlaceholderText("Doe"), "Doe");
      await userEvent.type(screen.getByPlaceholderText("jane@example.com"), "kid@test.com");

      await userEvent.click(screen.getByRole("button", { name: /^Add Member$/i }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Jane")).not.toBeInTheDocument();
      });
    });

    test("shows an error message when addDependent throws", async () => {
      mockAddDependent.mockRejectedValueOnce(new Error("No active member profile"));

      renderSection();
      await userEvent.click(screen.getByRole("button", { name: /Add Family Member/i }));

      await userEvent.type(screen.getByPlaceholderText("Jane"), "Kid");
      await userEvent.type(screen.getByPlaceholderText("Doe"), "Doe");
      await userEvent.type(screen.getByPlaceholderText("jane@example.com"), "kid@test.com");

      await userEvent.click(screen.getByRole("button", { name: /^Add Member$/i }));

      await waitFor(() => {
        expect(screen.getByText(/No active member profile/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Remove flow
  // -------------------------------------------------------------------------

  describe("remove flow", () => {
    beforeEach(() => {
      mockDependents = [
        {
          _id: "prof_dep1",
          firstName: "Kid",
          lastName: "Doe",
          relationship: "child",
          invitedEmail: "kid@test.com",
          inviteStatus: "pending",
        },
      ];
    });

    test("clicking the trash icon shows a confirmation dialog", async () => {
      renderSection();

      const trashBtn = screen.getByTitle(/Remove family member/i);
      await userEvent.click(trashBtn);

      // Confirm and Cancel buttons should appear
      expect(screen.getByRole("button", { name: /Confirm/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    });

    test("clicking Cancel hides the confirmation dialog", async () => {
      renderSection();

      await userEvent.click(screen.getByTitle(/Remove family member/i));
      await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(screen.queryByRole("button", { name: /Confirm/i })).not.toBeInTheDocument();
    });

    test("clicking Confirm calls removeDependent with the correct ID", async () => {
      renderSection();

      await userEvent.click(screen.getByTitle(/Remove family member/i));
      await userEvent.click(screen.getByRole("button", { name: /Confirm/i }));

      await waitFor(() => {
        expect(mockRemoveDependent).toHaveBeenCalledWith(
          expect.objectContaining({ dependentProfileId: "prof_dep1" })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Resend invite
  // -------------------------------------------------------------------------

  describe("resend invite", () => {
    beforeEach(() => {
      mockDependents = [
        {
          _id: "prof_dep1",
          firstName: "Kid",
          lastName: "Doe",
          relationship: "child",
          invitedEmail: "kid@test.com",
          inviteStatus: "pending",
        },
      ];
    });

    test("clicking Resend calls resendDependentInvite", async () => {
      renderSection();

      await userEvent.click(screen.getByRole("button", { name: /Resend/i }));

      await waitFor(() => {
        expect(mockResendInvite).toHaveBeenCalledWith(
          expect.objectContaining({ dependentProfileId: "prof_dep1" })
        );
      });
    });
  });
});
