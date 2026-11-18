import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";

const mocks = vi.hoisted(() => ({
  options: vi.fn(),
  auth: vi.fn(),
  lookup: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", async (original) => ({
  ...(await original<typeof import("@clerk/nextjs/server")>()),
  clerkMiddleware:
    (
      handler: (auth: typeof mocks.auth, request: NextRequest) => unknown,
      options: (request: NextRequest) => unknown,
    ) =>
    async (request: NextRequest) => {
      mocks.options(options(request));
      return handler(mocks.auth, request);
    },
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = mocks.lookup;
    mutation = vi.fn();
  },
}));
import proxy from "./proxy";
import { MERGED_SERVICE_PAGES } from "./lib/assure-service-links";
const event = {} as NextFetchEvent;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  mocks.lookup.mockResolvedValue(null);
  mocks.signIn.mockReturnValue(
    NextResponse.redirect("https://www.getidealoh.com/assurevantage/sign-in"),
  );
  mocks.auth.mockResolvedValue({
    userId: null,
    redirectToSignIn: mocks.signIn,
  });
});

test("the Assure entry returns to its own homepage and preserves referral parameters", async () => {
  const response = await proxy(
    new NextRequest("https://www.assurevantage.com/assurevantage?ref=100001"),
    event,
  );
  expect(response?.headers.get("location")).toBe(
    "https://www.assurevantage.com/?ref=100001",
  );
  expect(mocks.options).not.toHaveBeenCalled();
});

test("a signed-out member scan uses Clerk's primary-domain redirect with the original destination", async () => {
  await proxy(
    new NextRequest(
      "https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan",
    ),
    event,
  );
  expect(mocks.options).toHaveBeenCalledWith(
    expect.objectContaining({ isSatellite: true, domain: "assurevantage.com" }),
  );
  expect(mocks.signIn).toHaveBeenCalledWith({
    returnBackUrl:
      "https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan",
  });
});

test("Ideal's existing member sign-in keeps its relative return path", async () => {
  const response = await proxy(
    new NextRequest(
      "https://www.getidealoh.com/health/dashboard?tab=oral-scan",
    ),
    event,
  );
  const target = new URL(response!.headers.get("location")!);
  expect(target.pathname).toBe("/health/sign-in");
  expect(target.searchParams.get("redirect_url")).toBe(
    "/health/dashboard?tab=oral-scan",
  );
});

test("public webhook endpoints do not start a satellite auth handshake", async () => {
  const response = await proxy(
    new NextRequest("https://www.assurevantage.com/api/stripe/webhook", {
      method: "POST",
    }),
    event,
  );
  expect(response!.status).toBe(200);
  expect(mocks.options).not.toHaveBeenCalled();
});

test.each([
  ["www.assurevantage.com", "/assurevantage/essentials"],
  ["www.getidealoh.com", "/newideal/essentials"],
])(
  "broker vanity links preserve attribution on %s",
  async (host, destination) => {
    mocks.lookup.mockResolvedValue({
      repCode: "100001",
      productHint: "essentials",
    });
    const response = await proxy(
      new NextRequest(`https://${host}/samplebroker`),
      event,
    );
    expect(response!.headers.get("location")).toBe(
      `https://${host}${destination}?ref=100001`,
    );
    expect(response!.headers.get("set-cookie")).toContain("ideal_ref=100001");
  },
);

test("new-brand marketing on an Ideal URL moves to Assure without changing Ideal's homepage", async () => {
  const response = await proxy(
    new NextRequest(
      "https://www.getidealoh.com/assurevantage/essentials?ref=100001",
    ),
    event,
  );
  expect(response!.headers.get("location")).toBe(
    "https://www.assurevantage.com/assurevantage/essentials?ref=100001",
  );
  expect(mocks.options).not.toHaveBeenCalled();
});

test("Ideal's homepage stays on Ideal and Clerk's shared sign-in remains reachable", async () => {
  for (const path of [
    "/",
    "/health",
    "/newideal/essentials",
    "/assurevantage/sign-in",
    "/assurevantage/sign-up",
    "/assurevantage/sso-callback",
  ]) {
    const response = await proxy(
      new NextRequest(`https://www.getidealoh.com${path}`),
      event,
    );
    expect(response?.headers.get("location")).toBeFalsy();
  }
});

test("signed-out plan management returns through the protected Assure account flow", async () => {
  await proxy(
    new NextRequest("https://www.assurevantage.com/assurevantage/manage-plans"),
    event,
  );
  expect(mocks.signIn).toHaveBeenCalledWith({
    returnBackUrl: "https://www.assurevantage.com/assurevantage/manage-plans",
  });
});

test.each(Object.entries(MERGED_SERVICE_PAGES))(
  "%s redirects permanently to its membership section and preserves referral parameters",
  async (service, parent) => {
    const response = await proxy(new NextRequest(`https://www.assurevantage.com/assurevantage/${service}?ref=100001&utm_source=email`), event);
    expect(response!.status).toBe(308);
    expect(response!.headers.get("location")).toBe(`https://www.assurevantage.com/assurevantage/${parent}?ref=100001&utm_source=email#${service}`);
    expect(mocks.options).not.toHaveBeenCalled();
  },
);

test("legacy service pages and both public checkouts retain their destinations", async () => {
  for (const host of ["www.assurevantage.com", "www.getidealoh.com"]) {
    for (const path of ["/assurevantage/program-checkout", "/assurevantage/program-success"]) {
      const response = await proxy(new NextRequest(`https://${host}${path}`), event);
      expect(response?.headers.get("location")).toBeFalsy();
    }
  }
  for (const path of ["/health/teledentistry", "/health/oral-health-scan", "/health/discount", "/newideal/essentials", "/newideal/balance-for-life", "/legacy-group/teledentistry"]) {
    const response = await proxy(new NextRequest(`https://www.getidealoh.com${path}`), event);
    expect(response?.headers.get("location")).toBeFalsy();
  }
  expect(mocks.auth).not.toHaveBeenCalled();
});
