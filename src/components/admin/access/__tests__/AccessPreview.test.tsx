// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";

vi.mock("convex/react", () => ({ useQuery: () => undefined }));

import { AccessPreview } from "../shared";

afterEach(cleanup);

describe("AccessPreview", () => {
  test("lists what each portal opens and flags sensitive permissions", () => {
    render(<AccessPreview permissions={["members.view", "support.use", "partner.book"]} />);
    expect(screen.getByText(/Sensitive: View members, Customer service/)).toBeInTheDocument();
    const admin = screen.getByText("Admin console").closest("div")!.parentElement!;
    expect(within(admin).getByText(/3 of \d+ pages/)).toBeInTheDocument();
    const employer = screen.getByText("Employer portal").closest("div")!.parentElement!;
    expect(within(employer).getByText("No access")).toBeInTheDocument();
  });

  test("says plainly when someone has no access at all", () => {
    render(<AccessPreview permissions={[]} />);
    expect(screen.getByText(/every portal is closed/)).toBeInTheDocument();
  });
});
