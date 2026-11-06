// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheckoutIntake } from "./CheckoutIntake";
const done = vi.fn();
beforeEach(() => {
  done.mockReset();
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("existing users must confirm a valid census form before signing", () => {
  render(
    <CheckoutIntake
      userId="user1"
      email="member@example.test"
      firstName="Pat"
      lastName="Member"
      onComplete={done}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm member details" }),
  );
  expect(done).not.toHaveBeenCalled();
  for (const [label, value] of [
    [/Date of birth/, "02/30/1990"],
    ["Street address", "123 Main St"],
    ["City", "Columbus"],
    [/State/, "OH"],
    ["ZIP code", "43215"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm member details" }),
  );
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(done).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Date of birth/), {
    target: { value: "01/15/1990" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm member details" }),
  );
  expect(done).toHaveBeenCalledWith(
    expect.objectContaining({ firstName: "Pat", dateOfBirth: "1990-01-15" }),
  );
  expect(screen.getByRole("status").textContent).toContain(
    "Member details confirmed",
  );
});
test("does not prefill another account's signup information", () => {
  sessionStorage.setItem(
    "careington_profile",
    JSON.stringify({
      email: "other@example.test",
      dateOfBirth: "1990-01-01",
      address: { line1: "Private Address" },
    }),
  );
  render(
    <CheckoutIntake
      userId="user2"
      email="member@example.test"
      firstName="Pat"
      onComplete={done}
    />,
  );
  expect(
    (screen.getByLabelText("Street address") as HTMLInputElement).value,
  ).toBe("");
});
