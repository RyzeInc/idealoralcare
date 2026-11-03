// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RootPage, { metadata } from "@/app/page";
import { programLink } from "../program-brand";
import { domainEntryPath } from "../site-domains";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("ref=100401"), usePathname: () => "/" }));
vi.mock("next/image", () => ({ default: ({ priority, fill, ...props }: { priority?: boolean; fill?: boolean; src: string; alt: string }) => { void priority; void fill; return <img {...props} />; } }));
afterEach(cleanup);

test("both public domains serve the shared three-program AssureVantage chooser", () => {
  for (const host of ["www.assurevantage.com", "assurevantage.com", "www.getidealoh.com", "getidealoh.com"]) expect(domainEntryPath(host, "/")).toBeNull();
  render(<RootPage />);
  expect(screen.getByAltText("AssureVantage")).toBeTruthy();
  expect(screen.getByText("Welcome to AssureVantage")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Everyday care, real savings");
  expect(screen.getByRole("link", { name: /Oral Savings Plans/ }).getAttribute("href")).toBe("/assurevantage/plans?ref=100401");
  expect(screen.getByRole("link", { name: /^Balance for Life/ }).getAttribute("href")).toBe("/assurevantage/balance-for-life?ref=100401");
  expect(screen.getByRole("link", { name: /Essentials Bundle/ }).getAttribute("href")).toBe("/assurevantage/essentials?ref=100401");
  expect(metadata.title).toContain("AssureVantage");
});

test.each([
  ["/newideal", "/assurevantage"],
  ["/newideal/essentials", "/assurevantage/essentials"],
  ["/newideal/balance-for-life", "/assurevantage/balance-for-life"],
  ["/newideal/plans?ref=100401", "/assurevantage/program-plans?ref=100401"],
  ["/newideal/checkout", "/assurevantage/program-checkout"],
  ["/newideal/success?program=bfl", "/assurevantage/program-success?program=bfl"],
])("primary program navigation maps %s while legacy navigation stays intact", (legacy, primary) => {
  expect(programLink(legacy, true)).toBe(primary);
  expect(programLink(legacy, false)).toBe(legacy);
});
