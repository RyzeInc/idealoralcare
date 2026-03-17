// @vitest-environment jsdom
/**
 * ClaimInvitePage — Component Tests
 *
 * Tests the invite-claim page that dependents use to link their Clerk account
 * to a pre-created memberProfile.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({ get: (key: string) => (key === "token" ? "test-invite-token-abc" : null) })),
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement("a", { href, ...rest }, children),
}));

// Mutable mock state for @clerk/nextjs
let mockClerkState = { isLoaded: true, isSignedIn: false };
vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(() => mockClerkState),
}));

// Mutable mock state for Convex hooks
let mockInvite: any = undefined;
const mockClaimProfile = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockInvite),
  useMutation: vi.fn(() => mockClaimProfile),
}));

// Mock the generated Convex API
vi.mock("@/convex/_generated/api", () => ({
  api: {
    enrollment: {
      dependents: {
        getProfileByInviteToken: "enrollment.dependents.getProfileByInviteToken",
        claimDependentProfile: "enrollment.dependents.claimDependentProfile",
      },
    },
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  CheckCircle: () => React.createElement("span", { "data-testid": "icon-check" }),
  AlertCircle: () => React.createElement("span", { "data-testid": "icon-alert" }),
  Loader2: () => React.createElement("span", { "data-testid": "icon-loader" }),
  HeartPulse: () => React.createElement("span", { "data-testid": "icon-heart" }),
}));

import ClaimInvitePage from "../page";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClerkState = { isLoaded: true, isSignedIn: false };
  mockInvite = undefined;
  mockClaimProfile.mockResolvedValue({ success: true, memberId: "MBR001" });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClaimInvitePage", () => {
  // -------------------------------------------------------------------------
  // Loading / initial states
  // -------------------------------------------------------------------------

  test("shows loading state while Clerk auth is not yet loaded", async () => {
    mockClerkState = { isLoaded: false, isSignedIn: false };
    mockInvite = undefined;

    render(<ClaimInvitePage />);

    // Should show a loader or nothing interactive yet (not the invite UI)
    expect(screen.queryByRole("button", { name: /Accept/i })).not.toBeInTheDocument();
  });

  test("shows loading state while invite query is in-flight (undefined)", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = undefined;

    render(<ClaimInvitePage />);

    // Page should be in loading / non-interactive state
    expect(screen.queryByText(/You're invited/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Invalid / expired token
  // -------------------------------------------------------------------------

  test("shows invalid-token message when invite is null (not found)", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = null;

    render(<ClaimInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid or Expired Invite/i)).toBeInTheDocument();
    });
  });

  test("shows a link back to dashboard on invalid token", async () => {
    mockInvite = null;

    render(<ClaimInvitePage />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Go to Dashboard/i });
      expect(link).toHaveAttribute("href", "/health/dashboard");
    });
  });

  // -------------------------------------------------------------------------
  // Unauthenticated user with valid invite
  // -------------------------------------------------------------------------

  test("shows invite welcome message when user is not signed in and invite is valid", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/You're invited/i)).toBeInTheDocument();
    });
  });

  test("shows the primary member's name in the invite message", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
    });
  });

  test("shows Create Account and Sign In links for unauthenticated users", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Create Account/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Sign In/i })).toBeInTheDocument();
    });
  });

  test("Sign In link includes the return URL with the invite token", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: false };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => {
      const signInLink = screen.getByRole("link", { name: /Sign In/i });
      expect(signInLink.getAttribute("href")).toContain("claim-invite");
      expect(signInLink.getAttribute("href")).toContain("test-invite-token-abc");
    });
  });

  // -------------------------------------------------------------------------
  // Authenticated user claiming the invite
  // -------------------------------------------------------------------------

  test("shows 'Accept & Get Access' button for authenticated + valid invite", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: true };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Accept & Get Access/i })).toBeInTheDocument();
    });
  });

  test("calls claimDependentProfile with the correct token when Accept is clicked", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: true };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => screen.getByRole("button", { name: /Accept & Get Access/i }));

    await userEvent.click(screen.getByRole("button", { name: /Accept & Get Access/i }));

    await waitFor(() => {
      expect(mockClaimProfile).toHaveBeenCalledWith({ inviteToken: "test-invite-token-abc" });
    });
  });

  test("shows success message after successful claim", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: true };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };

    render(<ClaimInvitePage />);

    await waitFor(() => screen.getByRole("button", { name: /Accept & Get Access/i }));
    await userEvent.click(screen.getByRole("button", { name: /Accept & Get Access/i }));

    await waitFor(() => {
      expect(screen.getByText(/You're all set/i)).toBeInTheDocument();
    });
  });

  test("shows error message when claimDependentProfile throws", async () => {
    mockClerkState = { isLoaded: true, isSignedIn: true };
    mockInvite = {
      _id: "profile_dep1",
      firstName: "Kid",
      lastName: "Doe",
      inviteStatus: "pending",
      primaryMemberName: "Jane Doe",
    };
    mockClaimProfile.mockRejectedValueOnce(new Error("This invite has already been used"));

    render(<ClaimInvitePage />);

    await waitFor(() => screen.getByRole("button", { name: /Accept & Get Access/i }));
    await userEvent.click(screen.getByRole("button", { name: /Accept & Get Access/i }));

    await waitFor(() => {
      expect(screen.getByText(/This invite has already been used/i)).toBeInTheDocument();
    });
  });
});
