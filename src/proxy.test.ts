import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";

const mocks = vi.hoisted(() => ({ options: vi.fn(), auth: vi.fn(), lookup: vi.fn(), signIn: vi.fn() }));
vi.mock("@clerk/nextjs/server", async original => ({
  ...(await original<typeof import("@clerk/nextjs/server")>()),
  clerkMiddleware: (handler: (auth: typeof mocks.auth, request: NextRequest) => unknown, options: (request: NextRequest) => unknown) => async (request: NextRequest) => {
    mocks.options(options(request));
    return handler(mocks.auth, request);
  },
}));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { query = mocks.lookup; mutation = vi.fn(); } }));
import proxy from "./proxy";
const event = {} as NextFetchEvent;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  mocks.lookup.mockResolvedValue(null);
  mocks.signIn.mockReturnValue(NextResponse.redirect("https://www.getidealoh.com/assurevantage/sign-in"));
  mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn: mocks.signIn });
});

test("the old brand entry returns to the shared homepage and preserves referral parameters", async () => {
  const response = await proxy(new NextRequest("https://www.assurevantage.com/assurevantage?ref=100001"), event);
  expect(response?.headers.get("location")).toBe("https://www.assurevantage.com/?ref=100001");
  expect(mocks.options).not.toHaveBeenCalled();
});

test("a signed-out member scan uses Clerk's primary-domain redirect with the original destination", async () => {
  await proxy(new NextRequest("https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan"), event);
  expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ isSatellite: true, domain: "assurevantage.com" }));
  expect(mocks.signIn).toHaveBeenCalledWith({ returnBackUrl: "https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan" });
});

test("Ideal's existing member sign-in keeps its relative return path", async () => {
  const response = await proxy(new NextRequest("https://www.getidealoh.com/health/dashboard?tab=oral-scan"), event);
  const target = new URL(response!.headers.get("location")!);
  expect(target.pathname).toBe("/health/sign-in");
  expect(target.searchParams.get("redirect_url")).toBe("/health/dashboard?tab=oral-scan");
});

test("public webhook endpoints do not start a satellite auth handshake", async () => {
  const response = await proxy(new NextRequest("https://www.assurevantage.com/api/stripe/webhook", { method: "POST" }), event);
  expect(response!.status).toBe(200);
  expect(mocks.options).not.toHaveBeenCalled();
});

test.each([
  ["www.assurevantage.com", "/assurevantage/essentials"],
  ["www.getidealoh.com", "/newideal/essentials"],
])("broker vanity links preserve attribution on %s", async (host, destination) => {
  mocks.lookup.mockResolvedValue({ repCode: "100001", productHint: "essentials" });
  const response = await proxy(new NextRequest(`https://${host}/samplebroker`), event);
  expect(response!.headers.get("location")).toBe(`https://${host}${destination}?ref=100001`);
  expect(response!.headers.get("set-cookie")).toContain("ideal_ref=100001");
});
