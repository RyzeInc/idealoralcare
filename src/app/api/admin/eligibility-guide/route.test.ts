// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), setAuth: vi.fn(), readFile: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { query = mocks.query; setAuth = mocks.setAuth; } }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
import { GET } from "./route";

describe("internal eligibility guide download", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "staff", getToken: vi.fn().mockResolvedValue("session-token") });
    mocks.readFile.mockResolvedValue(Buffer.from("%PDF-1.4 example"));
  });
  it("does not read the guide for an anonymous visitor", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("requires a backend authentication token", async () => {
    mocks.auth.mockResolvedValue({ userId: "staff", getToken: vi.fn().mockResolvedValue(null) });
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("denies signed-in users without a staff record", async () => {
    mocks.query.mockResolvedValue(false);
    expect((await GET()).status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("serves the PDF privately to staff", async () => {
    mocks.query.mockResolvedValue(true);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toMatch(/^%PDF/);
    expect(mocks.setAuth).toHaveBeenCalledWith("session-token");
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { clerkUserId: "staff" });
  });
});
