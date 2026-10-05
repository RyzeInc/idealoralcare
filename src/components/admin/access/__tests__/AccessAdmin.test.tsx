// @vitest-environment jsdom
/**
 * Smoke test: every tab of Access & Roles renders with realistic data, and
 * the person drawer and pack editor open, without the page crashing.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import React from "react";
import { getFunctionName } from "convex/server";
import { BUILT_IN_PACKS, PAGES } from "@/convex/lib/access/catalog";

const packs = BUILT_IN_PACKS.map((p, i) => ({
  ...p,
  _id: `pack_${i}`,
  _creationTime: 0,
  builtIn: true,
  createdAt: 0,
  updatedAt: 0,
  activeRoles: i,
  modified: p.key === "staff_support",
  locked: p.key === "owner",
}));
const roles = [
  { _id: "role_1", role: "program_manager", status: "active", partnerId: "p1", leaderId: null, groupId: null, label: null, title: null, description: "Program Manager — Summit PM", packs: [{ _id: "pack_11", key: "partner_leadership", name: "Partner leadership", archived: false }] },
  { _id: "role_2", role: "rep", status: "suspended", partnerId: "p2", leaderId: "l1", groupId: null, label: null, title: "Rep", description: "Rep — Harbor Agency", packs: [{ _id: "pack_12", key: "partner_agent", name: "Broker / rep — own book", archived: false }] },
];
const DATA: Record<string, unknown> = {
  "access/packs:listPacks": packs,
  "access/people:linkTargets": { partners: [{ _id: "p1", name: "Summit PM", type: "program_manager", status: "active" }], groups: [{ _id: "g1", name: "Acme", status: "active" }] },
  "access/people:listPeople": [
    { _id: "prof_1", name: "Pat Broker", email: "pat@summit.test", status: "active", signedIn: true, invite: null, isOwner: false, roles, updatedAt: 0 },
    { _id: "prof_2", name: "Ivy Invited", email: "ivy@acme.test", status: "invited", signedIn: false, invite: "expired", isOwner: false, roles: [], updatedAt: 0 },
  ],
  "access/people:getPerson": {
    profile: { _id: "prof_1", name: "Pat Broker", email: "pat@summit.test", phone: null, notes: null, status: "active", signedIn: true, invite: null, inviteExpiry: null, invitedAt: null, claimedAt: 1 },
    roles,
    permissions: ["partner.book", "partner.downline", "partner.groups", "partner.resources"],
    isOwner: false,
    isStaff: false,
    pages: PAGES.map((p) => ({ ...p, allowed: p.portal === "partner" })),
    isSelf: false,
  },
  "access/people:partnerPeople": [],
  "access/sync:syncStatus": { profiles: 2, notImported: { staff: 1, leaders: 0, contacts: 0, grants: 3 } },
};

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) => (args === "skip" ? undefined : DATA[getFunctionName(ref as never)]),
  useMutation: () => vi.fn(async () => null),
  useAction: () => vi.fn(async () => ({})),
}));

import { AccessAdmin } from "../AccessAdmin";

afterEach(cleanup);

describe("Access & Roles", () => {
  test("every tab renders, and people and packs open for editing", async () => {
    const user = userEvent.setup();
    render(<AccessAdmin />);
    expect(screen.getByText("Pat Broker")).toBeInTheDocument();
    expect(screen.getByText(/Program Manager — Summit PM/)).toBeInTheDocument();
    expect(screen.getByText("Link expired")).toBeInTheDocument();

    await user.click(screen.getByText("Pat Broker"));
    expect(screen.getByText("What they can open")).toBeInTheDocument();
    expect(screen.getAllByText("Suspend role").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Access packs" }));
    expect(screen.getAllByText("Customer support").length).toBeGreaterThan(0);
    expect(screen.getByText("EDITED")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    expect(screen.getByText(/Changes apply immediately/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByText("Permission")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview & demo" }));
    await user.click(screen.getByRole("button", { name: "Broker + rep + Program Manager head" }));
    expect(screen.getAllByText("Partner portal").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Import existing" }));
    expect(screen.getByRole("button", { name: "Import existing accounts" })).toBeEnabled();
  });

  test("the invite form starts empty and adds roles", async () => {
    const user = userEvent.setup();
    render(<AccessAdmin />);
    await user.click(screen.getByRole("button", { name: /Invite person/ }));
    await user.click(screen.getByRole("button", { name: /Add a role/ }));
    await user.click(screen.getByRole("button", { name: /Add a role/ }));
    expect(screen.getByText("Role 2")).toBeInTheDocument();
  });
});
