// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SatelliteAuthRedirect } from "./SatelliteAuthRedirect";

const mocks = vi.hoisted(() => ({
  loaded: true,
  clerkLoaded: true,
  signedIn: false,
  satellite: true,
  path: "/assurevantage/checkout",
  query: "plan=family&ref=100001",
  replace: vi.fn(),
  signIn: vi.fn(
    () => "https://www.getidealoh.com/assurevantage/sign-in?clerk-sync=1",
  ),
  signUp: vi.fn(
    () => "https://www.getidealoh.com/assurevantage/sign-up?clerk-sync=1",
  ),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: mocks.loaded, isSignedIn: mocks.signedIn }),
  useClerk: () => ({
    loaded: mocks.clerkLoaded,
    buildSignInUrl: mocks.signIn,
    buildSignUpUrl: mocks.signUp,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.path,
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock("@/lib/auth-return", async (original) => ({
  ...(await original<typeof import("@/lib/auth-return")>()),
  replaceAuthLocation: mocks.replace,
}));
vi.mock("@/lib/site-domains", () => ({
  PRIMARY_AUTH_ORIGIN: "https://www.getidealoh.com",
  ASSURE_ORIGIN: "https://www.assurevantage.com",
  domainSite: () =>
    mocks.satellite
      ? { slug: "assurevantage", origin: "https://www.assurevantage.com" }
      : null,
}));
beforeEach(() => {
  mocks.loaded = true;
  mocks.clerkLoaded = true;
  mocks.signedIn = false;
  mocks.satellite = true;
  mocks.query = "plan=family&ref=100001";
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("satellite account entry", () => {
  test("uses Clerk's sync-aware URL builder and returns to the same checkout with the broker code", async () => {
    render(
      <SatelliteAuthRedirect mode="checkout">
        <div>Checkout fields</div>
      </SatelliteAuthRedirect>,
    );
    const destination =
      "https://www.assurevantage.com/assurevantage/checkout?plan=family&ref=100001";
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith({
        signInForceRedirectUrl: destination,
        signUpForceRedirectUrl: destination,
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("clerk-sync=1"),
    );
    const target = new URL(mocks.replace.mock.calls[0][0]);
    expect(target.searchParams.get("redirect_url")).toBe(destination);
    expect(target.searchParams.get("clerk-sync")).toBe("1");
    expect(screen.queryByText("Checkout fields")).toBeNull();
  });
  test("allows the signed-in member to continue checkout on the satellite", () => {
    mocks.signedIn = true;
    render(
      <SatelliteAuthRedirect mode="checkout">
        <div>Checkout fields</div>
      </SatelliteAuthRedirect>,
    );
    expect(screen.getByText("Checkout fields")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  test("keeps existing primary-domain inline account entry unchanged", () => {
    mocks.satellite = false;
    render(
      <SatelliteAuthRedirect mode="checkout">
        <div>Checkout fields</div>
      </SatelliteAuthRedirect>,
    );
    expect(screen.getByText("Checkout fields")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  test("waits for Clerk to load before redirecting", () => {
    mocks.loaded = false;
    render(
      <SatelliteAuthRedirect mode="sign-in">
        <div>Credentials</div>
      </SatelliteAuthRedirect>,
    );
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeTruthy();
  });
  test("waits for browser Clerk even when server auth is already loaded", () => {
    mocks.clerkLoaded = false;
    const view = render(
      <SatelliteAuthRedirect mode="checkout">
        <div>Checkout fields</div>
      </SatelliteAuthRedirect>,
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.clerkLoaded = true;
    view.rerender(
      <SatelliteAuthRedirect mode="checkout">
        <div>Checkout fields</div>
      </SatelliteAuthRedirect>,
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("clerk-sync=1"),
    );
  });
  test("preserves the member scan destination through sign-up", async () => {
    mocks.query =
      "redirect_url=" +
      encodeURIComponent("/assurevantage/dashboard?tab=oral-scan");
    render(
      <SatelliteAuthRedirect mode="sign-up">
        <div>Credentials</div>
      </SatelliteAuthRedirect>,
    );
    const destination =
      "https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan";
    await waitFor(() =>
      expect(mocks.signUp).toHaveBeenCalledWith({
        signInForceRedirectUrl: destination,
        signUpForceRedirectUrl: destination,
      }),
    );
    expect(
      new URL(mocks.replace.mock.calls[0][0]).searchParams.get("redirect_url"),
    ).toBe(destination);
  });
});

test("password reset opens the actual reset form and keeps the original destination", async () => {
  mocks.query =
    "redirect_url=" +
    encodeURIComponent(
      "https://www.assurevantage.com/assurevantage/program-checkout?ref=100001",
    );
  render(
    <SatelliteAuthRedirect mode="reset">
      <div>Reset</div>
    </SatelliteAuthRedirect>,
  );
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  const url = new URL(mocks.replace.mock.calls[0][0]);
  expect(url.pathname).toBe("/assurevantage/forgot-password");
  expect(url.searchParams.get("redirect_url")).toBe(
    "https://www.assurevantage.com/assurevantage/program-checkout?ref=100001",
  );
  expect(url.searchParams.get("clerk-sync")).toBe("1");
});

test("employer account entry returns to eligibility uploads on the satellite", async () => {
  mocks.query = "redirect_url=" + encodeURIComponent("/employer/upload");
  render(
    <SatelliteAuthRedirect mode="sign-in">
      <div>Sign in</div>
    </SatelliteAuthRedirect>,
  );
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  expect(
    new URL(mocks.replace.mock.calls[0][0]).searchParams.get("redirect_url"),
  ).toBe("https://www.assurevantage.com/employer/upload");
});
